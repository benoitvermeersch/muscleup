/* =====================================================================
   MuscleUp — profiles and the leaderboard feed
   =====================================================================

   Exposes `MuProfiles`:

     mine()                  → the signed-in user's profile (cached, may be null)
     load()                  → Promise<profile|null>, refreshes the cache
     save({username, firstName, lastName})  → Promise<profile>
     list()                  → Promise<[profile]>, every registered athlete
     pushStats()             → Promise, publishes my rep totals + favourite
     displayName(profile)    → what to show on the leaderboard
     checkUsername(name)     → Promise<null|string> (an error message)
     onChange(fn)            → fires when my profile or its stats change

   Two backends, matching MuAuth:

     remote — a `public.profiles` row per account in Supabase, created by a
              trigger on auth.users so *every* registered user is listed
              even before they fill anything in. Readable by everyone,
              writable only by its owner (see supabase/schema.sql).
     local  — the browser's own `mu-users` table, with each account's
              profile under `mu-profile:<id>`. Rep totals are read straight
              off the device, so nothing needs publishing.

   Emails are deliberately never stored on a profile: the table is world
   readable, and a leaderboard is no place to leak everybody's address.
   ===================================================================== */

(function (global) {
  "use strict";

  const CFG = global.MU_AUTH_CONFIG || {};
  const SB_URL = String(CFG.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const SB_KEY = String(CFG.SUPABASE_ANON_KEY || "").trim();
  const REMOTE = Boolean(SB_URL && SB_KEY);

  const PROFILE_BASE = "mu-profile";
  const USERS_KEY = "mu-users";

  const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

  const COLUMNS =
    "id,username,first_name,last_name,total_reps,category_reps,top_category," +
    "favourite_skill,favourite_skill_label,created_at";

  /* ------------------------------------------------------------------
     Storage helpers
     ------------------------------------------------------------------ */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) {}
  }

  const uid = () => {
    const user = global.MuAuth && global.MuAuth.currentUser();
    return user ? user.id : null;
  };

  /* ------------------------------------------------------------------
     Shape coming out of either backend
     ------------------------------------------------------------------ */
  function normalise(row) {
    if (!row) return null;
    return {
      id: row.id,
      username: row.username || null,
      firstName: row.first_name || null,
      lastName: row.last_name || null,
      totalReps: Number(row.total_reps) || 0,
      categoryReps: row.category_reps || {},
      topCategory: row.top_category || null,
      favouriteSkill: row.favourite_skill || null,
      // the stored label is a snapshot; prefer the live one if the skill
      // still exists, so renaming a skill doesn't strand old rows
      favouriteSkillLabel:
        (row.favourite_skill && global.MuSkills.skillLabel(row.favourite_skill)) ||
        row.favourite_skill_label ||
        null,
      createdAt: row.created_at || null,
    };
  }

  // Never the email — this is shown to every other athlete.
  function displayName(profile) {
    if (!profile) return "Athlete";
    if (profile.username) return profile.username;
    const full = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    if (full) return full;
    return `Athlete ${String(profile.id || "").slice(0, 4) || "—"}`;
  }

  function fullName(profile) {
    if (!profile) return "";
    return [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  }

  /* ------------------------------------------------------------------
     Validation — the same rules on both backends
     ------------------------------------------------------------------ */
  function validateUsername(name) {
    const value = String(name || "").trim();
    if (!value) return "Pick a username — it's the name other athletes see.";
    if (value.length < 3) return "Usernames are at least 3 characters.";
    if (value.length > 20) return "Usernames are at most 20 characters.";
    if (!USERNAME_RE.test(value)) return "Use letters, numbers and underscores only.";
    return null;
  }

  function validateName(value, which) {
    const v = String(value || "").trim();
    if (!v) return `Enter your ${which}.`;
    if (v.length > 40) return `That ${which} is too long (40 characters max).`;
    return null;
  }

  /* ------------------------------------------------------------------
     Supabase REST
     ------------------------------------------------------------------ */
  async function rest(path, options) {
    const opts = options || {};
    const method = opts.method || "GET";

    const send = (token) =>
      fetch(SB_URL + "/rest/v1" + path, {
        method,
        headers: Object.assign(
          { apikey: SB_KEY, "Content-Type": "application/json" },
          token ? { Authorization: `Bearer ${token}` } : {},
          opts.prefer ? { Prefer: opts.prefer } : {}
        ),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });

    let token = opts.auth ? global.MuAuth.accessToken() : null;
    let res = await send(token);

    // an hour-old access token is the usual cause — refresh once, then retry
    if (res.status === 401 && opts.auth) {
      const fresh = await global.MuAuth.refreshSession();
      if (!fresh) throw new Error("Your session expired — log in again.");
      res = await send(fresh);
    }

    let payload = null;
    try { payload = await res.json(); } catch (err) { payload = null; }

    if (!res.ok) throw restError(payload, res.status);
    return payload;
  }

  function restError(payload, status) {
    const code = String((payload && payload.code) || "");
    const message = String((payload && (payload.message || payload.hint)) || "");

    // the schema hasn't been applied to this Supabase project yet
    if (code === "PGRST205" || code === "42P01" || /relation .*profiles.* does not exist/i.test(message)) {
      const err = new Error(
        "The profiles table doesn't exist in this Supabase project yet. " +
        "Run supabase/schema.sql in the Supabase SQL editor to create it."
      );
      err.code = "no_table";
      return err;
    }
    if (code === "23505" || /duplicate key|already exists/i.test(message)) {
      const err = new Error("That username is already taken — try another.");
      err.code = "username_taken";
      return err;
    }
    if (code === "42501" || status === 403) {
      const err = new Error("You can only edit your own profile.");
      err.code = "forbidden";
      return err;
    }
    if (status === 401) {
      const err = new Error("Your session expired — log in again.");
      err.code = "unauthorised";
      return err;
    }
    const err = new Error(message || `Something went wrong (HTTP ${status}).`);
    err.code = code || String(status);
    return err;
  }

  /* ------------------------------------------------------------------
     Local backend
     ------------------------------------------------------------------ */
  const localProfileKey = (id) => `${PROFILE_BASE}:${id}`;

  function localAccounts() {
    const users = readJSON(USERS_KEY, {}) || {};
    return Object.keys(users)
      .map((email) => users[email])
      .filter((u) => u && u.id);
  }

  function localProfile(id) {
    const stored = readJSON(localProfileKey(id), null) || {};
    const stats = global.MuSkills.statsFor(id);
    return normalise({
      id,
      username: stored.username,
      first_name: stored.first_name,
      last_name: stored.last_name,
      total_reps: stats.totalReps,
      category_reps: stats.categoryReps,
      top_category: stats.topCategory,
      favourite_skill: stats.favouriteSkill,
      favourite_skill_label: stats.favouriteSkillLabel,
      created_at: stored.created_at || null,
    });
  }

  /* ------------------------------------------------------------------
     Cache + change notification
     ------------------------------------------------------------------ */
  let cached = null;
  let loadedFor = null;   // which account `cached` belongs to
  const listeners = [];

  function emit() {
    listeners.forEach((fn) => {
      try { fn(cached); } catch (err) { console.error(err); }
    });
  }

  // Only announce a profile that actually changed. A republish of identical
  // stats must stay silent, or a listener that re-syncs on change (the
  // leaderboard does) would drive itself in a loop.
  function setCached(next) {
    const before = JSON.stringify(cached === undefined ? null : cached);
    const after = JSON.stringify(next === undefined ? null : next);
    cached = next;
    if (before !== after) emit();
  }

  function mine() { return cached; }

  async function load() {
    const id = uid();
    if (!id) { loadedFor = null; setCached(null); return null; }

    let next;
    if (REMOTE) {
      const rows = await rest(`/profiles?select=${COLUMNS}&id=eq.${encodeURIComponent(id)}`);
      // no row yet (schema applied after this account signed up) — the first
      // save will upsert one, so treat it as an empty profile for now
      next = normalise((rows && rows[0]) || { id });
    } else {
      next = localProfile(id);
    }
    loadedFor = id;
    setCached(next);
    return cached;
  }

  /* ------------------------------------------------------------------
     Saving the profile
     ------------------------------------------------------------------ */
  async function checkUsername(name) {
    const invalid = validateUsername(name);
    if (invalid) return invalid;

    const id = uid();
    const value = String(name).trim();

    if (REMOTE) {
      // An exact match is caught here for a friendly inline message; the
      // database index is case-insensitive, so a "Ben" vs "ben" clash comes
      // back from the save as a 23505 and gets the same wording.
      const rows = await rest(
        `/profiles?select=id&username=eq.${encodeURIComponent(value)}&limit=1`
      );
      const taken = rows && rows[0] && rows[0].id !== id;
      return taken ? "That username is already taken — try another." : null;
    }

    const clash = localAccounts().some((u) => {
      if (u.id === id) return false;
      const stored = readJSON(localProfileKey(u.id), null);
      return stored && String(stored.username || "").toLowerCase() === value.toLowerCase();
    });
    return clash ? "That username is already taken — try another." : null;
  }

  async function save(fields) {
    const id = uid();
    if (!id) throw new Error("Log in to edit your profile.");

    const username = String(fields.username || "").trim();
    const firstName = String(fields.firstName || "").trim();
    const lastName = String(fields.lastName || "").trim();

    const problem =
      validateUsername(username) ||
      validateName(firstName, "first name") ||
      validateName(lastName, "last name");
    if (problem) throw new Error(problem);

    const taken = await checkUsername(username);
    if (taken) throw new Error(taken);

    let saved;
    if (REMOTE) {
      const stats = global.MuSkills.stats();
      const row = {
        id,
        username,
        first_name: firstName,
        last_name: lastName,
        total_reps: stats.totalReps,
        category_reps: stats.categoryReps,
        top_category: stats.topCategory,
        favourite_skill: stats.favouriteSkill,
        favourite_skill_label: stats.favouriteSkillLabel,
        updated_at: new Date().toISOString(),
      };
      // upsert: the trigger normally created the row at signup, but this also
      // covers accounts that pre-date the schema being applied
      const rows = await rest("/profiles", {
        method: "POST",
        body: [row],
        prefer: "resolution=merge-duplicates,return=representation",
        auth: true,
      });
      saved = normalise(merge(row, rows && rows[0]));
    } else {
      const stored = readJSON(localProfileKey(id), null) || {};
      writeJSON(localProfileKey(id), {
        username,
        first_name: firstName,
        last_name: lastName,
        created_at: stored.created_at || new Date().toISOString(),
      });
      saved = localProfile(id);
    }

    loadedFor = id;
    setCached(saved);
    return cached;
  }

  /* ------------------------------------------------------------------
     Publishing rep totals

     The tree keeps its reps in localStorage, which no one else can read, so
     the aggregate the leaderboard needs is pushed up whenever it changes.
     Local mode reads the device directly and needs none of this.
     ------------------------------------------------------------------ */
  async function pushStats() {
    const id = uid();
    if (!id || !REMOTE) return null;

    const stats = global.MuSkills.stats();
    const row = {
      id,
      total_reps: stats.totalReps,
      category_reps: stats.categoryReps,
      top_category: stats.topCategory,
      favourite_skill: stats.favouriteSkill,
      favourite_skill_label: stats.favouriteSkillLabel,
      updated_at: new Date().toISOString(),
    };

    const rows = await rest("/profiles", {
      method: "POST",
      body: [row],
      prefer: "resolution=merge-duplicates,return=representation",
      auth: true,
    });

    // this write carries no name fields, so merge the response over what we
    // already hold rather than replacing it — a stats push must never blank
    // out the username someone is halfway through editing
    setCached(normalise(merge(row, rows && rows[0])));
    return cached;
  }

  // current cache → written columns → whatever the server echoed back
  function merge(written, returned) {
    const base = cached
      ? {
          id: cached.id,
          username: cached.username,
          first_name: cached.firstName,
          last_name: cached.lastName,
          total_reps: cached.totalReps,
          category_reps: cached.categoryReps,
          top_category: cached.topCategory,
          favourite_skill: cached.favouriteSkill,
          favourite_skill_label: cached.favouriteSkillLabel,
          created_at: cached.createdAt,
        }
      : {};
    return Object.assign(base, written || {}, returned || {});
  }

  /* ------------------------------------------------------------------
     The leaderboard feed — everyone who ever registered
     ------------------------------------------------------------------ */
  async function list() {
    if (REMOTE) {
      // a row exists per auth user (created by the signup trigger), so this
      // is every registered account, not just the ones who filled a form in
      const rows = await rest(
        `/profiles?select=${COLUMNS}&order=total_reps.desc,created_at.asc`
      );
      return (rows || []).map(normalise);
    }

    return localAccounts()
      .map((u) => localProfile(u.id))
      .sort((a, b) => b.totalReps - a.totalReps || String(a.id).localeCompare(String(b.id)));
  }

  /* ------------------------------------------------------------------
     Keeping the published stats in step with the tree
     ------------------------------------------------------------------ */
  let pushTimer = 0;

  function schedulePush() {
    if (!REMOTE || !uid()) return;
    clearTimeout(pushTimer);
    // reps arrive in bursts (tap +25 four times) — publish once they settle
    pushTimer = setTimeout(() => {
      pushStats().catch((err) => console.warn("[MuscleUp] stats sync failed:", err.message));
    }, 900);
  }

  if (global.MuSkills) {
    global.MuSkills.onChange((reason) => {
      if (reason !== "reps" && reason !== "favourite") return;
      if (REMOTE) { schedulePush(); return; }

      // Local mode publishes nothing, but anything watching the profile —
      // the standings panel, the leaderboard — still needs to hear that the
      // numbers moved.
      const id = uid();
      if (id) setCached(localProfile(id));
    });
  }

  if (global.MuAuth) {
    global.MuAuth.onChange((user) => {
      if (!user) { loadedFor = null; setCached(null); return; }
      if (loadedFor === user.id) return;
      load()
        // whatever this device has logged is the truth for this account
        .then(() => schedulePush())
        .catch((err) => console.warn("[MuscleUp] profile load failed:", err.message));
    });
  }

  /* ------------------------------------------------------------------
     Export
     ------------------------------------------------------------------ */
  global.MuProfiles = {
    mode: REMOTE ? "remote" : "local",
    mine,
    load,
    save,
    list,
    pushStats,
    displayName,
    fullName,
    checkUsername,
    validateUsername,
    onChange(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
      };
    },
  };

  // first load for an already-signed-in visitor
  if (uid()) {
    load()
      .then(() => schedulePush())
      .catch((err) => console.warn("[MuscleUp] profile load failed:", err.message));
  }
})(window);
