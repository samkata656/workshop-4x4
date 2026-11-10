/**
 * Database schema (Postgres 16, Drizzle ORM).
 *
 * Conventions
 * - Money is EUR with VAT included, stored as numeric(10,2). Columns end in `_eur`.
 * - Fluid quantities are litres, numeric(5,2). Columns end in `_l`. NULL = unknown.
 * - All timestamps are `timestamptz` (stored in UTC, shown in Europe/Sofia).
 *
 * One thing Drizzle cannot express lives in a hand-written migration:
 * the exclusion constraint that makes double booking impossible
 * (drizzle/0001_no_double_booking.sql).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const vehicleBrand = pgEnum("vehicle_brand", ["Toyota", "Lexus"]);
export const fuelType = pgEnum("fuel_type", ["petrol", "diesel"]);
export const transmissionType = pgEnum("transmission_type", ["manual", "automatic"]);
export const recordAuthor = pgEnum("record_author", ["seed", "admin", "AI"]);

/** A fluid the workshop buys and charges for by the litre. */
export const fluidKind = pgEnum("fluid_kind", [
  "engine_oil",
  "atf",
  "gear_oil",
  "coolant",
  "brake_fluid",
]);

/**
 * Which vehicle capacities a service consumes. The pricing module maps this to
 * capacity columns on `vehicles` and to a row in `fluid_prices`:
 *   engine_oil     -> engine_oil_with_filter_l          x engine_oil
 *   coolant        -> coolant_l                         x coolant
 *   transmission   -> transmission_l                    x atf (automatic) | gear_oil (manual)
 *   differentials  -> front_diff_l + rear_diff_l        x gear_oil
 *   transfer_case  -> transfer_case_l                   x gear_oil
 *   brake_fluid    -> brake_fluid_l                     x brake_fluid
 *   none           -> labour + consumables only
 */
export const serviceFluidSource = pgEnum("service_fluid_source", [
  "engine_oil",
  "coolant",
  "transmission",
  "differentials",
  "transfer_case",
  "brake_fluid",
  "none",
]);

export const bookingStatus = pgEnum("booking_status", [
  "booked",
  "in_progress",
  "done",
  "cancelled",
  "no_show",
]);
export const bookingSource = pgEnum("booking_source", ["web", "admin", "agent"]);

export const quoteKind = pgEnum("quote_kind", ["service", "repair", "modification"]);
export const quoteStatus = pgEnum("quote_status", ["new", "contacted", "converted", "closed"]);

export const requestType = pgEnum("request_type", ["repair", "modification"]);
export const requestStatus = pgEnum("request_status", [
  "new",
  "contacted",
  "quoted",
  "booked",
  "closed",
]);

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

const eur = (name: string) => numeric(name, { precision: 10, scale: 2 });
const litres = (name: string) => numeric(name, { precision: 5, scale: 2 });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Workshop setup
// ---------------------------------------------------------------------------

/** The 4 lift bays. */
export const bays = pgTable("bays", {
  id: smallint("id").primaryKey(), // 1..4, also the "lowest free bay" order
  name: text("name").notNull().unique(), // "Бокс 1"
  active: boolean("active").notNull().default(true),
});

/** One row per weekday (ISO: 1 = Monday ... 7 = Sunday). */
export const openingHours = pgTable(
  "opening_hours",
  {
    weekday: smallint("weekday").primaryKey(),
    closed: boolean("closed").notNull().default(false),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
  },
  (t) => [
    check("opening_hours_weekday_range", sql`${t.weekday} between 1 and 7`),
    check(
      "opening_hours_times_when_open",
      sql`${t.closed} or (${t.opensAt} is not null and ${t.closesAt} is not null and ${t.closesAt} > ${t.opensAt})`,
    ),
  ],
);

/** Single-row table (id is always 1) for workshop-wide knobs. */
export const settings = pgTable(
  "settings",
  {
    id: smallint("id").primaryKey().default(1),
    timezone: text("timezone").notNull().default("Europe/Sofia"),
    slotMinutes: smallint("slot_minutes").notNull().default(30),
    bookingMinDaysAhead: smallint("booking_min_days_ahead").notNull().default(1),
    bookingMaxDaysAhead: smallint("booking_max_days_ahead").notNull().default(30),
    updatedAt: updatedAt(),
  },
  (t) => [check("settings_single_row", sql`${t.id} = 1`)],
);

