import { parseId } from "@/lib/booking/validation";
import { MAX_DESCRIPTION, MAX_MILEAGE_KM, OPTIONS_BY_TYPE, type RequestType } from "./options";

/** Either a catalogue row, or a non-stock car described in words. */
export type RequestVehicle =
  | { nonStock: false; vehicleId: number }
  | { nonStock: true; brand: "Toyota" | "Lexus"; model: string; generation: string; engine: string; transmission: string };

export type RequestErrors = Partial<Record<"vehicle" | "engine" | "transmission" | "description" | "options" | "mileage", string>>;

export type RequestDetails = {
  vehicle: RequestVehicle;
  mileageKm: number | null;
  description: string | null;
  options: string[];
};

const text = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

export function parseRequestDetails(
  type: RequestType,
  input: unknown,
): { ok: true; details: RequestDetails } | { ok: false; errors: RequestErrors } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const errors: RequestErrors = {};

  // --- vehicle ---
  const v = (raw.vehicle ?? {}) as Record<string, unknown>;
  let vehicle: RequestVehicle | null = null;
  if (v.nonStock === true) {
    const brand = v.brand === "Toyota" || v.brand === "Lexus" ? v.brand : null;
    const model = text(v.model);
    const generation = text(v.generation);
    const engine = text(v.engine);
    const transmission = text(v.transmission);
    if (!brand || !model || !generation) errors.vehicle = "Изберете марка, модел и поколение.";
    if (engine.length < 2 || engine.length > 80) errors.engine = "Опишете двигателя, например „1UZ-FE 4.0 V8“.";
    if (transmission.length < 2 || transmission.length > 80) {
      errors.transmission = "Опишете скоростната кутия, например „A340F автоматична“.";
    }
    if (brand && !errors.vehicle && !errors.engine && !errors.transmission) {
      vehicle = { nonStock: true, brand, model, generation, engine, transmission };
    }
  } else {
    const vehicleId = parseId(v.vehicleId);
    if (!vehicleId) errors.vehicle = "Изберете автомобила до скоростна кутия.";
    else vehicle = { nonStock: false, vehicleId };
  }

  // --- options: only values from the fixed list ---
  const allowed = OPTIONS_BY_TYPE[type];
  const options = Array.isArray(raw.options)
    ? allowed.filter((option) => (raw.options as unknown[]).includes(option))
    : [];

  // --- free text ---
  const descriptionRaw = typeof raw.description === "string" ? raw.description.trim() : "";
  if (descriptionRaw.length > MAX_DESCRIPTION) {
    errors.description = `Текстът е твърде дълъг. Съкратете го до ${MAX_DESCRIPTION} знака.`;
  } else if (type === "repair" && descriptionRaw.length < 5) {
    errors.description = "Опишете с няколко думи какво се случва с автомобила.";
  } else if (type === "modification" && options.length === 0 && descriptionRaw.length === 0) {
    errors.options = "Отбележете поне една модификация или опишете какво искате.";
  }

  // --- mileage (repair only, optional) ---
  let mileageKm: number | null = null;
  if (type === "repair" && raw.mileageKm !== null && raw.mileageKm !== undefined && raw.mileageKm !== "") {
    const n = Number(raw.mileageKm);
    if (!Number.isInteger(n) || n < 0 || n > MAX_MILEAGE_KM) errors.mileage = "Въведете пробега в километри, само с цифри.";
    else mileageKm = n;
  }

  if (Object.keys(errors).length > 0 || !vehicle) return { ok: false, errors };
  return { ok: true, details: { vehicle, mileageKm, description: descriptionRaw || null, options } };
}

// ---------------------------------------------------------------------------
// AI output written back by n8n (SPEC.md 8.2 and 8.3)
// ---------------------------------------------------------------------------

export type RepairAiOutput = {
  causes: { cause: string; how_to_confirm: string; urgency: "low" | "medium" | "high"; likely_parts: string[] }[];
};
export type ModificationAiOutput = { summary: string; jobs: string[]; missing_info: string[] };
export type AiOutput = RepairAiOutput | ModificationAiOutput;

const URGENCIES = ["low", "medium", "high"] as const;
const MAX_AI_TEXT = 2000;
const MAX_AI_LIST = 30;
const MAX_AI_ITEM = 300;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Checks the AI text against the fixed shape for the request type and keeps only
 * the known fields — anything else the model added is dropped, not stored.
 * Error messages are in English: they go back to n8n, not to a customer.
 */
export function parseAiOutput(
  type: RequestType,
  input: unknown,
): { ok: true; output: AiOutput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!isRecord(input)) return { ok: false, errors: { output: "Required: a JSON object." } };

  const sentence = (value: unknown, path: string) => {
    const s = typeof value === "string" ? value.trim() : "";
    if (!s || s.length > MAX_AI_TEXT) errors[path] = `Required: non-empty text of at most ${MAX_AI_TEXT} characters.`;
    return s;
  };
  const strings = (value: unknown, path: string) => {
    const ok =
      Array.isArray(value) &&
      value.length <= MAX_AI_LIST &&
      value.every((item) => typeof item === "string" && item.trim() !== "" && item.length <= MAX_AI_ITEM);
    if (!ok) {
      errors[path] = `Required: an array (may be empty) of at most ${MAX_AI_LIST} non-empty strings, each at most ${MAX_AI_ITEM} characters.`;
      return [];
    }
    return (value as string[]).map((item) => item.trim());
  };

  let output: AiOutput;
  if (type === "repair") {
    const causes = Array.isArray(input.causes) ? input.causes : [];
    if (causes.length !== 3) errors.causes = "Required: an array of exactly 3 possible causes.";
    output = {
      causes: causes.slice(0, 3).map((raw, i) => {
        const c = isRecord(raw) ? raw : {};
        const urgency = URGENCIES.find((u) => u === c.urgency);
        if (!urgency) errors[`causes[${i}].urgency`] = 'Required: "low", "medium" or "high".';
        return {
          cause: sentence(c.cause, `causes[${i}].cause`),
          how_to_confirm: sentence(c.how_to_confirm, `causes[${i}].how_to_confirm`),
          urgency: urgency ?? "low",
          likely_parts: strings(c.likely_parts, `causes[${i}].likely_parts`),
        };
      }),
    };
  } else {
    output = {
      summary: sentence(input.summary, "summary"),
      jobs: strings(input.jobs, "jobs"),
      missing_info: strings(input.missing_info, "missing_info"),
    };
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, output };
}
