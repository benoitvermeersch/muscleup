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
     describe(catKey, id)          → what the exercise is, in a sentence or three
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
     What each skill actually is

     Shown when a node is opened, locked or not — a name alone doesn't
     tell you what a Hefesto is, and the locked ones are exactly the
     ones you've never done. Three sentences at the outside: what the
     movement is, and the cue or fact worth knowing about it.

     Kept out of CATEGORIES so the shape of the tree stays scannable.
     Keyed "branch:id", because Burpee appears on two branches.
     ------------------------------------------------------------------ */
  const DESCRIPTIONS = {
    /* --- push --- */
    "push:inclinepush": "A push-up with the hands raised on a bench, a table or a wall. The higher the surface the less of your bodyweight you press, so it's the gentlest way into the movement. Work your way down towards the floor as it gets easy.",
    "push:kneepush": "A push-up done from the knees rather than the toes, which cuts the load to roughly half your bodyweight. Keep a straight line from knees to shoulders — letting the hips sag turns it into a much easier exercise.",
    "push:pushup": "The full movement: hands under the shoulders, body in one line from heels to head, chest to the floor and back up. Let the elbows track back at around 45° instead of flaring straight out to the sides.",
    "push:oapush": "A full push-up pressed with one arm, the other held behind your back. Widen the feet for balance and fight the twist — the rotation is usually what gives out first, not the arm.",
    "push:explosivepush": "A push-up driven hard enough that the hands leave the floor at the top. Land with soft elbows and reset between reps. It builds the pressing speed that clapping variations and the muscle-up are made of.",
    "push:dip": "Supported on parallel bars, lower until the shoulders sit just below the elbows, then press back up. Lean the torso forward to bias the chest, or stay upright to put the work on the triceps.",
    "push:impdip": "A dip taken to a near-horizontal lean, the hands finishing behind and below the hips. It asks for extreme straight-arm shoulder extension and is one of the hardest positions on the bars.",
    "push:pikepush": "A push-up with the hips piked high, so you press mostly overhead rather than forward. It's the first real overhead press in the tree and the foundation of the whole handstand line.",
    "push:diamondpush": "A push-up with the hands together under the chest, thumbs and index fingers making a diamond. Keeping the elbows tucked close shifts most of the work onto the triceps.",
    "push:elevpike": "A pike push-up with the feet raised on a box or a bench, tipping you closer to vertical. The steeper the angle, the nearer it gets to a true handstand push-up.",
    "push:hswall": "An upside-down hold with the heels resting on a wall for balance. Stack wrists, elbows and shoulders in one line and pull the ribs down — a banana-shaped back is the usual fault.",
    "push:handstand": "A free-standing hold with nothing to lean on, balanced through the fingers and wrists. Balance is corrected by pressing through the fingertips, not by folding at the hips.",
    "push:oahandstand": "A handstand held on a single arm. It needs a rock-solid two-arm handstand first, plus the shoulder strength to hold a heavy side lean while the other hand comes off the floor.",
    "push:hspushwall": "A vertical press with the wall taking your balance: lower until the crown of the head touches the floor, then push back up. It's the strength half of the handstand push-up with the balance removed.",
    "push:hspush": "A full overhead press done free-standing — head to the floor and back up to a handstand. You need the pressing strength and the balance to hold a handstand while it's moving.",
    "push:hsclap": "A handstand push-up pressed hard enough to leave the floor and clap before landing. It wants explosive overhead power on top of an already reliable handstand.",
    "push:planchelean": "A plank on straight arms with the shoulders pushed far forward, past the hands. The further you lean the more of your weight the shoulders carry, which makes it the single best drill for building planche strength.",
    "push:pseudopp": "A push-up performed in a planche lean, hands down by the waist and shoulders well ahead of them. It teaches the body to press from the straight-arm, forward-leaning line the planche is built on.",
    "push:hold90": "A hold with the body horizontal and the arms bent to a right angle, elbows tucked into the ribs. It sits between the planche and the handstand push-up and asks a great deal of the elbows and wrists.",
    "push:hs90push": "A handstand push-up that pauses in a 90° hold on the way down and presses back to vertical from there. It joins the bent-arm strength of the 90° hold to handstand balance.",
    "push:frogstand": "A balance on the hands with the knees resting on the backs of the upper arms. It's the first straight-arm balance most people manage, and the way into the planche line.",
    "push:elbowlever": "The body held horizontal with the elbows dug into the abdomen carrying the weight. It's far more about balance and body tension than raw strength, which makes it an achievable first lever.",
    "push:tuckplanche": "A planche with the knees pulled tight to the chest, held on straight arms with the shoulders leaning forward. Bringing the hips level with the shoulders, rather than letting them hang below, is what makes it count.",
    "push:straddleplanche": "A planche with the legs opened wide, which shortens the lever and makes the hold lighter than the full version. It's the last step before the planche itself.",
    "push:planche": "The body held horizontal and straight on straight arms, feet and shoulders level, touching nothing but the floor. It's one of the hardest holds in calisthenics and takes years of patient work.",
    "push:planchepush": "A push-up performed in and out of a full planche, without the feet ever touching down. Few athletes hold a planche at all, and fewer still can press in one.",
    "push:maltese": "A horizontal hold with the arms out to the sides at chest height instead of underneath the body. The leverage is brutal, and it's usually trained on rings.",
    "push:oaplanche": "A full planche held on a single straight arm. It's among the rarest feats in the sport, needing planche strength and the power to resist enormous rotation at the same time.",

    /* --- pull --- */
    "pull:deadhang": "Hanging from a bar with straight arms and relaxed shoulders. It builds the grip and the shoulder tolerance every other pulling skill is built on, which is why the branch starts here.",
    "pull:jumpneg": "Jump to the top of a pull-up, then lower yourself as slowly as you can. You're stronger lowering than lifting, so this builds the strength for a first pull-up before you have one.",
    "pull:pullup": "Hanging with an overhand grip, pull until the chin clears the bar, then lower under control. Start every rep from a full dead hang — half reps from a bent arm are the usual way this gets easier than it should be.",
    "pull:auspull": "A horizontal row under a low bar with the heels on the floor. The flatter your body the harder it gets, so it scales smoothly and stays useful long after full pull-ups arrive.",
    "pull:chinup": "A pull-up with an underhand grip, hands about shoulder-width apart. The palms-up position brings the biceps in far more heavily, so most people manage a few more of these than pull-ups.",
    "pull:oadeadhang": "Hanging from the bar by one hand. It's the grip and shoulder test that gates the one-arm pull-up, and it almost always fails at the fingers long before the shoulder.",
    "pull:chesttobar": "A pull-up taken high enough that the chest touches the bar. Leaning back slightly and driving the elbows down through the rep is what buys the extra range.",
    "pull:naveltobar": "A pull-up pulled all the way to the waist, the bar meeting the navel. It needs the explosive pull a muscle-up is made of, and having one is a strong sign you're close.",
    "pull:oapull": "A full pull-up on a single arm, from a dead hang to chin over bar. It's one of the great milestones of pulling strength and usually sits years past a first pull-up.",
    "pull:oamu": "A muscle-up performed on one arm — pulling, then pressing over the bar, unassisted. Vanishingly few athletes anywhere have one.",
    "pull:muscleup": "A pull-up that carries on over the bar into a dip, finishing with straight arms and the chest above it. The transition is the hard part: pull high, then whip the chest forward over the bar rather than trying to press through it.",
    "pull:mujump": "A muscle-up finished by landing in a support with the feet up on the bar. It's a control drill that teaches the top half of the transition.",
    "pull:mubackclap": "A muscle-up explosive enough to clap the hands behind your back in mid-air. It takes far more pulling speed than the plain version, and a fast, confident re-grip.",
    "pull:explosivemu": "A muscle-up driven so hard that the body clears the bar to the waist or beyond. It's the base every release and flight skill on the bar is built from.",
    "pull:straddlefl": "A front lever with the legs split wide, which shortens the lever and lightens the hold. It's the last progression before the full front lever.",
    "pull:frontlever": "Hanging from the bar with the body horizontal and face-up, straight from head to toes. It's a straight-arm hold driven by the lats and the core, and one of the signature skills of the sport.",
    "pull:oafl": "A front lever held from a single arm. On top of the lever strength it takes serious anti-rotation power to stop the body turning under the bar.",
    "pull:flpu": "A pull-up performed while holding the front lever, body horizontal the whole way through. It stacks the hardest static hold on the bar on top of dynamic pulling.",

    /* --- legs --- */
    "legs:lunge": "Step forward and drop the back knee towards the floor, then drive back up through the front heel. Keep the front shin roughly vertical so the knee stays over the ankle rather than travelling past the toes.",
    "legs:squat": "Feet about shoulder-width apart, sit down between the hips until the thighs pass parallel, then stand back up. Keep the heels planted and the chest up — depth is what makes it worth doing.",
    "legs:pistol": "A full squat on one leg with the other held straight out in front. It asks for single-leg strength, ankle mobility and balance all at once, which is why it takes most people a while.",
    "legs:nordic": "Kneel with the ankles anchored and lower your torso towards the floor, resisting the whole way with the hamstrings alone. It's one of the most demanding hamstring exercises there is — catch yourself with your hands and push back up until you can hold the whole descent.",
    "legs:burpee": "Squat down, kick out to a push-up, come back in and jump. It welds a squat and a push-up into a single movement, which is why the tree wants both before it opens.",

    /* --- core --- */
    "core:boathold": "Sit balanced on the tailbone with the legs and chest lifted, making a shallow V. Don't let the lower back round — drop the legs a little if it starts to, since holding the position is the whole point.",
    "core:plank": "Hold a push-up position on the forearms with the body in one straight line. Squeeze the glutes and tuck the ribs down; a plank with sagging hips trains almost nothing.",
    "core:legraises": "Lying flat, raise straight legs to vertical and lower them slowly without letting the lower back arch off the floor. Stop the descent where the back starts to lift, and grow the range from there.",
    "core:hangingleg": "Hanging from a bar, raise straight legs to horizontal or higher under control. Kill the swing on the way down — the reps that count are the ones without momentum.",
    "core:tucksit": "Supported on the hands with the knees tucked to the chest and the feet off the floor. It builds the shoulder depression and the compression an L-sit needs.",
    "core:lsit": "Supported on straight arms with the legs held straight out in front, the body making an L. Push the floor away and lock the elbows — most people fail here on shoulder strength rather than abs.",
    "core:lsitpull": "A pull-up performed while holding an L-sit throughout. Keeping the legs locked out in front while you pull makes it far harder than either skill on its own.",
    "core:vsit": "An L-sit with the legs raised above hip height, folding the body into a V. It needs deep compression and the strength to hold the hips behind the hands.",
    "core:manna": "A hold in which the legs travel past vertical and the hips sit behind the hands, arching the body back over the shoulders. It's one of the most extreme shoulder-extension positions in gymnastics.",
    "core:humanflag": "Gripping a vertical pole and holding the body straight out sideways, parallel to the ground. The bottom arm pushes while the top arm pulls, and the obliques hold the line.",
    "core:backlever": "Hanging from the bar and holding the body horizontal and face-down, on straight arms. Build it slowly: the position puts a long, heavy stretch through the biceps and shoulders.",
    "core:dragonflag": "Lying on a bench and gripping behind your head, hold the body straight and lower it from vertical without bending at the hips. Anything that folds turns it into a leg raise.",
    "core:oabacklever": "A back lever held on a single arm. The lever is hard enough on two — on one, resisting the rotation becomes the main event.",
    "core:hefesto": "A pull from a back lever up into a support with the arms behind the back and the palms turned away. It demands extreme biceps and shoulder-extension strength, and carries real injury risk if rushed.",

    /* --- cardio --- */
    "cardio:jumpingjacks": "Jump the feet wide while swinging the arms overhead, then jump back in. It's the simplest way to lift the heart rate and warm the shoulders and hips at the same time.",
    "cardio:highknees": "Run on the spot, driving each knee up to hip height. Stay on the balls of the feet and keep the pace quick — it's a conditioning drill, not a march.",
    "cardio:burpee": "Drop to the floor, kick back to a push-up, jump the feet in and leap up. Full-body and relentless, it's one of the fastest ways to spike the heart rate with no equipment at all.",
    "cardio:mountain": "From a push-up position, drive the knees to the chest one at a time, as fast as you can hold the plank. Keep the hips low — letting them ride up turns it into a rest.",
    "cardio:sprint": "Short all-out runs separated by walking or standing recovery. Intervals build top-end conditioning far faster than steady jogging, and the recovery matters as much as the effort.",
    "cardio:jumprope": "Skipping a turning rope with small, quick hops off the balls of the feet. It trains calves, coordination and conditioning together, and packs a lot of work into very little space.",
    "cardio:burpeepull": "A burpee that finishes by jumping straight up into a pull-up. It ties the two branches together and is as much a conditioning test as a strength one.",
  };

  function describe(catKey, id) { return DESCRIPTIONS[`${catKey}:${id}`] || ""; }

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
    describe,
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
