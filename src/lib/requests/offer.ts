/**
 * Offer e-mail for a modification request.
 *
 *   1. n8n looks up indicative part prices and writes a draft
 *      -> POST /api/agent/requests/{id}/offer-draft
 *   2. the owner reads and edits the draft in the admin inbox
 *   3. the owner approves -> the app asks n8n to send the e-mail
 *
 * Nothing is ever sent to a customer without step 3.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { N8nError, callN8n } from "@/lib/n8n";
import { RequestError } from "./engine";

const { customers, requests } = schema;

export const MAX_OFFER_SUBJECT = 200;
export const MAX_OFFER_BODY = 6000;
const MAX_ITEMS = 20;
const MAX_ITEM_NAME = 200;
const MAX_PRICE_EUR = 100_000;
const SEND_TIMEOUT_MS = 30_000;

/** One price the AI found online. Shown to the owner only, next to the draft. */
export type OfferItem = { name: string; priceFromEur: number | null; priceToEur: number | null; source: string | null };
export type OfferDraft = { subject: string; body: string; items: OfferItem[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const price = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_PRICE_EUR ? Math.round(value) : null);
const link = (value: unknown) => (typeof value === "string" && /^https?:\/\/\S+$/.test(value) && value.length <= 500 ? value : null);

/** The draft exactly as the owner will see it: subject and body are plain text. */
export function parseOfferText(subjectRaw: unknown, bodyRaw: unknown): { ok: true; subject: string; body: string } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const subject = typeof subjectRaw === "string" ? subjectRaw.replace(/\s+/g, " ").trim() : "";
  const body = typeof bodyRaw === "string" ? bodyRaw.replace(/\r\n/g, "\n").trim() : "";
  if (!subject || subject.length > MAX_OFFER_SUBJECT) errors.subject = `Required: text of at most ${MAX_OFFER_SUBJECT} characters, one line.`;
  if (!body || body.length > MAX_OFFER_BODY) errors.body = `Required: text of at most ${MAX_OFFER_BODY} characters.`;
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, subject, body };
}

/** What n8n sends. Items that are not usable are dropped rather than rejected. */
export function parseOfferDraft(input: unknown): { ok: true; draft: OfferDraft } | { ok: false; errors: Record<string, string> } {
  if (!isRecord(input)) return { ok: false, errors: { draft: "Required: a JSON object." } };
  const text = parseOfferText(input.subject, input.body);
  if (!text.ok) return text;

  const items: OfferItem[] = [];
  for (const raw of Array.isArray(input.items) ? input.items.slice(0, MAX_ITEMS) : []) {
    if (!isRecord(raw) || typeof raw.name !== "string" || !raw.name.trim()) continue;
    const from = price(raw.price_from_eur);
    const to = price(raw.price_to_eur);
    items.push({
      name: raw.name.trim().slice(0, MAX_ITEM_NAME),
      priceFromEur: from !== null && to !== null ? Math.min(from, to) : (from ?? to),
      priceToEur: from !== null && to !== null ? Math.max(from, to) : (to ?? from),
      source: link(raw.source_url),
    });
  }
  return { ok: true, draft: { subject: text.subject, body: text.body, items } };
}

export type SaveDraftResult = { ok: true } | { ok: false; reason: "NOT_A_MODIFICATION" | "ALREADY_SENT" };

/** Agent API: stores the AI draft. A draft the owner already sent is never overwritten. */
export async function saveOfferDraft(requestId: number, draft: OfferDraft): Promise<SaveDraftResult> {
  return getDb().transaction(async (tx) => {
    const [request] = await tx
      .select({ type: requests.type, sentAt: requests.offerSentAt })
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND");
    if (request.type !== "modification") return { ok: false, reason: "NOT_A_MODIFICATION" };
    if (request.sentAt) return { ok: false, reason: "ALREADY_SENT" };

    const now = new Date();
    await tx
      .update(requests)
      .set({ offerSubject: draft.subject, offerBody: draft.body, offerItems: draft.items, offerDraftedAt: now, updatedAt: now })
      .where(eq(requests.id, requestId));
    return { ok: true };
  });
}

/** Admin: saves the owner's edits. */
export async function saveOfferText(requestId: number, subject: string, body: string) {
  await getDb().update(requests).set({ offerSubject: subject, offerBody: body, updatedAt: new Date() }).where(eq(requests.id, requestId));
}

export type SendOfferResult = { ok: true; to: string } | { ok: false; reason: "NOT_FOUND" | "NO_EMAIL" | "NOT_CONFIGURED" | "SEND_FAILED" };

/** Admin: e-mails the saved offer to the customer through n8n and marks the request as quoted. */
export async function sendOffer(requestId: number): Promise<SendOfferResult> {
  const db = getDb();
  const [row] = await db
    .select({ subject: requests.offerSubject, body: requests.offerBody, status: requests.status, to: customers.email, name: customers.name })
    .from(requests)
    .innerJoin(customers, eq(customers.id, requests.customerId))
    .where(eq(requests.id, requestId))
    .limit(1);
  if (!row || !row.subject || !row.body) return { ok: false, reason: "NOT_FOUND" };
  if (!row.to) return { ok: false, reason: "NO_EMAIL" };

  try {
    const answer = await callN8n("N8N_OFFER_EMAIL_WEBHOOK_URL", { requestId, to: row.to, subject: row.subject, body: row.body }, SEND_TIMEOUT_MS);
    if (!isRecord(answer) || answer.sent !== true) throw new N8nError("FAILED", "n8n did not confirm the e-mail was sent");
  } catch (error) {
    if (error instanceof N8nError && error.code === "NOT_CONFIGURED") return { ok: false, reason: "NOT_CONFIGURED" };
    console.error(`[offer] e-mail for request ${requestId} was not sent:`, error);
    return { ok: false, reason: "SEND_FAILED" };
  }

  const now = new Date();
  await db
    .update(requests)
    .set({
      offerSentAt: now,
      offerSentTo: row.to,
      // Moves a fresh request forward; a later status the owner chose is left alone.
      ...((row.status === "new" || row.status === "contacted") && { status: "quoted" as const }),
      updatedAt: now,
    })
    .where(eq(requests.id, requestId));
  return { ok: true, to: row.to };
}
