import { agentRoute, invalid, json } from "@/lib/agent/http";
import { parseIdText } from "@/lib/agent/input";
import { servicePriceJson } from "@/lib/agent/serialize";
import { getServicePrices } from "@/lib/booking/engine";
import { listActiveServices } from "@/lib/queries";

/**
 * GET /api/agent/services              -> services with duration and labour
 * GET /api/agent/services?vehicleId=12 -> the same, plus the full price of each
 *                                         service for that vehicle
 * The full price depends on the vehicle's fluid capacities, so it needs a vehicle.
 */
export const GET = agentRoute(async (request) => {
  const vehicleParam = new URL(request.url).searchParams.get("vehicleId");
  const vehicleId = parseIdText(vehicleParam);
  if (vehicleParam !== null && !vehicleId) {
    throw invalid("Some fields are missing or invalid. See `fields`.", {
      vehicleId: "Optional: a positive integer id from GET /api/agent/vehicles.",
    });
  }

  const [services, prices] = await Promise.all([listActiveServices(), vehicleId ? getServicePrices(vehicleId) : null]);

  return json({
    currency: "EUR",
    vatIncluded: true,
    vehicleId,
    services: services.map((s) => {
      const price = prices?.find((p) => p.serviceId === s.id);
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        durationMin: s.durationMin,
        labourEur: Number(s.labourEur),
        // Present only when vehicleId was given.
        ...(price && { price: servicePriceJson(price) }),
      };
    }),
    ...(!vehicleId && {
      note: "labourEur is labour only. Add ?vehicleId= to get the full price (labour + fluids + consumables).",
    }),
  });
});
