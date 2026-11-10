import { agentRoute, json, readJsonObject } from "@/lib/agent/http";
import { parseQuoteInput } from "@/lib/agent/input";
import { priceJson } from "@/lib/agent/serialize";
import { createQuote } from "@/lib/booking/engine";

/**
 * POST /api/agent/quotes
 *   { "vehicleId": 12, "serviceIds": [1, 4],
 *     "contact": { "name": "...", "phone": "0888 123 456", "email": null, "consent": true } }
 * Saves a price estimate for the owner to follow up. Never reserves a bay.
 */
export const POST = agentRoute(async (request) => {
  const input = parseQuoteInput(await readJsonObject(request));
  const quote = await createQuote({ ...input, source: "agent" });
  return json({ quote: { id: quote.id, price: priceJson(quote.price) } }, 201);
});
