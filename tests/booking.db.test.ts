/**
 * Booking engine against a REAL Postgres, so the exclusion constraint is part of
 * what is tested. Uses its own throw-away database (workshop_test).
 *
 * Needs Postgres reachable at DATABASE_URL (see docker-compose.dev.yml):
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
 *   npm run test:db
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";

const TEST_DB = "workshop_test";
const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${TEST_DB}`;

// "Now" is Tuesday 10 Nov 2026, noon in Sofia. Bookings go on Thursday the 12th.
const now = new Date("2026-11-10T10:00:00Z");
const THURSDAY = "2026-11-12";
const SATURDAY = "2026-11-14";

type Engine = typeof import("@/lib/booking/engine");
let engine: Engine;
let sql: ReturnType<typeof postgres>;
let vehicleId: number;
let oilChange: number; // 60 min
let coolant: number; // 140 min

const customer = (n: number) => ({ name: `Клиент ${n}`, phone: `+35988800000${n}`, email: null });
const book = (n: number, time: string, date = THURSDAY, serviceIds = [oilChange]) =>
  engine.createBooking({ vehicleId, serviceIds, date, time, contact: customer(n), now });

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${TEST_DB} with (force)`);
  await admin.unsafe(`create database ${TEST_DB}`);
  await admin.end();

  process.env.DATABASE_URL = testUrl.toString(); // the engine connects through getDb()
  sql = postgres(testUrl.toString(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seed(db);

  engine = await import("@/lib/booking/engine");
  [{ id: vehicleId }] = await sql`select id from vehicles where engine_code = '1KD-FTV' order by id limit 1`;
  [{ id: oilChange }] = await sql`select id from services where slug = 'engine-oil'`;
  [{ id: coolant }] = await sql`select id from services where slug = 'coolant'`;
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

describe("two bookings at the same time", () => {
  it("one after the other: the second lands in the next bay", async () => {
    const first = await book(1, "09:00");
    const second = await book(2, "09:00");
    expect(first.bayId).toBe(1);
    expect(second.bayId).toBe(2);
  });

  it("at the very same instant: both succeed, in different bays", async () => {
    const [a, b] = await Promise.all([book(1, "09:00"), book(2, "09:00")]);
    expect(new Set([a.bayId, b.bayId]).size).toBe(2);
  });

  it("the database itself refuses an overlap in one bay, whatever the app does", async () => {
    const first = await book(1, "09:00");
    const overlap = sql`
      insert into bookings (bay_id, customer_id, vehicle_id, starts_at, ends_at)
      select ${first.bayId}, id, ${vehicleId}, '2026-11-12 09:30+02', '2026-11-12 10:30+02' from customers limit 1`;
    await expect(overlap).rejects.toMatchObject({ code: "23P01", constraint_name: "bookings_no_double_booking" });
  });
});

describe("a job ending after closing", () => {
  it("is rejected and nothing is saved", async () => {
    // 2 h 20 min from 16:00 would end at 18:20; closing is 18:00.
    await expect(book(1, "16:00", THURSDAY, [coolant])).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    // Saturday closes at 14:00.
    await expect(book(1, "12:00", SATURDAY, [coolant])).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    const [{ n }] = await sql`select count(*)::int n from bookings`;
    expect(n).toBe(0);
  });

  it("is accepted when it ends before closing", async () => {
    const booking = await book(1, "15:30", THURSDAY, [coolant]);
    expect(booking.endsAt.toISOString()).toBe("2026-11-12T15:50:00.000Z"); // 17:50 in Sofia
  });

  it("rejects a start that is off the 30-minute grid or outside the booking window", async () => {
    await expect(book(1, "09:10")).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await expect(book(1, "09:00", "2026-11-10")).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" }); // today
    await expect(book(1, "09:00", "2026-11-15")).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" }); // Sunday
  });
});

describe("all 4 bays full", () => {
  it("fills bays 1-4 in order, then turns the fifth customer away", async () => {
    const bays = [];
    for (let n = 1; n <= 4; n++) bays.push((await book(n, "09:00")).bayId);
    expect(bays).toEqual([1, 2, 3, 4]);

    await expect(book(5, "09:00")).rejects.toMatchObject({ code: "SLOT_TAKEN" });

    const slots = await engine.getAvailableSlots({ serviceIds: [oilChange], date: THURSDAY, now });
    expect(slots.map((s) => s.time)).not.toContain("09:00");
    expect(slots.map((s) => s.time)).toContain("10:00");
  });

  it("five customers at the same instant: exactly four get a bay", async () => {
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map((n) => book(n, "09:00")));
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");
    expect(won).toHaveLength(4);
    expect(new Set(won.map((r) => r.value.bayId)).size).toBe(4);
    expect(lost).toHaveLength(1);
    expect(lost[0].reason).toMatchObject({ code: "SLOT_TAKEN" });
  });

  it("a cancelled booking frees its bay", async () => {
    const bookings = [];
    for (let n = 1; n <= 4; n++) bookings.push(await book(n, "09:00"));

    expect(await engine.cancelBookingByToken(bookings[1].cancelToken, now)).toBe(true);
    const replacement = await book(5, "09:00");
    expect(replacement.bayId).toBe(2);
  });
});

describe("quote without booking", () => {
  it("saves the estimate and blocks no bay", async () => {
    const quote = await engine.createQuote({ vehicleId, serviceIds: [oilChange], contact: customer(1) });
    expect(quote.price.totalCents).toBeGreaterThan(0);

    const [{ quotes, bookings }] = await sql`
      select (select count(*)::int from quotes) quotes, (select count(*)::int from bookings) bookings`;
    expect(quotes).toBe(1);
    expect(bookings).toBe(0);

    const slot = (await engine.getAvailableSlots({ serviceIds: [oilChange], date: THURSDAY, now })).find(
      (s) => s.time === "09:00",
    );
    expect(slot!.freeBayIds).toEqual([1, 2, 3, 4]);
  });
});

describe("admin: moving a booking and changing its status", () => {
  it("moves to a free bay and time, keeping the job length", async () => {
    const booking = await book(1, "09:00"); // bay 1, 60 min
    await engine.moveBooking({ id: booking.id, date: THURSDAY, time: "11:00", bayId: 3 });
    const [row] = await sql`select bay_id, starts_at, ends_at from bookings where id = ${booking.id}`;
    expect(row.bay_id).toBe(3);
    expect(new Date(row.starts_at).toISOString()).toBe("2026-11-12T09:00:00.000Z"); // 11:00 Sofia
    expect(new Date(row.ends_at).toISOString()).toBe("2026-11-12T10:00:00.000Z");
  });

  it("refuses to move onto an occupied bay", async () => {
    const a = await book(1, "09:00"); // bay 1
    const b = await book(2, "09:00"); // bay 2
    await expect(engine.moveBooking({ id: b.id, date: THURSDAY, time: "09:30", bayId: a.bayId })).rejects.toMatchObject({
      code: "SLOT_TAKEN",
    });
  });

  it("refuses a move that would end after closing", async () => {
    const booking = await book(1, "09:00", THURSDAY, [coolant]); // 140 min
    await expect(engine.moveBooking({ id: booking.id, date: THURSDAY, time: "16:30", bayId: 1 })).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
    });
  });

  it("reactivating a cancelled booking whose bay was taken meanwhile is refused", async () => {
    const first = await book(1, "09:00"); // bay 1
    await engine.setBookingStatus(first.id, "cancelled");
    const second = await book(2, "09:00");
    expect(second.bayId).toBe(1); // freed bay is reused
    await expect(engine.setBookingStatus(first.id, "booked")).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    await engine.setBookingStatus(second.id, "in_progress");
    const [row] = await sql`select status from bookings where id = ${second.id}`;
    expect(row.status).toBe("in_progress");
  });
});

describe("what gets saved", () => {
  it("stores the frozen price, the services and one customer per phone number", async () => {
    await book(1, "09:00", THURSDAY, [oilChange, coolant]);
    await book(1, "13:00"); // same phone again

    const [{ n: customers }] = await sql`select count(*)::int n from customers`;
    expect(customers).toBe(1);

    const [first] = await sql`select * from bookings order by id limit 1`;
    expect(first.price_total_eur).toBeNull(); // coolant capacity unknown -> price after inspection
    expect(first.cancel_token).toHaveLength(64);
    const items = await sql`select service_name, price_eur from booking_services where booking_id = ${first.id} order by position`;
    expect(items).toHaveLength(2);
    expect(items[0].price_eur).not.toBeNull();
    expect(items[1].price_eur).toBeNull();
  });
});
