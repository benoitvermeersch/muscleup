/* =====================================================================
   MuscleUp — landing interactions, theme toggle & the Skill Tree wheel
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initWaitlist();
  initJoinSection();
  initUserCount();
  initSkillTree();
});

/* ---------------------------------------------------------------------
   "X Active Users" in the hero. Starts hidden and only appears once a
   real number comes back — an empty or unreachable board should say
   nothing rather than boast about zero athletes.
   --------------------------------------------------------------------- */
function initUserCount() {
  const block = document.getElementById("stat-users-block");
  const value = document.getElementById("stat-users");
  const label = document.getElementById("stat-users-label");
  if (!block || !value || !window.MuProfiles) return;

  const show = (total) => {
    value.textContent = total.toLocaleString();
    label.textContent = total === 1 ? "Active User" : "Active Users";
    block.hidden = false;
  };

  // last visit's number, on screen before the request is even sent
  const known = window.MuProfiles.cachedCount();
  if (known) show(known);

  window.MuProfiles.count()
    .then((total) => { if (total) show(total); })
    .catch((err) => console.warn("[MuscleUp] user count unavailable:", err.message));
}

/* ---------------------------------------------------------------------
   The "create your account" section is only useful to signed-out
   visitors — once you have an account it's just asking you to sign up
   for something you already have.
   --------------------------------------------------------------------- */
function initJoinSection() {
  const join = document.getElementById("join");
  if (!join || !window.MuAuth) return;

  const sync = () => { join.hidden = Boolean(window.MuAuth.currentUser()); };
  window.MuAuth.onChange(sync);
  sync();
}

/* ---------------------------------------------------------------------
   Waitlist form
   --------------------------------------------------------------------- */
function initWaitlist() {
  const form = document.getElementById("waitlist-form");
  const note = document.getElementById("waitlist-note");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    if (!email || !window.MuAuth) return;

    if (window.MuAuth.currentUser()) {
      note.textContent = "You're already signed in — open the skill tree and keep climbing.";
      note.classList.add("is-success");
      return;
    }

    // hand the address straight to the real signup form
    window.MuAuth.openModal("signup");
    const field = document.getElementById("signup-email");
    if (field) {
      field.value = email;
      const password = document.getElementById("signup-password");
      if (password) password.focus();
    }
    form.reset();
  });
}

/* ---------------------------------------------------------------------
   Skill data, rep counters and favourites all live in js/skills.js, so the
   leaderboard and the profile page read the same numbers this map draws.
   --------------------------------------------------------------------- */
const {
  FAMILY, CATEGORIES, RANKS, REPS_PER_RANK, UNLOCK_REPS, STARTERS,
  repsOf, addRepsTo, setRepsTo, rankIndex, isUnlocked, prereqsOf, skillByKey,
  isFavourite, toggleFavourite, MAX_REPS_PER_ENTRY,
} = window.MuSkills;

/* ---------------------------------------------------------------------
   Layout engine: radial tidy-tree fanned into an upward "V" wedge
   --------------------------------------------------------------------- */
const CIRCLE_R = 32;  // skill node radius
const LABEL_H  = 62;  // space under each circle for the name (up to 3 lines) + bar
const FO_W     = 126; // node footprint width (for bounding box)
const BASE_R = 300;   // radius of the first ring (depth 1)
const RING   = 195;   // distance between rings
const CENTER_ANGLE = -Math.PI / 2;         // wedge points straight up

/* The carousel only ever has three slices in play — the branch you're on and
   the two either side of it — so a branch gets a third of the circle rather
   than a fifth, and those three still tile 360° exactly. A fifth would close
   the wheel too, but at 72° each it leaves every branch in a narrow column.

   Slice width and the angle between neighbours have to be the same number.
   Pull them apart and every join shows a sliver of nothing, which is what a
   110° slice placed every 122° used to do.

   The two slices furthest from centre come to rest on top of the two nearest.
   They're faded out well before they get there, so nothing is drawn twice.

   Nodes sit inside a slightly narrower fan than the slice they belong to, so
   a wide label on the edge of one branch doesn't lean into its neighbour. */
const WEDGES_IN_VIEW = 3;
const WEDGE_DEG  = 360 / WEDGES_IN_VIEW;    // 120° across
const ROT_STEP   = WEDGE_DEG;               // deg between adjacent wedges
const NODE_INSET = 8;                       // deg kept clear of each divider
const WEDGE_SPAN = ((WEDGE_DEG - NODE_INSET) * Math.PI) / 180;

const R_START   = 210;                      // vertical radius of the START base (used for edge offset + text)
const R_START_X = 250;                       // horizontal radius — a touch wider than tall

// clean inline padlock (no emoji)
const LOCK_SVG =
  '<svg class="lock-ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
  '<path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6.5A2.5 2.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-6A2.5 2.5 0 0 0 17.5 10H17V7a5 5 0 0 0-5-5zm3 8H9V7a3 3 0 0 1 6 0v3zm-3 3.25a1.75 1.75 0 0 1 .75 3.33V19a.75.75 0 0 1-1.5 0v-2.42A1.75 1.75 0 0 1 12 13.25z"/>' +
  '</svg>';

