import { describe, expect, it } from "vitest";
import {
  priceBooking,
  roundUpToHalfLitre,
  type FluidPrice,
  type PricingService,
  type PricingVehicle,
  type ServiceConsumable,
} from "@/lib/booking/pricing";

const fluidPrices: FluidPrice[] = [
  { fluid: "engine_oil", name: "Двигателно масло", pricePerLitreEur: "12.00" },
  { fluid: "atf", name: "ATF", pricePerLitreEur: "15.00" },
  { fluid: "gear_oil", name: "Трансмисионно масло", pricePerLitreEur: "14.00" },
  { fluid: "coolant", name: "Антифриз", pricePerLitreEur: "6.00" },
  { fluid: "brake_fluid", name: "Спирачна течност", pricePerLitreEur: "10.00" },
];

const oil: PricingService = { id: 1, name: "Масло и филтър", durationMin: 60, fluidSource: "engine_oil", labourEur: "40.00" };
const gearbox: PricingService = { id: 3, name: "Скоростна кутия", durationMin: 90, fluidSource: "transmission", labourEur: "70.00" };
const diffs: PricingService = { id: 4, name: "Диференциали", durationMin: 75, fluidSource: "differentials", labourEur: "60.00" };
const pads: PricingService = { id: 6, name: "Накладки", durationMin: 90, fluidSource: "none", labourEur: "70.00" };
const coolant: PricingService = { id: 2, name: "Антифриз", durationMin: 140, fluidSource: "coolant", labourEur: "80.00" };

const kit = (serviceId: number): ServiceConsumable => ({ serviceId, name: "Основни консумативи", priceEur: "5.00", quantity: 1 });
const consumables: ServiceConsumable[] = [
  { serviceId: 1, name: "Маслен филтър", priceEur: "20.00", quantity: 1 },
  ...[1, 2, 3, 4, 6].map(kit),
];

// Prado J120 1KD-FTV manual, as seeded.
const prado: PricingVehicle = {
  transmissionType: "manual",
  engineOilWithFilterL: "7.00",
  transmissionL: "2.20",
  frontDiffL: "1.40",
  rearDiffL: "2.95",
  transferCaseL: "1.40",
  coolantL: null,
  brakeFluidL: null,
  verified: false,
};

const price = (vehicle: PricingVehicle, ...services: PricingService[]) =>
  priceBooking(vehicle, services, fluidPrices, consumables);

describe("rounding fluid quantities up to the next 0.5 L", () => {
  it.each([
    [6.9, 7],
    [7, 7],
    [7.01, 7.5],
    [1.35, 1.5],
    [2.95, 3],
    [0.5, 0.5],
  ])("%d L -> %d L", (input, expected) => expect(roundUpToHalfLitre(input)).toBe(expected));
});

describe("price breakdown", () => {
  it("engine oil = labour + litres x price + filter + consumables", () => {
    const result = price(prado, oil);
    // 40 labour + 7.0 L x 12 + 20 filter + 5 consumables
    expect(result.totalCents).toBe(4000 + 8400 + 2000 + 500);
    expect(result.services[0].lines.map((l) => l.kind)).toEqual(["labour", "fluid", "consumable", "consumable"]);
  });

  it("only the engine oil service is charged the oil filter", () => {
    const labels = price(prado, pads).services[0].lines.map((l) => l.label);
    expect(labels).not.toContain("Маслен филтър");
    expect(price(prado, pads).totalCents).toBe(7000 + 500);
  });

  it("gearbox uses gear oil for a manual and ATF for an automatic", () => {
    // manual: 2.2 L -> 2.5 L x 14
    expect(price(prado, gearbox).totalCents).toBe(7000 + 3500 + 500);
    // automatic: 2.2 L -> 2.5 L x 15
    expect(price({ ...prado, transmissionType: "automatic" }, gearbox).totalCents).toBe(7000 + 3750 + 500);
  });

  it("differentials price the front and the rear, each rounded up", () => {
    // front 1.4 -> 1.5 L, rear 2.95 -> 3.0 L, both x 14
    expect(price(prado, diffs).totalCents).toBe(6000 + 2100 + 4200 + 500);
  });

  it("adds several services together and sums their durations", () => {
    const result = price(prado, oil, pads);
    expect(result.totalCents).toBe(14900 + 7500);
    expect(result.totalDurationMin).toBe(150);
  });

  it("an unknown capacity means price after inspection, never a guess", () => {
    const result = price(prado, oil, coolant);
    expect(result.services[1].totalCents).toBeNull();
    expect(result.totalCents).toBeNull();
    expect(result.knownTotalCents).toBe(14900); // the oil change is still priced
  });

  it("flags fluid quantities as approximate until the vehicle row is verified", () => {
    expect(price(prado, oil).approximateFluids).toBe(true);
    expect(price({ ...prado, verified: true }, oil).approximateFluids).toBe(false);
    expect(price(prado, pads).approximateFluids).toBe(false); // no fluids involved
  });
});
