/**
 * Booking engine — the only place that reads availability from, and writes
 * bookings and quotes to, the database.
 *
 * The website's server actions call these functions today; the agent API
 * (/api/agent/*) and the admin calendar will call the same ones, so there is one
 * set of rules. The rules themselves live in ./pricing and ./availability.
 */
import { and, asc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { listActiveServices } from "@/lib/queries";
import { bookingWindow, computeSlots, type BookingRules, type DayHours, type Slot } from "./availability";
import { priceBooking, priceService, type PriceBreakdown, type ServiceConsumable, type ServicePrice } from "./pricing";
import { addDays, isoWeekday, toMinutes, zonedToUtc } from "./time";
import type { Contact } from "./validation";

const { bays, bookings, bookingServices, consumables, customers, fluidPrices, openingHours, quotes, quoteServices } =
  schema;
const { serviceConsumables, services, settings, vehicles } = schema;

export type BookingErrorCode =
  | "VEHICLE_NOT_FOUND"
  | "SERVICE_NOT_FOUND"
  | "SLOT_UNAVAILABLE" // outside opening hours / window / grid, or would end after closing
  | "BOOKING_NOT_FOUND"
  | "SLOT_TAKEN"; // valid slot, but every bay was taken in the meantime

export class BookingError extends Error {
  constructor(public code: BookingErrorCode) {
    super(code);
    this.name = "BookingError";
  }
}

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Source = "web" | "admin" | "agent";

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Rules and price lists that every calculation needs. */
export async function loadRules(db: Db | Tx = getDb()) {
  const [settingsRows, hours, bayRows, fluids, consumableRows] = await Promise.all([
    db.select().from(settings).limit(1),
    db.select().from(openingHours).orderBy(asc(openingHours.weekday)),
    db.select({ id: bays.id, name: bays.name }).from(bays).where(eq(bays.active, true)).orderBy(asc(bays.id)),
    db.select().from(fluidPrices),
    db
      .select({
        serviceId: serviceConsumables.serviceId,
        name: consumables.name,
        priceEur: consumables.priceEur,
        quantity: serviceConsumables.quantity,
      })
      .from(serviceConsumables)
      .innerJoin(consumables, eq(consumables.id, serviceConsumables.consumableId))
      .where(eq(consumables.active, true))
      .orderBy(asc(consumables.id)),
  ]);

  const s = settingsRows[0];
  const rules: BookingRules = {
    timezone: s?.timezone ?? "Europe/Sofia",
    slotMinutes: s?.slotMinutes ?? 30,
    bookingMinDaysAhead: s?.bookingMinDaysAhead ?? 1,
    bookingMaxDaysAhead: s?.bookingMaxDaysAhead ?? 30,
  };
  return {
    rules,
    hours: hours as DayHours[],
    bays: bayRows,
    fluidPrices: fluids,
    consumables: consumableRows as ServiceConsumable[],
  };
}

/** Active services in the order the caller asked for them. Throws if any is missing. */
async function loadServices(db: Db | Tx, serviceIds: number[]) {
  const rows = await db
    .select()
    .from(services)
    .where(and(inArray(services.id, serviceIds), eq(services.active, true)));
  const ordered = serviceIds.map((id) => rows.find((r) => r.id === id));
  if (ordered.some((s) => !s)) throw new BookingError("SERVICE_NOT_FOUND");
  return ordered as (typeof rows)[number][];
}

async function loadVehicle(db: Db | Tx, vehicleId: number) {
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!vehicle) throw new BookingError("VEHICLE_NOT_FOUND");
  return vehicle;
}

/** Price breakdown for one vehicle and a set of services. */
export async function getPrice(input: { vehicleId: number; serviceIds: number[] }): Promise<PriceBreakdown> {
  const db = getDb();
  const [vehicle, chosen, ctx] = await Promise.all([
    loadVehicle(db, input.vehicleId),
    loadServices(db, input.serviceIds),
    loadRules(db),
  ]);
  return priceBooking(vehicle, chosen, ctx.fluidPrices, ctx.consumables);
}

