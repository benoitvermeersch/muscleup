/* =====================================================================
   MuscleUp — skill data, rep progression and favourites
   =====================================================================

   Everything the tree *is*, separated from how it's drawn. The skill-tree
   overlay (js/script.js), the leaderboard and the profile page all read
   from here, so there is exactly one definition of the branches and one
   copy of the rep counters.

   Exposes `MuSkills`:

     CATEGORIES, FAMILY, RANKS, REPS_PER_RANK, UNLOCK_REPS, LEVELS
     repsOf(catKey, id)            → reps logged on one skill
     addRepsTo / setRepsTo         → log reps (persists + notifies)
     rankIndex(reps)               → 0..4 index into RANKS
     isUnlocked(cat, node)         → is this skill open yet
     prereqsOf(catKey, node)       → [{ catKey, id }] standing in its way
     skillByKey("push:pushup")     → { cat, node }
     getFavourite() / setFavourite / toggleFavourite / isFavourite
     hasAssessed() / applyAssessment(level, keys) / previewUnlocked(keys)
     isCleared(catKey, id)         → ticked at the sign-up check-in
     stats()                       → { totalReps, categoryReps, topCategory, … }
     statsFor(userId)              → the same, for any account on this device
     onChange(fn)                  → fires whenever reps or the favourite move

   Reps, the favourite and the check-in are stored per account (see
   MuAuth.scopedKey), so two people sharing a browser keep separate trees.
   ===================================================================== */

