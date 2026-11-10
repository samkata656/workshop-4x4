"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { ok: boolean; message: string } | null;
export type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>;

/** A <form> wired to a server action, showing the action's answer underneath. */
export function ActionForm(props: { action: FormAction; className?: string; children: React.ReactNode }) {
  const [state, formAction] = useActionState(props.action, null);
  return (
    <form action={formAction} className={props.className}>
      {props.children}
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`col-span-full mt-3 border-l-2 px-3 py-2 text-sm ${
            state.ok ? "border-sand text-sand" : "border-rust bg-olive/40 text-paper"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SubmitButton(props: { children: React.ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={props.className ?? "btn min-h-10 px-4"}>
      {pending ? (props.pendingLabel ?? "Записваме…") : props.children}
    </button>
  );
}
