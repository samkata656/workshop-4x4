"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import type { FormState } from "@/components/admin/action-form";
import { isLockedOut } from "@/lib/admin/rate-limit";
import { clientAddress } from "@/lib/n8n";

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  // The LAST x-forwarded-for entry is the one our proxy added; earlier ones are client-supplied
  // and would let an attacker dodge the lockout by sending a new value with every guess.
  const address = clientAddress(await headers());
  if (isLockedOut(address)) {
    return { ok: false, message: "Твърде много неуспешни опити. Изчакайте 15 минути и опитайте отново." };
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      // The failure was already counted where the password is checked (src/lib/admin/login.ts).
      return { ok: false, message: "Имейлът или паролата не съвпадат. Проверете ги и опитайте отново." };
    }
    throw error; // a successful sign-in "throws" the redirect to /admin
  }
}
