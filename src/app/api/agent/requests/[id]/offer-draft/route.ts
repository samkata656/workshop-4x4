import { AgentError, agentRoute, invalid, json, readJsonObject } from "@/lib/agent/http";
import { parseIdText } from "@/lib/agent/input";
import { parseOfferDraft, saveOfferDraft } from "@/lib/requests/offer";

/**
 * POST /api/agent/requests/{id}/offer-draft
 *   { "draft": { "subject": "...", "body": "...",
 *                "items": [ { "name", "price_from_eur", "price_to_eur", "source_url" } ] } }
 *
 * Stores the AI-written offer e-mail for a modification request. It is only a
 * draft: the owner edits and approves it in the admin inbox before anything is
 * sent. Sending it again replaces the draft, unless the offer was already sent.
 */
export const POST = agentRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const id = parseIdText((await params).id);
  if (!id) throw invalid("The request id in the URL must be a positive integer.");

  const body = await readJsonObject(request);
  const parsed = parseOfferDraft(body.draft);
  if (!parsed.ok) throw invalid("`draft` does not have the expected shape. See `fields`.", parsed.errors);

  const saved = await saveOfferDraft(id, parsed.draft);
  if (!saved.ok) {
    throw saved.reason === "ALREADY_SENT"
      ? new AgentError(409, "OFFER_ALREADY_SENT", "The owner already sent this offer to the customer; the draft was not replaced.")
      : new AgentError(409, "NOT_A_MODIFICATION", "Offer drafts exist only for modification requests.");
  }
  return json({ requestId: id, saved: true, items: parsed.draft.items.length });
});
