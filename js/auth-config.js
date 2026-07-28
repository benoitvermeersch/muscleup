/* =====================================================================
   MuscleUp — auth configuration
   =====================================================================

   MuscleUp is a static site (no server of our own), so the account +
   email side is handled by Supabase Auth, which works entirely from the
   browser and sends the confirmation email for us.

   To switch the real email flow on:

     1. Create a free project at https://supabase.com
     2. Project Settings → API → copy the "Project URL" and the
        "anon / public" key into the two fields below.
     3. Authentication → Providers → Email → make sure
        "Confirm email" is ON.
     4. Authentication → URL Configuration → add this site's URL
        (e.g. https://benoitvermeersch.github.io/muscleup/) to both
        "Site URL" and "Redirect URLs", so the link in the email lands
        back here.

   The anon key is designed to be public — it is safe to commit and ships
   to the browser on every Supabase site. Row-level security, not this
   key, is what protects data.

   Leave the fields empty and MuscleUp runs in local mode instead: real
   validation, real password hashing, real verify-before-login gating,
   but the confirmation email is rendered on screen rather than sent, and
   accounts live in this browser only. That keeps the whole signup →
   verify → log in flow clickable before the Supabase project exists.
   --------------------------------------------------------------------- */

window.MU_AUTH_CONFIG = {
  SUPABASE_URL: "https://ixcmhtoixwewbaqtuimb.supabase.co",

  // Either key format works here: the legacy "anon" JWT (eyJ...) or the
  // newer publishable key (sb_publishable_...). Both are public by design.
  SUPABASE_ANON_KEY: "sb_publishable_6FBYhjIsyScYEihaTNxr9w_417OyU3I",
};