// ---------------------------------------------------------------------------
// Services and pricing
// ---------------------------------------------------------------------------

export const services = pgTable(
  "services",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(), // stable key for code and seed
    name: text("name").notNull(), // Bulgarian label shown to customers
    durationMin: smallint("duration_min").notNull(),
    fluidSource: serviceFluidSource("fluid_source").notNull().default("none"),
    labourEur: eur("labour_eur").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("services_duration_positive", sql`${t.durationMin} > 0`),
    check("services_labour_not_negative", sql`${t.labourEur} >= 0`),
  ],
);

/** Price per litre of each fluid. */
export const fluidPrices = pgTable(
  "fluid_prices",
  {
    fluid: fluidKind("fluid").primaryKey(),
    name: text("name").notNull(), // Bulgarian label for the price breakdown
    pricePerLitreEur: eur("price_per_litre_eur").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [check("fluid_prices_not_negative", sql`${t.pricePerLitreEur} >= 0`)],
);

/** Fixed-price parts and sundries: the oil filter, the basic consumables kit. */
export const consumables = pgTable(
  "consumables",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    priceEur: eur("price_eur").notNull(),
    active: boolean("active").notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [check("consumables_price_not_negative", sql`${t.priceEur} >= 0`)],
);

/** Which consumables each service uses (and how many). */
export const serviceConsumables = pgTable(
  "service_consumables",
  {
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    consumableId: integer("consumable_id")
      .notNull()
      .references(() => consumables.id, { onDelete: "cascade" }),
    quantity: smallint("quantity").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId, t.consumableId] }),
    check("service_consumables_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

/** Catalogue: one row per brand + model + generation + engine + transmission. */
export const vehicles = pgTable(
  "vehicles",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    brand: vehicleBrand("brand").notNull(),
    model: text("model").notNull(),
    generation: text("generation").notNull(),
    yearsFrom: smallint("years_from"),
    yearsTo: smallint("years_to"), // NULL = still in production
    engineCode: text("engine_code").notNull(),
    fuel: fuelType("fuel").notNull(),
    transmission: text("transmission").notNull(),
    transmissionType: transmissionType("transmission_type").notNull(),
    // Capacities in litres. NULL = unknown -> the service shows "цена след оглед".
    engineOilWithFilterL: litres("engine_oil_with_filter_l"),
    transmissionL: litres("transmission_l"),
    frontDiffL: litres("front_diff_l"),
    rearDiffL: litres("rear_diff_l"),
    transferCaseL: litres("transfer_case_l"),
    coolantL: litres("coolant_l"),
    brakeFluidL: litres("brake_fluid_l"),
    verified: boolean("verified").notNull().default(false),
    source: text("source"), // manual, link, or "AI lookup"
    createdBy: recordAuthor("created_by").notNull().default("admin"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // years_from is part of the key because a facelift can change a capacity
    // without changing the engine or gearbox code.
    unique("vehicles_combination_unique")
      .on(t.brand, t.model, t.generation, t.engineCode, t.transmission, t.yearsFrom)
      .nullsNotDistinct(),
    index("vehicles_picker_idx").on(t.brand, t.model, t.generation),
    check(
      "vehicles_capacities_positive",
      sql`coalesce(${t.engineOilWithFilterL}, 1) > 0 and coalesce(${t.transmissionL}, 1) > 0
        and coalesce(${t.frontDiffL}, 1) > 0 and coalesce(${t.rearDiffL}, 1) > 0
        and coalesce(${t.transferCaseL}, 1) > 0 and coalesce(${t.coolantL}, 1) > 0
        and coalesce(${t.brakeFluidL}, 1) > 0`,
    ),
    check(
      "vehicles_years_in_order",
      sql`${t.yearsTo} is null or ${t.yearsFrom} is null or ${t.yearsTo} >= ${t.yearsFrom}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const customers = pgTable(
  "customers",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    phone: text("phone").notNull(), // normalised by the app (+359...)
    email: text("email"),
    consentAt: timestamp("consent_at", { withTimezone: true }), // GDPR checkbox
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("customers_phone_unique").on(t.phone),
    index("customers_email_idx").on(t.email),
  ],
);

/** A customer's actual car: which catalogue vehicle it is, plus its plate. */
export const customerVehicles = pgTable(
  "customer_vehicles",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    plate: text("plate"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("customer_vehicles_customer_idx").on(t.customerId)],
);

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export const bookings = pgTable(
  "bookings",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    bayId: smallint("bay_id")
      .notNull()
      .references(() => bays.id, { onDelete: "restrict" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("booked"),
    source: bookingSource("source").notNull().default("web"),
    /** NULL when at least one service is "цена след оглед". */
    priceTotalEur: eur("price_total_eur"),
    /** Frozen copy of the breakdown shown to the customer at booking time. */
    priceBreakdown: jsonb("price_breakdown"),
    /** Secret in the cancel link; lets a customer cancel without logging in. */
    cancelToken: text("cancel_token")
      .notNull()
      .unique()
      .default(sql`replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("bookings_ends_after_start", sql`${t.endsAt} > ${t.startsAt}`),
    index("bookings_starts_at_idx").on(t.startsAt),
    index("bookings_customer_idx").on(t.customerId),
    // + EXCLUDE constraint "bookings_no_double_booking" (see 0001 migration)
  ],
);

/** The services inside a booking, with name/duration/price frozen at booking time. */
export const bookingServices = pgTable(
  "booking_services",
  {
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    position: smallint("position").notNull().default(0),
    serviceName: text("service_name").notNull(),
    durationMin: smallint("duration_min").notNull(),
    priceEur: eur("price_eur"), // NULL = "цена след оглед"
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.serviceId] })],
);

