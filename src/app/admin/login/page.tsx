import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="relative isolate flex flex-1 items-center justify-center px-4 py-16">
      <div aria-hidden className="survey-grid absolute inset-0 -z-10" />
      <div className="w-full max-w-sm border border-line-strong bg-carbon-raised">
        <div aria-hidden className="hatch h-2" />
        <div className="p-6 sm:p-8">
          <p className="label">
            <span className="label-accent">CMD</span> / Вход
          </p>
          <h1 className="display mt-4 text-6xl">
            4<span className="text-rust">×</span>4 Админ
          </h1>
          <ActionForm action={loginAction} className="mt-8 grid gap-5">
            <div>
              <label htmlFor="email" className="field-label">
                Имейл
              </label>
              <input id="email" name="email" type="email" autoComplete="username" required className="input" />
            </div>
            <div>
              <label htmlFor="password" className="field-label">
                Парола
              </label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
            </div>
            <SubmitButton pendingLabel="Влизаме…" className="btn justify-center">
              Влез
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
