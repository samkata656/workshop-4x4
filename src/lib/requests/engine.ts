/**
 * Repair and modification requests. A request never reserves a bay.
 *
 * It is saved with status "new" and an empty ai_output. The AI text (3 possible
 * causes, or a modification summary) is written later by n8n through the agent
 * API — see ./webhook.ts for how n8n gets told about a new request.
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { upsertCustomer } from "@/lib/booking/engine";
import type { Contact } from "@/lib/booking/validation";
import type { RequestType } from "./options";
import { parseAiOutput, type RequestDetails } from "./validation";

const { quotes, requests, vehicles } = schema;

export class RequestError extends Error {
  constructor(public code: "VEHICLE_NOT_FOUND" | "REQUEST_NOT_FOUND") {
    super(code);
    this.name = "RequestError";
  }
}

/** What n8n needs to do its job. Deliberately contains NO name, phone or email. */
export type RequestForAi = {
  requestId: number;
  type: RequestType;
  vehicle: {
    brand: string;
    model: string;
    generation: string;
    engine: string;
    transmission: string;
    nonStock: boolean;
  };
  mileageKm: number | null;
  description: string | null;
  options: string[];
};

export async function createRequest(input: {
  type: RequestType;
  details: RequestDetails;
  contact: Contact;
  /** "Поискай оферта без записване на час": also file a quote for the owner's list. */
  wantsQuote?: boolean;
}): Promise<{ id: number; quoteId: number | null; forAi: RequestForAi }> {
  const { type, details, contact } = input;

  return getDb().transaction(async (tx) => {
    let described: RequestForAi["vehicle"];

    if (details.vehicle.nonStock) {
      // Brand / model / generation must still be one we work on.
      const { brand, model, generation, engine, transmission } = details.vehicle;
      const [known] = await tx
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(and(eq(vehicles.brand, brand), eq(vehicles.model, model), eq(vehicles.generation, generation)))
        .limit(1);
      if (!known) throw new RequestError("VEHICLE_NOT_FOUND");
      described = { brand, model, generation, engine, transmission, nonStock: true };
    } else {
      const [row] = await tx.select().from(vehicles).where(eq(vehicles.id, details.vehicle.vehicleId)).limit(1);
      if (!row) throw new RequestError("VEHICLE_NOT_FOUND");
      described = {
        brand: row.brand,
        model: row.model,
        generation: row.generation,
        engine: row.engineCode,
        transmission: row.transmission,
        nonStock: false,
      };
    }

    const customerId = await upsertCustomer(tx, contact);

    const [request] = await tx
      .insert(requests)
      .values({
        type,
        status: "new",
        customerId,
        vehicleId: details.vehicle.nonStock ? null : details.vehicle.vehicleId,
        nonStock: details.vehicle.nonStock,
        ...(details.vehicle.nonStock && {
          nonStockBrand: details.vehicle.brand,
          nonStockModel: details.vehicle.model,
          nonStockGeneration: details.vehicle.generation,
          nonStockEngine: details.vehicle.engine,
          nonStockTransmission: details.vehicle.transmission,
        }),
        mileageKm: details.mileageKm,
        contactEmail: contact.email,
        description: details.description,
        options: details.options,
        aiOutput: null, // filled in later by n8n
      })
      .returning({ id: requests.id });

    let quoteId: number | null = null;
    if (input.wantsQuote) {
      const [quote] = await tx
        .insert(quotes)
        .values({
          kind: type,
          customerId,
          vehicleId: details.vehicle.nonStock ? null : details.vehicle.vehicleId,
          requestId: request.id,
          source: "web",
        })
        .returning({ id: quotes.id });
      quoteId = quote.id;
    }

    return {
      id: request.id,
      quoteId,
      forAi: {
        requestId: request.id,
        type,
        vehicle: described,
        mileageKm: details.mileageKm,
        description: details.description,
        options: details.options,
      },
    };
  });
}

/**
 * Stores the AI text n8n produced for a request (agent API). The expected shape
 * depends on the request type, so the request is looked up first. Sending it
 * again simply replaces the earlier text. The request status is not touched.
 */
export async function saveAiOutput(
  requestId: number,
  input: unknown,
): Promise<{ ok: true; type: RequestType } | { ok: false; type: RequestType; errors: Record<string, string> }> {
  return getDb().transaction(async (tx) => {
    const [request] = await tx.select({ type: requests.type }).from(requests).where(eq(requests.id, requestId)).limit(1);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND");

    const parsed = parseAiOutput(request.type, input);
    if (!parsed.ok) return { ok: false, type: request.type, errors: parsed.errors };

    const now = new Date();
    await tx.update(requests).set({ aiOutput: parsed.output, aiCompletedAt: now, updatedAt: now }).where(eq(requests.id, requestId));
    return { ok: true, type: request.type };
  });
}
