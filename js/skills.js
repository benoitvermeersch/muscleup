/* =====================================================================
   MuscleUp — skill data, rep progression and favourites
   =====================================================================

   Everything the tree *is*, separated from how it's drawn. The skill-tree
   overlay (js/script.js), the leaderboard and the profile page all read
   from here, so there is exactly one definition of the branches and one
   copy of the rep counters.

   Exposes `MuSkills`:

     CATEGORIES, FAMILY, RANKS, REPS_PER_RANK, UNLOCK_REPS, STARTERS
     repsOf(catKey, id)            → reps logged on one skill
     addRepsTo / setRepsTo         → log reps (persists + notifies)
     rankIndex(reps)               → 0..4 index into RANKS
     isUnlocked(cat, node)         → is this skill open yet
     skillByKey("push:pushup")     → { cat, node }
     getFavourite() / setFavourite / toggleFavourite / isFavourite
     stats()                       → { totalReps, categoryReps, topCategory, … }
     statsFor(userId)              → the same, for any account on this device
     onChange(fn)                  → fires whenever reps or the favourite move

   Reps and the favourite are stored per account (see MuAuth.scopedKey), so
   two people sharing a browser keep separate trees.
   ===================================================================== */

(function (global) {
  "use strict";

  /* ------------------------------------------------------------------
     Movement families — colour + icon per line of progression
     ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------
     The five branches
     ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------
     Progression rules
     ------------------------------------------------------------------ */

  // every 200 reps is a new rank; reaching Novice (200) unlocks the next skill
  const RANKS = ["Beginner", "Novice", "Intermediate", "Advanced", "Mastered"];
  const REPS_PER_RANK = 200;
  const UNLOCK_REPS = 200;

  // First-run check-in: the ground-floor skill of each line. Ticking one
  // credits it with UNLOCK_REPS, which opens everything sitting above it.
  const STARTERS = [
    { cat: "push",   id: "pushup",       icon: "💪", target: "10 clean reps" },
    { cat: "push",   id: "dip",          icon: "🔻", target: "5 full-depth reps" },
    { cat: "pull",   id: "pullup",       icon: "🧗", target: "1 dead-hang rep" },
    { cat: "legs",   id: "squat",        icon: "🦵", target: "20 deep reps" },
    { cat: "legs",   id: "hambridge",    icon: "🌉", target: "10 controlled reps" },
    { cat: "core",   id: "plank",        icon: "🔥", target: "a 30-second hold" },
    { cat: "core",   id: "tucksit",      icon: "🪑", target: "a 15-second hold" },
    { cat: "cardio", id: "jumpingjacks", icon: "🏃", target: "50 unbroken" },
  ];

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
  const ASSESSED_BASE = "mu-assessed";   // the first-run check-in flag

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

  function loadState() {
    repsState = readJSON(scoped(REPS_BASE), {}) || {};
    try { favourite = localStorage.getItem(scoped(FAV_BASE)) || null; } catch (err) { favourite = null; }
  }
  loadState();

  function saveReps() {
    try { localStorage.setItem(scoped(REPS_BASE), JSON.stringify(repsState)); } catch (err) {}
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

  function addRepsTo(catKey, id, n) {
    const k = `${catKey}:${id}`;
    repsState[k] = Math.max(0, (repsState[k] || 0) + n);
    saveReps();
    emit("reps");
  }

  function setRepsTo(catKey, id, n) {
    repsState[`${catKey}:${id}`] = Math.max(0, n);
    saveReps();
    emit("reps");
  }

  function rankIndex(reps) { return Math.min(RANKS.length - 1, Math.floor(reps / REPS_PER_RANK)); }

  function isUnlocked(cat, node) {
    if (node.parent === "START") return true;            // roots (closest to START) always open
    return repsOf(cat.key, node.parent) >= UNLOCK_REPS;  // parent must reach Novice
  }

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

  // Back to an empty tree: no reps, no favourite, and the first-run
  // check-in offered again next time the map opens. The account stays.
  function resetTree() {
    repsState = {};
    favourite = null;
    try {
      localStorage.removeItem(scoped(REPS_BASE));
      localStorage.removeItem(scoped(FAV_BASE));
      localStorage.removeItem(scoped(ASSESSED_BASE));
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
    } catch (err) {}
    const current = global.MuAuth && global.MuAuth.currentUser();
    if (current && current.id === userId) { repsState = {}; favourite = null; }
  }

  /* ------------------------------------------------------------------
     Aggregates — what the leaderboard shows
     ------------------------------------------------------------------ */
  function summarise(reps, favouriteKey) {
    const categoryReps = {};
    let totalReps = 0;

    CATEGORIES.forEach((cat) => {
      let sum = 0;
      cat.nodes.forEach((n) => { sum += reps[`${cat.key}:${n.id}`] || 0; });
      categoryReps[cat.key] = sum;
      totalReps += sum;
    });

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
    STARTERS,
    categoryByKey,
    skillByKey,
    skillLabel,
    repsOf,
    addRepsTo,
    setRepsTo,
    rankIndex,
    isUnlocked,
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