(function (global) {
  "use strict";

  /* ------------------------------------------------------------------
     Movement families — colour + icon per line of progression
     ------------------------------------------------------------------ */
  const FAMILY = {
    push:        { name: "Push-Ups",        color: "#e8873a", icon: "💪" },
    dip:         { name: "Dips",            color: "#d9a521", icon: "🔻" },
    pike:        { name: "Pike & Press",    color: "#2493b0", icon: "🔺" },
    handstand:   { name: "Handstand",       color: "#3fae6b", icon: "🙃" },
    planche:     { name: "Planche",         color: "#d6443c", icon: "🤸" },

    pull:        { name: "Pull-Ups",        color: "#3d86d6", icon: "🧗" },
    muscleup:    { name: "Muscle-Up",       color: "#d9a521", icon: "🔝" },
    frontLever:  { name: "Front Lever",     color: "#3fae6b", icon: "🦅" },
    backLever:   { name: "Back Lever",      color: "#20a89f", icon: "🔄" },
    hefesto:     { name: "Hefesto",         color: "#e8873a", icon: "🔥" },

    squat:       { name: "Squat",           color: "#3d86d6", icon: "🦵" },
    hamstring:   { name: "Hamstring",       color: "#d6443c", icon: "🌉" },

    hollow:      { name: "Hollow & Hang",   color: "#2493b0", icon: "🛶" },
    sit:         { name: "L-Sit Line",      color: "#20a89f", icon: "🪑" },
    flag:        { name: "Flags & Levers",  color: "#d152a3", icon: "🚩" },
    dragon:      { name: "Dragon Flag",     color: "#8a5cd0", icon: "🐉" },

    cardio:      { name: "Cardio",          color: "#20a89f", icon: "🏃" },
  };

  /* ------------------------------------------------------------------
     The five branches

     A node's prerequisites are its `parent` plus anything in `extra`.
     Both accept "id" for a skill in the same branch and "branch:id" for
     one in another — the tree is a wheel, and a few lines genuinely
     reach across it (a burpee is a squat and a push-up; hanging leg
     raises need a bar you can already hang from).

     `connector` says how those prerequisites combine:

       "AND"      every one of them has to reach Novice
       "OR"       any one of them opens the skill
       (omitted)  same as OR — an `extra` with no connector is a second
                  route in, never an extra hurdle

     `legendary` marks the end-of-line feats; `locked` is a hard gate
     that no amount of reps opens.
     ------------------------------------------------------------------ */
  const CATEGORIES = [
    {
      key: "push", label: "Push", icon: "💪", color: "#ff6b5e", complete: false,
      nodes: [
        // the push-up line itself
        { id: "inclinepush",   label: "Inclined Push-Up",  parent: "START",       fam: "push" },
        { id: "kneepush",      label: "Knee Push-Up",      parent: "inclinepush", fam: "push" },
        { id: "pushup",        label: "Push-Up",           parent: "kneepush",    fam: "push" },
        { id: "oapush",        label: "One-Arm Push-Up",   parent: "pushup",      fam: "push", legendary: true },
        { id: "explosivepush", label: "Explosive Push-Up", parent: "pushup",      fam: "push" },

        // dips
        { id: "dip",    label: "Dip",            parent: "pushup", fam: "dip" },
        { id: "impdip", label: "Impossible Dip", parent: "dip",    fam: "dip", legendary: true },

        // pike work — the road to a handstand
        { id: "pikepush",    label: "Pike Push-Up",          parent: "pushup",   fam: "pike" },
        { id: "diamondpush", label: "Diamond Push-Up",       parent: "pikepush", fam: "push" },
        { id: "elevpike",    label: "Elevated Pike Push-Up", parent: "pikepush", fam: "pike" },

        // handstand line
        { id: "hswall",      label: "Handstand Against the Wall",         parent: "elevpike",   fam: "handstand" },
        { id: "handstand",   label: "Handstand",                          parent: "hswall",     fam: "handstand", legendary: true },
        { id: "oahandstand", label: "One-Arm Handstand",                  parent: "handstand",  fam: "handstand", legendary: true },
        { id: "hspushwall",  label: "Handstand Push-Up Against the Wall", parent: "hswall",     fam: "handstand" },
        { id: "hspush",      label: "Handstand Push-Up",                  parent: "hspushwall", fam: "handstand" },
        { id: "hsclap",      label: "Handstand Clap Push-Up",             parent: "hspush",     fam: "handstand" },

        // straight-arm work — planche lean through to the planche
        { id: "planchelean", label: "Planche Lean",           parent: "pikepush",    fam: "planche" },
        { id: "pseudopp",    label: "Pseudo Planche Push-Up", parent: "planchelean", fam: "planche" },
        { id: "hold90",      label: "90° Hold",               parent: "pseudopp",    fam: "planche" },
        { id: "hs90push",    label: "90° Handstand Push-Up",  parent: "hold90",      fam: "handstand", extra: ["hspushwall"] },
        { id: "frogstand",   label: "Frog Stand",             parent: "diamondpush", fam: "planche" },
        { id: "elbowlever",  label: "Elbow Lever",            parent: "explosivepush", fam: "planche" },
        { id: "tuckplanche", label: "Tuck Planche",           parent: "frogstand",   fam: "planche", extra: ["elbowlever"] },

        { id: "straddleplanche", label: "Straddle Planche", parent: "tuckplanche", fam: "planche", legendary: true, connector: "OR", extra: ["hold90"] },
        { id: "planche",         label: "Planche",           parent: "straddleplanche", fam: "planche", legendary: true },
        { id: "planchepush",     label: "Planche Push-Up",   parent: "planche", fam: "planche" },
        { id: "maltese",         label: "Maltese",           parent: "planche", fam: "planche", legendary: true },
        { id: "oaplanche",       label: "One-Arm Planche",   parent: "planche", fam: "planche", legendary: true },
      ],
    },

    {
      key: "pull", label: "Pull", icon: "🧗", color: "#4eb0ff", complete: false,
      nodes: [
        // getting to a pull-up
        { id: "deadhang", label: "Dead Hang",                 parent: "START",    fam: "pull" },
        { id: "jumpneg",  label: "Jumping Negative Pull-Ups", parent: "deadhang", fam: "pull" },
        { id: "pullup",   label: "Pull-Up",                   parent: "jumpneg",  fam: "pull" },

        // variations off the bar
        { id: "auspull",    label: "Australian Pull-Up",   parent: "pullup",     fam: "pull" },
        { id: "chinup",     label: "Chin-Up",              parent: "auspull",    fam: "pull" },
        { id: "oadeadhang", label: "One-Arm Dead Hang",    parent: "pullup",     fam: "pull" },
        { id: "chesttobar", label: "Chest to Bar Pull-Up", parent: "pullup",     fam: "pull" },
        { id: "naveltobar", label: "Navel to Bar Pull-Up", parent: "chesttobar", fam: "pull" },

        // one arm
        { id: "oapull", label: "One-Arm Pull-Up",   parent: "pullup", fam: "pull",     legendary: true, connector: "OR", extra: ["oadeadhang"] },
        { id: "oamu",   label: "One-Arm Muscle-Up", parent: "oapull", fam: "muscleup", legendary: true },

        // muscle-up line
        { id: "muscleup",    label: "Muscle-Up",                 parent: "chesttobar", fam: "muscleup", legendary: true },
        { id: "mujump",      label: "Muscle-Up Jump on the Bar", parent: "muscleup",   fam: "muscleup" },
        { id: "mubackclap",  label: "Muscle-Up Back Clap",       parent: "muscleup",   fam: "muscleup" },
        { id: "explosivemu", label: "Explosive Muscle-Up",       parent: "muscleup",   fam: "muscleup" },

        // front lever line
        { id: "straddlefl", label: "Straddle Front Lever", parent: "naveltobar", fam: "frontLever" },
        { id: "frontlever", label: "Front Lever",          parent: "straddlefl", fam: "frontLever", legendary: true },
        { id: "oafl",       label: "One-Arm Front Lever",  parent: "frontlever", fam: "frontLever", legendary: true },
        { id: "flpu",       label: "Front Lever Pull-Up",  parent: "frontlever", fam: "frontLever" },
      ],
    },

    {
      key: "legs", label: "Legs", icon: "🦵", color: "#c084ff", complete: false,
      nodes: [
        { id: "lunge",  label: "Lunge",        parent: "START", fam: "squat" },
        { id: "squat",  label: "Squat",        parent: "lunge", fam: "squat" },
        { id: "pistol", label: "Pistol Squat", parent: "squat", fam: "squat" },
        { id: "nordic", label: "Nordic Curl",  parent: "lunge", fam: "hamstring" },

        // squat down, push up, jump — it needs both halves
        { id: "burpee", label: "Burpee", parent: "squat", fam: "squat", connector: "AND", extra: ["push:pushup"] },
      ],
    },

    {
      key: "core", label: "Core", icon: "🔥", color: "#ffd24e", complete: true,
      nodes: [
        { id: "boathold",  label: "Boat Hold",  parent: "START",    fam: "hollow" },
        { id: "plank",     label: "Plank",      parent: "boathold", fam: "hollow" },
        { id: "legraises", label: "Leg Raises", parent: "plank",    fam: "hollow" },
        { id: "hangingleg",label: "Hanging Leg Raises", parent: "legraises", fam: "hollow", connector: "AND", extra: ["pull:deadhang"] },

        // the L-sit line
        { id: "tucksit",  label: "Tuck Sit",      parent: "plank",   fam: "sit" },
        { id: "lsit",     label: "L-Sit",         parent: "tucksit", fam: "sit", legendary: true },
        { id: "lsitpull", label: "L-Sit Pull-Up", parent: "lsit",    fam: "sit", connector: "AND", extra: ["pull:pullup"] },
        { id: "vsit",     label: "V-Sit",         parent: "lsit",    fam: "sit", legendary: true },
        { id: "manna",    label: "Manna",         parent: "vsit",    fam: "sit", legendary: true },

        // Flags and levers: whole-body holds that grow out of the plank
        { id: "humanflag",   label: "Human Flag",         parent: "plank",     fam: "flag",      legendary: true },
        { id: "backlever",   label: "Back Lever",         parent: "plank",     fam: "backLever", legendary: true, extra: ["humanflag"] },
        { id: "dragonflag",  label: "Dragon Flag",        parent: "backlever", fam: "dragon",    legendary: true },
        { id: "oabacklever", label: "One-Arm Back Lever", parent: "backlever", fam: "backLever", legendary: true },
        { id: "hefesto",     label: "Hefesto",            parent: "backlever", fam: "hefesto",   legendary: true },
      ],
    },

    {
      key: "cardio", label: "Cardio", icon: "⚡", color: "#4ee0a8", complete: true,
      nodes: [
        { id: "jumpingjacks",label: "Jumping Jacks",   parent: "START",       fam: "cardio" },
        { id: "highknees",   label: "High Knees",      parent: "jumpingjacks",fam: "cardio" },
        { id: "burpee",      label: "Burpee",          parent: "highknees",   fam: "cardio" },
        { id: "mountain",    label: "Mountain Climbers",parent: "burpee",     fam: "cardio" },
        { id: "sprint",      label: "Sprint Intervals",parent: "mountain",    fam: "cardio" },
        { id: "jumprope",    label: "Jump Rope",       parent: "jumpingjacks",fam: "cardio" },
        { id: "burpeepull",  label: "Burpee Pull-Up",  parent: "burpee",      fam: "cardio", locked: true, lockReason: "Requires Pull-Up (Pull branch)" },
      ],
    },
  ];

  /* ------------------------------------------------------------------
     Progression rules
     ------------------------------------------------------------------ */

  // every 200 reps is a new rank; reaching Novice (200) unlocks the next skill
  const RANKS = ["Beginner", "Novice", "Intermediate", "Advanced", "Mastered"];
  const REPS_PER_RANK = 200;
  const UNLOCK_REPS = 200;

  /* ------------------------------------------------------------------
     Limits

     A set of 2,000 is already an absurd session, and anything past it is
     either a typo or someone poking at the form. It matters more than
     vanity: a number big enough to overflow a double becomes Infinity,
     JSON.stringify writes that as `null`, and the published total lands in
     Postgres as a null against a NOT NULL integer column. Clamp at the
     door and every layer behind it stays honest.
     ------------------------------------------------------------------ */
  const MAX_REPS_PER_ENTRY = 2000;      // one press of "Add reps"
  const MAX_REPS_PER_SKILL = 1000000;   // lifetime on a single skill
  const INT4_MAX = 2147483647;          // what a Postgres integer holds

  // any input → a whole, finite, non-negative number no larger than `max`
  function clamp(value, max) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, max);
  }

  /* ------------------------------------------------------------------
     The sign-up check-in

     Two steps. First you say roughly where you are — beginner,
     intermediate or advanced — and that decides *which* exercises the
     second step asks about: there is no point asking someone on their
     first push-up whether they hold a planche, and no point walking an
     advanced athlete through jumping jacks.

     Nothing here credits reps. Everyone starts on zero, however they
     answer; ticking an exercise only says "I can already do this",
     which opens the skills sitting above it (see `clearedState`). Tick
     more and more of the tree is open — that is the whole mechanism.
     ------------------------------------------------------------------ */
  const LEVELS = [
    {
      key: "beginner",
      label: "Beginner",
      icon: "🌱",
      blurb: "New to training, or coming back after a long break.",
      lead: "The ground floor of every branch. Tick what you can already manage with clean form.",
      skills: [
        { cat: "push",   id: "inclinepush",  target: "10 reps against a bench or wall" },
        { cat: "push",   id: "kneepush",     target: "10 reps on your knees" },
        { cat: "pull",   id: "deadhang",     target: "a 30-second hang" },
        { cat: "legs",   id: "lunge",        target: "10 reps each leg" },
        { cat: "legs",   id: "squat",        target: "20 bodyweight squats" },
        { cat: "core",   id: "boathold",     target: "a 30-second hold" },
        { cat: "core",   id: "plank",        target: "a 45-second plank" },
        { cat: "cardio", id: "jumpingjacks", target: "50 unbroken" },
        { cat: "cardio", id: "highknees",    target: "30 seconds at pace" },
        { cat: "cardio", id: "jumprope",     target: "50 skips without a trip" },
      ],
    },

    {
      key: "intermediate",
      label: "Intermediate",
      icon: "⚡",
      blurb: "Push-ups and squats are routine — you're chasing the pull-up and the dip.",
      lead: "The middle of each branch. The basics under these are taken as read once you tick one.",
      skills: [
        { cat: "push",   id: "pushup",        target: "15 full push-ups" },
        { cat: "push",   id: "explosivepush", target: "5 with the hands off the floor" },
        { cat: "push",   id: "dip",           target: "8 full-depth dips" },
        { cat: "push",   id: "pikepush",      target: "10 reps, hips high" },
        { cat: "push",   id: "diamondpush",   target: "10 with the hands together" },
        { cat: "pull",   id: "jumpneg",       target: "5 slow negatives" },
        { cat: "pull",   id: "pullup",        target: "5 dead-hang pull-ups" },
        { cat: "pull",   id: "auspull",       target: "12 body rows" },
        { cat: "pull",   id: "chinup",        target: "8 chin-ups" },
        { cat: "legs",   id: "pistol",        target: "3 each leg" },
        { cat: "legs",   id: "nordic",        target: "5 controlled reps" },
        { cat: "core",   id: "legraises",     target: "15 straight-leg raises" },
        { cat: "core",   id: "tucksit",       target: "a 20-second tuck sit" },
        { cat: "cardio", id: "burpee",        target: "20 unbroken" },
        { cat: "cardio", id: "mountain",      target: "45 seconds at pace" },
      ],
    },

    {
      key: "advanced",
      label: "Advanced",
      icon: "🔥",
      blurb: "Muscle-ups, handstands and levers are the language you train in.",
      lead: "The top of each branch. Ticking one takes everything below it on that line as read.",
      skills: [
        { cat: "push",   id: "elevpike",    target: "8 with the feet raised" },
        { cat: "push",   id: "hswall",      target: "a 45-second wall handstand" },
        { cat: "push",   id: "hspushwall",  target: "5 against the wall" },
        { cat: "push",   id: "handstand",   target: "a 15-second free handstand" },
        { cat: "push",   id: "oapush",      target: "3 one-arm push-ups a side" },
        { cat: "push",   id: "planchelean", target: "a 20-second lean" },
        { cat: "push",   id: "pseudopp",    target: "8 pseudo planche push-ups" },
        { cat: "push",   id: "frogstand",   target: "a 30-second frog stand" },
        { cat: "push",   id: "elbowlever",  target: "a 20-second elbow lever" },
        { cat: "push",   id: "tuckplanche", target: "a 15-second tuck planche" },
        { cat: "pull",   id: "chesttobar",  target: "8 chest-to-bar" },
        { cat: "pull",   id: "naveltobar",  target: "5 navel-to-bar" },
        { cat: "pull",   id: "muscleup",    target: "one clean muscle-up" },
        { cat: "pull",   id: "straddlefl",  target: "a 10-second straddle front lever" },
        { cat: "pull",   id: "frontlever",  target: "a 10-second front lever" },
        { cat: "core",   id: "lsit",        target: "a 20-second L-sit" },
        { cat: "core",   id: "humanflag",   target: "a 5-second flag" },
        { cat: "core",   id: "backlever",   target: "a 10-second back lever" },
        { cat: "cardio", id: "sprint",      target: "6 × 30-second sprints" },
      ],
    },
  ];

  function levelByKey(key) {
    return LEVELS.find((l) => l.key === key) || null;
  }

  /* ------------------------------------------------------------------
     Lookups
     ------------------------------------------------------------------ */
  function categoryByKey(key) {
    return CATEGORIES.find((c) => c.key === key) || null;
  }

  // "push:pushup" → { cat, node }; either may be null for stale keys
  function skillByKey(key) {
    const [catKey, id] = String(key || "").split(":");
    const cat = categoryByKey(catKey);
    const node = cat ? cat.nodes.find((n) => n.id === id) || null : null;
    return { cat, node };
  }

  function skillLabel(key) {
    const { node } = skillByKey(key);
    return node ? node.label : null;
  }

  /* ------------------------------------------------------------------
     Storage
     ------------------------------------------------------------------ */
  const REPS_BASE = "mu-reps";
  const FAV_BASE = "mu-favourite";
  const ASSESSED_BASE = "mu-assessed";   // the sign-up check-in flag
  const CLEARED_BASE = "mu-cleared";     // skills ticked at that check-in
  const LEVEL_BASE = "mu-level";         // beginner / intermediate / advanced

  function scoped(base, userId) {
    if (userId) return `${base}:${userId}`;
    if (global.MuAuth) return global.MuAuth.scopedKey(base);
    return base;
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  let repsState = {};
  let favourite = null;
  let clearedState = new Set();   // "cat:id" of everything the check-in ticked
  let level = null;

  // A browser holding a bad number from before the cap existed is repaired
  // on the next load rather than poisoning every total from then on. A count
  // *above* the per-skill ceiling can't have been reached through the UI —
  // adding clamps there — so it's overflow or tampering, and gets dropped
  // rather than parked at the ceiling where it would top the board forever.
  function sanitise(raw) {
    const clean = {};
    let changed = false;
    Object.keys(raw || {}).forEach((key) => {
      const stored = raw[key];
      const value = Number(stored) > MAX_REPS_PER_SKILL ? 0 : clamp(stored, MAX_REPS_PER_SKILL);
      if (value !== stored) changed = true;
      if (value > 0) clean[key] = value;
    });
    return { clean, changed };
  }

  function loadState() {
    const { clean, changed } = sanitise(readJSON(scoped(REPS_BASE), {}) || {});
    repsState = clean;
    if (changed) saveReps();
    try { favourite = localStorage.getItem(scoped(FAV_BASE)) || null; } catch (err) { favourite = null; }

    // a key naming a skill that no longer exists is dropped rather than
    // sitting in storage unlocking nothing
    const stored = readJSON(scoped(CLEARED_BASE), []) || [];
    clearedState = new Set(
      (Array.isArray(stored) ? stored : []).filter((key) => skillByKey(key).node)
    );
    try { level = localStorage.getItem(scoped(LEVEL_BASE)) || null; } catch (err) { level = null; }
  }
  loadState();

  function saveReps() {
    try { localStorage.setItem(scoped(REPS_BASE), JSON.stringify(repsState)); } catch (err) {}
  }

  function saveCleared() {
    try {
      localStorage.setItem(scoped(CLEARED_BASE), JSON.stringify(Array.from(clearedState)));
    } catch (err) {}
  }

  /* ------------------------------------------------------------------
     Change notification — the tree redraws, the leaderboard re-syncs
     ------------------------------------------------------------------ */
  const listeners = [];

  function emit(reason) {
    listeners.forEach((fn) => {
      try { fn(reason); } catch (err) { console.error(err); }
    });
  }

  /* ------------------------------------------------------------------
     Reps
     ------------------------------------------------------------------ */
  function repsOf(catKey, id) { return repsState[`${catKey}:${id}`] || 0; }

  // Returns how many reps were actually credited, which is less than asked
  // for when the entry cap bites — the popup uses it to say so.
  function addRepsTo(catKey, id, n) {
    const add = clamp(n, MAX_REPS_PER_ENTRY);
    if (!add) return 0;

    const k = `${catKey}:${id}`;
    repsState[k] = clamp((repsState[k] || 0) + add, MAX_REPS_PER_SKILL);
    saveReps();
    emit("reps");
    return add;
  }

  function setRepsTo(catKey, id, n) {
    const value = clamp(n, MAX_REPS_PER_SKILL);
    if (value > 0) repsState[`${catKey}:${id}`] = value;
    else delete repsState[`${catKey}:${id}`];
    saveReps();
    emit("reps");
    return value;
  }

  function rankIndex(reps) { return Math.min(RANKS.length - 1, Math.floor(reps / REPS_PER_RANK)); }

  /* ------------------------------------------------------------------
     Prerequisites

     A reference is "id" for a skill on the same branch or "branch:id"
     for one on another — see the note above CATEGORIES. `homeCat` is the
     branch the reference was written on, which is what a bare id means.
     ------------------------------------------------------------------ */
  function resolveRef(homeCat, ref) {
    const text = String(ref || "");
    const split = text.indexOf(":");
    return split === -1
      ? { catKey: homeCat, id: text }
      : { catKey: text.slice(0, split), id: text.slice(split + 1) };
  }

  // everything standing between you and this skill, in reading order
  function prereqsOf(catKey, node) {
    const refs = [];
    if (node.parent && node.parent !== "START") refs.push(resolveRef(catKey, node.parent));
    (node.extra || []).forEach((ref) => refs.push(resolveRef(catKey, ref)));
    return refs;
  }

  // A prerequisite is satisfied by training it to Novice, or by having
  // ticked it at the check-in — "I can already do this" is the same claim
  // 200 reps makes, minus the reps. `cleared` overrides the stored set so
  // the check-in can price a set of ticks before committing to them.
  function refMet(ref, cleared) {
    if ((cleared || clearedState).has(`${ref.catKey}:${ref.id}`)) return true;
    return repsOf(ref.catKey, ref.id) >= UNLOCK_REPS;
  }

  function isUnlocked(cat, node, cleared) {
    const refs = prereqsOf(cat.key, node);
    if (!refs.length) return true;   // sits on START — always open
    // AND wants every prerequisite at Novice. Anything else — an explicit
    // OR, or an `extra` that just marks a second way in — opens on the first.
    const met = (ref) => refMet(ref, cleared);
    return node.connector === "AND" ? refs.every(met) : refs.some(met);
  }

  function countUnlocked(cleared) {
    let n = 0;
    CATEGORIES.forEach((cat) => {
      cat.nodes.forEach((node) => { if (isUnlocked(cat, node, cleared)) n++; });
    });
    return n;
  }

  /* ------------------------------------------------------------------
     The check-in

     Ticking "Muscle-Up" is also a claim on every pull-up that leads to
     it, so a tick is expanded up its own line before it is stored —
     otherwise an advanced athlete would end up with a muscle-up open
     above a locked dead hang. Only the parent chain is followed (plus
     the extras of an AND, which are genuine requirements); an OR's
     extras are a second way in, not something the tick implies.
     ------------------------------------------------------------------ */
  function addWithAncestors(key, set) {
    if (!key || set.has(key)) return;
    const { cat, node } = skillByKey(key);
    if (!cat || !node) return;
    set.add(key);

    const refs = [];
    if (node.parent && node.parent !== "START") refs.push(resolveRef(cat.key, node.parent));
    if (node.connector === "AND") {
      (node.extra || []).forEach((ref) => refs.push(resolveRef(cat.key, ref)));
    }
    refs.forEach((ref) => addWithAncestors(`${ref.catKey}:${ref.id}`, set));
  }

  function expandCleared(keys) {
    const set = new Set(clearedState);
    (keys || []).forEach((key) => addWithAncestors(key, set));
    return set;
  }

  // how much of the tree a set of ticks would open, before it is saved —
  // what the check-in counts up live as you tick
  function previewUnlocked(keys) { return countUnlocked(expandCleared(keys)); }

  const assessedKey = () => scoped(ASSESSED_BASE);
  function hasAssessed() {
    // storage unreadable → treat it as done rather than asking on every visit
    try { return localStorage.getItem(assessedKey()) === "1"; } catch (err) { return true; }
  }
  function markAssessed() {
    try { localStorage.setItem(assessedKey(), "1"); } catch (err) {}
  }

  // Save the check-in. No reps are credited — everyone starts on zero,
  // whichever level they picked. The ticks decide what is *open*, not
  // what has been done.
  function applyAssessment(levelKey, keys) {
    clearedState = expandCleared(keys);
    saveCleared();

    level = levelByKey(levelKey) ? levelKey : null;
    try {
      if (level) localStorage.setItem(scoped(LEVEL_BASE), level);
      else localStorage.removeItem(scoped(LEVEL_BASE));
    } catch (err) {}

    markAssessed();
    emit("assessment");
    return { ticked: (keys || []).length, cleared: clearedState.size, unlocked: countUnlocked() };
  }

  function isCleared(catKey, id) { return clearedState.has(`${catKey}:${id}`); }
  function getLevel() { return level; }

  /* ------------------------------------------------------------------
     Favourite skill — one per account, shown on the leaderboard
     ------------------------------------------------------------------ */
  function getFavourite() { return favourite; }
  function isFavourite(key) { return Boolean(favourite) && favourite === key; }

  function setFavourite(key) {
    favourite = key || null;
    try {
      if (favourite) localStorage.setItem(scoped(FAV_BASE), favourite);
      else localStorage.removeItem(scoped(FAV_BASE));
    } catch (err) {}
    emit("favourite");
    return favourite;
  }

  // starring the skill you already starred clears it
  function toggleFavourite(key) {
    return setFavourite(isFavourite(key) ? null : key);
  }

  /* ------------------------------------------------------------------
     Starting over
     ------------------------------------------------------------------ */

  // Back to an empty tree: no reps, no favourite, nothing ticked, and the
  // check-in offered again next time the map opens. The account stays.
  function resetTree() {
    repsState = {};
    favourite = null;
    clearedState = new Set();
    level = null;
    try {
      localStorage.removeItem(scoped(REPS_BASE));
      localStorage.removeItem(scoped(FAV_BASE));
      localStorage.removeItem(scoped(ASSESSED_BASE));
      localStorage.removeItem(scoped(CLEARED_BASE));
      localStorage.removeItem(scoped(LEVEL_BASE));
    } catch (err) {}
    emit("reset");
  }

  // Wipe one account's training off this device — used when the account
  // itself is deleted, so nothing of theirs is left behind in the browser.
  function forget(userId) {
    if (!userId) return;
    try {
      localStorage.removeItem(scoped(REPS_BASE, userId));
      localStorage.removeItem(scoped(FAV_BASE, userId));
      localStorage.removeItem(scoped(ASSESSED_BASE, userId));
      localStorage.removeItem(scoped(CLEARED_BASE, userId));
      localStorage.removeItem(scoped(LEVEL_BASE, userId));
    } catch (err) {}
    const current = global.MuAuth && global.MuAuth.currentUser();
    if (current && current.id === userId) {
      repsState = {};
      favourite = null;
      clearedState = new Set();
      level = null;
    }
  }

  /* ------------------------------------------------------------------
     Aggregates — what the leaderboard shows
     ------------------------------------------------------------------ */
  function summarise(reps, favouriteKey) {
    const categoryReps = {};
    let totalReps = 0;

    CATEGORIES.forEach((cat) => {
      let sum = 0;
      cat.nodes.forEach((n) => { sum += clamp(reps[`${cat.key}:${n.id}`], MAX_REPS_PER_SKILL); });
      categoryReps[cat.key] = Math.min(sum, INT4_MAX);
      totalReps += sum;
    });
    // last gate before these numbers are published to an integer column
    totalReps = Math.min(totalReps, INT4_MAX);

    // the branch with the most reps; nothing logged yet → no branch
    let topCategory = null;
    CATEGORIES.forEach((cat) => {
      if (categoryReps[cat.key] > 0 && (!topCategory || categoryReps[cat.key] > categoryReps[topCategory])) {
        topCategory = cat.key;
      }
    });

    return {
      totalReps,
      categoryReps,
      topCategory,
      favouriteSkill: favouriteKey || null,
      favouriteSkillLabel: favouriteKey ? skillLabel(favouriteKey) : null,
    };
  }

  function stats() { return summarise(repsState, favourite); }

  // the same figures for any account stored on this device — local mode's
  // leaderboard is built from these
  function statsFor(userId) {
    const reps = readJSON(scoped(REPS_BASE, userId), {}) || {};
    let fav = null;
    try { fav = localStorage.getItem(scoped(FAV_BASE, userId)) || null; } catch (err) {}
    return summarise(reps, fav);
  }

  /* ------------------------------------------------------------------
     Export
     ------------------------------------------------------------------ */
  global.MuSkills = {
    FAMILY,
    CATEGORIES,
    RANKS,
    REPS_PER_RANK,
    UNLOCK_REPS,
    LEVELS,
    MAX_REPS_PER_ENTRY,
    categoryByKey,
    levelByKey,
    skillByKey,
    skillLabel,
    repsOf,
    addRepsTo,
    setRepsTo,
    rankIndex,
    isUnlocked,
    countUnlocked,
    previewUnlocked,
    prereqsOf,
    hasAssessed,
    markAssessed,
    applyAssessment,
    isCleared,
    getLevel,
    getFavourite,
    setFavourite,
    toggleFavourite,
    isFavourite,
    stats,
    statsFor,
    resetTree,
    forget,
    reload: loadState,
    onChange(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
      };
    },
  };

  // signing in or out swaps to that account's tree and favourite
  if (global.MuAuth) {
    global.MuAuth.onChange(() => { loadState(); emit("account"); });
  }
})(window);
