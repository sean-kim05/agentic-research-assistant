// Auth.js (NextAuth v5) configuration — Google sign-in with JWT sessions
// (no database, matching this project's no-DB design; the session lives in an
// encrypted cookie).
//
// GRACEFUL BY DESIGN: auth is only "enabled" when Google OAuth credentials are
// present in the environment. Until then `authEnabled` is false, the app runs
// exactly as before (no sign-in wall, no user menu), so a missing config never
// breaks the app.
//
// To turn it on, set these in the frontend environment (server-side only —
// never NEXT_PUBLIC):
//   AUTH_SECRET        (any long random string; `openssl rand -base64 32`)
//   AUTH_GOOGLE_ID     (OAuth client ID from Google Cloud Console)
//   AUTH_GOOGLE_SECRET (OAuth client secret)

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const authEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: authEnabled ? [Google] : [],
  session: { strategy: "jwt" },
  // Sign-in is initiated from the landing page rather than a NextAuth-hosted page.
  pages: { signIn: "/" },
});
