"use server";

import { after } from "next/server";
import { parseContact, type ContactErrors } from "@/lib/booking/validation";
import { createRequest, RequestError } from "./engine";
import type { RequestType } from "./options";
import { parseRequestDetails, type RequestErrors } from "./validation";
import { notifyAiOfNewRequest } from "./webhook";

export type RequestResult =
  | { ok: true; quoted: boolean }
  | { ok: false; message: string; fieldErrors?: ContactErrors & RequestErrors };

/** Server action behind both the repair form and the modification form. */
export async function submitRequestAction(input: {
  type?: unknown;
  details?: unknown;
  contact?: unknown;
  wantsQuote?: unknown;
}): Promise<RequestResult> {
  const type: RequestType | null = input.type === "repair" || input.type === "modification" ? input.type : null;
  if (!type) return { ok: false, message: "Заявката не можа да се изпрати. Презаредете страницата и опитайте отново." };

  const details = parseRequestDetails(type, input.details);
  const contact = parseContact(input.contact, { emailRequired: true });
  if (!details.ok || !contact.ok) {
    return {
      ok: false,
      message: "Проверете отбелязаните полета.",
      fieldErrors: { ...(details.ok ? {} : details.errors), ...(contact.ok ? {} : contact.errors) },
    };
  }

  try {
    const saved = await createRequest({
      type,
      details: details.details,
      contact: contact.contact,
      wantsQuote: input.wantsQuote === true,
    });
    // Runs after the customer already has their answer; does nothing until the
    // n8n webhook URL is configured.
    after(() => notifyAiOfNewRequest(saved.forAi));
    return { ok: true, quoted: saved.quoteId !== null };
  } catch (error) {
    if (error instanceof RequestError) {
      return { ok: false, message: "Този модел вече не е в списъка ни. Презаредете страницата и изберете отново." };
    }
    console.error("[requests] unexpected error", error);
    return { ok: false, message: "Нещо се обърка при нас и заявката не е записана. Опитайте отново след малко." };
  }
}
