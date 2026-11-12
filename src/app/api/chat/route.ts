import { askChatAgent, parseChatInput } from "@/lib/chat";
import { clientAddress } from "@/lib/n8n";

/** A chat message is at most 1000 characters; anything larger is not read into memory. */
const MAX_BODY_BYTES = 8 * 1024;

async function readSmallJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel(); // no content-length, or a false one: stop as soon as the cap is passed
      return null;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * POST /api/chat   { "sessionId": "<uuid from the browser>", "message": "..." }
 *   -> 200 { "reply": "..." }
 *   -> 400 / 429 / 502 / 503 { "error": "<Bulgarian text for the chat window>" }
 *
 * The only public door to the n8n booking agent. The n8n address and the agent
 * key stay on the server.
 */
export async function POST(request: Request) {
  const input = parseChatInput(await readSmallJson(request));
  if (!input) {
    return Response.json({ error: "Съобщението е празно или твърде дълго." }, { status: 400 });
  }

  const result = await askChatAgent(input, clientAddress(request.headers));
  if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
  return Response.json({ reply: result.reply });
}
