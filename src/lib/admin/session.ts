import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Call at the top of every admin data loader and every admin server action.
 * Server actions are plain POST endpoints, so the proxy alone is not enough.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  return session.user;
}
