/**
 * Read queries for the admin panel. Every function starts with requireAdmin(),
 * so none of this data can be reached without a valid session.
 */
import { and, asc, desc, eq, gte, ilike, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { zonedDate, zonedTime, zonedToUtc } from "@/lib/booking/time";
import { requireAdmin } from "./session";

const { bays, bookings, bookingServices, consumables, customers, customerVehicles, fluidPrices } = schema;
const { openingHours, quotes, requests, services, settings, vehicles } = schema;

const vehicleLabel = sql<string>`${vehicles.brand} || ' ' || ${vehicles.model} || ' ' || ${vehicles.generation} || ' · ' || ${vehicles.engineCode} || ' · ' || ${vehicles.transmission}`;

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export type CalendarBooking = Awaited<ReturnType<typeof listCalendarBookings>>[number];

/** Non-cancelled bookings between two workshop-local dates (to is exclusive). */
export async function listCalendarBookings(fromDate: string, toDate: string) {
  await requireAdmin();
  const db = getDb();
  const rows = await db
    .select({
      id: bookings.id,
      bayId: bookings.bayId,
      status: bookings.status,
      source: bookings.source,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      priceTotalEur: bookings.priceTotalEur,
      notes: bookings.notes,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      vehicle: vehicleLabel,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .where(
      and(
        ne(bookings.status, "cancelled"),
        gte(bookings.startsAt, zonedToUtc(fromDate, "00:00")),
        lt(bookings.startsAt, zonedToUtc(toDate, "00:00")),
      ),
    )
    .orderBy(asc(bookings.startsAt));

  const items = rows.length
    ? await db
        .select()
        .from(bookingServices)
        .where(inArray(bookingServices.bookingId, rows.map((r) => r.id)))
        .orderBy(asc(bookingServices.position))
    : [];

  return rows.map(({ startsAt, endsAt, ...row }) => ({
    ...row,
    // Workshop wall-clock strings: the calendar must look the same in any browser time zone.
    date: zonedDate(startsAt),
    start: zonedTime(startsAt),
    end: zonedTime(endsAt),
    services: items
      .filter((i) => i.bookingId === row.id)
      .map((i) => ({ name: i.serviceName, durationMin: i.durationMin, priceEur: i.priceEur })),
  }));
}

export async function getCalendarSetup() {
  await requireAdmin();
  const db = getDb();
  const [bayRows, hours] = await Promise.all([
    db.select({ id: bays.id, name: bays.name }).from(bays).where(eq(bays.active, true)).orderBy(asc(bays.id)),
    db.select().from(openingHours).orderBy(asc(openingHours.weekday)),
  ]);
  return { bays: bayRows, hours };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function listCustomers(search: string) {
  await requireAdmin();
  const q = search.trim();
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  return getDb()
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      createdAt: customers.createdAt,
      bookings: sql<number>`(select count(*)::int from bookings b where b.customer_id = ${customers.id})`,
      requests: sql<number>`(select count(*)::int from requests r where r.customer_id = ${customers.id})`,
      lastVisit: sql<Date | null>`(select max(b.starts_at) from bookings b where b.customer_id = ${customers.id} and b.status <> 'cancelled')`.mapWith(
        (v) => (v ? new Date(v) : null),
      ),
    })
    .from(customers)
    .where(
      q
        ? or(
            ilike(customers.name, pattern),
            ilike(customers.phone, pattern),
            ilike(customers.email, pattern),
            sql`exists (select 1 from customer_vehicles cv where cv.customer_id = ${customers.id} and cv.plate ilike ${pattern})`,
          )
        : undefined,
    )
    .orderBy(desc(customers.createdAt))
    .limit(200);
}

export async function getCustomer(id: number) {
  await requireAdmin();
  const db = getDb();
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) return null;

  const [bookingRows, requestRows, quoteRows, garage] = await Promise.all([
    db
      .select({
        id: bookings.id,
        status: bookings.status,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        priceTotalEur: bookings.priceTotalEur,
        bayName: bays.name,
        vehicle: vehicleLabel,
        services: sql<string>`(select string_agg(bs.service_name, ', ' order by bs.position) from booking_services bs where bs.booking_id = ${bookings.id})`,
      })
      .from(bookings)
      .innerJoin(bays, eq(bays.id, bookings.bayId))
      .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
      .where(eq(bookings.customerId, id))
      .orderBy(desc(bookings.startsAt)),
    listRequestRows(eq(requests.customerId, id)),
    db
      .select({
        id: quotes.id,
        kind: quotes.kind,
        status: quotes.status,
        priceTotalEur: quotes.priceTotalEur,
        createdAt: quotes.createdAt,
        vehicle: sql<string | null>`(select v.brand || ' ' || v.model || ' ' || v.generation from vehicles v where v.id = ${quotes.vehicleId})`,
      })
      .from(quotes)
      .where(eq(quotes.customerId, id))
      .orderBy(desc(quotes.createdAt)),
    db
      .select({ plate: customerVehicles.plate, vehicle: vehicleLabel })
      .from(customerVehicles)
      .innerJoin(vehicles, eq(vehicles.id, customerVehicles.vehicleId))
      .where(eq(customerVehicles.customerId, id)),
  ]);

  // "Their vehicles" = registered ones plus every car they booked or asked about.
  const seen = new Map<string, string | null>();
  for (const g of garage) seen.set(g.vehicle, g.plate);
  for (const b of bookingRows) if (!seen.has(b.vehicle)) seen.set(b.vehicle, null);
  for (const r of requestRows) if (!seen.has(r.vehicle)) seen.set(r.vehicle, null);

  return {
    customer,
    bookings: bookingRows,
    requests: requestRows,
    quotes: quoteRows,
    vehicles: [...seen].map(([label, plate]) => ({ label, plate })),
  };
}

// ---------------------------------------------------------------------------
// Requests and quotes
// ---------------------------------------------------------------------------

type RequestFilter = SQL | undefined;

async function listRequestRows(filter: RequestFilter) {
  return getDb()
    .select({
      id: requests.id,
      type: requests.type,
      status: requests.status,
      createdAt: requests.createdAt,
      description: requests.description,
      options: requests.options,
      mileageKm: requests.mileageKm,
      nonStock: requests.nonStock,
      aiOutput: requests.aiOutput,
      notes: requests.notes,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      vehicle: sql<string>`case when ${requests.nonStock}
        then ${requests.nonStockBrand}::text || ' ' || ${requests.nonStockModel} || ' ' || ${requests.nonStockGeneration} || ' · ' || ${requests.nonStockEngine} || ' · ' || ${requests.nonStockTransmission}
        else coalesce((select v.brand || ' ' || v.model || ' ' || v.generation || ' · ' || v.engine_code || ' · ' || v.transmission from vehicles v where v.id = ${requests.vehicleId}), '—') end`,
    })
    .from(requests)
    .innerJoin(customers, eq(customers.id, requests.customerId))
    .where(filter)
    .orderBy(desc(requests.createdAt))
    .limit(200);
}

export type RequestRow = Awaited<ReturnType<typeof listRequestRows>>[number];

export async function listRequests(filter: { type?: string; status?: string }) {
  await requireAdmin();
  const type = schema.requestType.enumValues.find((t) => t === filter.type);
  const status = schema.requestStatus.enumValues.find((s) => s === filter.status);
  return listRequestRows(and(type ? eq(requests.type, type) : undefined, status ? eq(requests.status, status) : undefined));
}

export async function listQuotes() {
  await requireAdmin();
  return getDb()
    .select({
      id: quotes.id,
      kind: quotes.kind,
      status: quotes.status,
      priceTotalEur: quotes.priceTotalEur,
      createdAt: quotes.createdAt,
      notes: quotes.notes,
      requestId: quotes.requestId,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      vehicle: sql<string | null>`(select v.brand || ' ' || v.model || ' ' || v.generation || ' · ' || v.engine_code from vehicles v where v.id = ${quotes.vehicleId})`,
      services: sql<string | null>`(select string_agg(s.name, ', ') from quote_services qs join services s on s.id = qs.service_id where qs.quote_id = ${quotes.id})`,
    })
    .from(quotes)
    .innerJoin(customers, eq(customers.id, quotes.customerId))
    .orderBy(desc(quotes.createdAt))
    .limit(200);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getServiceSettings() {
  await requireAdmin();
  return getDb().select().from(services).orderBy(asc(services.sortOrder), asc(services.id));
}

export async function getPriceSettings() {
  await requireAdmin();
  const db = getDb();
  const [fluids, parts] = await Promise.all([
    db.select().from(fluidPrices).orderBy(asc(fluidPrices.fluid)),
    db.select().from(consumables).orderBy(asc(consumables.id)),
  ]);
  return { fluids, consumables: parts };
}

export async function getHoursSettings() {
  await requireAdmin();
  const db = getDb();
  const [hours, [rules]] = await Promise.all([
    db.select().from(openingHours).orderBy(asc(openingHours.weekday)),
    db.select().from(settings).limit(1),
  ]);
  return { hours, rules };
}

export async function listVehiclesForAdmin(filter: { q?: string; only?: string }) {
  await requireAdmin();
  const q = (filter.q ?? "").trim();
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  return getDb()
    .select()
    .from(vehicles)
    .where(
      and(
        q
          ? or(
              ilike(vehicles.model, pattern),
              ilike(vehicles.generation, pattern),
              ilike(vehicles.engineCode, pattern),
              ilike(vehicles.transmission, pattern),
            )
          : undefined,
        filter.only === "unverified" ? eq(vehicles.verified, false) : undefined,
        filter.only === "ai" ? eq(vehicles.createdBy, "AI") : undefined,
      ),
    )
    .orderBy(asc(vehicles.brand), asc(vehicles.model), asc(vehicles.yearsFrom), asc(vehicles.engineCode));
}

export async function getVehicleForAdmin(id: number) {
  await requireAdmin();
  const [vehicle] = await getDb().select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return vehicle ?? null;
}
