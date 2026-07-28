# MuscleUp

**Level Up Your Body**

A skill tree to help you unlock calisthenics, isometrics and strengthen your body, with AI guidance along the way.

MuscleUp turns bodyweight training into an RPG-style skill tree, split into four branches:

- **Push** — push-ups, dips, handstands, planche
- **Pull** — rows, pull-ups, front lever, muscle-up
- **Legs** — squats, lunges, pistol squats, shrimp squats
- **Core** — plank, hollow body, L-sit, dragon flag

Each move is a node you unlock as you progress, Duolingo-style, with AI guidance recommending what to train next.

## Accounts

Signing up takes an email and a password of **more than 8 characters**. You
get a confirmation email, and the account can't log in until that link is
clicked. Once you're in, the skill tree opens with a one-time check-in —
tick the exercises you can already do and the skills above them unlock.

Progress is stored per account, so two people sharing a browser don't
inherit each other's tree.

### Turning on real email

MuscleUp is a static site with no server of its own, so accounts and the
confirmation email are handled by [Supabase Auth](https://supabase.com),
which runs entirely from the browser. To switch it on:

1. Create a free Supabase project.
2. Put the **Project URL** and the **anon / public** key into
   `js/auth-config.js`.
3. Authentication → Providers → Email → turn **Confirm email** on.
4. Authentication → URL Configuration → add this site's URL to **Site URL**
   and **Redirect URLs**, so the link in the email lands back here.

The anon key is meant to be public — it ships to the browser on every
Supabase site, and row-level security is what protects data, not the key.

**Until those two values are filled in, the site runs in local mode:** the
rules are all still enforced (password length, verify-before-login,
PBKDF2-hashed passwords, no duplicate accounts), but the confirmation email
is rendered on screen instead of sent, and accounts live in that browser
only. It exists so the whole signup → verify → log in flow is clickable
before the Supabase project is created. Local mode is *not* real security —
don't treat a local-mode account as protecting anything.

## This repo

```
.
├── index.html          # landing page, auth dialog, skill-tree overlay
├── css/style.css       # landing page + skill tree styles
├── css/auth.css        # auth dialog, account chip, first-run check-in
├── js/auth-config.js   # Supabase URL + anon key (empty → local mode)
├── js/auth.js          # signup / login / verification + auth UI
└── js/script.js        # theme, skill tree wheel, progression
```

### Running locally

It's a static site — serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Use `localhost` rather than opening
`index.html` directly: password hashing needs WebCrypto, which browsers
only expose on `localhost` or HTTPS.