// the star drawn on a favourited node and inside the popup button
const STAR_PATH = "M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.4l-5.8 3.06 1.11-6.46-4.7-4.58 6.49-.94z";

function layoutCategory(cat) {
  const nodes = cat.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map();
  const roots = [];

  nodes.forEach((n) => {
    if (n.parent === "START" || !byId.has(n.parent)) {
      roots.push(n.id);
    } else {
      if (!children.has(n.parent)) children.set(n.parent, []);
      children.get(n.parent).push(n.id);
    }
  });
  children.set("START", roots);

  const depth = new Map();
  const breadth = new Map();
  let leafCursor = 0;

  (function dfs(id, d) {
    depth.set(id, d);
    const kids = children.get(id) || [];
    if (kids.length === 0) {
      breadth.set(id, leafCursor++);
      return;
    }
    let sum = 0;
    kids.forEach((k) => { dfs(k, d + 1); sum += breadth.get(k); });
    breadth.set(id, sum / kids.length);
  })("START", 0);

  const leaves = Math.max(1, leafCursor);
  const maxBreadth = Math.max(1, leaves - 1);
  const maxDepth = Math.max(...nodes.map((n) => depth.get(n.id)));
  const maxR = BASE_R + (maxDepth - 1) * RING;

  // every wedge is exactly one fifth of the circle
  const span = WEDGE_SPAN;

  const pos = new Map();
  pos.set("START", { x: 0, y: 0, angle: CENTER_ANGLE });

  let aMin = CENTER_ANGLE, aMax = CENTER_ANGLE;

  nodes.forEach((n) => {
    const d = depth.get(n.id);
    const frac = leaves === 1 ? 0.5 : breadth.get(n.id) / maxBreadth;
    const angle = CENTER_ANGLE + (frac - 0.5) * span;
    const r = BASE_R + (d - 1) * RING;
    pos.set(n.id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, angle });
    if (angle < aMin) aMin = angle;
    if (angle > aMax) aMax = angle;
  });

  return { pos, byId, maxR, aMin, aMax };
}

/* ---------------------------------------------------------------------
   SVG rendering
   --------------------------------------------------------------------- */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fam(node) { return FAMILY[node.fam] || { name: node.fam, color: "#8a93a3" }; }

// wrap a skill name onto at most three centred lines
function wrapLabel(s) {
  const words = String(s).split(" ");
  const MAX = 16;
  const MAX_LINES = 3;
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur.length + 1 + w.length) > MAX) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  if (lines.length > MAX_LINES) {
    lines[MAX_LINES - 1] = lines.slice(MAX_LINES - 1).join(" ");
    lines.length = MAX_LINES;
  }
  return lines;
}

// padlock drawn as a native SVG path, centred on (cx, cy)
function lockGlyph(cx, cy) {
  const s = 0.92;
  return `<g class="skill-lock" transform="translate(${(cx - 12 * s).toFixed(1)},${(cy - 12 * s).toFixed(1)}) scale(${s})">` +
    '<path d="M12 2a5 5 0 0 0-5 5v3H6.5A2.5 2.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-6A2.5 2.5 0 0 0 17.5 10H17V7a5 5 0 0 0-5-5zm3 8H9V7a3 3 0 0 1 6 0v3z"/></g>';
}

// favourite star, drawn as a native SVG path centred on (cx, cy)
function starGlyph(cx, cy, scale) {
  const s = scale || 1;
  return `<g class="skill-star" transform="translate(${(cx - 12 * s).toFixed(1)},${(cy - 12 * s).toFixed(1)}) scale(${s})">` +
    `<path d="${STAR_PATH}"/></g>`;
}

function trimLine(from, to, offFrom, offTo) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  return {
    x1: from.x + ux * offFrom, y1: from.y + uy * offFrom,
    x2: to.x - ux * offTo,     y2: to.y - uy * offTo,
  };
}

