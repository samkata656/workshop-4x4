import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestForAi } from "@/lib/requests/engine";
import { parseOfferDraft, parseOfferText } from "@/lib/requests/offer";
import { requestOfferDraft } from "@/lib/requests/webhook";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("offer draft from the AI", () => {
  it("keeps the text and tidies the price list", () => {
    const parsed = parseOfferDraft({
      subject: "  Оферта за   модификации ",
      body: "Здравейте,\r\nетo офертата.",
      items: [
        { name: " OME повдигане 5 cm ", price_from_eur: 1450.4, price_to_eur: 1200, source_url: "https://example.com/ome" },
        { name: "Шнорхел", price_from_eur: null, price_to_eur: null, source_url: "javascript:alert(1)" },
        { name: "", price_from_eur: 10, price_to_eur: 20, source_url: null },
        "not an item",
      ],
    });
    expect(parsed).toEqual({
      ok: true,
      draft: {
        subject: "Оферта за модификации",
        body: "Здравейте,\nетo офертата.",
        items: [
          { name: "OME повдигане 5 cm", priceFromEur: 1200, priceToEur: 1450, source: "https://example.com/ome" },
          { name: "Шнорхел", priceFromEur: null, priceToEur: null, source: null },
        ],
      },
    });
  });

  it("rejects a draft without subject or body", () => {
    expect(parseOfferDraft({ subject: "", body: "текст" })).toMatchObject({ ok: false, errors: { subject: expect.any(String) } });
    expect(parseOfferDraft({ subject: "Тема", body: "а".repeat(6001) })).toMatchObject({ ok: false, errors: { body: expect.any(String) } });
    expect(parseOfferDraft("text")).toMatchObject({ ok: false });
  });

  it("checks the owner's edited text the same way", () => {
    expect(parseOfferText("Тема", " Текст ")).toEqual({ ok: true, subject: "Тема", body: "Текст" });
    expect(parseOfferText("т".repeat(201), "Текст").ok).toBe(false);
  });
});

describe("asking n8n for an offer draft", () => {
  const payload: RequestForAi = {
    requestId: 7,
    type: "modification",
    vehicle: { brand: "Toyota", model: "Hilux", generation: "N70", engine: "1KD-FTV", transmission: "R151F", nonStock: false },
    mileageKm: null,
    description: null,
    options: ["Шнорхел"],
  };

  it("is asked only for modification requests", async () => {
    vi.stubEnv("N8N_OFFER_DRAFT_WEBHOOK_URL", "http://n8n:5678/webhook/offer-draft");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    expect(await requestOfferDraft({ ...payload, type: "repair" })).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await requestOfferDraft(payload)).toBe("sent");
    expect(fetchMock.mock.calls[0][0]).toBe("http://n8n:5678/webhook/offer-draft");
  });

  it("does nothing while the URL is empty", async () => {
    vi.stubEnv("N8N_OFFER_DRAFT_WEBHOOK_URL", "");
    expect(await requestOfferDraft(payload)).toBe("skipped");
  });
});
