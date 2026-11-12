/**
 * Chat window -> n8n booking agent (SPEC.md 6.6 and 8.1).
 *
 * The browser talks only to our own POST /api/chat. This module checks the
 * input, applies the limits and forwards the message to n8n, which keeps the
 * conversation memory under the session id.
 */
import { hit } from "@/lib/agent/rate-limit";
import { N8nError, callN8n } from "@/lib/n8n";

export const MAX_CHAT_MESSAGE = 1000;
const MAX_REPLY = 4000;
const TIMEOUT_MS = 60_000;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Each message costs LLM tokens, so the limits are deliberately tight. */
const PER_VISITOR_BURST = { limit: 15, windowMs: 5 * MINUTE };
const PER_VISITOR_DAY = { limit: 80, windowMs: DAY };
const EVERYONE_DAY = { limit: 2000, windowMs: DAY, shared: true };

export type ChatInput = { sessionId: string; message: string };

/** The session id is made in the browser (crypto.randomUUID) and is the memory key in n8n. */
const SESSION_ID = /^[A-Za-z0-9-]{16,64}$/;

export function parseChatInput(body: unknown): ChatInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { sessionId, message } = body as Record<string, unknown>;
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return null;
  if (typeof message !== "string") return null;
  const text = message.trim();
  if (!text || text.length > MAX_CHAT_MESSAGE) return null;
  return { sessionId, message: text };
}

export type ChatResult =
  | { ok: true; reply: string }
  | { ok: false; status: 429 | 502 | 503; message: string };

export async function askChatAgent(input: ChatInput, address: string): Promise<ChatResult> {
  const limited =
    !hit(`chat:burst:${address}`, PER_VISITOR_BURST).allowed ||
    !hit(`chat:day:${address}`, PER_VISITOR_DAY).allowed ||
    !hit("chat:everyone", EVERYONE_DAY).allowed;
  if (limited) {
    return { ok: false, status: 429, message: "Твърде много съобщения за кратко време. Изчакайте няколко минути и опитайте отново." };
  }

  try {
    const answer = await callN8n("N8N_CHAT_WEBHOOK_URL", input, TIMEOUT_MS);
    const reply = typeof answer === "object" && answer !== null ? (answer as Record<string, unknown>).reply : null;
    if (typeof reply !== "string" || !reply.trim()) throw new N8nError("FAILED", "n8n sent no reply text");
    return { ok: true, reply: reply.trim().slice(0, MAX_REPLY) };
  } catch (error) {
    if (error instanceof N8nError && error.code === "NOT_CONFIGURED") {
      return { ok: false, status: 503, message: "Чатът не е включен в момента. Използвайте формата за записване." };
    }
    console.error("[chat] the agent did not answer:", error);
    return { ok: false, status: 502, message: "Асистентът не отговори. Опитайте отново след малко или използвайте формата за записване." };
  }
}
