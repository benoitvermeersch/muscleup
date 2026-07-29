/* =====================================================================
   MuscleUp — profile page

   The profile isn't part of signing up: an account starts as just an
   email, and this is where it gets a name. Username, first name, last
   name — that's the whole form for now.
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const gate = document.getElementById("pf-gate");
  const content = document.getElementById("pf-content");
  const form = document.getElementById("pf-form");
  if (!form) return;

  const usernameEl = document.getElementById("pf-username");
  const firstEl = document.getElementById("pf-first");
  const lastEl = document.getElementById("pf-last");
  const errorEl = document.getElementById("pf-error");
  const noteEl = document.getElementById("pf-note");
  const emailEl = document.getElementById("pf-email");
  const previewName = document.getElementById("pf-preview-name");
  const previewFull = document.getElementById("pf-preview-full");
  const previewAvatar = document.getElementById("pf-preview-avatar");
  const previewStats = document.getElementById("pf-preview-stats");
  const submitBtn = form.querySelector('button[type="submit"]');

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function showError(message) {
    errorEl.textContent = message || "";
    errorEl.classList.toggle("is-visible", Boolean(message));
  }

  function showNote(message, kind) {
    noteEl.textContent = message || "";
    noteEl.className = `pf-note${kind ? ` is-${kind}` : ""}`;
  }

  /* ---- the card on the right: how you'll look on the leaderboard ---- */
  function renderPreview() {
    const draft = {
      id: (window.MuAuth.currentUser() || {}).id,
      username: usernameEl.value.trim(),
      firstName: firstEl.value.trim(),
      lastName: lastEl.value.trim(),
    };
    const name = window.MuProfiles.displayName(draft);
    const full = window.MuProfiles.fullName(draft);

    previewAvatar.textContent = name.slice(0, 1).toUpperCase();
    previewName.textContent = name;
    previewFull.textContent = full || "Your name, once you fill it in";
    previewFull.classList.toggle("is-placeholder", !full);

    const stats = window.MuSkills.stats();
    const top = stats.topCategory && window.MuSkills.categoryByKey(stats.topCategory);
    previewStats.innerHTML =
      `<div class="pf-mini"><span>${stats.totalReps.toLocaleString()}</span><small>total reps</small></div>` +
      `<div class="pf-mini"><span>${top ? esc(top.icon + " " + top.label) : "—"}</span><small>top branch</small></div>` +
      `<div class="pf-mini"><span>${stats.favouriteSkillLabel ? esc(stats.favouriteSkillLabel) : "—"}</span>` +
        `<small>favourite position</small></div>`;
  }

  /* ---- fill the form from the stored profile ---- */
  function fill(profile) {
    const user = window.MuAuth.currentUser();
    gate.hidden = Boolean(user);
    content.hidden = !user;
    if (!user) return;

    if (emailEl) emailEl.textContent = user.email;
    if (profile) {
      // don't clobber something half-typed with a background refresh
      if (document.activeElement !== usernameEl) usernameEl.value = profile.username || "";
      if (document.activeElement !== firstEl) firstEl.value = profile.firstName || "";
      if (document.activeElement !== lastEl) lastEl.value = profile.lastName || "";
    }
    renderPreview();
  }

  [usernameEl, firstEl, lastEl].forEach((el) =>
    el.addEventListener("input", () => { renderPreview(); showError(""); }));

  /* ---- save ---- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    showNote("");

    submitBtn.disabled = true;
    const idle = submitBtn.textContent;
    submitBtn.textContent = "Saving…";

    try {
      await window.MuProfiles.save({
        username: usernameEl.value,
        firstName: firstEl.value,
        lastName: lastEl.value,
      });
      showNote("Profile saved — that's the name on the leaderboard now.", "ok");
    } catch (err) {
      showError(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = idle;
    }
  });

  window.MuAuth.onChange(() => fill(window.MuProfiles.mine()));
  window.MuProfiles.onChange((profile) => fill(profile));
  window.MuSkills.onChange(renderPreview);

  fill(window.MuProfiles.mine());
  if (window.MuAuth.currentUser() && !window.MuProfiles.mine()) {
    window.MuProfiles.load().catch((err) => showError(err.message));
  }
});
