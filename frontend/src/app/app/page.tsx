// The workspace (chat + search), reached from the landing page at "/".
// When auth is enabled, this Server Component gates access: no session → back to
// the landing page to sign in. When auth is disabled, it renders for everyone.

import { redirect } from "next/navigation";
import { auth, authEnabled } from "@/auth";
import Workspace from "../_components/Workspace";

export default async function AppPage() {
  const session = authEnabled ? await auth() : null;
  if (authEnabled && !session) redirect("/");
  return <Workspace user={session?.user ?? null} />;
}
