import { afterEach, describe, expect, it, vi } from "vitest";
import { parseContact } from "@/lib/booking/validation";
import type { RequestForAi } from "@/lib/requests/engine";
import { parseRequestDetails } from "@/lib/requests/validation";
import { notifyAiOfNewRequest } from "@/lib/requests/webhook";

const stock = { nonStock: false, vehicleId: 12 };
const swapped = { nonStock: true, brand: "Toyota", model: "Land Cruiser", generation: "J80", engine: " 1UZ-FE  4.0 V8 ", transmission: "A340F" };

describe("repair request validation", () => {
  it("accepts a stock vehicle with symptoms", () => {
    const result = parseRequestDetails("repair", { vehicle: stock, description: "Чука отпред при неравности", options: ["шум"], mileageKm: 245000 });
    expect(result).toMatchObject({ ok: true, details: { mileageKm: 245000, options: ["шум"] } });
  });

  it("requires the symptoms text", () => {
    const result = parseRequestDetails("repair", { vehicle: stock, description: "  ", options: ["шум"] });
    expect(result).toMatchObject({ ok: false, errors: { description: expect.any(String) } });
  });

  it("drops quick picks that are not on the list", () => {
    const result = parseRequestDetails("repair", { vehicle: stock, description: "Тече масло", options: ["теч", "<script>", "Шнорхел"] });
    expect(result.ok && result.details.options).toEqual(["теч"]);
  });

  it("rejects a mileage that is not a whole number of km", () => {
    const result = parseRequestDetails("repair", { vehicle: stock, description: "Тече масло", mileageKm: "много" });
    expect(result).toMatchObject({ ok: false, errors: { mileage: expect.any(String) } });
  });
});

describe("modification request validation", () => {
  it("accepts ticked options with no comment", () => {
    const result = parseRequestDetails("modification", { vehicle: stock, options: ["Шнорхел", "Стоманени брони"] });
    expect(result).toMatchObject({ ok: true, details: { description: null, options: ["Шнорхел", "Стоманени брони"] } });
  });

  it("needs at least one option or a comment", () => {
    expect(parseRequestDetails("modification", { vehicle: stock, options: [] })).toMatchObject({ ok: false, errors: { options: expect.any(String) } });
    expect(parseRequestDetails("modification", { vehicle: stock, description: "Искам лебедка" }).ok).toBe(true);
  });
});

describe("„Не е стоков джип?“", () => {
  it("takes engine and gearbox as free text, trimmed", () => {
    const result = parseRequestDetails("modification", { vehicle: swapped, options: ["Шнорхел"] });
    expect(result.ok && result.details.vehicle).toEqual({ ...swapped, engine: "1UZ-FE 4.0 V8" });
  });

  it("asks for both text fields", () => {
    const result = parseRequestDetails("modification", { vehicle: { ...swapped, engine: "", transmission: " " }, options: ["Шнорхел"] });
    expect(result).toMatchObject({ ok: false, errors: { engine: expect.any(String), transmission: expect.any(String) } });
  });

  it("without the tick, a catalogue vehicle is required", () => {
    const result = parseRequestDetails("repair", { vehicle: { nonStock: false }, description: "Тече масло" });
    expect(result).toMatchObject({ ok: false, errors: { vehicle: expect.any(String) } });
  });
});

describe("contact on request forms: name, phone and email all required", () => {
  const base = { name: "Иван Петров", phone: "0888 123 456", consent: true };

  it("rejects a missing email", () => {
    expect(parseContact({ ...base, email: "" }, { emailRequired: true })).toMatchObject({ ok: false, errors: { email: expect.any(String) } });
  });

  it("the booking form still allows it", () => {
    expect(parseContact({ ...base, email: "" })).toMatchObject({ ok: true, contact: { phone: "+359888123456", email: null } });
  });

  it("requires consent", () => {
    expect(parseContact({ ...base, email: "ivan@example.bg", consent: false }, { emailRequired: true })).toMatchObject({ ok: false });
  });
});

describe("n8n webhook hook", () => {
  const payload: RequestForAi = {
    requestId: 7,
    type: "repair",
    vehicle: { brand: "Toyota", model: "Land Cruiser", generation: "J80", engine: "1HD-T", transmission: "H151F", nonStock: false },
    mileageKm: 300000,
    description: "Пуши на студено",
    options: [],
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does nothing while the URL is not configured", async () => {
    vi.stubEnv("N8N_REPAIR_WEBHOOK_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await notifyAiOfNewRequest(payload)).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the request to the URL for its type, with the secret header", async () => {
    vi.stubEnv("N8N_REPAIR_WEBHOOK_URL", "http://n8n:5678/webhook/repair");
    vi.stubEnv("N8N_MODIFICATION_WEBHOOK_URL", "http://n8n:5678/webhook/mod");
    vi.stubEnv("N8N_WEBHOOK_SECRET", "s3cret");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    expect(await notifyAiOfNewRequest(payload)).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://n8n:5678/webhook/repair");
    expect(init.headers["x-webhook-secret"]).toBe("s3cret");
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it("never throws when n8n is down", async () => {
    vi.stubEnv("N8N_REPAIR_WEBHOOK_URL", "http://n8n:5678/webhook/repair");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await notifyAiOfNewRequest(payload)).toBe("failed");
  });
});
