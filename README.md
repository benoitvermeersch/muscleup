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
clicked.

**The skill tree is open to everyone — an account isn't required.** Opening
it runs a one-time check-in: tick the exercises you can already do and the
skills above them unlock.

Progress is stored per account, so two people sharing a browser don't
inherit each other's tree. Signed out, progress is kept on the device under
a `guest` key; it stays separate from any account you later sign in to,
rather than being merged into it.

## Your profile

Signing up asks for an email and a password, nothing else. The name comes
later, on **`profile.html`** — username, first name, last name, and that's
it for now. The username is what other athletes see; the email never leaves
your own screen.

Usernames are 3–20 characters of letters, numbers and underscores, and are
unique across the site (case-insensitively, so `Ben` and `ben` can't both
exist). Until you set one, the leaderboard calls you `Athlete 1a2b` after
the first characters of your account id.

## The leaderboard

**`leaderboard.html`** lists **every account ever registered** — not just
the ones who have trained — ranked by total reps. Each row shows:

- **Total reps** — everything logged across all five branches
- **Top branch** — whichever of Push, Pull, Legs, Core or Cardio holds the
  most of those reps
- **Favourite position** — the one skill you've starred

### Favouriting a position

Open any skill in the tree and hit **Make this my favourite**. The node
gets a gold star and the skill's name appears next to you on the
leaderboard. Starring another position moves the star; starring the one
you've already starred clears it. Locked skills can be favourited too — a
goal makes a perfectly good favourite.

### Where the numbers come from

Reps live in the browser's local storage, which nobody else can read, so
the aggregate the board needs (total, per-branch totals, top branch,
favourite) is published to your `profiles` row as you train. Per-skill
counts stay on your device.

In local mode there's nothing to publish: every account on the device is
already readable, so the board is built straight from local storage.

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

5. **Add custom SMTP** — Project Settings → Authentication → SMTP Settings.
   Without this almost nobody receives the email (see below).

6. **Run `supabase/schema.sql`** — SQL Editor → New query → paste → Run.
   This creates the `profiles` table the leaderboard reads, plus a trigger
   on `auth.users` so every new account gets a row the moment it signs up,
   and backfills rows for accounts that already exist. Re-running it is
   safe. Without it the leaderboard says so rather than failing silently.

   Row-level security lets anyone read the table and only its owner write
   to it. No email address is stored there — the board is world readable,
   and it has no business handing out everyone's address.

Either key format works: the legacy `anon` JWT (`eyJ...`) or the newer
publishable key (`sb_publishable_...`). Both are meant to be public — they
ship to the browser on every Supabase site, and row-level security is what
protects data, not the key.

### Why the confirmation email doesn't arrive

Supabase's **built-in mailer is for testing only**. Two limits bite hard:

- it delivers **only to addresses belonging to members of your Supabase
  organisation** — signing up with any other address sends nothing, and the
  signup still returns HTTP 200, so it looks like it worked
- it's capped at roughly **2 emails per hour**

So a project with default settings genuinely cannot email your users. Fix it
by pointing Supabase at a real SMTP provider (Resend, Postmark, SendGrid,
Brevo, Mailgun — all have free tiers) under **Project Settings →
Authentication → SMTP Settings**, then raise the rate limit under
Authentication → Rate Limits.

The signup form now detects both cases rather than showing a hopeful "check
your inbox": if Supabase reports no mail was dispatched, or the send was
rate-limited, it says so and names the fix.

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
├── index.html            # landing page + skill-tree overlay
├── leaderboard.html      # every registered athlete, ranked
├── profile.html          # username / first name / last name
├── assets/logo.svg       # the mark, white on transparent
├── assets/favicon.svg    # the mark on a dark rounded tile
├── css/style.css         # landing page + skill tree styles
├── css/auth.css          # auth dialog, account chip, first-run check-in
├── css/pages.css         # leaderboard + profile pages
├── js/auth-config.js     # Supabase URL + anon key (empty → local mode)
├── js/auth.js            # signup / login / verification + the auth dialog
├── js/skills.js          # branches, rep counters, favourite, aggregates
├── js/profiles.js        # profile storage + the leaderboard feed
├── js/script.js          # skill tree wheel + progression
├── js/leaderboard.js     # the rankings table
├── js/profile-page.js    # the profile form
└── supabase/schema.sql   # profiles table, RLS and the signup trigger
```

The sign up / log in dialog is built by `js/auth.js` rather than written
into each page, so a page becomes sign-in-able just by loading that script
and putting an `#auth-slot` in its header.

## Look and feel

The site is **dark only** — there's no light theme and no theme switcher.
The palette is monochrome: near-black surfaces with white as the single
accent, so `--lime` (a historical variable name) is now simply `#ffffff`
and `--lime-dim` the muted step below it.

Type is **Helvetica**, falling back to Arial (metrically identical) on
Windows and Nimbus Sans on Linux. No webfont is loaded, so there's no
render-blocking request to a font CDN and no flash of unstyled text.

The hero shows a miniature of the tree — START climbing through Incline
Push-Up, Push-Up, Dip and Pull-Up to Muscle-Up — with a gold arrow rising
behind it to the goal. Gold appears only here and on mastered skills.

The one deliberate exception is the five skill branches, which keep their
colours (`--push`, `--pull`, `--legs`, `--core`, plus cardio). Those aren't
decoration — they're how you tell one branch of the tree from another.

### Running locally

It's a static site — serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Use `localhost` rather than opening
`index.html` directly: password hashing needs WebCrypto, which browsers
only expose on `localhost` or HTTPS.