function renderCategorySVG(cat, rOuter) {
  const { pos } = layoutCategory(cat);

  // --- wedge backdrop: exactly one slice of the wheel ---
  // Cut from the slice's own geometry rather than from wherever the nodes
  // happened to land, and out to the radius shared by every branch, so the
  // five sectors tile the circle with no gap and no overlap.
  const half = (WEDGE_DEG * Math.PI) / 360;
  const a0 = CENTER_ANGLE - half, a1 = CENTER_ANGLE + half;
  const SAMPLES = 28;
  let sector = `M 0 0`;
  for (let i = 0; i <= SAMPLES; i++) {
    const a = a0 + (a1 - a0) * (i / SAMPLES);
    sector += ` L ${(Math.cos(a) * rOuter).toFixed(1)} ${(Math.sin(a) * rOuter).toFixed(1)}`;
  }
  sector += " Z";
  let svg = `<path class="tt-sector" d="${sector}"/>`;

  // faint depth-ring guides, carried across the whole slice
  const rings = Math.max(2, Math.floor((rOuter - BASE_R) / RING) + 1);
  for (let i = 1; i <= rings; i++) {
    const rr = (BASE_R + (i - 1) * RING).toFixed(1);
    let arc = "";
    for (let j = 0; j <= SAMPLES; j++) {
      const a = a0 + (a1 - a0) * (j / SAMPLES);
      arc += `${j === 0 ? "M" : "L"} ${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)} `;
    }
    svg += `<path class="tt-sector-tick" fill="none" d="${arc}"/>`;
  }

  // --- edges (primary tree + AND/OR extras) ---
  // A parent on another branch has no position in this wedge, so the edge
  // falls back to the START base — the same as a root — and the padlock
  // popup is what names the skill it's actually waiting on.
  const OFF = CIRCLE_R + 5;
  let edges = "";
  cat.nodes.forEach((n) => {
    const c = pos.get(n.id);
    const inWedge = n.parent !== "START" && pos.has(n.parent);
    const parent = inWedge ? pos.get(n.parent) : pos.get("START");
    const offFrom = inWedge ? OFF : R_START;
    const l = trimLine(parent, c, offFrom, OFF);
    edges += `<line class="tt-edge" x1="${l.x1.toFixed(1)}" y1="${l.y1.toFixed(1)}" x2="${l.x2.toFixed(1)}" y2="${l.y2.toFixed(1)}" marker-end="url(#tt-arrow)"/>`;
    (n.extra || []).forEach((exId) => {
      const ex = pos.get(exId);
      if (!ex) return;
      const le = trimLine(ex, c, OFF, OFF);
      edges += `<line class="tt-edge tt-edge--extra" x1="${le.x1.toFixed(1)}" y1="${le.y1.toFixed(1)}" x2="${le.x2.toFixed(1)}" y2="${le.y2.toFixed(1)}" marker-end="url(#tt-arrow)"/>`;
    });
  });
  svg += edges;

  // --- AND / OR chips (native SVG) ---
  // The chip labels the way in, so it rides the edge back toward the primary
  // parent — far enough out to clear the skill's own name and progress bar.
  cat.nodes.forEach((n) => {
    if (!n.connector) return;
    const c = pos.get(n.id);
    const from = (n.parent !== "START" && pos.get(n.parent)) || pos.get("START");
    const dx = from.x - c.x, dy = from.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    const out = Math.min(CIRCLE_R + 70, Math.max(CIRCLE_R + 13, len - CIRCLE_R));
    const cx = c.x + (dx / len) * out;
    const cy = c.y + (dy / len) * out;
    svg += `<g class="tt-chip"><rect x="${(cx - 17).toFixed(1)}" y="${(cy - 9).toFixed(1)}" width="34" height="18" rx="9"/>` +
      `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" dy="0.32em" text-anchor="middle">${n.connector}</text></g>`;
  });

  // --- nodes: circle with an exercise icon, name underneath (native SVG) ---
  const foW = FO_W;
  cat.nodes.forEach((n) => {
    const c = pos.get(n.id);
    const f = fam(n);
    const unlocked = isUnlocked(cat, n);
    const reps = repsOf(cat.key, n.id);
    const mastered = unlocked && rankIndex(reps) >= RANKS.length - 1;
    const starred = isFavourite(`${cat.key}:${n.id}`);
    const cls = ["skill-node"];
    if (n.legendary) cls.push("is-legendary");
    if (!unlocked) cls.push("is-locked");
    if (mastered) cls.push("is-mastered");
    if (starred) cls.push("is-favourite");

    const inner = unlocked
      ? `<text class="skill-dot__icon" x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" dy="0.34em" text-anchor="middle">${f.icon || "•"}</text>`
      : lockGlyph(c.x, c.y);

    const lines = wrapLabel(n.label);
    const ly = c.y + CIRCLE_R + 15;
    const label = lines.map((ln, i) =>
      `<tspan x="${c.x.toFixed(1)}" dy="${i === 0 ? 0 : 13}">${esc(ln)}</tspan>`).join("");

    // progress bar under the name — fills toward Mastered, in the category colour
    const total = REPS_PER_RANK * (RANKS.length - 1);
    const prog = unlocked ? Math.min(1, reps / total) : 0;
    const barW = 52, barH = 5;
    const barY = ly + (lines.length - 1) * 13 + 9;
    const barX = c.x - barW / 2;
    const bar = `<g class="skill-bar">` +
      `<rect class="skill-bar__track" x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW}" height="${barH}" rx="${barH / 2}"/>` +
      (prog > 0 ? `<rect class="skill-bar__fill" x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" width="${(barW * prog).toFixed(1)}" height="${barH}" rx="${barH / 2}"/>` : "") +
      `</g>`;

    // a gold star sits on the shoulder of the one skill you've favourited
    const star = starred ? starGlyph(c.x + CIRCLE_R * 0.72, c.y - CIRCLE_R * 0.72, 0.86) : "";

    svg += `<g class="${cls.join(" ")}" data-node="${cat.key}:${n.id}" style="--fam:${cat.color}">` +
      `<circle class="skill-dot" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${CIRCLE_R}"/>` +
      inner +
      star +
      `<text class="skill-dot__label" x="${c.x.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${label}</text>` +
      bar +
      `</g>`;
  });

  // Bounding box of what there is to look at — the skills and the START base.
  // The sector backdrop is deliberately left out: it now runs to a radius
  // shared by all five branches, and taking that as the extent of a short
  // branch would leave you panning around a lot of empty slice.
  const xs = [], ys = [];
  cat.nodes.forEach((n) => {
    const c = pos.get(n.id);
    xs.push(c.x - foW / 2, c.x + foW / 2);
    ys.push(c.y - CIRCLE_R, c.y + CIRCLE_R + LABEL_H);
  });
  xs.push(-R_START_X, R_START_X);
  ys.push(-R_START, 60);
  const P = 70;
  const minX = Math.min(...xs) - P, maxX = Math.max(...xs) + P;
  const minY = Math.min(...ys) - P, maxY = Math.max(...ys) + P;

  return {
    markup: svg,
    box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}

/* ---------------------------------------------------------------------
   Overlay controller: open/close, navigation, pan / zoom / swipe
   --------------------------------------------------------------------- */
function initSkillTree() {
  const overlay  = document.getElementById("tree-overlay");
  const svg      = document.getElementById("tree-svg");
  const stage    = document.getElementById("tree-stage");
  const legendEl = document.getElementById("tree-legend");
  const dotsEl   = document.getElementById("tree-dots");
  const nameEl   = document.getElementById("tree-cat-name");
  const iconEl   = document.getElementById("tree-cat-icon");
  const checkEl  = document.getElementById("tree-cat-check");
  const metaEl   = document.getElementById("tree-cat-meta");
  const popEl    = document.getElementById("skill-pop");
  const popBody  = document.getElementById("skill-pop-body");
  if (!overlay || !svg) return;

  const N = CATEGORIES.length;
  let pos = 0, targetPos = 0, animating = false, animRAF = 0;
  let wedgeEls = [];
  const boxes = [];
  let box = { x: 0, y: 0, w: 1000, h: 1000 };
  let vb  = { x: 0, y: 0, w: 100, h: 100 };
  let homeW = 1500;   // viewBox width of the default (home) view, for zoom-out limits

  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const targetIndex = () => ((Math.round(targetPos) % N) + N) % N;

  // keep panning inside the wedge: horizontal within its width, vertical within
  // its height, and never below the middle of the START base circle (y = 0)
  function clampView() {
    if (box.w <= 1) return;
    const bx0 = box.x, bx1 = box.x + box.w;
    const by0 = box.y, by1 = 0;                 // bottom limit = START centre
    if (vb.w >= bx1 - bx0) vb.x = (bx0 + bx1) / 2 - vb.w / 2;
    else vb.x = Math.min(Math.max(vb.x, bx0), bx1 - vb.w);
    if (vb.h >= by1 - by0) vb.y = by1 - vb.h;    // taller than region → pin bottom to y=0
    else vb.y = Math.min(Math.max(vb.y, by0), by1 - vb.h);
  }
  function applyViewBox() {
    clampView();
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  // default landing view: zoomed in on START + the first rings
  function home() {
    const sw = stage.clientWidth || 1200;
    const sh = stage.clientHeight || 700;
    const viewH = BASE_R + RING * 2.4;
    const viewW = viewH * (sw / sh);
    homeW = viewW;
    vb = { x: -viewW / 2, y: -viewH, w: viewW, h: viewH };  // bottom at y=0 (top of START circle base)
    applyViewBox();
  }

  /* ---- build the full 5-wedge wheel once ---- */
  function build() {
    let inner = `<defs><marker id="tt-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--tt-line)"/></marker></defs>`;
    inner += `<g id="tt-wheel">`;
    // the deepest branch sets the rim, and every slice is drawn to it
    const rOuter = CATEGORIES.reduce(
      (max, cat) => Math.max(max, layoutCategory(cat).maxR), 0) + BASE_R * 0.5;
    CATEGORIES.forEach((cat, i) => {
      const { markup, box: b } = renderCategorySVG(cat, rOuter);
      boxes[i] = b;
      inner += `<g class="tt-wedge" data-wi="${i}">${markup}</g>`;
    });
    inner += `</g>`;
    inner += `<g class="tt-start"><ellipse cx="0" cy="0" rx="${R_START_X}" ry="${R_START}"/>` +
      `<text x="0" y="${(-R_START * 0.4).toFixed(0)}">START</text></g>`;
    svg.innerHTML = inner;
    wedgeEls = Array.from(svg.querySelectorAll(".tt-wedge"));
    layoutWheel();
  }

  /* ---- position every wedge around the START vertex per `pos` ---- */
  function layoutWheel() {
    wedgeEls.forEach((el) => {
      const i = +el.dataset.wi;
      const iu = i + N * Math.round((pos - i) / N);   // nearest unrolled slot
      const theta = (iu - pos) * ROT_STEP;            // degrees around origin
      el.setAttribute("transform", `rotate(${theta.toFixed(2)})`);
      const a = Math.abs(theta);
      // The three slices nearest the centre make up the whole circle, so they
      // all stay drawn, with the centred branch brought forward out of the
      // others. Beyond them a slice is on its way to a place already taken,
      // and has faded to nothing by the time it lands there.
      const op = a < 1 ? 1 : Math.max(0, 1 - a / (ROT_STEP * 1.6));
      el.style.opacity = op.toFixed(3);
      const isCenter = a < ROT_STEP * 0.5;
      el.style.pointerEvents = isCenter && !animating ? "auto" : "none";
      el.classList.toggle("is-current", isCenter);
    });
  }

  /* ---- chrome (title / dots / legend / colour) for the centred branch ---- */
  function buildDots() {
    dotsEl.innerHTML = "";
    CATEGORIES.forEach((cat, i) => {
      const b = document.createElement("button");
      b.className = "tree-dots__dot";
      b.setAttribute("aria-label", cat.label);
      b.addEventListener("click", () => goTo(i));
      dotsEl.appendChild(b);
    });
  }

  function buildLegend(cat) {
    let html = `<span class="tree-legend__item"><span class="tree-legend__sw" style="--sw:${cat.color}"></span>${esc(cat.label)} skill</span>`;
    html += `<span class="tree-legend__item"><span class="tree-legend__sw tree-legend__sw--gold"></span>Mastered</span>`;
    html += `<span class="tree-legend__item"><span class="tree-legend__lock">${LOCK_SVG}</span>Locked — train the previous skill</span>`;
    if (cat.nodes.some((n) => n.connector))
      html += `<span class="tree-legend__item">AND / OR prerequisite</span>`;
    // a line that starts on another branch has no visible parent here
    if (cat.nodes.some((n) => prereqsOf(cat.key, n).some((r) => r.catKey !== cat.key)))
      html += `<span class="tree-legend__item">Some skills need another branch</span>`;
    legendEl.innerHTML = html;
  }

  function updateChrome() {
    const i = targetIndex();
    const cat = CATEGORIES[i];
    overlay.style.setProperty("--cat-color", cat.color);
    nameEl.textContent = cat.label;
    iconEl.textContent = cat.icon;
    metaEl.textContent = `Branch ${i + 1} / ${N}`;
    buildLegend(cat);
    box = boxes[i] || box;
    Array.from(dotsEl.children).forEach((d, di) => d.classList.toggle("is-active", di === i));
  }

  /* ---- animated navigation ---- */
  function animatePos() {
    if (animRAF) cancelAnimationFrame(animRAF);
    animating = true;
    const start = pos, end = targetPos, t0 = performance.now(), dur = 460;
    (function frame(t) {
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
      pos = start + (end - start) * e;
      layoutWheel();
      if (k < 1) { animRAF = requestAnimationFrame(frame); }
      else { pos = end; animating = false; layoutWheel(); }
    })(t0);
  }
  function navigate(dir) {
    targetPos = Math.round(targetPos) + dir;
    updateChrome();
    animatePos();
  }
  function goTo(i) {
    const cur = ((Math.round(targetPos) % N) + N) % N;
    let d = i - cur;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    targetPos = Math.round(targetPos) + d;
    updateChrome();
    animatePos();
  }

  /* ---- signed-out preview notice ---- */
  const previewBar = document.getElementById("tree-preview-bar");
  function syncPreviewBar() {
    if (!previewBar) return;
    previewBar.hidden = Boolean(window.MuAuth && window.MuAuth.currentUser());
  }

  /* ---- open / close ---- */
  function open() {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");
    syncPreviewBar();
    requestAnimationFrame(() => {
      build(); updateChrome(); home(); requestAnimationFrame(layoutWheel);
      if (!hasAssessed()) openAssessment();
    });
  }
  function close() { closePopup(); overlay.classList.remove("is-open"); overlay.setAttribute("aria-hidden", "true"); document.body.classList.remove("is-locked"); }

  // Links from the other pages can't open an overlay that lives here, so
  // they arrive as index.html?tree — open the map and tidy the URL, leaving
  // a plain reload showing the landing page as normal.
  (function openFromUrl() {
    const params = new URLSearchParams(location.search);
    if (!params.has("tree")) return;
    params.delete("tree");
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
    open();
  })();

  // Delegated, because the header nav is rebuilt whenever you sign in or
  // out — a handler bound to today's link would be thrown away with it.
  document.addEventListener("click", (e) => {
    // The tree is open to everyone. Signed out, progress is kept under a
    // "guest" key on this device; signing in swaps to that account's tree.
    if (e.target.closest("[data-open-tree]")) {
      e.preventDefault();
      open();
      return;
    }

    // The header "Skill Tree" link goes straight to the map once you have an
    // account. Signed out it keeps its href and just scrolls down to the
    // branches section, so the page still works without JS.
    if (e.target.closest("[data-tree-link]")) {
      if (!(window.MuAuth && window.MuAuth.currentUser())) return;
      e.preventDefault();
      open();
    }
  });

  // switching account (in either direction) swaps which tree is on screen.
  // MuSkills has already reloaded that account's reps by the time this runs.
  if (window.MuAuth) {
    window.MuAuth.onChange(() => {
      syncPreviewBar();
      if (overlay.classList.contains("is-open")) { build(); updateChrome(); layoutWheel(); }
    });
  }

  /* ---- first-run assessment ---- */
  const assessEl = document.getElementById("assess");
  const assessList = document.getElementById("assess-list");
  const assessCount = document.getElementById("assess-count");

  const assessKey = () => (window.MuAuth ? window.MuAuth.scopedKey("mu-assessed") : "mu-assessed");
  function hasAssessed() {
    try { return localStorage.getItem(assessKey()) === "1"; } catch (e) { return true; }
  }
  function markAssessed() {
    try { localStorage.setItem(assessKey(), "1"); } catch (e) {}
  }

  function starterInfo(entry) {
    const cat = CATEGORIES.find((c) => c.key === entry.cat);
    const node = cat && cat.nodes.find((n) => n.id === entry.id);
    return { cat, node };
  }

  function refreshAssessCount() {
    const n = assessList.querySelectorAll(".assess__item.is-checked").length;
    assessCount.textContent = n === 0
      ? "Nothing ticked — you'll start at the base of every branch."
      : `${n} skill${n === 1 ? "" : "s"} ticked — that opens the next node on ${n === 1 ? "that line" : "those lines"}.`;
  }

  function openAssessment() {
    if (!assessEl) return;
    if (window.MuAuth && window.MuAuth.hideBanner) window.MuAuth.hideBanner();

    assessList.innerHTML = STARTERS.map((entry) => {
      const { cat, node } = starterInfo(entry);
      if (!cat || !node) return "";
      return `<label class="assess__item" style="--branch:${cat.color}">` +
        `<input type="checkbox" data-starter="${entry.cat}:${entry.id}">` +
        `<span class="assess__box" aria-hidden="true"></span>` +
        `<span class="assess__icon" aria-hidden="true">${entry.icon}</span>` +
        `<span class="assess__text">` +
          `<span class="assess__name">${esc(node.label)}</span>` +
          `<span class="assess__target">${esc(entry.target)}</span>` +
        `</span>` +
        `<span class="assess__branch">${esc(cat.label)}</span>` +
        `</label>`;
    }).join("");

    assessList.querySelectorAll("input[data-starter]").forEach((input) => {
      input.addEventListener("change", () => {
        input.closest(".assess__item").classList.toggle("is-checked", input.checked);
        refreshAssessCount();
      });
    });

    refreshAssessCount();
    assessEl.hidden = false;
    requestAnimationFrame(() => assessEl.classList.add("is-open"));
  }

  function closeAssessment() {
    assessEl.classList.remove("is-open");
    setTimeout(() => { assessEl.hidden = true; }, 180);
  }

  if (assessEl) {
    document.getElementById("assess-save").addEventListener("click", () => {
      let unlocked = 0;
      assessList.querySelectorAll("input[data-starter]:checked").forEach((input) => {
        const [catKey, id] = input.dataset.starter.split(":");
        // credit exactly the reps needed to hit Novice, which is the unlock gate
        if (repsOf(catKey, id) < UNLOCK_REPS) setRepsTo(catKey, id, UNLOCK_REPS);
        unlocked++;
      });
      markAssessed();
      closeAssessment();
      build(); updateChrome(); layoutWheel();
      if (unlocked && window.MuAuth && window.MuAuth.banner) {
        window.MuAuth.banner(`${unlocked} skill${unlocked === 1 ? "" : "s"} unlocked. Tap any node to log reps.`, "ok");
      }
    });

    document.getElementById("assess-skip").addEventListener("click", () => {
      markAssessed();
      closeAssessment();
    });
  }
  document.getElementById("tree-close").addEventListener("click", close);
  document.getElementById("tree-prev").addEventListener("click", () => navigate(-1));
  document.getElementById("tree-next").addEventListener("click", () => navigate(1));
  buildDots();

  /* ---- skill popup ---- */
  function nodeByKey(key) {
    const [catKey, id] = key.split(":");
    const cat = CATEGORIES.find((c) => c.key === catKey);
    const node = cat && cat.nodes.find((n) => n.id === id);
    return { cat, node };
  }
  function openPopup(key, notice) {
    const { cat, node } = nodeByKey(key);
    if (!cat || !node) return;
    const f = fam(node);
    const unlocked = isUnlocked(cat, node);
    const reps = repsOf(cat.key, node.id);
    const ri = rankIndex(reps);
    const into = reps % REPS_PER_RANK;
    const isMax = ri >= RANKS.length - 1;

    const starred = isFavourite(key);
    const badgeCls = unlocked ? (isMax ? "is-mastered" : "") : "is-locked";
    let html = `<div class="pop-head">` +
      `<div class="pop-badge ${badgeCls}" style="--fam:${cat.color}">${unlocked ? (f.icon || "•") : LOCK_SVG}</div>` +
      `<div><h3 class="pop-name">${esc(node.label)}</h3>` +
      `<div class="pop-sub">${esc(cat.label)}${isMax ? " · Mastered" : ""}</div></div></div>`;

    // Favourite the position — one per account, shown next to your name on
    // the leaderboard. Locked skills count too: a goal is a fine favourite.
    html += `<button type="button" id="pop-fav" class="pop-fav${starred ? " is-on" : ""}" ` +
      `aria-pressed="${starred}">` +
      `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${STAR_PATH}"/></svg>` +
      `<span>${starred ? "Your favourite position" : "Make this my favourite"}</span></button>`;

    if (!unlocked) {
      // One prerequisite reads as a single sentence; several need to say
      // whether you're chasing all of them or just the quickest one.
      const refs = prereqsOf(cat.key, node).map((ref) => {
        const found = skillByKey(`${ref.catKey}:${ref.id}`);
        return { ...ref, cat: found.cat, node: found.node, reps: repsOf(ref.catKey, ref.id) };
      }).filter((ref) => ref.node);

      const lead = !refs.length ? "the previous skill"
        : refs.length > 1 ? `<b>${node.connector === "AND" ? "all" : "any"}</b> of these`
        : `<b>${esc(refs[0].node.label)}</b>`;

      html += `<div class="pop-locked">` +
        `<div class="pop-lock-ico">${LOCK_SVG}</div>` +
        `<p>Locked. Reach <b>Novice</b> (${UNLOCK_REPS} reps) on ${lead} to unlock this skill.</p>`;

      refs.forEach((ref) => {
        // name the branch too when the prerequisite is on a different wedge
        const away = ref.cat && ref.cat.key !== cat.key ? ` · ${esc(ref.cat.label)}` : "";
        html += `<div class="pop-bar"><i style="width:${Math.min(100, (ref.reps / UNLOCK_REPS) * 100).toFixed(1)}%"></i></div>` +
          `<div class="pop-bar__meta">${esc(ref.node.label)}${away}: ${ref.reps} / ${UNLOCK_REPS} reps</div>`;
      });

      html += `</div>`;
    } else {
      html += `<div class="pop-rank"><span class="rank-chip rank-${ri}">${RANKS[ri]}</span>` +
        `<span class="pop-reps"><b>${reps}</b> total reps</span></div>`;
      html += `<div class="pop-bar"><i style="width:${isMax ? 100 : ((into / REPS_PER_RANK) * 100).toFixed(1)}%"></i></div>`;
      html += `<div class="pop-bar__meta">` +
        (isMax ? `Mastered — every skill in this line is open to you.`
               : `${into} / ${REPS_PER_RANK} reps to <b>${RANKS[ri + 1]}</b>`) + `</div>`;
      html += `<div class="pop-add">` +
        `<input id="pop-add-input" type="number" min="1" step="1" max="${MAX_REPS_PER_ENTRY}" ` +
        `value="10" inputmode="numeric" aria-label="Reps to add">` +
        `<button id="pop-add-btn" class="btn btn--primary">Add reps</button></div>`;
      html += `<div class="pop-quick">` +
        [5, 10, 25, 50].map((q) => `<button class="pop-quick__b" data-q="${q}">+${q}</button>`).join("") + `</div>`;
      if (notice) html += `<p class="pop-warn">${esc(notice)}</p>`;
      html += `<p class="pop-note">Every ${REPS_PER_RANK} reps earns the next rank, and you can log up to ` +
        `${MAX_REPS_PER_ENTRY.toLocaleString()} reps at a time. Hit Novice to unlock the skill above this one.</p>`;
    }

    popBody.innerHTML = html;
    popEl.dataset.key = key;
    popEl.hidden = false;
    requestAnimationFrame(() => popEl.classList.add("is-open"));

    const favBtn = document.getElementById("pop-fav");
    if (favBtn) {
      favBtn.addEventListener("click", () => {
        toggleFavourite(key);
        build(); layoutWheel();      // move the star to (or off) the node
        openPopup(key);              // refresh popup contents
      });
    }

    const doAdd = (value) => {
      const wanted = Math.floor(Number(value));
      if (!Number.isFinite(wanted) || wanted <= 0) {
        return openPopup(key, "Enter how many reps you did.");
      }

      const added = addRepsTo(cat.key, node.id, wanted);
      build(); layoutWheel();        // reflect new unlocks / ranks

      // say so rather than silently banking a different number
      const capped = added < wanted
        ? `That's more than a set — logged ${added.toLocaleString()} reps, the most allowed at a time.`
        : "";
      openPopup(key, capped);        // refresh popup contents
    };
    const addBtn = document.getElementById("pop-add-btn");
    if (addBtn) {
      const input = document.getElementById("pop-add-input");
      addBtn.addEventListener("click", () => doAdd(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doAdd(e.target.value);
      });
      // pull an over-long number back into range as it's typed
      input.addEventListener("input", () => {
        const n = Math.floor(Number(input.value));
        if (Number.isFinite(n) && n > MAX_REPS_PER_ENTRY) input.value = String(MAX_REPS_PER_ENTRY);
      });
      popBody.querySelectorAll(".pop-quick__b").forEach((b) =>
        b.addEventListener("click", () => doAdd(parseInt(b.dataset.q, 10))));
    }
  }
  function closePopup() {
    popEl.classList.remove("is-open");
    popEl.hidden = true;
    delete popEl.dataset.key;
  }
  popEl.querySelectorAll("[data-pop-close]").forEach((el) => el.addEventListener("click", closePopup));

  /* ---- zoom helpers ---- */
  function clientToUser(clientX, clientY) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  function zoomAround(ux, uy, factor) {
    // Out as far as the whole branch on screen at once, and no further —
    // past that you'd only be adding empty space around it. The default view
    // is closer in than that, so there is room to pull back from it.
    const minW = box.w * 0.16;
    const aspect = vb.h > 0 ? vb.w / vb.h : 1;
    const maxW = Math.max(homeW, box.w, box.h * aspect) * 1.04;
    let w = Math.min(Math.max(vb.w * factor, minW), maxW);
    const f = w / vb.w;
    vb.x = ux - (ux - vb.x) * f;
    vb.y = uy - (uy - vb.y) * f;
    vb.w *= f; vb.h *= f;
    applyViewBox();
  }
  const zoomCenter = (factor) => zoomAround(vb.x + vb.w / 2, vb.y + vb.h / 2, factor);

  document.getElementById("tree-zoom-in").addEventListener("click", () => zoomCenter(0.8));
  document.getElementById("tree-zoom-out").addEventListener("click", () => zoomCenter(1.25));
  document.getElementById("tree-zoom-reset").addEventListener("click", home);

  /* ---- pan by a screen-pixel delta, whatever the current zoom ---- */
  function panByPixels(dxPix, dyPix) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const inv = ctm.inverse();
    vb.x += inv.a * dxPix + inv.c * dyPix;
    vb.y += inv.b * dxPix + inv.d * dyPix;
    applyViewBox();
  }

  // Firefox reports scroll in lines or pages rather than pixels
  function toPixels(delta, mode) {
    if (mode === 1) return delta * 16;                        // lines
    if (mode === 2) return delta * (stage.clientHeight || 700); // pages
    return delta;
  }

  // Two fingers on a trackpad move the map, the way every other canvas
  // works — no click needed. Zoom stays on pinch (which browsers deliver as
  // ctrl + wheel), the +/− buttons and the +/− keys.
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const u = clientToUser(e.clientX, e.clientY);
      zoomAround(u.x, u.y, e.deltaY > 0 ? 1.12 : 0.89);
      return;
    }

    panByPixels(toPixels(e.deltaX, e.deltaMode), toPixels(e.deltaY, e.deltaMode));
  }, { passive: false });

  /* ---- pan / swipe / tap ---- */
  let dragging = false, lastX = 0, lastY = 0, startX = 0, startY = 0, startT = 0, moved = 0;

  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    stage.classList.add("is-panning");
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    lastX = startX = e.clientX; lastY = startY = e.clientY;
    startT = performance.now(); moved = 0;
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dxPix = e.clientX - lastX, dyPix = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dxPix) + Math.abs(dyPix);
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const inv = ctm.inverse();
      vb.x -= inv.a * dxPix + inv.c * dyPix;
      vb.y -= inv.b * dxPix + inv.d * dyPix;
      applyViewBox();
    }
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove("is-panning");
    const dt = performance.now() - startT;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (dt < 450 && Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      navigate(dx > 0 ? -1 : 1);
      return;
    }
    if (moved < 8 && dt < 350) {
      const el = document.elementFromPoint(startX, startY);
      const nodeEl = el && el.closest ? el.closest("[data-node]") : null;
      if (nodeEl) openPopup(nodeEl.getAttribute("data-node"));
    }
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", () => { dragging = false; stage.classList.remove("is-panning"); });

  /* ---- keyboard ---- */
  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("is-open")) return;
    if (e.key === "Escape") { if (!popEl.hidden) closePopup(); else close(); }
    else if (e.key === "ArrowLeft") navigate(-1);
    else if (e.key === "ArrowRight") navigate(1);
    else if (e.key === "+" || e.key === "=") zoomCenter(0.8);
    else if (e.key === "-" || e.key === "_") zoomCenter(1.25);
  });

  window.addEventListener("resize", () => {
    if (overlay.classList.contains("is-open")) applyViewBox();
  });
}
