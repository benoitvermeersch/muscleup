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
  const stateEl = document.getElementById("pf-state");
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

  /* ---- have you actually saved anything? ---- */

  // An empty form with example placeholders reads as a filled-in one, and
  // then the leaderboard "loses" a name that was never saved. Say so plainly.
  function renderState(profile) {
    if (!stateEl) return;
    const saved = profile && profile.username;
    stateEl.hidden = Boolean(saved);
    if (!saved) {
      const shown = window.MuProfiles.displayName(profile || { id: (window.MuAuth.currentUser() || {}).id });
      stateEl.textContent =
        `You haven't saved a profile yet — the leaderboard shows you as “${shown}” until you do. ` +
        `The greyed-out text below is example text, not your details.`;
    }
  }

  /* ---- fill the form from the stored profile ---- */
  function fill(profile) {
    const user = window.MuAuth.currentUser();
    gate.hidden = Boolean(user);
    content.hidden = !user;
    if (!user) return;

    renderState(profile);
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

  /* ---- danger zone ---- */
  const dangerNote = document.getElementById("pf-danger-note");
  const confirms = {
    reset: document.getElementById("pf-reset-confirm"),
    delete: document.getElementById("pf-delete-confirm"),
  };

  function showDanger(message, kind) {
    if (!dangerNote) return;
    dangerNote.textContent = message || "";
    dangerNote.className = `pf-danger__note${kind ? ` is-${kind}` : ""}`;
  }

  // only one confirmation open at a time, so a stray click can't hit the
  // wrong one
  function openConfirm(which) {
    Object.keys(confirms).forEach((key) => {
      if (confirms[key]) confirms[key].hidden = key !== which;
    });
    showDanger("");
    if (which === "reset") {
      document.getElementById("pf-reset-count").textContent =
        window.MuSkills.stats().totalReps.toLocaleString();
    }
    if (which === "delete") {
      const input = document.getElementById("pf-delete-input");
      input.value = "";
      document.getElementById("pf-delete-go").disabled = true;
      input.focus();
    }
  }

  function closeConfirms() {
    Object.keys(confirms).forEach((key) => { if (confirms[key]) confirms[key].hidden = true; });
  }

  if (dangerNote) {
    document.getElementById("pf-reset").addEventListener("click", () => openConfirm("reset"));
    document.getElementById("pf-delete").addEventListener("click", () => openConfirm("delete"));
    document.querySelectorAll("[data-danger-cancel]").forEach((el) =>
      el.addEventListener("click", closeConfirms));

    // deleting an account is worth typing for
    const deleteInput = document.getElementById("pf-delete-input");
    const deleteGo = document.getElementById("pf-delete-go");
    deleteInput.addEventListener("input", () => {
      deleteGo.disabled = deleteInput.value.trim().toUpperCase() !== "DELETE";
    });

    document.getElementById("pf-reset-go").addEventListener("click", async () => {
      closeConfirms();
      window.MuSkills.resetTree();
      renderPreview();
      try {
        await window.MuProfiles.pushStats();
        showDanger("Tree reset — you're back at zero reps.", "ok");
      } catch (err) {
        showDanger(`Tree reset on this device, but the leaderboard wasn't updated: ${err.message}`, "error");
      }
    });

    deleteGo.addEventListener("click", async () => {
      deleteGo.disabled = true;
      deleteGo.textContent = "Deleting…";
      try {
        await window.MuProfiles.deleteAccount();
        // the account is gone; there's nothing left on this page to show
        location.href = "index.html";
      } catch (err) {
        deleteGo.disabled = false;
        deleteGo.textContent = "Delete permanently";
        showDanger(err.message, "error");
      }
    });
  }

  window.MuAuth.onChange(() => fill(window.MuProfiles.mine()));
  window.MuProfiles.onChange((profile) => fill(profile));
  window.MuSkills.onChange(renderPreview);

  fill(window.MuProfiles.mine());
  if (window.MuAuth.currentUser() && !window.MuProfiles.mine()) {
    window.MuProfiles.load().catch((err) => showError(err.message));
  }
});
