/* =====================================================================
   MuscleUp — the standings panel docked to the skill tree

   A short version of the leaderboard, collapsed to a tab by default and
   expandable over the map: the top few athletes, plus your own line if
   you're further down. The full board lives on leaderboard.html.
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const board = document.getElementById("tree-board");
  if (!board || !window.MuProfiles) return;

  const toggle = document.getElementById("tree-board-toggle");
  const panel = document.getElementById("tree-board-panel");
  const listEl = document.getElementById("tree-board-list");
  const statusEl = document.getElementById("tree-board-status");

  const TOP = 5;                       // rows shown before your own line
  const OPEN_KEY = "mu-tree-board-open";
  const nf = new Intl.NumberFormat();

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function setStatus(message, kind) {
    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.className = `tree-board__status${kind ? ` is-${kind}` : ""}`;
  }

  /* ---- the panel sits on the map, which pans and zooms under the
          pointer — keep its own gestures to itself ---- */
  ["pointerdown", "pointermove", "pointerup", "wheel"].forEach((type) =>
    board.addEventListener(type, (e) => e.stopPropagation()));

  /* ---- expand / collapse ---- */
  let open = false;
  try { open = localStorage.getItem(OPEN_KEY) === "1"; } catch (err) {}

  function setOpen(next, remember) {
    open = next;
    board.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (remember) {
      try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch (err) {}
    }
    if (open) refresh(true);
  }

  toggle.addEventListener("click", () => setOpen(!open, true));

  /* ---- one row ---- */
  function row(profile, rank, meId) {
    const isMe = profile.id === meId;
    const name = window.MuProfiles.displayName(profile);
    return `<li class="tree-board__row${isMe ? " is-me" : ""}">` +
      `<span class="tree-board__rank">${rank}</span>` +
      `<span class="tree-board__name">${esc(name)}</span>` +
      `<span class="tree-board__reps">${nf.format(profile.totalReps)}</span>` +
      `</li>`;
  }

  /* ---- load + draw ---- */
  let loading = false;
  let queued = false;

  async function refresh(push) {
    if (!open) return;

    const user = window.MuAuth.currentUser();
    if (!user) {
      listEl.innerHTML = "";
      setStatus("Log in to see where you rank.");
      return;
    }

    if (loading) { queued = true; return; }
    loading = true;

    try {
      // same reasoning as the full board: publish my reps before reading,
      // so my own line can't show yesterday's numbers
      if (push) {
        try { await window.MuProfiles.pushStats(); } catch (err) { /* shown below if listing fails too */ }
      }

      const profiles = await window.MuProfiles.list();
      const meIndex = profiles.findIndex((p) => p.id === user.id);

      let html = profiles.slice(0, TOP).map((p, i) => row(p, i + 1, user.id)).join("");
      // your own line, when you're below the cut
      if (meIndex >= TOP) {
        html += `<li class="tree-board__gap" aria-hidden="true">···</li>`;
        html += row(profiles[meIndex], meIndex + 1, user.id);
      }

      listEl.innerHTML = html;
      setStatus(profiles.length ? "" : "No athletes registered yet.");
    } catch (err) {
      listEl.innerHTML = "";
      setStatus(err.message, "error");
    } finally {
      loading = false;
      if (queued) { queued = false; refresh(false); }
    }
  }

  window.MuAuth.onChange(() => refresh(true));
  // fires once the debounced rep sync has landed
  window.MuProfiles.onChange(() => refresh(false));

  setOpen(open, false);
});