/** Every active service priced for one vehicle, in menu order (agent API). */
export async function getServicePrices(vehicleId: number): Promise<ServicePrice[]> {
  const db = getDb();
  const [vehicle, active, ctx] = await Promise.all([loadVehicle(db, vehicleId), listActiveServices(), loadRules(db)]);
  return active.map((service) => priceService(vehicle, service, ctx.fluidPrices, ctx.consumables));
}

/** Non-cancelled bookings touching one workshop-local calendar day. */
async function loadBusy(db: Db | Tx, date: string, timezone: string) {
  const dayStart = zonedToUtc(date, "00:00", timezone);
  const dayEnd = zonedToUtc(addDays(date, 1), "00:00", timezone);
  return db
    .select({ bayId: bookings.bayId, startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(and(ne(bookings.status, "cancelled"), lt(bookings.startsAt, dayEnd), gt(bookings.endsAt, dayStart)));
}

/** Free start times on one day for the total duration of the chosen services. */
export async function getAvailableSlots(input: { serviceIds: number[]; date: string; now?: Date }): Promise<Slot[]> {
  const db = getDb();
  const [chosen, ctx] = await Promise.all([loadServices(db, input.serviceIds), loadRules(db)]);
  const busy = await loadBusy(db, input.date, ctx.rules.timezone);
  return computeSlots({
    date: input.date,
    durationMin: chosen.reduce((sum, s) => sum + s.durationMin, 0),
    hours: ctx.hours,
    rules: ctx.rules,
    bayIds: ctx.bays.map((b) => b.id),
    busy,
    now: input.now ?? new Date(),
  });
}

/**
 * Everything the agent needs to offer a time: the price for this vehicle, the
 * free start times that day, and the dates that can be booked at all.
 */
export async function getPriceAndSlots(input: { vehicleId: number; serviceIds: number[]; date: string; now?: Date }) {
  const db = getDb();
  const now = input.now ?? new Date();
  const [vehicle, chosen, ctx] = await Promise.all([
    loadVehicle(db, input.vehicleId),
    loadServices(db, input.serviceIds),
    loadRules(db),
  ]);
  const price = priceBooking(vehicle, chosen, ctx.fluidPrices, ctx.consumables);
  const busy = await loadBusy(db, input.date, ctx.rules.timezone);
  const slots = computeSlots({
    date: input.date,
    durationMin: price.totalDurationMin,
    hours: ctx.hours,
    rules: ctx.rules,
    bayIds: ctx.bays.map((b) => b.id),
    busy,
    now,
  });
  return { price, slots, window: bookingWindow(now, ctx.rules), timezone: ctx.rules.timezone };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** One customer per phone number. Never overwrites a name or email already on file. */
export async function upsertCustomer(tx: Tx, contact: Contact) {
  const [row] = await tx
    .insert(customers)
    .values({ name: contact.name, phone: contact.phone, email: contact.email, consentAt: new Date() })
    .onConflictDoUpdate({
      target: customers.phone,
      set: {
        email: sql`coalesce(${customers.email}, excluded.email)`,
        consentAt: sql`coalesce(${customers.consentAt}, excluded.consent_at)`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: customers.id });
  return row.id;
}

/** Namespace for the per-day advisory lock (any fixed number; the date is the second key). */
const BOOKING_LOCK = 4104;

const centsToEur =(cents: number | null) => (cents === null ? null : (cents / 100).toFixed(2));

/** Postgres error 23P01 = exclusion constraint violated (our no-double-booking rule). */
function isDoubleBooking(error: unknown): boolean {
  for (let e = error as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.code === "23P01") return true;
  }
  return false;
}

export type CreatedBooking = {
  id: number;
  bayId: number;
  bayName: string;
  startsAt: Date;
  endsAt: Date;
  cancelToken: string;
  price: PriceBreakdown;
};

/**
 * Books the lowest-numbered free bay for the whole job.
 *
 * Two layers stop double booking:
 *  - computeSlots() only offers times where a bay looks free, and
 *  - the database exclusion constraint has the final word. If another customer
 *    grabbed the bay a millisecond earlier the insert fails, and we try the next
 *    free bay. When no bay is left the caller gets SLOT_TAKEN.
 */
export async function createBooking(input: {
  vehicleId: number;
  serviceIds: number[];
  date: string;
  time: string;
  contact: Contact;
  source?: Source;
  notes?: string | null;
  now?: Date;
}): Promise<CreatedBooking> {
  return getDb().transaction(async (tx) => {
    const [vehicle, chosen, ctx] = await Promise.all([
      loadVehicle(tx, input.vehicleId),
      loadServices(tx, input.serviceIds),
      loadRules(tx),
    ]);
    const price = priceBooking(vehicle, chosen, ctx.fluidPrices, ctx.consumables);

    // Queue up everyone booking the same day. Without this, two customers who
    // insert at the same instant each wait for the other's constraint check and
    // Postgres has to break the deadlock by failing one of them. With the lock,
    // the second waits a few milliseconds, then sees the first booking and takes
    // the next bay. The lock is released automatically when the transaction ends.
    await tx.execute(sql`select pg_advisory_xact_lock(${BOOKING_LOCK}, ${Number(input.date.replaceAll("-", ""))})`);

    const busy = await loadBusy(tx, input.date, ctx.rules.timezone);
    const slots = computeSlots({
      date: input.date,
      durationMin: price.totalDurationMin,
      hours: ctx.hours,
      rules: ctx.rules,
      bayIds: ctx.bays.map((b) => b.id),
      busy: [], // first ask: is this a legal start time at all?
      now: input.now ?? new Date(),
    });
    const legal = slots.find((s) => s.time === input.time);
    if (!legal) throw new BookingError("SLOT_UNAVAILABLE");

    const candidates = computeSlots({
      date: input.date,
      durationMin: price.totalDurationMin,
      hours: ctx.hours,
      rules: ctx.rules,
      bayIds: ctx.bays.map((b) => b.id),
      busy,
      now: input.now ?? new Date(),
    }).find((s) => s.time === input.time);
    if (!candidates) throw new BookingError("SLOT_TAKEN");

    const customerId = await upsertCustomer(tx, input.contact);

    for (const bayId of candidates.freeBayIds) {
      try {
        // Nested transaction = savepoint: a rejected insert does not poison the outer one.
        const booking = await tx.transaction(async (attempt) => {
          const [row] = await attempt
            .insert(bookings)
            .values({
              bayId,
              customerId,
              vehicleId: vehicle.id,
              startsAt: legal.startsAt,
              endsAt: legal.endsAt,
              source: input.source ?? "web",
              priceTotalEur: centsToEur(price.totalCents),
              priceBreakdown: price,
              notes: input.notes ?? null,
            })
            .returning({ id: bookings.id, cancelToken: bookings.cancelToken });
          return row;
        });

        await tx.insert(bookingServices).values(
          price.services.map((s, position) => ({
            bookingId: booking.id,
            serviceId: s.serviceId,
            position,
            serviceName: s.name,
            durationMin: s.durationMin,
            priceEur: centsToEur(s.totalCents),
          })),
        );

        return {
          id: booking.id,
          bayId,
          bayName: ctx.bays.find((b) => b.id === bayId)!.name,
          startsAt: legal.startsAt,
          endsAt: legal.endsAt,
          cancelToken: booking.cancelToken,
          price,
        };
      } catch (error) {
        if (!isDoubleBooking(error)) throw error;
        // Someone else took this bay first — try the next one.
      }
    }
    throw new BookingError("SLOT_TAKEN");
  });
}

/** "Поискай оферта без записване на час": saves the estimate, reserves nothing. */
export async function createQuote(input: {
  vehicleId: number;
  serviceIds: number[];
  contact: Contact;
  source?: Source;
}): Promise<{ id: number; price: PriceBreakdown }> {
  return getDb().transaction(async (tx) => {
    const [vehicle, chosen, ctx] = await Promise.all([
      loadVehicle(tx, input.vehicleId),
      loadServices(tx, input.serviceIds),
      loadRules(tx),
    ]);
    const price = priceBooking(vehicle, chosen, ctx.fluidPrices, ctx.consumables);
    const customerId = await upsertCustomer(tx, input.contact);

    const [quote] = await tx
      .insert(quotes)
      .values({
        kind: "service",
        customerId,
        vehicleId: vehicle.id,
        priceTotalEur: centsToEur(price.totalCents),
        priceBreakdown: price,
        source: input.source ?? "web",
      })
      .returning({ id: quotes.id });

    await tx
      .insert(quoteServices)
      .values(price.services.map((s) => ({ quoteId: quote.id, serviceId: s.serviceId, priceEur: centsToEur(s.totalCents) })));

    return { id: quote.id, price };
  });
}

// ---------------------------------------------------------------------------
// Cancel link
// ---------------------------------------------------------------------------

export async function findBookingByCancelToken(token: string) {
  const db = getDb();
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      priceTotalEur: bookings.priceTotalEur,
      vehicleBrand: vehicles.brand,
      vehicleModel: vehicles.model,
      vehicleGeneration: vehicles.generation,
    })
    .from(bookings)
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .where(eq(bookings.cancelToken, token))
    .limit(1);
  if (!booking) return null;

  const items = await db
    .select({ name: bookingServices.serviceName })
    .from(bookingServices)
    .where(eq(bookingServices.bookingId, booking.id))
    .orderBy(asc(bookingServices.position));
  return { ...booking, services: items.map((i) => i.name) };
}

/** Cancels an upcoming booking. Returns false when there was nothing to cancel. */
export async function cancelBookingByToken(token: string, now = new Date()): Promise<boolean> {
  const cancelled = await getDb()
    .update(bookings)
    .set({ status: "cancelled", updatedAt: now })
    .where(and(eq(bookings.cancelToken, token), eq(bookings.status, "booked"), gt(bookings.startsAt, now)))
    .returning({ id: bookings.id });
  return cancelled.length > 0;
}

// ---------------------------------------------------------------------------
// Admin calendar
// ---------------------------------------------------------------------------

export type BookingStatus = (typeof schema.bookingStatus.enumValues)[number];

/**
 * Moves a booking to another time and/or bay (drag in the admin calendar).
 * The job keeps its length. The owner may move it to any open day — the
 * customer booking window does not apply — but it must still fit inside
 * opening hours, and the no-double-booking constraint still has the last word.
 */
export async function moveBooking(input: { id: number; date: string; time: string; bayId: number }) {
  return getDb().transaction(async (tx) => {
    const ctx = await loadRules(tx);
    if (!ctx.bays.some((b) => b.id === input.bayId)) throw new BookingError("SLOT_UNAVAILABLE");

    await tx.execute(sql`select pg_advisory_xact_lock(${BOOKING_LOCK}, ${Number(input.date.replaceAll("-", ""))})`);

    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, input.id)).limit(1);
    if (!booking) throw new BookingError("BOOKING_NOT_FOUND");
    const durationMin = Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000);

    const day = ctx.hours.find((h) => h.weekday === isoWeekday(input.date));
    if (!day || day.closed || !day.opensAt || !day.closesAt) throw new BookingError("SLOT_UNAVAILABLE");
    const start = toMinutes(input.time);
    if (start < toMinutes(day.opensAt) || start + durationMin > toMinutes(day.closesAt)) {
      throw new BookingError("SLOT_UNAVAILABLE");
    }

    const startsAt = zonedToUtc(input.date, input.time, ctx.rules.timezone);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    try {
      await tx.transaction((attempt) =>
        attempt
          .update(bookings)
          .set({ bayId: input.bayId, startsAt, endsAt, updatedAt: new Date() })
          .where(eq(bookings.id, input.id)),
      );
    } catch (error) {
      if (isDoubleBooking(error)) throw new BookingError("SLOT_TAKEN");
      throw error;
    }
    return { id: input.id, bayId: input.bayId, startsAt, endsAt };
  });
}

/**
 * Changes a booking status. Bringing a cancelled booking back can collide with
 * whoever took the bay in the meantime — the database then refuses (SLOT_TAKEN).
 */
export async function setBookingStatus(id: number, status: BookingStatus) {
  try {
    const updated = await getDb()
      .update(bookings)
      .set({ status, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning({ id: bookings.id });
    if (updated.length === 0) throw new BookingError("BOOKING_NOT_FOUND");
  } catch (error) {
    if (isDoubleBooking(error)) throw new BookingError("SLOT_TAKEN");
    throw error;
  }
}
