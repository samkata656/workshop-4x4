/**
 * Shared plumbing for every /api/agent/* route: rate limit, x-agent-key check,
 * JSON parsing and one error format.
 *
 *   { "error": { "code": "SLOT_TAKEN", "message": "...", "fields": { ... } } }
 *
 * Messages are in English: they are read by the agent, not shown to customers.
 * The routes themselves hold no business rules — those live in src/lib/booking
 * and src/lib/requests, the same code the website uses.
 */
import { BookingError, type BookingErrorCode } from "@/lib/booking/engine";
import { RequestError } from "@/lib/requests/engine";
import { AGENT_KEY_HEADER, checkAgentKey } from "./auth";
import { hit, isLimited, type RateLimit } from "./rate-limit";

/** All agent traffic together. n8n is the only caller, so one shared budget. */
const REQUESTS: RateLimit = { limit: 120, windowMs: 60_000, shared: true };
/** Wrong or missing keys, per address — slows down guessing. */
const BAD_KEYS: RateLimit = { limit: 10, windowMs: 60_000 };
const MAX_BODY_BYTES = 64 * 1024;

const NO_STORE = { "cache-control": "no-store" };

export class AgentError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public retryAfterSec?: number,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export const invalid = (message: string, fields?: Record<string, string>) =>
  new AgentError(400, "INVALID_INPUT", message, fields);

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE });
}

function errorResponse(error: AgentError) {
  return Response.json(
    { error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }) } },
    {
      status: error.status,
      headers: { ...NO_STORE, ...(error.retryAfterSec && { "retry-after": String(error.retryAfterSec) }) },
    },
  );
}

const BOOKING_ERRORS: Record<BookingErrorCode, [status: number, message: string]> = {
  VEHICLE_NOT_FOUND: [404, "No vehicle with this vehicleId. Use GET /api/agent/vehicles to find a valid id."],
  SERVICE_NOT_FOUND: [404, "At least one serviceId does not exist or is no longer offered. Use GET /api/agent/services."],
  BOOKING_NOT_FOUND: [404, "No booking with this id."],
  SLOT_UNAVAILABLE: [
    409,
    "This start time cannot be booked: it is outside opening hours or the booking window, off the slot grid, or the job would end after closing. Use POST /api/agent/availability to get valid times.",
  ],
  SLOT_TAKEN: [409, "Every bay is already taken at this time. Use POST /api/agent/availability and offer another time."],
};

function toAgentError(error: unknown): AgentError {
  if (error instanceof AgentError) return error;
  if (error instanceof BookingError) {
    const [status, message] = BOOKING_ERRORS[error.code];
    return new AgentError(status, error.code, message);
  }
  if (error instanceof RequestError) {
    return error.code === "REQUEST_NOT_FOUND"
      ? new AgentError(404, error.code, "No request with this id.")
      : new AgentError(404, error.code, "The vehicle of this request is not in the catalogue.");
  }
  console.error("[agent] unexpected error", error);
  return new AgentError(500, "INTERNAL_ERROR", "Something went wrong on the server. Nothing was saved. Try again later.");
}

/**
 * The address that reached our reverse proxy. The proxy appends it as the LAST
 * x-forwarded-for entry; earlier entries are whatever the client claimed.
 * Calls from inside the Docker network (n8n) carry no such header.
 */
function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "direct";
}

function guard(request: Request) {
  const badKeys = `bad-key:${clientAddress(request)}`;
  const blocked = isLimited(badKeys, BAD_KEYS);
  if (!blocked.allowed) {
    throw new AgentError(429, "RATE_LIMITED", "Too many requests with a wrong key. Wait and try again.", undefined, blocked.retryAfterSec);
  }

  const key = checkAgentKey(request.headers.get(AGENT_KEY_HEADER));
  if (key === "not_configured") {
    console.error("[agent] AGENT_API_KEY is missing or shorter than 32 characters — the agent API is closed.");
    throw new AgentError(503, "AGENT_API_DISABLED", "The agent API is not configured on this server.");
  }
  if (key === "wrong") {
    hit(badKeys, BAD_KEYS);
    throw new AgentError(401, "UNAUTHORIZED", `Missing or wrong ${AGENT_KEY_HEADER} header.`);
  }

  const budget = hit("requests", REQUESTS);
  if (!budget.allowed) {
    throw new AgentError(429, "RATE_LIMITED", `Too many requests (limit ${REQUESTS.limit} per minute). Wait and try again.`, undefined, budget.retryAfterSec);
  }
}

/** Wraps a route handler: nothing runs before the rate limit and the key check pass. */
export function agentRoute<Context = unknown>(handler: (request: Request, context: Context) => Promise<Response>) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      guard(request);
      return await handler(request, context);
    } catch (error) {
      return errorResponse(toAgentError(error));
    }
  };
}

/** The request body as a JSON object, or a clear 4xx. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new AgentError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the body as JSON with the header content-type: application/json.");
  }
  const tooLarge = new AgentError(413, "BODY_TOO_LARGE", `The body is larger than ${MAX_BODY_BYTES / 1024} KB.`);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw tooLarge;

  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw tooLarge;

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw invalid("The body is not valid JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw invalid("The body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}
