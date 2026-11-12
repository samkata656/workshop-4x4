/**
 * Calls an n8n webhook that answers in the same request (chat agent, non-stock
 * lookup) and returns its JSON.
 *
 * The URLs point at the internal Docker network and never reach the browser.
 * Requests that n8n answers later use src/lib/requests/webhook.ts instead.
 */

export class N8nError extends Error {
  constructor(
    public readonly code: "NOT_CONFIGURED" | "FAILED",
    message: string,
  ) {
    super(message);
    this.name = "N8nError";
  }
}

export async function callN8n(envName: string, payload: unknown, timeoutMs: number): Promise<unknown> {
  const url = process.env[envName];
  if (!url) throw new N8nError("NOT_CONFIGURED", `${envName} is empty`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET && { "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET }),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`n8n answered ${response.status}`);
    return await response.json();
  } catch (error) {
    throw new N8nError("FAILED", error instanceof Error ? error.message : String(error));
  }
}

/**
 * The visitor's address as seen by our proxy. NGINX Proxy Manager appends the
 * real address as the LAST x-forwarded-for entry; earlier entries are whatever
 * the client claimed, so they are never trusted for rate limiting.
 */
export function clientAddress(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "direct";
}
