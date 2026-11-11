/**
 * "Не е стоков джип?" on the booking form (SPEC.md 6.1 and 8.4).
 *
 * The customer types the swapped engine and gearbox; n8n looks the fluid
 * capacities up online; the answer is saved as a vehicle row with
 * verified = false and created_by = AI, so prices are shown as approximate and
 * the owner can check the row in the admin panel.
 *
 * If the lookup fails, the row is still saved with empty capacities: the
 * customer can book, and fluid prices show as "цена след оглед".
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { callN8n } from "@/lib/n8n";

const { vehicles } = schema;

const LOOKUP_TIMEOUT_MS = 90_000;
const MAX_TEXT = 80;
const MAX_LITRES = 60; // nothing on a 4x4 holds more; larger numbers are a wrong unit or a mistake
const MAX_SOURCE = 1000;

export type NonStockInput = {
  brand: "Toyota" | "Lexus";
  model: string;
  generation: string;
  engine: string;
  transmission: string;
  fuel: "petrol" | "diesel";
  transmissionType: "manual" | "automatic";
};

export type NonStockErrors = Partial<Record<"vehicle" | "engine" | "transmission" | "fuel" | "transmissionType", string>>;

const oneLine = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

export function parseNonStockInput(input: unknown): { ok: true; value: NonStockInput } | { ok: false; errors: NonStockErrors } {
  const raw = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const errors: NonStockErrors = {};

  const brand = raw.brand === "Toyota" || raw.brand === "Lexus" ? raw.brand : null;
  const model = oneLine(raw.model);
  const generation = oneLine(raw.generation);
  if (!brand || !model || !generation || model.length > MAX_TEXT || generation.length > MAX_TEXT) {
    errors.vehicle = "Изберете марка, модел и поколение.";
  }

  const engine = oneLine(raw.engine);
  if (engine.length < 2 || engine.length > MAX_TEXT) errors.engine = "Опишете двигателя, напр. 1UZ-FE 4.0 V8.";
  const transmission = oneLine(raw.transmission);
  if (transmission.length < 2 || transmission.length > MAX_TEXT) errors.transmission = "Опишете скоростната кутия, напр. A340F.";

  const fuel = raw.fuel === "petrol" || raw.fuel === "diesel" ? raw.fuel : null;
  if (!fuel) errors.fuel = "Изберете гориво.";
  const transmissionType = raw.transmissionType === "manual" || raw.transmissionType === "automatic" ? raw.transmissionType : null;
  if (!transmissionType) errors.transmissionType = "Изберете вид на кутията.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { brand: brand!, model, generation, engine, transmission, fuel: fuel!, transmissionType: transmissionType! } };
}

const CAPACITY_FIELDS = {
  engine_oil_with_filter_l: "engineOilWithFilterL",
  transmission_l: "transmissionL",
  front_diff_l: "frontDiffL",
  rear_diff_l: "rearDiffL",
  transfer_case_l: "transferCaseL",
  coolant_l: "coolantL",
  brake_fluid_l: "brakeFluidL",
} as const;

type CapacityColumn = (typeof CAPACITY_FIELDS)[keyof typeof CAPACITY_FIELDS];
export type LookedUpCapacities = Record<CapacityColumn, string | null> & { source: string };

/**
 * Turns the AI answer into column values. Anything that is not a plausible
 * number of litres becomes NULL ("unknown") rather than a guess.
 */
export function parseLookupOutput(answer: unknown): LookedUpCapacities {
  const wrapper = typeof answer === "object" && answer !== null ? (answer as Record<string, unknown>).output : null;
  const output = typeof wrapper === "object" && wrapper !== null ? (wrapper as Record<string, unknown>) : {};

  const capacities = {} as Record<CapacityColumn, string | null>;
  for (const [key, column] of Object.entries(CAPACITY_FIELDS)) {
    const litres = output[key];
    capacities[column] = typeof litres === "number" && Number.isFinite(litres) && litres > 0 && litres <= MAX_LITRES ? litres.toFixed(2) : null;
  }

  const confidence = ["low", "medium", "high"].find((level) => level === output.confidence) ?? "low";
  const links = (Array.isArray(output.sources) ? output.sources : []).filter(
    (link): link is string => typeof link === "string" && /^https?:\/\/\S+$/.test(link),
  );
  const source = [`AI lookup (confidence: ${confidence})`, ...links].join(" ").slice(0, MAX_SOURCE);

  return { ...capacities, source };
}

export class NonStockError extends Error {
  constructor(public readonly code: "UNKNOWN_FAMILY") {
    super(code);
    this.name = "NonStockError";
  }
}

type Lookup = (input: NonStockInput) => Promise<unknown>;

const askN8n: Lookup = ({ brand, model, generation, engine, transmission }) =>
  callN8n("N8N_NONSTOCK_WEBHOOK_URL", { brand, model, generation, engine, transmission }, LOOKUP_TIMEOUT_MS);

/**
 * The saved row for this swap: an earlier one if the same swap was already
 * looked up with a result, otherwise a new (or re-tried) one.
 */
export async function findOrCreateNonStockVehicle(input: NonStockInput, lookup: Lookup = askN8n) {
  const db = getDb();
  const sameFamily = and(eq(vehicles.brand, input.brand), eq(vehicles.model, input.model), eq(vehicles.generation, input.generation));

  // Brand / model / generation must be a chassis the workshop takes.
  const [known] = await db.select({ id: vehicles.id }).from(vehicles).where(sameFamily).limit(1);
  if (!known) throw new NonStockError("UNKNOWN_FAMILY");

  const sameSwap = and(
    sameFamily,
    sql`lower(${vehicles.engineCode}) = lower(${input.engine})`,
    sql`lower(${vehicles.transmission}) = lower(${input.transmission})`,
    isNull(vehicles.yearsFrom),
  );
  const [existing] = await db.select().from(vehicles).where(sameSwap).limit(1);
  // An earlier lookup that found nothing is tried again; anything else is reused as it is.
  const emptyAiRow =
    existing && existing.createdBy === "AI" && !existing.verified && Object.values(CAPACITY_FIELDS).every((column) => existing[column] === null);
  if (existing && !emptyAiRow) return existing;

  let found: LookedUpCapacities;
  try {
    found = parseLookupOutput(await lookup(input));
  } catch (error) {
    console.error("[non-stock] capacity lookup failed:", error);
    found = parseLookupOutput(null);
    found.source = "AI lookup failed — capacities not found";
  }

  if (existing) {
    const [retried] = await db
      .update(vehicles)
      .set({ ...found, fuel: input.fuel, transmissionType: input.transmissionType, updatedAt: new Date() })
      .where(eq(vehicles.id, existing.id))
      .returning();
    return retried ?? existing;
  }

  const [created] = await db
    .insert(vehicles)
    .values({
      brand: input.brand,
      model: input.model,
      generation: input.generation,
      engineCode: input.engine,
      fuel: input.fuel,
      transmission: input.transmission,
      transmissionType: input.transmissionType,
      ...found,
      verified: false,
      createdBy: "AI",
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Someone saved the same swap between our check and our insert.
  const [raced] = await db.select().from(vehicles).where(sameSwap).limit(1);
  if (!raced) throw new Error("non-stock vehicle could not be saved");
  return raced;
}
