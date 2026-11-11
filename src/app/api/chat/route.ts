import { askChatAgent, parseChatInput } from "@/lib/chat";
import { clientAddress } from "@/lib/n8n";

const MAX_BODY_CHARS = 4000;

/**
 * POST /api/chat   { "sessionId": "<uuid from the browser>", "message": "..." }
 *   -> 200 { "reply": "..." }
 *   -> 400 / 429 / 502 / 503 { "error": "<Bulgarian text for the chat window>" }
 *
 * The only public door to the n8n booking agent. The n8n address and the agent
 * key stay on the server.
 */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    const text = await request.text();
    if (text.length <= MAX_BODY_CHARS) body = JSON.parse(text);
  } catch {
    // falls through to the 400 below
  }

  const input = parseChatInput(body);
  if (!input) {
    return Response.json({ error: "Съобщението е празно или твърде дълго." }, { status: 400 });
  }

  const result = await askChatAgent(input, clientAddress(request.headers));
  if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
  return Response.json({ reply: result.reply });
}
