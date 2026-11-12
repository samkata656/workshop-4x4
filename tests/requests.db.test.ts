/**
 * Repair / modification requests against a real Postgres (throw-away database).
 * See tests/booking.db.test.ts for how to run.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";

const TEST_DB = "workshop_test_requests";
const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${TEST_DB}`;

type Engine = typeof import("@/lib/requests/engine");
let engine: Engine;
let sql: ReturnType<typeof postgres>;
let vehicleId: number;

const contact = { name: "Мария Иванова", phone: "+359888000111", email: "maria@example.bg" };

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${TEST_DB} with (force)`);
  await admin.unsafe(`create database ${TEST_DB}`);
  await admin.end();

  process.env.DATABASE_URL = testUrl.toString();
  sql = postgres(testUrl.toString(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seed(db);

  engine = await import("@/lib/requests/engine");
  [{ id: vehicleId }] = await sql`select id from vehicles where engine_code = '1HD-T' limit 1`;
}, 60_000);

beforeEach(async () => {
  await sql`truncate bookings, booking_services, quotes, quote_services, requests, customer_vehicles, customers restart identity cascade`;
});

afterAll(async () => {
  const { closeDb } = await import("@/db");
  await closeDb();
  await sql?.end();
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${TEST_DB} with (force)`);
  await admin.end();
});

describe("repair request", () => {
  it("is saved as new, with an empty AI field, and books no bay", async () => {
    const saved = await engine.createRequest({
      type: "repair",
      contact,
      details: { vehicle: { nonStock: false, vehicleId }, mileageKm: 310000, description: "Пуши на студено", options: ["друго"] },
    });

    const [row] = await sql`select * from requests where id = ${saved.id}`;
    expect(row).toMatchObject({
      type: "repair",
      status: "new",
      vehicle_id: vehicleId,
      non_stock: false,
      mileage_km: 310000,
      description: "Пуши на студено",
      options: ["друго"],
      ai_output: null,
      ai_completed_at: null,
    });

    const [{ bookings, quotes }] = await sql`select (select count(*)::int from bookings) bookings, (select count(*)::int from quotes) quotes`;
    expect(bookings).toBe(0);
    expect(quotes).toBe(0);
  });

  it("hands n8n the vehicle and symptoms but no personal data", async () => {
    const saved = await engine.createRequest({
      type: "repair",
      contact,
      details: { vehicle: { nonStock: false, vehicleId }, mileageKm: null, description: "Пуши на студено", options: [] },
    });
    expect(saved.forAi.vehicle).toMatchObject({ brand: "Toyota", model: "Land Cruiser", generation: "J80", engine: "1HD-T" });
    const sent = JSON.stringify(saved.forAi);
    for (const secret of [contact.name, contact.phone, contact.email]) expect(sent).not.toContain(secret);
  });
});

describe("modification request", () => {
  it("stores a non-stock car as text, with no catalogue row", async () => {
    const saved = await engine.createRequest({
      type: "modification",
      contact,
      details: {
        vehicle: { nonStock: true, brand: "Toyota", model: "Land Cruiser", generation: "J80", engine: "1UZ-FE 4.0 V8", transmission: "A340F" },
        mileageKm: null,
        description: null,
        options: ["Шнорхел", "Стоманени брони"],
      },
    });

    const [row] = await sql`select * from requests where id = ${saved.id}`;
    expect(row).toMatchObject({
      type: "modification",
      status: "new",
      vehicle_id: null,
      non_stock: true,
      non_stock_brand: "Toyota",
      non_stock_model: "Land Cruiser",
      non_stock_generation: "J80",
      non_stock_engine: "1UZ-FE 4.0 V8",
      non_stock_transmission: "A340F",
      options: ["Шнорхел", "Стоманени брони"],
      ai_output: null,
    });
    // The catalogue is untouched: customers cannot add vehicle rows.
    const [{ n }] = await sql`select count(*)::int n from vehicles where engine_code like '1UZ%'`;
    expect(n).toBe(0);
  });

  it("refuses a model we do not work on, even with the non-stock tick", async () => {
    const request = engine.createRequest({
      type: "modification",
      contact,
      details: {
        vehicle: { nonStock: true, brand: "Toyota", model: "Corolla", generation: "E120", engine: "1ZZ-FE", transmission: "C59" },
        mileageKm: null,
        description: null,
        options: ["Шнорхел"],
      },
    });
    await expect(request).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });

  it("with the quote button: also files a quote linked to the request, still no booking", async () => {
    const saved = await engine.createRequest({
      type: "modification",
      contact,
      wantsQuote: true,
      details: { vehicle: { nonStock: false, vehicleId }, mileageKm: null, description: "Лебедка", options: [] },
    });
    const [quote] = await sql`select * from quotes where id = ${saved.quoteId}`;
    expect(quote).toMatchObject({ kind: "modification", status: "new", request_id: saved.id });
    const [{ n }] = await sql`select count(*)::int n from bookings`;
    expect(n).toBe(0);
  });

  it("sends the offer to the e-mail typed on the request, not the first one stored for that phone", async () => {
    // A stranger files a request with the victim's phone and their own e-mail first.
    const details = { vehicle: { nonStock: false as const, vehicleId }, mileageKm: null, description: "Лебедка", options: [] };
    await engine.createRequest({ type: "modification", contact: { ...contact, email: "stranger@example.com" }, details });
    const real = await engine.createRequest({ type: "modification", contact, details });

    // The shared customer row still holds the first e-mail...
    const [customer] = await sql`select email from customers where phone = ${contact.phone}`;
    expect(customer.email).toBe("stranger@example.com");
    // ...but the request remembers its own.
    const [row] = await sql`select contact_email from requests where id = ${real.id}`;
    expect(row.contact_email).toBe("maria@example.bg");

    const offer = await import("@/lib/requests/offer");
    await offer.saveOfferText(real.id, "Оферта", "Здравейте, ето офертата.");
    process.env.N8N_OFFER_EMAIL_WEBHOOK_URL = "http://n8n:5678/webhook/offer-email";
    const realFetch = globalThis.fetch;
    const sent: unknown[] = [];
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ sent: true });
    }) as typeof fetch;
    try {
      expect(await offer.sendOffer(real.id)).toEqual({ ok: true, to: "maria@example.bg" });
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.N8N_OFFER_EMAIL_WEBHOOK_URL;
    }
    expect(sent).toMatchObject([{ requestId: real.id, to: "maria@example.bg" }]);
  });
});
