import { and, asc, count, eq, ilike, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { bays, bookings, openingHours, quotes, requests, services, vehicles } = schema;

export function listActiveServices() {
  return getDb()
    .select()
    .from(services)
    .where(eq(services.active, true))
    .orderBy(asc(services.sortOrder), asc(services.id));
}

export function listOpeningHours() {
  return getDb().select().from(openingHours).orderBy(asc(openingHours.weekday));
}

export function listBays() {
  return getDb().select().from(bays).where(eq(bays.active, true)).orderBy(asc(bays.id));
}

export function listVehicles() {
  return getDb()
    .select()
    .from(vehicles)
    .orderBy(asc(vehicles.brand), asc(vehicles.model), asc(vehicles.yearsFrom), asc(vehicles.engineCode));
}

export type VehicleFilter = { brand?: "Toyota" | "Lexus"; model?: string; generation?: string; engine?: string };

/** "%" and "_" typed by the caller are matched literally. */
const contains = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

/** Catalogue search for the agent API: every filter given must match (case-insensitive, partial). */
export function searchVehicles(filter: VehicleFilter, limit: number) {
  return getDb()
    .select()
    .from(vehicles)
    .where(
      and(
        filter.brand ? eq(vehicles.brand, filter.brand) : undefined,
        filter.model ? ilike(vehicles.model, contains(filter.model)) : undefined,
        filter.generation ? ilike(vehicles.generation, contains(filter.generation)) : undefined,
        filter.engine ? ilike(vehicles.engineCode, contains(filter.engine)) : undefined,
      ),
    )
    .orderBy(asc(vehicles.brand), asc(vehicles.model), asc(vehicles.yearsFrom), asc(vehicles.engineCode))
    .limit(limit);
}

/** Model -> generations, for the public "what we work on" list. */
export async function listVehicleFamilies() {
  const rows = await getDb()
    .selectDistinct({ brand: vehicles.brand, model: vehicles.model, generation: vehicles.generation })
    .from(vehicles)
    .orderBy(asc(vehicles.brand), asc(vehicles.model), asc(vehicles.generation));

  const families = new Map<string, { brand: string; model: string; generations: string[] }>();
  for (const row of rows) {
    const key = `${row.brand} ${row.model}`;
    if (!families.has(key)) families.set(key, { brand: row.brand, model: row.model, generations: [] });
    families.get(key)!.generations.push(row.generation);
  }
  // Toyota first, then Lexus.
  return [...families.values()].sort((a, b) => b.brand.localeCompare(a.brand) || a.model.localeCompare(b.model));
}

/** Today's non-cancelled bookings (workshop local day). No customer data. */
export function listTodaysBookings() {
  return getDb()
    .select({
      id: bookings.id,
      bayId: bookings.bayId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      sql`${bookings.status} <> 'cancelled'
        and (${bookings.startsAt} at time zone 'Europe/Sofia')::date = (now() at time zone 'Europe/Sofia')::date`,
    )
    .orderBy(asc(bookings.startsAt));
}

export async function getAdminCounts() {
  const db = getDb();
  const [[v], [unverified], [newRequests], [newQuotes], [activeServices]] = await Promise.all([
    db.select({ n: count() }).from(vehicles),
    db.select({ n: count() }).from(vehicles).where(eq(vehicles.verified, false)),
    db.select({ n: count() }).from(requests).where(eq(requests.status, "new")),
    db.select({ n: count() }).from(quotes).where(eq(quotes.status, "new")),
    db.select({ n: count() }).from(services).where(eq(services.active, true)),
  ]);
  return {
    vehicles: v.n,
    unverifiedVehicles: unverified.n,
    newRequests: newRequests.n,
    newQuotes: newQuotes.n,
    activeServices: activeServices.n,
  };
}

/** Only the fields the public vehicle picker needs (no capacities). */
export async function listPickerVehicles() {
  const rows = await listVehicles();
  return rows.map((v) => ({
    id: v.id,
    brand: v.brand,
    model: v.model,
    generation: v.generation,
    yearsFrom: v.yearsFrom,
    yearsTo: v.yearsTo,
    engineCode: v.engineCode,
    fuel: v.fuel,
    transmission: v.transmission,
    transmissionType: v.transmissionType,
  }));
}
