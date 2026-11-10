import { agentRoute, invalid, json, readJsonObject } from "@/lib/agent/http";
import { parseIdText } from "@/lib/agent/input";
import { saveAiOutput } from "@/lib/requests/engine";

/**
 * POST /api/agent/requests/{id}/ai-result
 *   repair request:        { "output": { "causes": [ 3 x { "cause", "how_to_confirm", "urgency", "likely_parts" } ] } }
 *   modification request:  { "output": { "summary", "jobs": [...], "missing_info": [...] } }
 * Stores the AI text on the request for the admin inbox. Sending it again replaces it.
 */
export const POST = agentRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const id = parseIdText((await params).id);
  if (!id) throw invalid("The request id in the URL must be a positive integer.");

  const body = await readJsonObject(request);
  const saved = await saveAiOutput(id, body.output);
  if (!saved.ok) {
    throw invalid(`\`output\` does not have the shape expected for a ${saved.type} request. See \`fields\`.`, saved.errors);
  }
  return json({ requestId: id, type: saved.type, saved: true });
});
