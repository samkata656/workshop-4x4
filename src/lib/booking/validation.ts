/**
 * Input validation shared by the website's server actions and the agent API.
 * Everything arriving from outside is `unknown` until it has passed through here.
 */

export type Contact = { name: string; phone: string; email: string | null };
export type ContactErrors = Partial<Record<"name" | "phone" | "email" | "consent", string>>;

/** "0888 123 456" -> "+359888123456". Returns null when it cannot be a phone number. */
export function normalizePhone(raw: string): string | null {
  let phone = raw.replace(/[\s\-().]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  else if (phone.startsWith("0")) phone = `+359${phone.slice(1)}`;
  else if (!phone.startsWith("+")) phone = `+${phone}`;
  return /^\+\d{8,15}$/.test(phone) ? phone : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseContact(
  input: unknown,
  options: { emailRequired?: boolean } = {},
): { ok: true; contact: Contact } | { ok: false; errors: ContactErrors } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const errors: ContactErrors = {};

  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2) errors.name = "Въведете име, за да знаем към кого да се обърнем.";
  else if (name.length > 120) errors.name = "Името е твърде дълго. Съкратете го до 120 знака.";

  const phone = typeof raw.phone === "string" ? normalizePhone(raw.phone) : null;
  if (!phone) errors.phone = "Въведете телефон във формат 0888 123 456 или +359 888 123 456.";

  const emailRaw = typeof raw.email === "string" ? raw.email.trim() : "";
  let email: string | null = null;
  if (emailRaw === "") {
    if (options.emailRequired) errors.email = "Въведете имейл, за да ви изпратим офертата.";
  } else if (!EMAIL.test(emailRaw) || emailRaw.length > 200) {
    errors.email = "Проверете имейла — изглежда непълен (пример: ime@domain.bg).";
  } else {
    email = emailRaw.toLowerCase();
  }

  if (raw.consent !== true) errors.consent = "Отбележете съгласието, за да обработим заявката.";

  if (Object.keys(errors).length > 0 || !phone) return { ok: false, errors };
  return { ok: true, contact: { name, phone, email } };
}

/** A list of positive integer ids, de-duplicated, order kept. Null when malformed. */
export function parseIdList(input: unknown, max = 20): number[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > max) return null;
  const ids: number[] = [];
  for (const value of input) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
    if (!ids.includes(value)) ids.push(value);
  }
  return ids;
}

export function parseId(input: unknown): number | null {
  return typeof input === "number" && Number.isInteger(input) && input > 0 ? input : null;
}
