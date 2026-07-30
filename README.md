# MuscleUp

**Level Up Your Body**

A skill tree to help you unlock calisthenics, isometrics and strengthen your body, with AI guidance along the way.

MuscleUp turns bodyweight training into an RPG-style skill tree, split into five branches:

- **Push** — push-ups, dips, handstands, planche
- **Pull** — rows, pull-ups, front lever, muscle-up
- **Legs** — squats, lunges, pistol squats, shrimp squats
- **Core** — plank, hollow body, L-sit, dragon flag
- **Cardio** — jumping jacks, burpees, jump rope, sprints

Each move is a node you unlock as you progress, Duolingo-style, with AI guidance recommending what to train next.

## Accounts

Signing up takes an email and a password of **more than 8 characters**. You
get a confirmation email, and the account can't log in until that link is
clicked.

**The skill tree is open to everyone — an account isn't required.** Opening
it runs a one-time check-in first (below).

Progress is stored per account, so two people sharing a browser don't
inherit each other's tree. Signed out, progress is kept on the device under
a `guest` key; it stays separate from any account you later sign in to,
rather than being merged into it.

### The check-in

The first time the map opens it asks two questions, in order.

**Step 1 — how far along are you?** Beginner, Intermediate or Advanced.
That choice decides nothing about your tree; all it does is pick *which*
exercises step 2 asks about. There's no point asking someone on their first
push-up whether they hold a planche, or walking an advanced athlete through
jumping jacks.

**Step 2 — which of those can you already do?** A checklist drawn from the
level you picked: ten foundations for a beginner, the middle of each branch
for an intermediate, levers and handstands for an advanced athlete.

**Step 1 is reversible, step 2 is not.** Picked the wrong level? **Change
level** goes back to the cards and swaps the list — as many times as you
like. Confirming the checklist ends the check-in for good: those answers
shape the tree from then on, and the dialog is never offered again. Ticks
don't survive a change of level, because a different level asks about
different exercises.

### Where you start

**Everyone starts on zero.** Whatever you tick, and whichever level you
pick, no reps are credited to anyone — the leaderboard begins at 0 for
every account, and the check-in can't be used to buy a head start.

What the ticks buy is *access*. A ticked exercise is stored as "I can
already do this" (`mu-cleared`), which counts as met wherever that skill
stands in another's way — the same claim 200 reps makes, minus the reps.
So the more you tick, the more of the tree is open to train:

| Ticked | Skills open |
| --- | --- |
| nothing | 5 — the base of each branch |
| Push-Up | 11 |
| Push-Up + Pull-Up | 17 |
| the whole advanced list | 58 |

The dialog counts this up live as you tick, so the trade is visible before
you commit to it.

Ticking high up a line takes the line below it as read: claim the Muscle-Up
and the chest-to-bar, pull-up, jumping negative and dead hang under it are
claimed too. Without that you'd end up with a muscle-up open above a locked
dead hang. Only the parent chain is followed — plus the extras of an `AND`,
which are genuine requirements. An `OR`'s extras are a second way in, not
something the tick implies.

Skills opened this way sit on zero reps with their line already open, so
the popup says why rather than leaving an empty counter looking like a bug.

## Your profile

Signing up asks for an email and a password, nothing else. The name comes
later, on **`profile.html`** — a picture, username, first name, last name,
and that's it for now. The username is what other athletes see; the email
never leaves your own screen.

Usernames are 3–20 characters of letters, numbers and underscores, and are
unique across the site (case-insensitively, so `Ben` and `ben` can't both
exist). Until you set one, the leaderboard calls you `Athlete 1a2b` after
the first characters of your account id.

### Your picture

The circle at the top of the form takes a photo — click it, use **Upload a
picture**, or drop a file straight onto it. It saves on its own rather than
waiting for **Save profile**, so a brand-new account doesn't need a
username before it can have a face. **Remove** puts the initial back.

