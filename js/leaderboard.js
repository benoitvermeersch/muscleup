/* =====================================================================
   MuscleUp — the leaderboard

   Every registered athlete, ranked by total reps, with the branch they
   train most and the position they've starred as their favourite.
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const gate = document.getElementById("lb-gate");
  const content = document.getElementById("lb-content");
  const statusEl = document.getElementById("lb-status");
  const summaryEl = document.getElementById("lb-summary");
  const bodyEl = document.getElementById("lb-body");
  const countEl = document.getElementById("lb-count");
  if (!bodyEl) return;

  const MEDALS = ["🥇", "🥈", "🥉"];

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  const nf = new Intl.NumberFormat();

  function setStatus(message, kind) {
    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.className = `lb-status${kind ? ` is-${kind}` : ""}`;
  }

  /* ---- branch chip in the category's own colour ---- */
  function categoryChip(key) {
    const cat = key && window.MuSkills.categoryByKey(key);
    if (!cat) return `<span class="lb-chip lb-chip--none">—</span>`;
    return `<span class="lb-chip" style="--chip:${cat.color}">` +
      `<span class="lb-chip__icon" aria-hidden="true">${cat.icon}</span>${esc(cat.label)}</span>`;
  }

  function favouriteCell(profile) {
    if (!profile.favouriteSkillLabel) {
      return `<span class="lb-fav lb-fav--none">Nothing starred yet</span>`;
    }
    const { cat } = window.MuSkills.skillByKey(profile.favouriteSkill || "");
    return `<span class="lb-fav">` +
      `<svg class="lb-fav__star" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">` +
      `<path d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.4l-5.8 3.06 1.11-6.46-4.7-4.58 6.49-.94z"/></svg>` +
      `<span>${esc(profile.favouriteSkillLabel)}</span>` +
      (cat ? `<small>${esc(cat.label)}</small>` : "") +
      `</span>`;
  }

  /* ---- one row ---- */
  function row(profile, index, meId) {
    const isMe = profile.id === meId;
    const name = window.MuProfiles.displayName(profile);
    const full = window.MuProfiles.fullName(profile);
    const rank = index + 1;
    const medal = profile.totalReps > 0 && rank <= 3 ? MEDALS[rank - 1] : "";

    return `<tr class="lb-row${isMe ? " is-me" : ""}">` +
      `<td class="lb-rank">${medal ? `<span class="lb-medal">${medal}</span>` : `<span>${rank}</span>`}</td>` +
      `<td class="lb-athlete">` +
        `<span class="lb-avatar" aria-hidden="true">${esc(name.slice(0, 1).toUpperCase())}</span>` +
        `<span class="lb-names">` +
          `<span class="lb-name">${esc(name)}${isMe ? `<span class="lb-you">You</span>` : ""}</span>` +
          (full && full !== name ? `<span class="lb-fullname">${esc(full)}</span>` : "") +
        `</span>` +
      `</td>` +
      `<td class="lb-reps"><b>${nf.format(profile.totalReps)}</b><small>reps</small></td>` +
      `<td class="lb-cat">${categoryChip(profile.topCategory)}</td>` +
      `<td class="lb-favcell">${favouriteCell(profile)}</td>` +
      `</tr>`;
  }

  /* ---- the strip above the table: where you stand ---- */
  function renderSummary(profiles, meId) {
    const meIndex = profiles.findIndex((p) => p.id === meId);
    const me = meIndex > -1 ? profiles[meIndex] : null;
    const trained = profiles.filter((p) => p.totalReps > 0).length;

    const cards = [
      { label: "Athletes registered", value: nf.format(profiles.length) },
      { label: "Have logged reps", value: nf.format(trained) },
      {
        label: "Your rank",
        value: me && me.totalReps > 0 ? `#${meIndex + 1}` : "—",
        note: me && me.totalReps > 0 ? `of ${nf.format(profiles.length)}` : "log some reps to rank",
      },
      {
        label: "Your total reps",
        value: me ? nf.format(me.totalReps) : "0",
        note: me && me.topCategory ? `most in ${window.MuSkills.categoryByKey(me.topCategory).label}` : "",
      },
    ];

    summaryEl.innerHTML = cards
      .map((c) =>
        `<div class="lb-stat"><span class="lb-stat__value">${esc(c.value)}</span>` +
        `<span class="lb-stat__label">${esc(c.label)}</span>` +
        (c.note ? `<span class="lb-stat__note">${esc(c.note)}</span>` : "") +
        `</div>`)
      .join("");
  }

  /* ---- load + draw ---- */
  let loading = false;

  async function render() {
    const user = window.MuAuth.currentUser();
    gate.hidden = Boolean(user);
    content.hidden = !user;
    if (!user || loading) return;

    loading = true;
    setStatus("Loading the leaderboard…");
    try {
      const profiles = await window.MuProfiles.list();
      renderSummary(profiles, user.id);
      bodyEl.innerHTML = profiles.map((p, i) => row(p, i, user.id)).join("");
      countEl.textContent = profiles.length === 1
        ? "1 athlete"
        : `${nf.format(profiles.length)} athletes`;
      setStatus(profiles.length ? "" : "No athletes registered yet.");
    } catch (err) {
      bodyEl.innerHTML = "";
      summaryEl.innerHTML = "";
      countEl.textContent = "";
      setStatus(err.message, "error");
    } finally {
      loading = false;
    }
  }

  window.MuAuth.onChange(() => render());
  // my own row goes stale the moment I log reps in the tree
  window.MuProfiles.onChange(() => { if (!loading) render(); });
  render();
});
