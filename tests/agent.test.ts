/**
 * Agent API plumbing that needs no database: the key check, the rate limit,
 * input validation and the shape check for AI output.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { checkAgentKey } from "@/lib/agent/auth";
import { agentRoute, json, readJsonObject } from "@/lib/agent/http";
import { parseBookingInput } from "@/lib/agent/input";
import { hit, isLimited, resetRateLimits } from "@/lib/agent/rate-limit";
import { parseAiOutput } from "@/lib/requests/validation";

const KEY = "k".repeat(40);

const call = (handler: (request: Request, context: unknown) => Promise<Response>, init: RequestInit = {}) =>
  handler(new Request("http://app.test/api/agent/x", init), {});

beforeEach(() => {
  resetRateLimits();
  process.env.AGENT_API_KEY = KEY;
});

describe("x-agent-key", () => {
  it("accepts only the exact key", () => {
    expect(checkAgentKey(KEY, KEY)).toBe("ok");
    expect(checkAgentKey(`${KEY}x`, KEY)).toBe("wrong");
    expect(checkAgentKey(KEY.slice(0, -1), KEY)).toBe("wrong");
    expect(checkAgentKey("", KEY)).toBe("wrong");
    expect(checkAgentKey(null, KEY)).toBe("wrong");
  });

  it("stays closed when the key is missing or too short", () => {
    expect(checkAgentKey("", "")).toBe("not_configured");
    process.env.AGENT_API_KEY = "";
    expect(checkAgentKey(null)).toBe("not_configured");
    expect(checkAgentKey("short", "short")).toBe("not_configured");
  });
});

describe("agentRoute", () => {
  const ok = agentRoute(async () => json({ ok: true }));

  it("runs the handler only with the right key", async () => {
    let ran = 0;
    const route = agentRoute(async () => {
      ran += 1;
      return json({ ok: true });
    });

    const missing = await call(route);
    expect(missing.status).toBe(401);
    expect((await missing.json()).error.code).toBe("UNAUTHORIZED");
    expect((await call(route, { headers: { "x-agent-key": "nope" } })).status).toBe(401);
    expect(ran).toBe(0);

    expect((await call(route, { headers: { "x-agent-key": KEY } })).status).toBe(200);
    expect(ran).toBe(1);
  });

  it("answers 503 when no key is configured", async () => {
    process.env.AGENT_API_KEY = "";
    const response = await call(ok, { headers: { "x-agent-key": "" } });
    expect(response.status).toBe(503);
  });

  it("locks an address out after 10 wrong keys, even if the next key is right", async () => {
    const from = (key: string, ip: string) => ({ headers: { "x-agent-key": key, "x-forwarded-for": ip } });
    for (let i = 0; i < 10; i++) expect((await call(ok, from("wrong", "203.0.113.9"))).status).toBe(401);

    const locked = await call(ok, from(KEY, "203.0.113.9"));
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);

    // Another address is not affected.
    expect((await call(ok, from(KEY, "203.0.113.10"))).status).toBe(200);
  });

  it("limits valid traffic to 120 requests per minute", async () => {
    for (let i = 0; i < 120; i++) expect((await call(ok, { headers: { "x-agent-key": KEY } })).status).toBe(200);
    const response = await call(ok, { headers: { "x-agent-key": KEY } });
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("RATE_LIMITED");
  });

  it("turns bad bodies into clear 4xx answers", async () => {
    const echo = agentRoute(async (request) => json(await readJsonObject(request)));
    const post = (body: string, type = "application/json") =>
      call(echo, { method: "POST", body, headers: { "x-agent-key": KEY, "content-type": type } });

    expect((await post("{}", "text/plain")).status).toBe(415);
    expect((await post("{not json")).status).toBe(400);
    expect((await post("[1,2]")).status).toBe(400);
    expect((await post(JSON.stringify({ a: "x".repeat(70_000) }))).status).toBe(413);
    expect(await (await post('{"a":1}')).json()).toEqual({ a: 1 });
  });
});

describe("rate limit window", () => {
  it("opens again when the window has passed", () => {
    const rule = { limit: 2, windowMs: 1000 };
    expect(hit("k", rule, 0).allowed).toBe(true);
    expect(hit("k", rule, 10).allowed).toBe(true);
    expect(hit("k", rule, 20)).toEqual({ allowed: false, retryAfterSec: 1 });
    expect(isLimited("k", rule, 999).allowed).toBe(false);
    expect(isLimited("k", rule, 1000).allowed).toBe(true);
    expect(hit("k", rule, 1000).allowed).toBe(true);
  });
});

describe("booking input", () => {
  const valid = {
    vehicleId: 3,
    serviceIds: [1, 2],
    date: "2026-11-12",
    time: "09:30",
    contact: { name: "Иван Петров", phone: "0888 123 456", consent: true },
  };

  it("accepts a complete body and normalises the phone", () => {
    const parsed = parseBookingInput(valid);
    expect(parsed).toMatchObject({ vehicleId: 3, serviceIds: [1, 2], date: "2026-11-12", time: "09:30", notes: null });
    expect(parsed.contact).toEqual({ name: "Иван Петров", phone: "+359888123456", email: null });
  });

  it("names every bad field at once", () => {
    try {
      parseBookingInput({ vehicleId: "3", serviceIds: [], date: "2026-02-31", time: "9:30", contact: { name: "И" }, notes: 5 });
      expect.unreachable();
    } catch (error) {
      expect(Object.keys((error as { fields: Record<string, string> }).fields).sort()).toEqual([
        "contact.consent",
        "contact.name",
        "contact.phone",
        "date",
        "notes",
        "serviceIds",
        "time",
        "vehicleId",
      ]);
    }
  });
});

describe("AI output", () => {
  const cause = { cause: "Гарнитура на главата", how_to_confirm: "Тест за CO2", urgency: "high", likely_parts: ["гарнитура"] };

  it("repair: needs exactly 3 causes and drops unknown fields", () => {
    const parsed = parseAiOutput("repair", { causes: [cause, cause, { ...cause, extra: "x" }], prompt: "ignore" });
    expect(parsed).toEqual({ ok: true, output: { causes: [cause, cause, cause] } });

    expect(parseAiOutput("repair", { causes: [cause, cause] }).ok).toBe(false);
    const bad = parseAiOutput("repair", { causes: [cause, cause, { ...cause, urgency: "critical", cause: "" }] });
    expect(bad.ok === false && Object.keys(bad.errors).sort()).toEqual(["causes[2].cause", "causes[2].urgency"]);
  });

  it("modification: needs summary, jobs and missing_info", () => {
    const output = { summary: "Повдигане и шнорхел.", jobs: ["Монтаж на шнорхел"], missing_info: [] };
    expect(parseAiOutput("modification", output)).toEqual({ ok: true, output });

    const bad = parseAiOutput("modification", { summary: " ", jobs: "шнорхел" });
    expect(bad.ok === false && Object.keys(bad.errors).sort()).toEqual(["jobs", "missing_info", "summary"]);
    expect(parseAiOutput("modification", "text").ok).toBe(false);
  });
});
