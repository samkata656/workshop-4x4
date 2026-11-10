/**
 * How prices look in agent responses: euros (VAT included) instead of the
 * internal integer cents. No arithmetic beyond that — the numbers come from
 * src/lib/booking/pricing.
 */
import type { PriceBreakdown, PriceLine, ServicePrice } from "@/lib/booking/pricing";

const eur = (cents: number) => cents / 100;
const eurOrNull = (cents: number | null) => (cents === null ? null : eur(cents));

function line(l: PriceLine) {
  switch (l.kind) {
    case "labour":
      return { kind: l.kind, label: l.label, eur: eur(l.cents) };
    case "fluid":
      return { kind: l.kind, label: l.label, litres: l.litres, perLitreEur: eur(l.perLitreCents), eur: eur(l.cents) };
    case "consumable":
      return { kind: l.kind, label: l.label, quantity: l.quantity, eur: eur(l.cents) };
  }
}

export function servicePriceJson(s: ServicePrice) {
  return {
    serviceId: s.serviceId,
    name: s.name,
    durationMin: s.durationMin,
    /** null = price after inspection ("цена след оглед"): a fluid capacity is unknown for this vehicle. */
    priceEur: eurOrNull(s.totalCents),
    priceAfterInspection: s.totalCents === null,
    lines: s.lines.map(line),
  };
}

export function priceJson(p: PriceBreakdown) {
  return {
    currency: "EUR",
    vatIncluded: true,
    /** null when at least one service is priced after inspection. */
    totalEur: eurOrNull(p.totalCents),
    /** Sum of the services that could be priced. */
    knownTotalEur: eur(p.knownTotalCents),
    priceAfterInspection: p.totalCents === null,
    /** true = fluid quantities come from an unverified vehicle row; say the price is approximate. */
    approximateFluids: p.approximateFluids,
    totalDurationMin: p.totalDurationMin,
    services: p.services.map(servicePriceJson),
  };
}
