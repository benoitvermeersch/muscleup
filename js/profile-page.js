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
  const previewStats = document.getElementById("pf-preview-stats");
  const submitBtn = form.querySelector('button[type="submit"]');

  const avatarImg = document.getElementById("pf-avatar-img");
  const avatarInitial = document.getElementById("pf-avatar-initial");
  const avatarInput = document.getElementById("pf-avatar-input");
  const avatarPick = document.getElementById("pf-avatar-pick");
  const avatarDrop = document.getElementById("pf-avatar-drop");
  const avatarRemove = document.getElementById("pf-avatar-remove");
  const avatarHint = document.getElementById("pf-avatar-hint");
  const previewImg = document.getElementById("pf-preview-avatar-img");
  const previewInitial = document.getElementById("pf-preview-avatar-initial");

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

    renderAvatar(name);
    previewName.textContent = name;
    previewFull.textContent = full || "Your name, once you fill it in";
    previewFull.classList.toggle("is-placeholder", !full);

    const stats = window.MuSkills.stats();
    const top = stats.topCategory && window.MuSkills.categoryByKey(stats.topCategory);
    previewStats.innerHTML =
      `<div class="pf-mini"><span>${stats.totalReps.toLocaleString()}</span><small>total reps</small></div>` +
      `<div class="pf-mini"><span>${top ? esc(top.icon + " " + top.label) : "—"}</span><small>top branch</small></div>` +
      `<div class="pf-mini"><span>${stats.favouriteSkillLabel ? esc(stats.favouriteSkillLabel) : "—"}</span>` +
        `<small>favourite exercise</small></div>`;
  }

  /* ---- the profile picture ----

     Both circles — the one in the form and the one on the preview card —
     show the same thing: your picture if there is one, your initial if
     there isn't.  */

  // a URL that has already failed once — the file was deleted from the
  // bucket, or the network is down — shouldn't be retried on every keystroke
  const broken = new Set();

  function paintCircle(img, letter, url, initial) {
    if (!img || !letter) return;
    letter.textContent = initial;

    if (url && !broken.has(url)) {
      // only when it actually changed, or every keystroke in the username
      // field would start the image loading again
      if (img.getAttribute("src") !== url) img.src = url;
      img.hidden = false;
      letter.hidden = true;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      letter.hidden = false;
    }
  }

  [avatarImg, previewImg].forEach((img) => {
    if (!img) return;
    img.addEventListener("error", () => {
      const src = img.getAttribute("src");
      if (!src) return;
      broken.add(src);
      renderPreview();
    });
  });

  function renderAvatar(name) {
    const profile = window.MuProfiles.mine();
    const url = (profile && profile.avatarUrl) || "";
    const initial = name.slice(0, 1).toUpperCase();

    paintCircle(avatarImg, avatarInitial, url, initial);
    paintCircle(previewImg, previewInitial, url, initial);

    if (avatarRemove) avatarRemove.hidden = !url;
    if (avatarDrop) avatarDrop.classList.toggle("has-image", Boolean(url));
  }

  const AVATAR_HINT = avatarHint ? avatarHint.textContent : "";
  let avatarBusy = false;

  function showAvatarNote(message, kind) {
    if (!avatarHint) return;
    avatarHint.textContent = message || AVATAR_HINT;
    avatarHint.className = `pf-hint${kind ? ` is-${kind}` : ""}`;
  }

  function setAvatarBusy(busy) {
    avatarBusy = busy;
    if (avatarInput) avatarInput.disabled = busy;
    if (avatarRemove) avatarRemove.disabled = busy;
    // a <label> has no disabled state of its own — CSS stops the clicks
    if (avatarPick) avatarPick.classList.toggle("is-disabled", busy);
    if (avatarDrop) {
      avatarDrop.classList.toggle("is-busy", busy);
      avatarDrop.disabled = busy;
    }
  }

  async function useFile(file) {
    if (!file || avatarBusy) return;
    setAvatarBusy(true);
    showAvatarNote("Uploading…");
    try {
      await window.MuProfiles.saveAvatar(file);
      showAvatarNote("Picture saved — that's your face on the leaderboard now.", "ok");
    } catch (err) {
      showAvatarNote(err.message, "error");
    } finally {
      setAvatarBusy(false);
      // picking the same file twice has to fire `change` again
      if (avatarInput) avatarInput.value = "";
    }
  }

  if (avatarInput) {
    avatarInput.addEventListener("change", () => useFile(avatarInput.files[0]));
  }

  if (avatarDrop) {
    avatarDrop.addEventListener("click", () => {
      if (!avatarBusy && avatarInput) avatarInput.click();
    });

    ["dragenter", "dragover"].forEach((type) =>
      avatarDrop.addEventListener(type, (e) => {
        e.preventDefault();
        if (!avatarBusy) avatarDrop.classList.add("is-over");
      }));

    ["dragleave", "dragend", "drop"].forEach((type) =>
      avatarDrop.addEventListener(type, () => avatarDrop.classList.remove("is-over")));

    avatarDrop.addEventListener("drop", (e) => {
      e.preventDefault();
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) useFile(files[0]);
    });
  }

  if (avatarRemove) {
    avatarRemove.addEventListener("click", async () => {
      if (avatarBusy) return;
      setAvatarBusy(true);
      showAvatarNote("Removing…");
      try {
        await window.MuProfiles.removeAvatar();
        showAvatarNote("Picture removed — back to your initial.", "ok");
      } catch (err) {
        showAvatarNote(err.message, "error");
      } finally {
        setAvatarBusy(false);
      }
    });
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
