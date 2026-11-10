/**
 * The /api/agent/* route handlers, called directly, against a real Postgres
 * (throw-away database). See tests/booking.db.test.ts for how to run.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import { resetRateLimits } from "@/lib/agent/rate-limit";
import { addDays, zonedDate } from "@/lib/booking/time";

const TEST_DB = "workshop_test_agent";
const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${TEST_DB}`;

const KEY = "test-agent-key-0123456789-0123456789";
const BASE = "http://app.test/api/agent";
const contact = { name: "Иван Петров", phone: "0888 123 456", email: null, consent: true };

type Handler = (request: Request, context: never) => Promise<Response>;
let routes: Record<"vehicles" | "services" | "availability" | "bookings" | "quotes" | "aiResult", Handler>;
let sql: ReturnType<typeof postgres>;
let vehicleId: number;
let serviceIds: number[];

async function get(handler: Handler, path: string, key: string | null = KEY) {
  const response = await handler(new Request(`${BASE}${path}`, { headers: key ? { "x-agent-key": key } : {} }), {} as never);
  return { status: response.status, body: await response.json() };
}

async function post(handler: Handler, path: string, body: unknown, context: unknown = {}) {
  const response = await handler(
    new Request(`${BASE}${path}`, {
      method: "POST",
      headers: { "x-agent-key": KEY, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    context as never,
  );
  return { status: response.status, body: await response.json() };
}

const aiResult = (id: string, output: unknown) =>
  post(routes.aiResult, `/requests/${id}/ai-result`, { output }, { params: Promise.resolve({ id }) });

/** The first day in the booking window that has free start times. */
async function firstOpenDay() {
  const today = zonedDate(new Date());
  for (let i = 1; i <= 10; i++) {
    const date = addDays(today, i);
    const { body } = await post(routes.availability, "/availability", { vehicleId, serviceIds, date });
    if (body.slots.length > 0) return { date, slots: body.slots as { time: string; endTime: string }[], body };
  }
  throw new Error("no open day in the next 10 days");
}

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${TEST_DB} with (force)`);
  await admin.unsafe(`create database ${TEST_DB}`);
  await admin.end();

  process.env.DATABASE_URL = testUrl.toString();
  process.env.AGENT_API_KEY = KEY;
  sql = postgres(testUrl.toString(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seed(db);

  routes = {
    vehicles: (await import("@/app/api/agent/vehicles/route")).GET,
    services: (await import("@/app/api/agent/services/route")).GET,
    availability: (await import("@/app/api/agent/availability/route")).POST,
    bookings: (await import("@/app/api/agent/bookings/route")).POST,
    quotes: (await import("@/app/api/agent/quotes/route")).POST,
    aiResult: (await import("@/app/api/agent/requests/[id]/ai-result/route")).POST as Handler,
  };

  [{ id: vehicleId }] = await sql`select id from vehicles where engine_code = '1HD-T' limit 1`;
  serviceIds = (await sql`select id from services where active order by sort_order, id limit 2`).map((r) => r.id);
}, 60_000);

beforeEach(async () => {
  resetRateLimits();
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

describe("key", () => {
  it("every route refuses a missing or wrong key before touching anything", async () => {
    for (const handler of Object.values(routes)) {
      resetRateLimits(); // 12 wrong keys in a row would otherwise trip the lockout
      expect((await get(handler, "/x", null)).status).toBe(401);
      expect((await get(handler, "/x", "wrong")).status).toBe(401);
    }
  });
});

describe("GET /vehicles", () => {
  it("filters by brand, model, generation and engine", async () => {
    const all = await get(routes.vehicles, "/vehicles");
    expect(all.status).toBe(200);
    expect(all.body.vehicles.length).toBeGreaterThan(0);

    const one = await get(routes.vehicles, "/vehicles?brand=toyota&engine=1hd-t");
    expect(one.body.vehicles.length).toBeGreaterThan(0);
    expect(one.body.vehicles.every((v: { brand: string; engineCode: string }) => v.brand === "Toyota" && /1HD-T/i.test(v.engineCode))).toBe(true);
    expect(one.body.vehicles[0].capacitiesL).toHaveProperty("engineOilWithFilter");

    // "%" is a literal character, not a wildcard.
    expect((await get(routes.vehicles, "/vehicles?model=%25")).body.vehicles).toEqual([]);
  });

  it("rejects another make", async () => {
    const response = await get(routes.vehicles, "/vehicles?brand=Nissan");
    expect(response.status).toBe(400);
    expect(response.body.error.fields.brand).toBeTruthy();
  });
});

describe("GET /services", () => {
  it("lists labour only, or full prices for a vehicle — the same prices the website calculates", async () => {
    const plain = await get(routes.services, "/services");
    expect(plain.status).toBe(200);
    expect(plain.body.services[0]).toMatchObject({ id: expect.any(Number), durationMin: expect.any(Number), labourEur: expect.any(Number) });
    expect(plain.body.services[0].price).toBeUndefined();

    const priced = await get(routes.services, `/services?vehicleId=${vehicleId}`);
    const { getPrice } = await import("@/lib/booking/engine");
    for (const service of priced.body.services) {
      const expected = (await getPrice({ vehicleId, serviceIds: [service.id] })).totalCents;
      expect(service.price.priceEur).toBe(expected === null ? null : expected / 100);
    }
  });

  it("answers 404 for an unknown vehicle and 400 for a malformed id", async () => {
    expect((await get(routes.services, "/services?vehicleId=999999")).body.error.code).toBe("VEHICLE_NOT_FOUND");
    expect((await get(routes.services, "/services?vehicleId=abc")).status).toBe(400);
  });
});

describe("POST /availability", () => {
  it("returns free times and the price; a full day has none", async () => {
    const { date, slots, body } = await firstOpenDay();
    expect(body.insideBookingWindow).toBe(true);
    expect(body.price.totalDurationMin).toBeGreaterThan(0);
    expect(slots[0]).toEqual({ time: expect.stringMatching(/^\d\d:\d\d$/), endTime: expect.stringMatching(/^\d\d:\d\d$/) });

    // Fill every bay for the whole day.
    await sql`insert into customers (name, phone) values ('x', '+359000000000')`;
    await sql`
      insert into bookings (bay_id, customer_id, vehicle_id, starts_at, ends_at)
      select b.id, 1, ${vehicleId}, ${date}::date::timestamp at time zone 'Europe/Sofia',
             (${date}::date + 1)::timestamp at time zone 'Europe/Sofia'
      from bays b where b.active`;
    const full = await post(routes.availability, "/availability", { vehicleId, serviceIds, date });
    expect(full.body.slots).toEqual([]);
  });

  it("explains bad input field by field", async () => {
    const response = await post(routes.availability, "/availability", { vehicleId: -1, serviceIds: "1", date: "tomorrow" });
    expect(response.status).toBe(400);
    expect(Object.keys(response.body.error.fields).sort()).toEqual(["date", "serviceIds", "vehicleId"]);

    const unknown = await post(routes.availability, "/availability", { vehicleId, serviceIds: [999999], date: "2026-11-12" });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("SERVICE_NOT_FOUND");
  });

  it("a date outside the booking window is a normal empty answer", async () => {
    const response = await post(routes.availability, "/availability", { vehicleId, serviceIds, date: "2020-01-06" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ slots: [], insideBookingWindow: false });
  });
});

describe("POST /bookings", () => {
  it("books an offered time as source 'agent', without exposing the cancel token", async () => {
    const { date, slots } = await firstOpenDay();
    const response = await post(routes.bookings, "/bookings", { vehicleId, serviceIds, date, time: slots[0].time, contact, notes: " от чата " });
    expect(response.status).toBe(201);
    expect(response.body.booking).toMatchObject({ date, time: slots[0].time, endTime: slots[0].endTime });
    expect(JSON.stringify(response.body)).not.toMatch(/cancel/i);

    const [row] = await sql`select source, notes, bay_id from bookings where id = ${response.body.booking.id}`;
    expect(row).toMatchObject({ source: "agent", notes: "от чата", bay_id: 1 });
    const [{ phone }] = await sql`select phone from customers`;
    expect(phone).toBe("+359888123456");
  });

  it("answers 409 for an illegal time and when every bay is taken", async () => {
    const { date, slots } = await firstOpenDay();
    const body = { vehicleId, serviceIds, date, contact };

    const offGrid = await post(routes.bookings, "/bookings", { ...body, time: "03:10" });
    expect(offGrid.status).toBe(409);
    expect(offGrid.body.error.code).toBe("SLOT_UNAVAILABLE");

    const [{ n: bayCount }] = await sql`select count(*)::int n from bays where active`;
    for (let i = 0; i < bayCount; i++) {
      expect((await post(routes.bookings, "/bookings", { ...body, time: slots[0].time })).status).toBe(201);
    }
    const taken = await post(routes.bookings, "/bookings", { ...body, time: slots[0].time });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe("SLOT_TAKEN");
    const [{ n }] = await sql`select count(*)::int n from bookings`;
    expect(n).toBe(bayCount);
  });

  it("saves nothing without consent, name and phone", async () => {
    const { date, slots } = await firstOpenDay();
    const response = await post(routes.bookings, "/bookings", { vehicleId, serviceIds, date, time: slots[0].time, contact: { name: "Иван" } });
    expect(response.status).toBe(400);
    expect(Object.keys(response.body.error.fields).sort()).toEqual(["contact.consent", "contact.phone"]);
    const [{ n }] = await sql`select count(*)::int n from bookings`;
    expect(n).toBe(0);
  });
});

describe("POST /quotes", () => {
  it("saves a quote with the price and books no bay", async () => {
    const response = await post(routes.quotes, "/quotes", { vehicleId, serviceIds, contact });
    expect(response.status).toBe(201);
    const [quote] = await sql`select kind, source, price_total_eur from quotes where id = ${response.body.quote.id}`;
    expect(quote).toMatchObject({ kind: "service", source: "agent" });
    if (response.body.quote.price.totalEur !== null) expect(Number(quote.price_total_eur)).toBe(response.body.quote.price.totalEur);
    const [{ n }] = await sql`select count(*)::int n from bookings`;
    expect(n).toBe(0);
  });
});

describe("POST /requests/{id}/ai-result", () => {
  const cause = { cause: "Гарнитура", how_to_confirm: "Тест за CO2", urgency: "medium", likely_parts: ["гарнитура"] };

  async function newRequest(type: "repair" | "modification") {
    const { createRequest } = await import("@/lib/requests/engine");
    const saved = await createRequest({
      type,
      contact: { name: "Мария", phone: "+359888000111", email: null },
      details: { vehicle: { nonStock: false, vehicleId }, mileageKm: null, description: "Пуши на студено", options: [] },
    });
    return String(saved.id);
  }

  it("stores a valid repair result and leaves the status alone", async () => {
    const id = await newRequest("repair");
    const response = await aiResult(id, { causes: [cause, cause, cause], injected: "drop me" });
    expect(response).toEqual({ status: 200, body: { requestId: Number(id), type: "repair", saved: true } });

    const [row] = await sql`select ai_output, ai_completed_at, status from requests where id = ${id}`;
    expect(row.ai_output).toEqual({ causes: [cause, cause, cause] });
    expect(row.ai_completed_at).not.toBeNull();
    expect(row.status).toBe("new");
  });

  it("checks the shape against the request type", async () => {
    const id = await newRequest("modification");
    const wrong = await aiResult(id, { causes: [cause, cause, cause] });
    expect(wrong.status).toBe(400);
    expect(Object.keys(wrong.body.error.fields).sort()).toEqual(["jobs", "missing_info", "summary"]);
    const [row] = await sql`select ai_output from requests where id = ${id}`;
    expect(row.ai_output).toBeNull();

    expect((await aiResult(id, { summary: "Шнорхел.", jobs: ["Монтаж"], missing_info: [] })).status).toBe(200);
  });

  it("answers 404 for an unknown request and 400 for a malformed id", async () => {
    expect((await aiResult("999999", { causes: [] })).body.error.code).toBe("REQUEST_NOT_FOUND");
    expect((await aiResult("1;drop", { causes: [] })).status).toBe(400);
  });
});