// ---------------------------------------------------------------------------
// Requests (repair / modification) and quotes
// ---------------------------------------------------------------------------

export const requests = pgTable(
  "requests",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    type: requestType("type").notNull(),
    status: requestStatus("status").notNull().default("new"),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    /**
     * "Не е стоков джип?" — the engine and/or gearbox were swapped, so there is no
     * catalogue row. vehicle_id stays empty and the car is described here instead:
     * brand/model/generation picked from the catalogue, engine and gearbox as the
     * customer typed them.
     */
    nonStock: boolean("non_stock").notNull().default(false),
    nonStockBrand: vehicleBrand("non_stock_brand"),
    nonStockModel: text("non_stock_model"),
    nonStockGeneration: text("non_stock_generation"),
    nonStockEngine: text("non_stock_engine"),
    nonStockTransmission: text("non_stock_transmission"),
    mileageKm: integer("mileage_km"),
    /** repair: symptoms (required). modification: optional comment. */
    description: text("description"),
    /** repair: quick-pick symptoms. modification: ticked options. */
    options: text("options").array().notNull().default(sql`'{}'::text[]`),
    /** Structured JSON written back by n8n (3 causes, or summary/jobs/missing_info). */
    aiOutput: jsonb("ai_output"),
    aiCompletedAt: timestamp("ai_completed_at", { withTimezone: true }),
    /** Owner's private notes. */
    notes: text("notes"),
    /** Set when the owner turns the request into a booking. */
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("requests_inbox_idx").on(t.status, t.createdAt),
    index("requests_customer_idx").on(t.customerId),
    check("requests_mileage_not_negative", sql`${t.mileageKm} is null or ${t.mileageKm} >= 0`),
    check(
      "requests_non_stock_described",
      sql`not ${t.nonStock} or (${t.nonStockBrand} is not null and ${t.nonStockModel} is not null
        and ${t.nonStockGeneration} is not null and ${t.nonStockEngine} is not null
        and ${t.nonStockTransmission} is not null)`,
    ),
  ],
);

/** "Поискай оферта без записване на час" — an estimate that never blocks a bay. */
export const quotes = pgTable(
  "quotes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    kind: quoteKind("kind").notNull(),
    status: quoteStatus("status").notNull().default("new"),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    /** For repair / modification quotes: the request holding the details. */
    requestId: integer("request_id").references(() => requests.id, { onDelete: "set null" }),
    priceTotalEur: eur("price_total_eur"),
    priceBreakdown: jsonb("price_breakdown"),
    source: bookingSource("source").notNull().default("web"),
    notes: text("notes"),
    /** Set when the quote becomes a booking. */
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("quotes_inbox_idx").on(t.status, t.createdAt),
    index("quotes_customer_idx").on(t.customerId),
  ],
);

/** Services a service-quote was priced for. */
export const quoteServices = pgTable(
  "quote_services",
  {
    quoteId: integer("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    priceEur: eur("price_eur"),
  },
  (t) => [primaryKey({ columns: [t.quoteId, t.serviceId] })],
);
