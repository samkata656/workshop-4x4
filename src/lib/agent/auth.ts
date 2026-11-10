/**
 * The agent API's only credential: a shared secret in the x-agent-key header.
 *
 *   AGENT_API_KEY   long random value in .env (openssl rand -hex 32)
 *
 * While it is missing or too short the whole agent API stays closed.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const AGENT_KEY_HEADER = "x-agent-key";
const MIN_KEY_LENGTH = 32;

export type AgentKeyCheck = "ok" | "wrong" | "not_configured";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/**
 * Constant-time comparison. Both sides are hashed first, so the buffers always
 * have the same length and the timing reveals neither the key nor its length.
 */
export function checkAgentKey(presented: string | null, expected = process.env.AGENT_API_KEY): AgentKeyCheck {
  if (!expected || expected.length < MIN_KEY_LENGTH) return "not_configured";
  return timingSafeEqual(digest(presented ?? ""), digest(expected)) ? "ok" : "wrong";
}
