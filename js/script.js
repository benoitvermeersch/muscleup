/* =====================================================================
   MuscleUp — landing interactions, theme toggle & the Skill Tree wheel
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initWaitlist();
  initTheme();
  initSkillTree();
});

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
    if (!email) return;
    note.textContent = `You're on the list, ${email}. We'll let you know when the tree opens.`;
    note.classList.add("is-success");
    form.reset();
  });
}

/* ---------------------------------------------------------------------
   Light / Dark theme (persisted, controls both landing page + overlay)
   --------------------------------------------------------------------- */
function initTheme() {
  const KEY = "mu-theme";
  const stored = localStorage.getItem(KEY);
  const initial = stored === "light" || stored === "dark" ? stored : "dark";

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
    document.querySelectorAll("[data-theme-set]").forEach((btn) => {
      const on = btn.getAttribute("data-theme-set") === theme;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  document.querySelectorAll("[data-theme-set]").forEach((btn) => {
    btn.addEventListener("click", () => apply(btn.getAttribute("data-theme-set")));
  });

  apply(initial);
}

/* ---------------------------------------------------------------------
   Skill Tree data
   --------------------------------------------------------------------- */

// Colour + simple icon per movement family (shared across categories where the key repeats)
const FAMILY = {
  push:        { name: "Push-Ups",        color: "#e8873a", icon: "💪" },
  dip:         { name: "Dips",            color: "#d9a521", icon: "🔻" },
  planche:     { name: "Planche",         color: "#d6443c", icon: "🤸" },
  ring:        { name: "Rings / Cross",   color: "#20a89f", icon: "⭕" },
  ringPlanche: { name: "Ring Planche",    color: "#3d86d6", icon: "🌀" },
  ringMaltese: { name: "Ring Maltese",    color: "#8a5cd0", icon: "✳️" },
  handstand:   { name: "Handstand",       color: "#3fae6b", icon: "🙃" },

  pull:        { name: "Pull-Ups",        color: "#3d86d6", icon: "🧗" },
  frontLever:  { name: "Front Lever",     color: "#3fae6b", icon: "🦅" },
  victorian:   { name: "Victorian",       color: "#8a5cd0", icon: "👑" },
  backLever:   { name: "Back Lever",      color: "#20a89f", icon: "🔄" },
  hefesto:     { name: "Hefesto",         color: "#e8873a", icon: "🔥" },

  squat:       { name: "Squat",           color: "#3d86d6", icon: "🦵" },
  sissy:       { name: "Sissy Squat",     color: "#20a89f", icon: "🦿" },
  shrimp:      { name: "Shrimp Squat",    color: "#3fae6b", icon: "🦐" },
  legext:      { name: "Leg Ext / Press", color: "#e8873a", icon: "🏋️" },
  hamstring:   { name: "Hamstring",       color: "#d6443c", icon: "🌉" },

  sit:         { name: "L-Sit Line",      color: "#2493b0", icon: "🪑" },
  dragon:      { name: "Dragon Flag",     color: "#8a5cd0", icon: "🐉" },
  reverse:     { name: "Reverse Planche", color: "#d152a3", icon: "🔃" },

  cardio:      { name: "Cardio",          color: "#20a89f", icon: "🏃" },
};

const CATEGORIES = [
  {
    key: "push", label: "Push", icon: "💪", color: "#ff6b5e", complete: false,
    nodes: [
      // main pushing line
      { id: "pushup",    label: "Push-Up",                 parent: "START",    fam: "push" },
      { id: "ringpush",  label: "Ring Push-Up",            parent: "pushup",   fam: "push" },
      { id: "ringflies", label: "Ring Flies",              parent: "ringpush", fam: "push" },
      { id: "sarflies",  label: "Straight-Arm Ring Flies", parent: "ringflies",fam: "push" },
      { id: "oapush",    label: "One-Arm Push-Up",         parent: "pushup",   fam: "push", legendary: true },

      // dips
      { id: "dip",     label: "Dip",             parent: "START",  fam: "dip" },
      { id: "oadip",   label: "One-Arm Dip",     parent: "dip",    fam: "dip", legendary: true },
      { id: "impdip",  label: "Impossible Dip",  parent: "dip",    fam: "dip" },
      { id: "morozov", label: "Morozov",         parent: "impdip", fam: "dip", legendary: true },

      // planche line
      { id: "planchelean",   label: "Planche Lean",           parent: "START",       fam: "planche" },
      { id: "pseudopp",      label: "Pseudo Planche Push-Up", parent: "planchelean", fam: "planche" },
      { id: "planchepush",   label: "Planche Push-Up",        parent: "pseudopp",    fam: "planche" },
      { id: "planche",       label: "Planche",                parent: "planchepush", fam: "planche" },
      { id: "oaplanche",     label: "One-Arm Planche",        parent: "planche",     fam: "planche", legendary: true },
      { id: "oaplanchepush", label: "One-Arm Planche Push-Up",parent: "oaplanche",   fam: "planche", legendary: true },
      { id: "maltese",       label: "Maltese",                parent: "planchepush", fam: "planche", legendary: true },
      { id: "bicepplanche",  label: "Bicep Planche",          parent: "planchepush", fam: "planche" },
      { id: "oabicep",       label: "One-Arm Bicep Planche",  parent: "bicepplanche",fam: "planche", legendary: true },

      // ring strength line
      { id: "ringturn",     label: "Ring Turn Out",     parent: "START",       fam: "ring" },
      { id: "ringdip",      label: "Ring Dip",          parent: "ringturn",    fam: "ring" },
      { id: "ringmu",       label: "Ring Muscle-Up",    parent: "ringdip",     fam: "ring" },
      { id: "wideringmu",   label: "Wide Ring Muscle-Up",parent: "ringmu",     fam: "ring" },
      { id: "bulgariandip", label: "Bulgarian Dip",     parent: "wideringmu",  fam: "ring" },
      { id: "ironcross",    label: "Iron Cross",        parent: "bulgariandip",fam: "ring", legendary: true },
      { id: "ironcrosspress",label: "Iron Cross Press", parent: "ironcross",   fam: "ring", legendary: true },
      { id: "butterfly",    label: "Butterfly",         parent: "ironcross",   fam: "ring" },
      { id: "butterflyinvic",label: "Butterfly → Inv. Iron Cross", parent: "butterfly", fam: "ring", legendary: true },
      { id: "azarianic",    label: "Azarian to Iron Cross", parent: "ironcross", fam: "ring", legendary: true },

      // ring planche line
      { id: "ringhs",         label: "Ring Handstand",      parent: "ringturn",  fam: "ringPlanche" },
      { id: "ringplanche",    label: "Ring Planche",        parent: "ringhs",    fam: "ringPlanche", legendary: true },
      { id: "ringplanchepress",label: "Ring Planche Press", parent: "ringplanche",fam: "ringPlanche", legendary: true },
      { id: "ringvictorian",  label: "Ring Victorian Cross",parent: "ringplanche",fam: "ringPlanche", legendary: true },

      // ring maltese line
      { id: "ringmaltese",       label: "Ring Maltese",              parent: "ringturn",   fam: "ringMaltese", legendary: true },
      { id: "vangelder",         label: "Van Gelder",                parent: "ringmaltese",fam: "ringMaltese", legendary: true },
      { id: "azarianpm",         label: "Azarian to Planche/Maltese",parent: "vangelder",  fam: "ringMaltese", legendary: true },
      { id: "maltesepressinvic", label: "Maltese Press → Inv. IC",   parent: "ringmaltese",fam: "ringMaltese", legendary: true },

      // legendary ring capstones
      { id: "invic",        label: "Inverted Iron Cross",           parent: "ironcrosspress",  fam: "ring",        legendary: true },
      { id: "invbutterfly", label: "Inverted Butterfly",            parent: "butterflyinvic",  fam: "ring",        legendary: true },
      { id: "zanetti",      label: "Zanetti",                       parent: "azarianpm",       fam: "ringMaltese", legendary: true },
      { id: "carmona",      label: "Carmona",                       parent: "maltesepressinvic",fam: "ringMaltese",legendary: true },
      { id: "flvictorian",  label: "Front Lever → Victorian Cross", parent: "ringvictorian",   fam: "ringPlanche", legendary: true, locked: true, lockReason: "Requires Front Lever (Pull branch)" },
      { id: "victorianrp",  label: "Victorian Cross → Reverse Planche", parent: "flvictorian", fam: "ringPlanche", legendary: true, locked: true, lockReason: "Requires Reverse Planche (Core branch)" },
      { id: "flrp",         label: "Front Lever → Reverse Planche", parent: "ringplanchepress",fam: "ringPlanche", legendary: true, locked: true, lockReason: "Requires Front Lever (Pull branch)" },

      // handstand sub-line
      { id: "handstand",   label: "Handstand (Wall HS)",       parent: "START",     fam: "handstand" },
      { id: "hspush",      label: "Handstand Push-Up",         parent: "handstand", fam: "handstand" },
      { id: "imptiger",    label: "Imp. Tigerbend HS Push-Up", parent: "hspush",    fam: "handstand", legendary: true },
      { id: "maltesepress",label: "Maltese Press",             parent: "imptiger",  fam: "handstand", legendary: true, connector: "OR", extra: ["planchepress"] },
      { id: "hspike",      label: "HS Pike Press",             parent: "handstand", fam: "handstand" },
      { id: "planchepress",label: "Planche Press",             parent: "hspike",    fam: "handstand", legendary: true },
      { id: "oahandstand", label: "One-Arm Handstand",         parent: "handstand", fam: "handstand", legendary: true },
      { id: "oahspress",   label: "One-Arm HS Press",          parent: "oahandstand",fam: "handstand", legendary: true },
    ],
  },

  {
    key: "pull", label: "Pull", icon: "🧗", color: "#4eb0ff", complete: false,
    nodes: [
      { id: "pullup",  label: "Pull-Up",           parent: "START",  fam: "pull" },
      { id: "ringpull",label: "Ring Pull-Up",      parent: "pullup", fam: "pull" },
      { id: "barmu",   label: "Bar Muscle-Up",     parent: "ringpull",fam: "pull", connector: "AND", extra: ["pullup"] },
      { id: "oachin",  label: "One-Arm Chin-Up",   parent: "pullup", fam: "pull", legendary: true },
      { id: "oapull",  label: "One-Arm Pull-Up",   parent: "pullup", fam: "pull", legendary: true },
      { id: "oamu",    label: "One-Arm Muscle-Up", parent: "barmu",  fam: "pull", legendary: true },

      { id: "frontlever",label: "Front Lever",             parent: "pullup",    fam: "frontLever" },
      { id: "oafl",      label: "One-Arm Front Lever",     parent: "frontlever",fam: "frontLever", legendary: true },
      { id: "oaflpu",    label: "One-Arm Front Lever Pull-Up",parent: "oafl",   fam: "frontLever", legendary: true },
      { id: "flpull",    label: "Front Lever Pull",        parent: "frontlever",fam: "frontLever" },
      { id: "flpu",      label: "Front Lever Pull-Up",     parent: "flpull",    fam: "frontLever" },

      { id: "pbvictorian",   label: "PB Victorian",   parent: "frontlever",  fam: "victorian" },
      { id: "floorvictorian",label: "Floor Victorian",parent: "pbvictorian", fam: "victorian", legendary: true },

      { id: "backlever",     label: "Back Lever",              parent: "START",      fam: "backLever" },
      { id: "backleverpu",   label: "Back Lever Pull-Up",      parent: "backlever",  fam: "backLever" },
      { id: "oabacklever",   label: "One-Arm Back Lever",      parent: "backleverpu",fam: "backLever", legendary: true },
      { id: "oabackleverpu", label: "One-Arm Back Lever Pull-Up",parent: "oabacklever",fam: "backLever", legendary: true },

      { id: "hefesto",        label: "Hefesto",                    parent: "backleverpu",  fam: "hefesto", legendary: true },
      { id: "hefestofrombl",  label: "Hefesto From Back Lever",    parent: "hefesto",      fam: "hefesto", legendary: true },
      { id: "oahefestofrombl",label: "One-Arm Hefesto From BL",    parent: "hefestofrombl",fam: "hefesto", legendary: true },
      { id: "oahefesto",      label: "One-Arm Hefesto",            parent: "hefesto",      fam: "hefesto", legendary: true },
      { id: "pelican",        label: "Pelican",                    parent: "backleverpu",  fam: "hefesto" },
    ],
  },

  {
    key: "legs", label: "Legs", icon: "🦵", color: "#c084ff", complete: false,
    nodes: [
      // squat main line
      { id: "squat",      label: "Squat",              parent: "START",       fam: "squat" },
      { id: "pistol",     label: "Pistol Squat",       parent: "squat",       fam: "squat" },
      { id: "shrimp",     label: "Shrimp Squat",       parent: "pistol",      fam: "shrimp" },
      { id: "sissy",      label: "Sissy Squat",        parent: "shrimp",      fam: "sissy" },
      { id: "hawaiian",   label: "Hawaiian Squat",     parent: "sissy",       fam: "squat" },
      { id: "naturalext", label: "Natural Leg Extension",parent: "hawaiian",  fam: "legext" },
      { id: "naturalpress",label: "Natural Leg Press", parent: "naturalext",  fam: "legext" },
      { id: "matrixext",  label: "Matrix Leg Extension",parent: "naturalpress",fam: "legext" },
      { id: "legextlever",label: "Leg Extension Lever",parent: "matrixext",   fam: "legext", legendary: true },

      // sissy branch
      { id: "sissy1leg",    label: "One-Leg Sissy Squat",         parent: "sissy",         fam: "sissy" },
      { id: "sissy1legelev",label: "Elevated One-Leg Sissy Squat",parent: "sissy1leg",     fam: "sissy" },
      { id: "shrimpblaster",label: "Shrimp Squat Blaster",        parent: "sissy1legelev", fam: "sissy", legendary: true },

      // shrimp branch
      { id: "shrimpelev", label: "Elevated Shrimp Squat", parent: "shrimp", fam: "shrimp" },

      // leg-ext / press branches
      { id: "naturalext1leg",     label: "One-Leg Natural Leg Ext.",    parent: "naturalext",   fam: "legext" },
      { id: "naturalpress1leg",   label: "One-Leg Natural Leg Press",   parent: "naturalpress", fam: "legext" },
      { id: "naturalpress1legelev",label: "Elev. One-Leg Natural Leg Press",parent: "naturalpress1leg",fam: "legext", legendary: true },
      { id: "matrixext1leg",      label: "One-Leg Matrix Leg Ext.",     parent: "matrixext",    fam: "legext" },
      { id: "matrixext1legelev",  label: "Elev. One-Leg Matrix Leg Ext.",parent: "matrixext1leg",fam: "legext", legendary: true },
      { id: "legextlever1leg",    label: "One-Leg Leg Extension Lever", parent: "legextlever",  fam: "legext", legendary: true },

      // hamstring line
      { id: "hambridge",     label: "Hamstring Bridge",          parent: "START",     fam: "hamstring" },
      { id: "nordic",        label: "Nordic Hamstring Curl",     parent: "hambridge", fam: "hamstring" },
      { id: "nordic1leg",    label: "One-Leg Nordic Curl",       parent: "nordic",    fam: "hamstring" },
      { id: "invnordic",     label: "Inverted Nordic Curl",      parent: "nordic1leg",fam: "hamstring", legendary: true },
      { id: "elev1legnordic",label: "Elev. One-Leg Nordic Curl", parent: "invnordic", fam: "hamstring", legendary: true },
      { id: "oa1leginvnordic",label: "One-Leg Inv. Nordic Curl", parent: "invnordic", fam: "hamstring", legendary: true },
    ],
  },

  {
    key: "core", label: "Core", icon: "🔥", color: "#ffd24e", complete: true,
    nodes: [
      { id: "tucksit", label: "Tuck-Sit", parent: "START",   fam: "sit" },
      { id: "lsit",    label: "L-Sit",    parent: "tucksit", fam: "sit" },
      { id: "vsit",    label: "V-Sit",    parent: "lsit",    fam: "sit" },
      { id: "manna",   label: "Manna",    parent: "vsit",    fam: "sit", legendary: true },

      { id: "plank",        label: "Plank",              parent: "START",       fam: "dragon" },
      { id: "dragonflag",   label: "Dragon Flag",        parent: "plank",       fam: "dragon" },
      { id: "oadragonflag", label: "One-Arm Dragon Flag",parent: "dragonflag",  fam: "dragon", legendary: true },
      { id: "dragonpress",  label: "Dragon Press",       parent: "oadragonflag",fam: "dragon", legendary: true },
      { id: "oadragonpress",label: "One-Arm Dragon Press",parent: "dragonpress",fam: "dragon", legendary: true },

      { id: "reverseplanche",label: "Reverse Planche", parent: "START", fam: "reverse", locked: true, lockReason: "Requires Pull-Up (Pull branch)" },
      { id: "pullfrreverse", label: "Pull-Up → Front Lever → Reverse Planche", parent: "reverseplanche", fam: "reverse", legendary: true, locked: true, lockReason: "Requires Front Lever (Pull branch)" },
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

/* ---------------------------------------------------------------------
   Layout engine: radial tidy-tree fanned into an upward "V" wedge
   --------------------------------------------------------------------- */
const CIRCLE_R = 27;  // skill node radius
const LABEL_H  = 32;  // space under each circle for the name
const FO_W     = 116; // node footprint width (for bounding box)
const BASE_R = 340;   // radius of the first ring (depth 1)
const RING   = 240;   // distance between rings
const CENTER_ANGLE = -Math.PI / 2;         // wedge points straight up
const WEDGE_SPAN = (110 * Math.PI) / 180;  // every branch is exactly 110° wide
const ROT_STEP   = 122;                     // deg between adjacent wedges in the carousel

// progression: every 200 reps is a new rank; reaching Novice (200) unlocks the next skill
const RANKS = ["Beginner", "Novice", "Intermediate", "Advanced", "Mastered"];
const REPS_PER_RANK = 200;
const UNLOCK_REPS = 200;

// clean inline padlock (no emoji)
const LOCK_SVG =
  '<svg class="lock-ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
  '<path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6.5A2.5 2.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-6A2.5 2.5 0 0 0 17.5 10H17V7a5 5 0 0 0-5-5zm3 8H9V7a3 3 0 0 1 6 0v3zm-3 3.25a1.75 1.75 0 0 1 .75 3.33V19a.75.75 0 0 1-1.5 0v-2.42A1.75 1.75 0 0 1 12 13.25z"/>' +
  '</svg>';

/* ---------------------------------------------------------------------
   Progression state (persisted per skill)
   --------------------------------------------------------------------- */
let repsState = {};
try { repsState = JSON.parse(localStorage.getItem("mu-reps") || "{}") || {}; } catch (e) { repsState = {}; }

function repsOf(catKey, id) { return repsState[`${catKey}:${id}`] || 0; }
function addRepsTo(catKey, id, n) {
  const k = `${catKey}:${id}`;
  repsState[k] = Math.max(0, (repsState[k] || 0) + n);
  localStorage.setItem("mu-reps", JSON.stringify(repsState));
}
function rankIndex(reps) { return Math.min(RANKS.length - 1, Math.floor(reps / REPS_PER_RANK)); }
function isUnlocked(cat, node) {
  if (node.parent === "START") return true;            // roots (closest to START) always open
  return repsOf(cat.key, node.parent) >= UNLOCK_REPS;  // parent must reach Novice
}

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

function trimLine(from, to, offFrom, offTo) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  return {
    x1: from.x + ux * offFrom, y1: from.y + uy * offFrom,
    x2: to.x - ux * offTo,     y2: to.y - uy * offTo,
  };
}

function renderCategorySVG(cat) {
  const { pos, byId, maxR, aMin, aMax } = layoutCategory(cat);

  // --- wedge backdrop (the "V" slice) ---
  const rOuter = maxR + BASE_R * 0.5;
  const pad = 0.06;
  const a0 = aMin - pad, a1 = aMax + pad;
  const SAMPLES = 28;
  let sector = `M 0 0`;
  for (let i = 0; i <= SAMPLES; i++) {
    const a = a0 + (a1 - a0) * (i / SAMPLES);
    sector += ` L ${(Math.cos(a) * rOuter).toFixed(1)} ${(Math.sin(a) * rOuter).toFixed(1)}`;
  }
  sector += " Z";
  let svg = `<path class="tt-sector" d="${sector}"/>`;

  // faint depth-ring guides
  const rings = Math.max(2, Math.round((maxR - BASE_R) / RING) + 1);
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
  const OFF = CIRCLE_R + 5;
  let edges = "";
  cat.nodes.forEach((n) => {
    const c = pos.get(n.id);
    const parent = pos.get(n.parent) || pos.get("START");
    const offFrom = n.parent === "START" ? 32 : OFF;
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

  // --- AND / OR chips ---
  cat.nodes.forEach((n) => {
    if (!n.connector) return;
    const c = pos.get(n.id);
    const len = Math.hypot(c.x, c.y) || 1;
    const ux = -c.x / len, uy = -c.y / len; // toward origin
    const cx = c.x + ux * (CIRCLE_R + 12);
    const cy = c.y + uy * (CIRCLE_R + 12);
    svg += `<foreignObject x="${(cx - 19).toFixed(1)}" y="${(cy - 9).toFixed(1)}" width="38" height="18" class="node-fo">` +
           `<div xmlns="http://www.w3.org/1999/xhtml" class="tt-chip">${n.connector}</div></foreignObject>`;
  });

  // --- nodes: circle with an exercise icon, name underneath ---
  const foW = FO_W, foH = CIRCLE_R * 2 + LABEL_H;
  cat.nodes.forEach((n) => {
    const c = pos.get(n.id);
    const f = fam(n);
    const unlocked = isUnlocked(cat, n);
    const reps = repsOf(cat.key, n.id);
    const mastered = unlocked && rankIndex(reps) >= RANKS.length - 1;
    const cls = ["skill-circle"];
    if (n.legendary) cls.push("is-legendary");
    if (!unlocked) cls.push("is-locked");
    if (mastered) cls.push("is-mastered");
    const inner = unlocked
      ? `<span class="skill-circle__icon">${f.icon || "•"}</span>`
      : LOCK_SVG;
    svg += `<foreignObject class="node-fo" x="${(c.x - foW / 2).toFixed(1)}" y="${(c.y - CIRCLE_R).toFixed(1)}" width="${foW}" height="${foH}">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" class="skill-circle-wrap" data-node="${cat.key}:${n.id}" role="button" tabindex="0">` +
      `<div class="${cls.join(" ")}" style="--fam:${f.color}">${inner}</div>` +
      `<span class="skill-circle__label">${esc(n.label)}</span></div></foreignObject>`;
  });

  // content bounding box
  const xs = [], ys = [];
  cat.nodes.forEach((n) => {
    const c = pos.get(n.id);
    xs.push(c.x - foW / 2, c.x + foW / 2);
    ys.push(c.y - CIRCLE_R, c.y + CIRCLE_R + LABEL_H);
  });
  xs.push(-rOuter * Math.abs(Math.cos(a0)) - 40, rOuter * Math.abs(Math.cos(a1)) + 40, 0);
  ys.push(-rOuter - 20, 60);
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

  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const applyViewBox = () => svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const targetIndex = () => ((Math.round(targetPos) % N) + N) % N;

  // default landing view: zoomed in on START + the first rings
  function home() {
    const sw = stage.clientWidth || 1200;
    const sh = stage.clientHeight || 700;
    const viewH = BASE_R + RING * 2.4;
    const viewW = viewH * (sw / sh);
    vb = { x: -viewW / 2, y: 110 - viewH, w: viewW, h: viewH };
    applyViewBox();
  }

  /* ---- build the full 5-wedge wheel once ---- */
  function build() {
    let inner = `<defs><marker id="tt-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--tt-line)"/></marker></defs>`;
    inner += `<g id="tt-wheel">`;
    CATEGORIES.forEach((cat, i) => {
      const { markup, box: b } = renderCategorySVG(cat);
      boxes[i] = b;
      inner += `<g class="tt-wedge" data-wi="${i}">${markup}</g>`;
    });
    inner += `</g>`;
    inner += `<g class="tt-start"><circle cx="0" cy="0" r="31"/><text x="0" y="4">START</text></g>`;
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
      let op = a < 1 ? 1 : Math.max(0.14, 1 - a / (ROT_STEP * 1.12));
      if (a > ROT_STEP * 1.6) op = 0;
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
    const seen = [];
    cat.nodes.forEach((n) => { if (!seen.includes(n.fam)) seen.push(n.fam); });
    let html = seen.map((k) => {
      const f = FAMILY[k];
      return `<span class="tree-legend__item"><span class="tree-legend__sw" style="--sw:${f.color}"></span>${esc(f.name)}</span>`;
    }).join("");
    html += `<span class="tree-legend__sep"></span>`;
    html += `<span class="tree-legend__item"><span class="tree-legend__sw tree-legend__sw--legendary"></span>Legendary</span>`;
    html += `<span class="tree-legend__item"><span class="tree-legend__lock">${LOCK_SVG}</span>Locked — train the previous skill</span>`;
    legendEl.innerHTML = html;
  }

  function updateChrome() {
    const i = targetIndex();
    const cat = CATEGORIES[i];
    overlay.style.setProperty("--cat-color", cat.color);
    nameEl.textContent = cat.label;
    iconEl.textContent = cat.icon;
    checkEl.classList.toggle("is-on", !!cat.complete);
    metaEl.textContent = `Branch ${i + 1} / ${N}` + (cat.complete ? " · complete" : "");
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

  /* ---- open / close ---- */
  function open() {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");
    requestAnimationFrame(() => { build(); updateChrome(); home(); });
  }
  function close() { closePopup(); overlay.classList.remove("is-open"); overlay.setAttribute("aria-hidden", "true"); document.body.classList.remove("is-locked"); }

  document.querySelectorAll("[data-open-tree]").forEach((el) =>
    el.addEventListener("click", (e) => { e.preventDefault(); open(); }));
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
  function openPopup(key) {
    const { cat, node } = nodeByKey(key);
    if (!cat || !node) return;
    const f = fam(node);
    const unlocked = isUnlocked(cat, node);
    const reps = repsOf(cat.key, node.id);
    const ri = rankIndex(reps);
    const into = reps % REPS_PER_RANK;
    const isMax = ri >= RANKS.length - 1;

    let html = `<div class="pop-head">` +
      `<div class="pop-badge ${unlocked ? "" : "is-locked"} ${node.legendary ? "is-legendary" : ""}" style="--fam:${f.color}">${unlocked ? (f.icon || "•") : LOCK_SVG}</div>` +
      `<div><h3 class="pop-name">${esc(node.label)}</h3>` +
      `<div class="pop-sub">${esc(f.name)}${node.legendary ? " · Legendary" : ""}</div></div></div>`;

    if (!unlocked) {
      const parent = cat.nodes.find((n) => n.id === node.parent);
      const pReps = parent ? repsOf(cat.key, parent.id) : 0;
      html += `<div class="pop-locked">` +
        `<div class="pop-lock-ico">${LOCK_SVG}</div>` +
        `<p>Locked. Reach <b>Novice</b> (${UNLOCK_REPS} reps) on <b>${esc(parent ? parent.label : "the previous skill")}</b> to unlock this skill.</p>` +
        (parent ? `<div class="pop-bar"><i style="width:${Math.min(100, (pReps / UNLOCK_REPS) * 100).toFixed(1)}%"></i></div>` +
          `<div class="pop-bar__meta">${esc(parent.label)}: ${pReps} / ${UNLOCK_REPS} reps</div>` : "") +
        `</div>`;
    } else {
      html += `<div class="pop-rank"><span class="rank-chip rank-${ri}">${RANKS[ri]}</span>` +
        `<span class="pop-reps"><b>${reps}</b> total reps</span></div>`;
      html += `<div class="pop-bar"><i style="width:${isMax ? 100 : ((into / REPS_PER_RANK) * 100).toFixed(1)}%"></i></div>`;
      html += `<div class="pop-bar__meta">` +
        (isMax ? `Mastered — every skill in this line is open to you.`
               : `${into} / ${REPS_PER_RANK} reps to <b>${RANKS[ri + 1]}</b>`) + `</div>`;
      html += `<div class="pop-add">` +
        `<input id="pop-add-input" type="number" min="1" step="1" value="10" inputmode="numeric" aria-label="Reps to add">` +
        `<button id="pop-add-btn" class="btn btn--primary">Add reps</button></div>`;
      html += `<div class="pop-quick">` +
        [5, 10, 25, 50].map((q) => `<button class="pop-quick__b" data-q="${q}">+${q}</button>`).join("") + `</div>`;
      html += `<p class="pop-note">Every ${REPS_PER_RANK} reps earns the next rank. Hit Novice to unlock the skill above this one.</p>`;
    }

    popBody.innerHTML = html;
    popEl.dataset.key = key;
    popEl.hidden = false;
    requestAnimationFrame(() => popEl.classList.add("is-open"));

    const doAdd = (n) => {
      if (!n || n <= 0) return;
      addRepsTo(cat.key, node.id, n);
      build(); layoutWheel();        // reflect new unlocks / ranks
      openPopup(key);                // refresh popup contents
    };
    const addBtn = document.getElementById("pop-add-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => doAdd(parseInt(document.getElementById("pop-add-input").value, 10)));
      document.getElementById("pop-add-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") doAdd(parseInt(e.target.value, 10));
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
    const minW = box.w * 0.16, maxW = box.w * 3.2;
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

  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const u = clientToUser(e.clientX, e.clientY);
    zoomAround(u.x, u.y, e.deltaY > 0 ? 1.12 : 0.89);
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
