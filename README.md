# MuscleUp

**Level Up Your Body**

A skill tree to help you unlock calisthenics, isometrics and strengthen your body, with AI guidance along the way.

MuscleUp turns bodyweight training into an RPG-style skill tree, split into four branches:

- **Push** — push-ups, dips, handstands, planche
- **Pull** — rows, pull-ups, front lever, muscle-up
- **Legs** — squats, lunges, pistol squats, shrimp squats
- **Core** — plank, hollow body, L-sit, dragon flag

Each move is a node you unlock as you progress, Duolingo-style, with AI guidance recommending what to train next.

## This repo

Currently contains the static landing page for MuscleUp.

```
.
├── index.html      # landing page markup
├── css/style.css   # styles
└── js/script.js    # small interactions (waitlist form)
```

### Running locally

It's a static site — just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

The full interactive skill tree is planned as a future addition to this project.