Whatever you pick is cropped to a centred square and re-encoded to a 256px
JPEG *in the browser*, before anything is uploaded. That keeps every avatar
the same shape, keeps the upload to a few tens of KB however large the
original was, and drops the metadata block a camera attaches — a photo off
a phone carries the time and GPS coordinates it was taken at, and these are
shown to everyone on the leaderboard.

Remote mode puts the file in an `avatars` storage bucket under a folder
named after your user id, and the profile row stores only that path — never
a full URL. The board renders every athlete's picture as an `<img>`, so a
row that could hold an arbitrary URL would be a way to point every viewer's
browser at a server of someone else's choosing; a check constraint keeps
the value inside your own folder. Local mode has no bucket, so the image
lives in this browser instead.

Your picture also replaces the initial in the header chip and on the
leaderboard. If one ever fails to load, the letter underneath shows through
rather than a broken-image icon.

## Danger zone

The bottom of the profile page holds the two irreversible things, both
behind a confirmation:

- **Reset my tree** clears every rep, the favourite, the check-in answers
  and the level that framed them, then publishes the zeroes so the
  leaderboard agrees. The check-in is offered again next time the map
  opens. The account and username survive.
- **Delete my account** takes the account, the profile row and everything
  this browser stored, and needs you to type DELETE first.

Supabase gives the browser no way to delete its own auth user — that sits
behind the service-role key, which must never ship to a page — so the
schema installs a `delete_own_account()` function that deletes only the
caller's row and lets the cascade take the profile. Storage sits outside
that cascade, so the function clears the athlete's avatar folder itself
rather than leaving the picture behind. It's granted to
`authenticated` and revoked from `anon`. **Re-run `supabase/schema.sql`
to add it**; until then, deleting says so rather than failing quietly.

## Contact

**`contact.html`** is who's building this and how to reach them. It's the
last link in the header either way — signed out and signed in — so it sits
in the same place whatever state you're in.

### Active users on the landing page

The hero's fourth stat is the number of registered athletes, read from the
`profiles` table. It asks PostgREST to count the rows and return none of
them (`Prefer: count=exact`, `Range: 0-0`) rather than downloading the
table to measure it, and falls back to counting a plain list if the
`Content-Range` header isn't exposed. The stat starts hidden and only
appears once a real number arrives, so an empty or unreachable board says
nothing rather than advertising zero.

## The leaderboard

**`leaderboard.html`** lists **every account ever registered** — not just
the ones who have trained — ranked by total reps. Each row shows:

- **Total reps** — everything logged across all five branches
- **Top branch** — whichever of Push, Pull, Legs, Core or Cardio holds the
  most of those reps
- **Favourite exercise** — the one skill you've starred

### Rep limits

You can log at most **2,000 reps at a time**. It isn't only about plausible
sets: a number large enough to overflow a double becomes `Infinity`,
`JSON.stringify` writes that as `null`, and the published total hits a NOT
NULL integer column — one bad entry would otherwise block every later
publish for that account.

The cap is enforced in four places, so no route around the form helps:

- the input carries `max` and pulls an over-long number back as you type
- `addRepsTo` clamps whatever it's handed and returns what it credited, so
  the popup can say a number was trimmed rather than banking a different
  one silently
- totals are capped per skill, and again at the Postgres integer ceiling
  before being published
