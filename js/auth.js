/* =====================================================================
   MuscleUp — email + password authentication
   =====================================================================

   Exposes a small `MuAuth` API used by the rest of the site:

     MuAuth.signUp(email, password)  → Promise<{ needsVerification }>
     MuAuth.logIn(email, password)   → Promise<user>
     MuAuth.logOut()
     MuAuth.resend(email)            → Promise
     MuAuth.currentUser()            → user | null
     MuAuth.onChange(fn)             → unsubscribe fn
     MuAuth.openModal(tab)           → opens the sign up / log in dialog
     MuAuth.scopedKey(base)          → per-account localStorage key

   Two backends, picked automatically from js/auth-config.js:

     remote — Supabase Auth over its REST API. Real accounts, real
              confirmation email, real verify-before-login enforcement.
     local  — same rules enforced in the browser (PBKDF2-hashed
              passwords, unverified accounts cannot log in), with the
              confirmation email rendered on screen instead of sent.
   ===================================================================== */

(function (global) {
  "use strict";

  /* ------------------------------------------------------------------
     Config & constants
     ------------------------------------------------------------------ */
  const CFG = global.MU_AUTH_CONFIG || {};
  const SB_URL = String(CFG.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const SB_KEY = String(CFG.SUPABASE_ANON_KEY || "").trim();
  const REMOTE = Boolean(SB_URL && SB_KEY);

  const SESSION_KEY = "mu-session";
  const USERS_KEY = "mu-users";

  // the password has to be *more than* 8 characters, so 9 is the shortest
  const PASSWORD_MIN_EXCLUSIVE = 8;
  const PBKDF2_ITERATIONS = 150000;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* private mode / quota — auth still works for this page view */
    }
  }

  /* ------------------------------------------------------------------
     Validation — shared by both backends so the rules never drift
     ------------------------------------------------------------------ */
  function validateEmail(email) {
    if (!email) return "Enter your email address.";
    if (!EMAIL_RE.test(email)) return "That doesn't look like a valid email address.";
    return null;
  }

  function validatePassword(password) {
    if (!password) return "Choose a password.";
    if (password.length <= PASSWORD_MIN_EXCLUSIVE) {
      return `Password must be more than ${PASSWORD_MIN_EXCLUSIVE} characters — that one is ${password.length}.`;
    }
    return null;
  }

  /* ------------------------------------------------------------------
     Local-mode password hashing (PBKDF2-SHA256 via WebCrypto)
     ------------------------------------------------------------------ */
  const subtle = global.crypto && global.crypto.subtle;

  function randomHex(bytes) {
    const buf = new Uint8Array(bytes);
    global.crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, saltHex) {
    if (!subtle) throw new Error("This browser can't hash passwords securely (needs HTTPS).");
    const enc = new TextEncoder();
    const key = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(saltHex), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      key,
      256
    );
    return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // constant-time-ish compare so a wrong password doesn't leak via timing
  function safeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ------------------------------------------------------------------
     Session state
     ------------------------------------------------------------------ */
  let session = readJSON(SESSION_KEY, null);
  if (session && !session.user) session = null;

  const listeners = [];

  function notify() {
    const user = currentUser();
    listeners.forEach((fn) => {
      try { fn(user); } catch (err) { console.error(err); }
    });
  }

  function setSession(next) {
    session = next;
    if (next) writeJSON(SESSION_KEY, next);
    else {
      try { localStorage.removeItem(SESSION_KEY); } catch (err) {}
    }
    notify();
  }

  function currentUser() {
    return session ? session.user : null;
  }

  /* ------------------------------------------------------------------
     Local users table
     ------------------------------------------------------------------ */
  const loadUsers = () => readJSON(USERS_KEY, {}) || {};
  const saveUsers = (users) => writeJSON(USERS_KEY, users);
  const normalise = (email) => String(email || "").trim().toLowerCase();

  function verifyLink(token) {
    const base = location.origin + location.pathname;
    return `${base}?mu_verify=${token}`;
  }

  /* ------------------------------------------------------------------
     Supabase REST helpers
     ------------------------------------------------------------------ */
  const redirectTarget = () => location.origin + location.pathname;

  async function sbFetch(path, options) {
    const opts = options || {};
    const res = await fetch(SB_URL + path, {
      method: opts.method || "POST",
      headers: Object.assign(
        { apikey: SB_KEY, "Content-Type": "application/json" },
        opts.token ? { Authorization: `Bearer ${opts.token}` } : {}
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    let payload = null;
    try { payload = await res.json(); } catch (err) { payload = null; }

    if (!res.ok) {
      const err = new Error(supabaseMessage(payload, res.status));
      err.code = (payload && (payload.error_code || payload.error)) || String(res.status);
      throw err;
    }
    return payload;
  }

  // GoTrue has spoken several error shapes over the years — check them all
  function supabaseMessage(payload, status) {
    const raw =
      (payload && (payload.error_description || payload.msg || payload.message || payload.error)) || "";
    const text = String(raw);
    if (/email not confirmed/i.test(text)) {
      return "That email hasn't been confirmed yet — check your inbox for the link.";
    }
    if (/invalid login credentials/i.test(text)) {
      return "Email or password is incorrect.";
    }
    if (/already registered|already been registered/i.test(text)) {
      return "That email already has an account. Try logging in instead.";
    }
    if (/rate limit|too many/i.test(text)) {
      return "Too many attempts just now — wait a minute and try again.";
    }
    return text || `Something went wrong (HTTP ${status}).`;
  }

  function userFromSupabase(u) {
    return { id: u.id, email: u.email, createdAt: u.created_at || null };
  }

  /* ------------------------------------------------------------------
     Public API — sign up
     ------------------------------------------------------------------ */
  async function signUp(rawEmail, password) {
    const email = normalise(rawEmail);
    const emailError = validateEmail(email);
    if (emailError) throw new Error(emailError);
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);

    if (REMOTE) {
      const query = `?redirect_to=${encodeURIComponent(redirectTarget())}`;
      const data = await sbFetch(`/auth/v1/signup${query}`, { body: { email, password } });

      // Supabase hands back a session directly when confirmations are off
      if (data && data.access_token && data.user) {
        setSession({
          user: userFromSupabase(data.user),
          token: data.access_token,
          refreshToken: data.refresh_token || null,
        });
        return { needsVerification: false, email };
      }
      return { needsVerification: true, email };
    }

    /* --- local mode --- */
    const users = loadUsers();
    if (users[email] && users[email].verified) {
      throw new Error("That email already has an account. Try logging in instead.");
    }

    const salt = randomHex(16);
    const hash = await hashPassword(password, salt);
    const token = randomHex(24);

    users[email] = {
      id: users[email] ? users[email].id : randomHex(12),
      email,
      salt,
      hash,
      verified: false,
      verifyToken: token,
      createdAt: new Date().toISOString(),
    };
    saveUsers(users);

    return { needsVerification: true, email, previewLink: verifyLink(token) };
  }

  /* ------------------------------------------------------------------
     Public API — log in
     ------------------------------------------------------------------ */
  async function logIn(rawEmail, password) {
    const email = normalise(rawEmail);
    const emailError = validateEmail(email);
    if (emailError) throw new Error(emailError);
    if (!password) throw new Error("Enter your password.");

    if (REMOTE) {
      const data = await sbFetch("/auth/v1/token?grant_type=password", { body: { email, password } });
      const user = userFromSupabase(data.user);
      setSession({ user, token: data.access_token, refreshToken: data.refresh_token || null });
      return user;
    }

    /* --- local mode --- */
    const users = loadUsers();
    const record = users[email];

    // same message for "no such account" and "wrong password" — don't
    // let the form become an account-existence oracle
    if (!record) throw new Error("Email or password is incorrect.");

    const hash = await hashPassword(password, record.salt);
    if (!safeEqual(hash, record.hash)) throw new Error("Email or password is incorrect.");

    if (!record.verified) {
      const err = new Error("That email hasn't been confirmed yet — check your inbox for the link.");
      err.code = "email_not_confirmed";
      err.previewLink = record.verifyToken ? verifyLink(record.verifyToken) : null;
      throw err;
    }

    const user = { id: record.id, email: record.email, createdAt: record.createdAt };
    setSession({ user });
    return user;
  }

  /* ------------------------------------------------------------------
     Public API — resend confirmation
     ------------------------------------------------------------------ */
  async function resend(rawEmail) {
    const email = normalise(rawEmail);
    const emailError = validateEmail(email);
    if (emailError) throw new Error(emailError);

    if (REMOTE) {
      const query = `?redirect_to=${encodeURIComponent(redirectTarget())}`;
      await sbFetch(`/auth/v1/resend${query}`, { body: { type: "signup", email } });
      return { email };
    }

    const users = loadUsers();
    const record = users[email];
    if (!record) throw new Error("No account waiting on that email address.");
    if (record.verified) throw new Error("That email is already confirmed — you can log in.");

    record.verifyToken = randomHex(24);
    saveUsers(users);
    return { email, previewLink: verifyLink(record.verifyToken) };
  }

  function logOut() {
    setSession(null);
  }

  /* ------------------------------------------------------------------
     Confirmation links landing back on the site
     ------------------------------------------------------------------ */

  // local mode: ?mu_verify=<token>
  function consumeLocalVerification() {
    const params = new URLSearchParams(location.search);
    const token = params.get("mu_verify");
    if (!token) return null;

    stripUrl(["mu_verify"]);

    const users = loadUsers();
    const email = Object.keys(users).find((key) => users[key].verifyToken === token);
    if (!email) return { ok: false, message: "That confirmation link is no longer valid." };

    users[email].verified = true;
    users[email].verifyToken = null;
    saveUsers(users);
    return { ok: true, email };
  }

  // remote mode: #access_token=...&type=signup  (or an #error=... payload)
  async function consumeSupabaseRedirect() {
    const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
    if (!hash) return null;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const errorDescription = params.get("error_description");
    if (!accessToken && !errorDescription) return null;

    history.replaceState(null, "", location.pathname + location.search);

    if (errorDescription) {
      return { ok: false, message: supabaseMessage({ error_description: errorDescription }, 400) };
    }

    try {
      const user = await sbFetch("/auth/v1/user", { method: "GET", token: accessToken });
      setSession({
        user: userFromSupabase(user),
        token: accessToken,
        refreshToken: params.get("refresh_token") || null,
      });
      return { ok: true, email: user.email, signedIn: true };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  function stripUrl(keys) {
    const params = new URLSearchParams(location.search);
    keys.forEach((key) => params.delete(key));
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
  }

  /* ------------------------------------------------------------------
     Export
     ------------------------------------------------------------------ */
  global.MuAuth = {
    mode: REMOTE ? "remote" : "local",
    PASSWORD_MIN_EXCLUSIVE,
    signUp,
    logIn,
    logOut,
    resend,
    currentUser,
    validateEmail,
    validatePassword,
    onChange(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
      };
    },
    // progress is stored per account so two people on one browser don't
    // inherit each other's unlocked skills
    scopedKey(base) {
      const user = currentUser();
      return user ? `${base}:${user.id}` : `${base}:guest`;
    },
    _consumeLocalVerification: consumeLocalVerification,
    _consumeSupabaseRedirect: consumeSupabaseRedirect,
  };
})(window);


/* =====================================================================
   Auth UI — the sign up / log in dialog and the header account chip
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("auth-modal");
  if (!modal) return;

  const panels = {
    signup: modal.querySelector('[data-auth-panel="signup"]'),
    login: modal.querySelector('[data-auth-panel="login"]'),
    sent: modal.querySelector('[data-auth-panel="sent"]'),
  };
  const tabs = Array.from(modal.querySelectorAll("[data-auth-tab]"));
  const sentBody = document.getElementById("auth-sent-body");
  const authSlot = document.getElementById("auth-slot");

  let pendingEmail = "";
  let afterAuth = null;   // what to run once the user is signed in
  let bannerTimer = 0;    // declared up here: the return-link handler below
                          // fires before the banner helpers are reached

  /* ---- panel switching ---- */
  function showPanel(name) {
    Object.keys(panels).forEach((key) => {
      if (panels[key]) panels[key].hidden = key !== name;
    });
    tabs.forEach((tab) => {
      const on = tab.dataset.authTab === name;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    // the tab strip is meaningless on the "check your email" screen
    modal.querySelector(".auth-tabs").hidden = name === "sent";
    clearErrors();
  }

  function clearErrors() {
    modal.querySelectorAll(".auth-error").forEach((el) => {
      el.textContent = "";
      el.classList.remove("is-visible");
    });
    modal.querySelectorAll(".auth-field input").forEach((el) => el.classList.remove("is-invalid"));
  }

  function showError(panel, message) {
    const el = panels[panel] && panels[panel].querySelector(".auth-error");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
  }

  function setBusy(form, busy, label) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (busy) {
      btn.dataset.idle = btn.dataset.idle || btn.textContent;
      btn.textContent = label || "Working…";
    } else if (btn.dataset.idle) {
      btn.textContent = btn.dataset.idle;
    }
    btn.disabled = busy;
    form.classList.toggle("is-busy", busy);
  }

  /* ---- open / close ---- */
  function openModal(tab, onSuccess) {
    afterAuth = typeof onSuccess === "function" ? onSuccess : null;
    hideBanner();
    modal.hidden = false;
    document.body.classList.add("is-locked");
    showPanel(tab === "login" ? "login" : "signup");
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      const input = panels[tab === "login" ? "login" : "signup"].querySelector('input[type="email"]');
      if (input) input.focus();
    });
  }

  function closeModal() {
    modal.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    // the skill tree overlay locks the body too — don't unlock it out from under
    if (document.getElementById("tree-overlay").classList.contains("is-open")) {
      document.body.classList.add("is-locked");
    }
    setTimeout(() => { modal.hidden = true; }, 180);
  }

  window.MuAuth.openModal = openModal;
  window.MuAuth.closeModal = closeModal;

  modal.querySelectorAll("[data-auth-close]").forEach((el) => el.addEventListener("click", closeModal));
  tabs.forEach((tab) => tab.addEventListener("click", () => showPanel(tab.dataset.authTab)));
  modal.querySelectorAll("[data-auth-goto]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      showPanel(el.dataset.authGoto);
    })
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  /* ---- "check your email" screen ---- */
  function showSent(email, previewLink, heading) {
    pendingEmail = email;
    let html = `<div class="auth-sent__icon">✉</div>`;
    html += `<h3 class="auth-sent__title">${heading || "Check your email"}</h3>`;
    html += `<p class="auth-sent__lead">We sent a confirmation link to <b>${escapeHtml(email)}</b>. ` +
      `Click it to activate your account, then log in.</p>`;

    if (previewLink) {
      html += `<div class="auth-sent__demo">` +
        `<div class="auth-sent__demo-tag">Local mode — no mail server yet</div>` +
        `<p>This build isn't wired to Supabase, so here is the email we <em>would</em> have sent:</p>` +
        `<a class="auth-sent__link" href="${escapeHtml(previewLink)}">Confirm my email address</a>` +
        `</div>`;
    }

    html += `<div class="auth-sent__actions">` +
      `<button type="button" class="btn btn--ghost btn--small" id="auth-resend">Resend link</button>` +
      `<button type="button" class="btn btn--primary btn--small" data-auth-goto="login">Go to log in</button>` +
      `</div>`;
    html += `<p class="auth-sent__note" id="auth-resend-note"></p>`;

    sentBody.innerHTML = html;
    showPanel("sent");

    sentBody.querySelectorAll("[data-auth-goto]").forEach((el) =>
      el.addEventListener("click", () => showPanel(el.dataset.authGoto))
    );

    const resendBtn = document.getElementById("auth-resend");
    const note = document.getElementById("auth-resend-note");
    resendBtn.addEventListener("click", async () => {
      resendBtn.disabled = true;
      try {
        const result = await window.MuAuth.resend(pendingEmail);
        showSent(pendingEmail, result.previewLink, "New link sent");
      } catch (err) {
        note.textContent = err.message;
        note.classList.add("is-error");
        resendBtn.disabled = false;
      }
    });
  }

  /* ---- sign up ---- */
  panels.signup.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const form = e.currentTarget;
    const email = form.querySelector('input[type="email"]').value.trim();
    const passwordInput = form.querySelector('input[type="password"]');
    const password = passwordInput.value;

    const emailError = window.MuAuth.validateEmail(email);
    if (emailError) {
      form.querySelector('input[type="email"]').classList.add("is-invalid");
      return showError("signup", emailError);
    }
    const passwordError = window.MuAuth.validatePassword(password);
    if (passwordError) {
      passwordInput.classList.add("is-invalid");
      return showError("signup", passwordError);
    }

    setBusy(form, true, "Creating account…");
    try {
      const result = await window.MuAuth.signUp(email, password);
      form.reset();
      updateStrength("");
      if (result.needsVerification) showSent(result.email, result.previewLink);
      else { closeModal(); runAfterAuth(); }
    } catch (err) {
      showError("signup", err.message);
    } finally {
      setBusy(form, false);
    }
  });

  /* ---- live password requirement hint ---- */
  const pwInput = panels.signup.querySelector('input[type="password"]');
  const pwHint = document.getElementById("auth-pw-hint");
  const MIN = window.MuAuth.PASSWORD_MIN_EXCLUSIVE;

  function updateStrength(value) {
    if (!pwHint) return;
    const ok = value.length > MIN;
    pwHint.classList.toggle("is-ok", ok && value.length > 0);
    pwHint.textContent = !value.length
      ? `Must be more than ${MIN} characters`
      : ok
        ? `Looks good — ${value.length} characters`
        : `${MIN + 1 - value.length} more character${MIN + 1 - value.length === 1 ? "" : "s"} needed`;
  }
  if (pwInput) pwInput.addEventListener("input", (e) => updateStrength(e.target.value));

  /* ---- log in ---- */
  panels.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const form = e.currentTarget;
    const email = form.querySelector('input[type="email"]').value.trim();
    const password = form.querySelector('input[type="password"]').value;

    setBusy(form, true, "Logging in…");
    try {
      await window.MuAuth.logIn(email, password);
      form.reset();
      closeModal();
      runAfterAuth();
    } catch (err) {
      if (err.code === "email_not_confirmed") {
        showSent(email, err.previewLink, "One step left");
      } else {
        showError("login", err.message);
      }
    } finally {
      setBusy(form, false);
    }
  });

  function runAfterAuth() {
    const fn = afterAuth;
    afterAuth = null;
    if (fn) fn();
  }

  /* ---- header account chip ---- */
  function renderAuthSlot(user) {
    if (!authSlot) return;
    if (user) {
      authSlot.innerHTML =
        `<div class="account">` +
        `<span class="account__avatar">${escapeHtml(user.email.slice(0, 1).toUpperCase())}</span>` +
        `<span class="account__email">${escapeHtml(user.email)}</span>` +
        `<button type="button" class="account__out" id="auth-logout">Log out</button>` +
        `</div>`;
      document.getElementById("auth-logout").addEventListener("click", () => window.MuAuth.logOut());
    } else {
      authSlot.innerHTML =
        `<button type="button" class="btn btn--ghost btn--small" data-auth-open="login">Log in</button>` +
        `<button type="button" class="btn btn--primary btn--small" data-auth-open="signup">Sign up</button>`;
    }
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-auth-open]");
    if (!trigger) return;
    e.preventDefault();
    openModal(trigger.dataset.authOpen);
  });

  window.MuAuth.onChange(renderAuthSlot);
  renderAuthSlot(window.MuAuth.currentUser());

  /* ---- handle a confirmation link landing on the page ---- */
  (async function handleReturn() {
    const local = window.MuAuth._consumeLocalVerification();
    if (local) {
      if (local.ok) {
        openModal("login");
        banner(`${local.email} is confirmed — log in to start climbing.`, "ok");
        const emailField = panels.login.querySelector('input[type="email"]');
        if (emailField) emailField.value = local.email;
        panels.login.querySelector('input[type="password"]').focus();
      } else {
        openModal("signup");
        showError("signup", local.message);
      }
      return;
    }

    if (window.MuAuth.mode !== "remote") return;
    const remote = await window.MuAuth._consumeSupabaseRedirect();
    if (!remote) return;
    if (remote.ok) banner(`Welcome, ${remote.email}. Your email is confirmed.`, "ok");
    else { openModal("login"); showError("login", remote.message); }
  })();

  function banner(message, kind) {
    const el = document.getElementById("auth-banner");
    if (!el) return;
    el.textContent = message;
    el.className = `auth-banner is-visible ${kind === "ok" ? "is-ok" : ""}`;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove("is-visible"), 6000);
  }

  function hideBanner() {
    const el = document.getElementById("auth-banner");
    if (!el) return;
    clearTimeout(bannerTimer);
    el.classList.remove("is-visible");
  }

  window.MuAuth.banner = banner;
  window.MuAuth.hideBanner = hideBanner;

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});
