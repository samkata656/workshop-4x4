/**
 * Pricing — pure functions, no database, no framework.
 * Used by the public booking form (in the browser, for the live breakdown),
 * by the server when it saves a booking or quote, and by the agent API.
 *
 *   price = labour
 *         + (litres for this vehicle, rounded up to 0.5 L) x price per litre
 *         + consumables linked to the service (oil filter, basic kit)
 *
 * All arithmetic is done in integer euro cents.
 */

export type FluidKind = "engine_oil" | "atf" | "gear_oil" | "coolant" | "brake_fluid";
export type FluidSource =
  | "engine_oil"
  | "coolant"
  | "transmission"
  | "differentials"
  | "transfer_case"
  | "brake_fluid"
  | "none";

export type PricingVehicle = {
  transmissionType: "manual" | "automatic";
  engineOilWithFilterL: string | null;
  transmissionL: string | null;
  frontDiffL: string | null;
  rearDiffL: string | null;
  transferCaseL: string | null;
  coolantL: string | null;
  brakeFluidL: string | null;
  verified: boolean;
};

export type PricingService = {
  id: number;
  name: string;
  durationMin: number;
  fluidSource: FluidSource;
  labourEur: string;
};

export type FluidPrice = { fluid: FluidKind; name: string; pricePerLitreEur: string };

export type ServiceConsumable = { serviceId: number; name: string; priceEur: string; quantity: number };

export type PriceLine =
  | { kind: "labour"; label: string; cents: number }
  | { kind: "fluid"; label: string; litres: number; perLitreCents: number; cents: number }
  | { kind: "consumable"; label: string; quantity: number; cents: number };

export type ServicePrice = {
  serviceId: number;
  name: string;
  durationMin: number;
  lines: PriceLine[];
  /** null = "цена след оглед": a capacity this service needs is unknown. */
  totalCents: number | null;
};

export type PriceBreakdown = {
  services: ServicePrice[];
  totalDurationMin: number;
  /** null when at least one service is priced after inspection. */
  totalCents: number | null;
  /** Sum of the services that could be priced. */
  knownTotalCents: number;
  /** True when a fluid quantity came from a vehicle row nobody has verified yet. */
  approximateFluids: boolean;
};

export const toCents = (eur: string | number) => Math.round(Number(eur) * 100);

/** You buy whole or half litres: 6.9 -> 7.0, 7.0 -> 7.0, 1.35 -> 1.5. */
export function roundUpToHalfLitre(litres: number) {
  return Math.ceil(litres * 2 - 1e-9) / 2;
}

type FluidNeed = { fluid: FluidKind; capacity: string | null; suffix?: string };

function fluidNeeds(source: FluidSource, v: PricingVehicle): FluidNeed[] {
  switch (source) {
    case "engine_oil":
      return [{ fluid: "engine_oil", capacity: v.engineOilWithFilterL }];
    case "coolant":
      return [{ fluid: "coolant", capacity: v.coolantL }];
    case "transmission":
      return [{ fluid: v.transmissionType === "automatic" ? "atf" : "gear_oil", capacity: v.transmissionL }];
    case "differentials":
      return [
        { fluid: "gear_oil", capacity: v.frontDiffL, suffix: "преден диференциал" },
        { fluid: "gear_oil", capacity: v.rearDiffL, suffix: "заден диференциал" },
      ];
    case "transfer_case":
      return [{ fluid: "gear_oil", capacity: v.transferCaseL }];
    case "brake_fluid":
      return [{ fluid: "brake_fluid", capacity: v.brakeFluidL }];
    case "none":
      return [];
  }
}

export function priceService(
  vehicle: PricingVehicle,
  service: PricingService,
  fluidPrices: FluidPrice[],
  consumables: ServiceConsumable[],
): ServicePrice {
  const lines: PriceLine[] = [{ kind: "labour", label: "Труд", cents: toCents(service.labourEur) }];
  let priceable = true;

  for (const need of fluidNeeds(service.fluidSource, vehicle)) {
    const price = fluidPrices.find((f) => f.fluid === need.fluid);
    if (need.capacity === null || !price) {
      priceable = false;
      continue;
    }
    const litres = roundUpToHalfLitre(Number(need.capacity));
    const perLitreCents = toCents(price.pricePerLitreEur);
    lines.push({
      kind: "fluid",
      label: need.suffix ? `${price.name} — ${need.suffix}` : price.name,
      litres,
      perLitreCents,
      cents: Math.round(litres * perLitreCents),
    });
  }

  for (const c of consumables) {
    if (c.serviceId !== service.id) continue;
    lines.push({ kind: "consumable", label: c.name, quantity: c.quantity, cents: toCents(c.priceEur) * c.quantity });
  }

  return {
    serviceId: service.id,
    name: service.name,
    durationMin: service.durationMin,
    lines,
    totalCents: priceable ? lines.reduce((sum, line) => sum + line.cents, 0) : null,
  };
}

/** Several services in one booking: price each, add them together. */
export function priceBooking(
  vehicle: PricingVehicle,
  services: PricingService[],
  fluidPrices: FluidPrice[],
  consumables: ServiceConsumable[],
): PriceBreakdown {
  const priced = services.map((s) => priceService(vehicle, s, fluidPrices, consumables));
  const knownTotalCents = priced.reduce((sum, s) => sum + (s.totalCents ?? 0), 0);
  const complete = priced.every((s) => s.totalCents !== null);
  const usesFluids = priced.some((s) => s.lines.some((line) => line.kind === "fluid"));

  return {
    services: priced,
    totalDurationMin: services.reduce((sum, s) => sum + s.durationMin, 0),
    totalCents: complete ? knownTotalCents : null,
    knownTotalCents,
    approximateFluids: usesFluids && !vehicle.verified,
  };
}
