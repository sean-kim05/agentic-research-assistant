"use server";

// Server actions for sign-in / sign-out, safe to import into Client Components
// (a <form action={...}> can call these). They run only on the server.

import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/app" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