- counts already in a browser are repaired on load — anything unreadable
  or above the per-skill ceiling (which adding can't produce) is treated as
  overflow and dropped rather than parked at the top of the leaderboard

### What a skill is

Clicking a node opens it and says, in no more than three sentences, what
the movement actually is — how it's performed, plus the form cue or the
fact worth knowing about it. Every one of the 72 skills has one, and it
shows on locked nodes as well as open ones: a name on its own doesn't tell
you what a Hefesto is, and the skills you can't reach yet are exactly the
ones you've never done.

The text lives in a `DESCRIPTIONS` map in `js/skills.js`, keyed
`branch:id` — separate from `CATEGORIES` so the shape of the tree stays
scannable, and keyed by branch as well as id because Burpee sits on two of
them.

### Favouriting an exercise

Open any skill in the tree and hit **Make this my favourite**. The node
gets a gold star and the skill's name appears next to you on the
leaderboard. Starring another exercise moves the star; starring the one
you've already starred clears it. Locked skills can be favourited too — a
goal makes a perfectly good favourite.

### Getting to the map

The tree is an overlay on the landing page, so links from the leaderboard
and the header carry `index.html?tree`, which opens it on arrival and then
tidies the query string back out of the URL. On the landing page itself the
click is intercepted and nothing navigates.

### Moving around the map

Two fingers on a trackpad (or a scroll wheel) move the map — no click
needed — and dragging still works. Zoom is on pinch, which browsers deliver
as ⌘/Ctrl + scroll, plus the +/− buttons and the +/− keys. The view can't
travel below the START circle, so at the default zoom there's nothing under
you to scroll down to.

### On the skill tree

The map carries a shortened version of the board, collapsed to a tab in
the top-right corner and expandable over the tree: the top five athletes
plus your own line if you're below them. It hides on narrow screens,
where the map needs every pixel it can get.

### Why pages don't sit empty waiting for the database

Three things, in order of how much they help:

1. **Cache first, then correct.** The last board, your last profile and the
   last athlete count are kept in local storage and painted before any
   request is sent. A repeat visit shows real content immediately and
   quietly updates itself; only a genuine first visit sees the placeholder
   rows.
2. **Nothing waits on anything it doesn't need.** Publishing your reps and
   reading the board don't depend on each other, so they run together
   rather than one after the other. Your own row is patched from this
   device regardless, so the table is right whether or not the write has
   landed.
3. **`<link rel="preconnect">` to Supabase**, so DNS and TLS are done
   before the first query rather than during it. Keep that host in step
   with `SUPABASE_URL` in `js/auth-config.js`.

Measured against a simulated 300 ms round trip: real rows on screen at
~160 ms instead of ~850 ms, and everything settled at ~680 ms instead of
~1,880 ms.

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

   The same script creates the public **`avatars`** storage bucket that
   profile pictures go in, with policies confining each athlete to a folder
   named after their user id. If your project doesn't let the SQL editor
   touch storage, the script says so in a notice and carries on rather than
   failing — create a public bucket called `avatars` under Storage by hand
   and add the four policies from that block. Until the bucket exists,
   uploading a picture explains what's missing instead of failing quietly.

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
├── profile.html          # username / first name / last name + danger zone
├── contact.html          # who builds this
├── assets/logo.svg       # the mark, white on transparent
├── assets/favicon.svg    # the mark on a dark rounded tile
├── css/style.css         # landing page + skill tree styles
├── css/auth.css          # auth dialog, account chip, the two-step check-in
├── css/pages.css         # leaderboard + profile pages
├── js/auth-config.js     # Supabase URL + anon key (empty → local mode)
├── js/auth.js            # signup / login / verification + the auth dialog
├── js/skills.js          # branches, levels, descriptions, reps, favourite, aggregates
├── js/profiles.js        # profile storage + the leaderboard feed
├── js/script.js          # skill tree wheel + progression
├── js/leaderboard.js     # the rankings table
├── js/tree-board.js      # the standings panel on the map
├── js/profile-page.js    # the profile form
└── supabase/schema.sql   # profiles table, RLS, avatars bucket, signup trigger
```

The sign up / log in dialog **and the header navigation** are built by
`js/auth.js` rather than written into each page, so a page picks both up
just by loading that script and putting an `#auth-slot` and an empty
`#nav-links` in its header. That's also what keeps the nav identical
everywhere: signed out it's How It Works / Skill Tree / AI Coach / Contact, and
signed in it's Home / Skill Tree / Leaderboard / Profile / Contact — the links don't
shuffle as you move between pages.

Assets are referenced with a `?v=` query string. **Bump it whenever you
change a CSS or JS file**, otherwise browsers keep serving the copy they
already have and you get a half-updated site.

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
