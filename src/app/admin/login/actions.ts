"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import type { FormState } from "@/components/admin/action-form";
import { isLockedOut, recordFailure } from "@/lib/admin/rate-limit";

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const forwarded = (await headers()).get("x-forwarded-for");
  const address = forwarded?.split(",")[0].trim() || "local";
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
      recordFailure(address);
      return { ok: false, message: "Имейлът или паролата не съвпадат. Проверете ги и опитайте отново." };
    }
    throw error; // a successful sign-in "throws" the redirect to /admin
  }
}
