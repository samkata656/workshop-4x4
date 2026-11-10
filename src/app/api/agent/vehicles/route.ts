import { agentRoute, invalid, json } from "@/lib/agent/http";
import { searchVehicles, type VehicleFilter } from "@/lib/queries";

const MAX_RESULTS = 50;
const MAX_FILTER_LENGTH = 60;
const FILTERS = ["brand", "model", "generation", "engine"] as const;

/**
 * GET /api/agent/vehicles?brand=Toyota&model=land+cruiser&generation=J80&engine=1HD
 * The catalogue rows that match every filter given (partial, case-insensitive).
 */
export const GET = agentRoute(async (request) => {
  const params = new URL(request.url).searchParams;
  const fields: Record<string, string> = {};
  const filter: VehicleFilter = {};

  for (const name of FILTERS) {
    const value = params.get(name)?.trim();
    if (!value) continue;
    if (value.length > MAX_FILTER_LENGTH) {
      fields[name] = `At most ${MAX_FILTER_LENGTH} characters.`;
    } else if (name === "brand") {
      const brand = (["Toyota", "Lexus"] as const).find((b) => b.toLowerCase() === value.toLowerCase());
      if (brand) filter.brand = brand;
      else fields.brand = 'Must be "Toyota" or "Lexus" — the workshop takes no other makes.';
    } else {
      filter[name] = value;
    }
  }
  if (Object.keys(fields).length > 0) throw invalid("Some search filters are invalid. See `fields`.", fields);

  const rows = await searchVehicles(filter, MAX_RESULTS + 1);
  const litres = (value: string | null) => (value === null ? null : Number(value));

  return json({
    vehicles: rows.slice(0, MAX_RESULTS).map((v) => ({
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
      // false = capacities not checked by the workshop yet; treat them as approximate.
      verified: v.verified,
      // Litres; null = unknown.
      capacitiesL: {
        engineOilWithFilter: litres(v.engineOilWithFilterL),
        transmission: litres(v.transmissionL),
        frontDiff: litres(v.frontDiffL),
        rearDiff: litres(v.rearDiffL),
        transferCase: litres(v.transferCaseL),
        coolant: litres(v.coolantL),
        brakeFluid: litres(v.brakeFluidL),
      },
    })),
    // true = more rows match than are returned; add filters to narrow the search.
    truncated: rows.length > MAX_RESULTS,
  });
});
