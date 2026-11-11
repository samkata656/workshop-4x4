import { afterEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/agent/rate-limit";
import { askChatAgent, parseChatInput } from "@/lib/chat";
import { clientAddress } from "@/lib/n8n";
import { parseLookupOutput, parseNonStockInput } from "@/lib/vehicles/non-stock";

const SESSION = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetRateLimits();
});

describe("chat input", () => {
  it("accepts a session id and a trimmed message", () => {
    expect(parseChatInput({ sessionId: SESSION, message: "  Здравейте  " })).toEqual({ sessionId: SESSION, message: "Здравейте" });
  });

  it("rejects empty, oversized and malformed input", () => {
    expect(parseChatInput({ sessionId: SESSION, message: "   " })).toBeNull();
    expect(parseChatInput({ sessionId: SESSION, message: "а".repeat(1001) })).toBeNull();
    expect(parseChatInput({ sessionId: "short", message: "Здравейте" })).toBeNull();
    expect(parseChatInput({ sessionId: `${SESSION}'; drop table`, message: "Здравейте" })).toBeNull();
    expect(parseChatInput("Здравейте")).toBeNull();
  });
});

describe("chat agent call", () => {
  it("says the chat is off while the webhook URL is empty", async () => {
    vi.stubEnv("N8N_CHAT_WEBHOOK_URL", "");
    expect(await askChatAgent({ sessionId: SESSION, message: "Здравейте" }, "1.2.3.4")).toMatchObject({ ok: false, status: 503 });
  });

  it("forwards the message to n8n and returns the reply", async () => {
    vi.stubEnv("N8N_CHAT_WEBHOOK_URL", "http://n8n:5678/webhook/chat-agent");
    const fetchMock = vi.fn(async () => Response.json({ reply: " 149 € с ДДС " }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await askChatAgent({ sessionId: SESSION, message: "Колко струва?" }, "1.2.3.4")).toEqual({ ok: true, reply: "149 € с ДДС" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://n8n:5678/webhook/chat-agent");
    expect(JSON.parse(init.body as string)).toEqual({ sessionId: SESSION, message: "Колко струва?" });
  });

  it("answers 502 when n8n fails or sends no reply", async () => {
    vi.stubEnv("N8N_CHAT_WEBHOOK_URL", "http://n8n:5678/webhook/chat-agent");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    expect(await askChatAgent({ sessionId: SESSION, message: "Здравейте" }, "1.2.3.4")).toMatchObject({ ok: false, status: 502 });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ reply: "" })));
    expect(await askChatAgent({ sessionId: SESSION, message: "Здравейте" }, "1.2.3.4")).toMatchObject({ ok: false, status: 502 });
  });

  it("limits one visitor to 15 messages in a burst without calling n8n again", async () => {
    vi.stubEnv("N8N_CHAT_WEBHOOK_URL", "http://n8n:5678/webhook/chat-agent");
    const fetchMock = vi.fn(async () => Response.json({ reply: "да" }));
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < 15; i++) {
      expect((await askChatAgent({ sessionId: SESSION, message: "Здравейте" }, "5.6.7.8")).ok).toBe(true);
    }
    expect(await askChatAgent({ sessionId: SESSION, message: "Здравейте" }, "5.6.7.8")).toMatchObject({ ok: false, status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(15);
    // Another visitor is not affected.
    expect((await askChatAgent({ sessionId: SESSION, message: "Здравейте" }, "9.9.9.9")).ok).toBe(true);
  });
});

describe("visitor address", () => {
  it("trusts only the last x-forwarded-for entry (the one our proxy added)", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientAddress(new Headers())).toBe("direct");
  });
});

describe("non-stock vehicle input", () => {
  const swap = { brand: "Toyota", model: "Land Cruiser", generation: "J80", engine: " 1UZ-FE   4.0 V8 ", transmission: "A340F", fuel: "petrol", transmissionType: "automatic" };

  it("accepts a described swap and tidies the text", () => {
    expect(parseNonStockInput(swap)).toMatchObject({ ok: true, value: { engine: "1UZ-FE 4.0 V8", transmission: "A340F" } });
  });

  it("names every missing field", () => {
    expect(parseNonStockInput({ ...swap, brand: "Nissan", engine: "x", fuel: "", transmissionType: "cvt" })).toMatchObject({
      ok: false,
      errors: { vehicle: expect.any(String), engine: expect.any(String), fuel: expect.any(String), transmissionType: expect.any(String) },
    });
  });
});

describe("AI capacity answer", () => {
  it("keeps plausible litres and turns everything else into unknown", () => {
    const parsed = parseLookupOutput({
      output: {
        engine_oil_with_filter_l: 5.1,
        transmission_l: 2,
        front_diff_l: 0,
        rear_diff_l: -3,
        transfer_case_l: "1.4",
        coolant_l: null,
        brake_fluid_l: 900,
        sources: ["https://example.com/manual", "javascript:alert(1)", 42],
        confidence: "medium",
      },
    });
    expect(parsed).toEqual({
      engineOilWithFilterL: "5.10",
      transmissionL: "2.00",
      frontDiffL: null,
      rearDiffL: null,
      transferCaseL: null,
      coolantL: null,
      brakeFluidL: null,
      source: "AI lookup (confidence: medium) https://example.com/manual",
    });
  });

  it("treats a missing or malformed answer as nothing found", () => {
    const parsed = parseLookupOutput("not json");
    expect(parsed.engineOilWithFilterL).toBeNull();
    expect(parsed.source).toBe("AI lookup (confidence: low)");
  });
});
