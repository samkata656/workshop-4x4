/**
 * Tells n8n that a new request is waiting for its AI text.
 *
 * NOT CONNECTED YET. While the environment variables below are empty this
 * function does nothing, and requests simply stay with an empty AI field.
 *
 *   N8N_REPAIR_WEBHOOK_URL         e.g. http://n8n:5678/webhook/repair-diagnosis
 *   N8N_MODIFICATION_WEBHOOK_URL   e.g. http://n8n:5678/webhook/modification-summary
 *   N8N_WEBHOOK_SECRET             optional; sent as the x-webhook-secret header
 *
 * These are server-only: they point at the internal Docker network and are never
 * sent to the browser. n8n answers later by calling
 * POST /api/agent/requests/{id}/ai-result.
 *
 * A failure here never fails the customer's request — it is already saved.
 */
import type { RequestForAi } from "./engine";

const URL_BY_TYPE = {
  repair: "N8N_REPAIR_WEBHOOK_URL",
  modification: "N8N_MODIFICATION_WEBHOOK_URL",
} as const;

export async function notifyAiOfNewRequest(payload: RequestForAi): Promise<"sent" | "skipped" | "failed"> {
  const url = process.env[URL_BY_TYPE[payload.type]];
  if (!url) return "skipped";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET && { "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET }),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`n8n answered ${response.status}`);
    return "sent";
  } catch (error) {
    console.error(`[requests] could not notify n8n about request ${payload.requestId}:`, error);
    return "failed";
  }
}
