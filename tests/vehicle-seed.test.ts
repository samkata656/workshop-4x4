import { describe, expect, it } from "vitest";
import { vehicleSeed } from "@/db/seed-data/vehicles";

describe("vehicle seed catalogue", () => {
  it("has no two rows with the same model, generation, engine, gearbox and first year", () => {
    // The same combination the database's unique constraint uses: a duplicate
    // would be silently skipped by the seed (ON CONFLICT DO NOTHING).
    const keys = vehicleSeed.map((v) => [v.brand, v.model, v.generation, v.engineCode, v.transmission, v.yearsFrom].join("|"));
    const repeated = keys.filter((key, i) => keys.indexOf(key) !== i);
    expect(repeated).toEqual([]);
  });

  it("keeps every row unverified, with sane years and positive capacities", () => {
    for (const v of vehicleSeed) {
      expect(v.verified).toBe(false);
      expect(v.yearsFrom).toBeGreaterThanOrEqual(1980);
      if (v.yearsTo !== null) expect(v.yearsTo).toBeGreaterThanOrEqual(v.yearsFrom);
      for (const litres of [v.engineOilWithFilterL, v.transmissionL, v.frontDiffL, v.rearDiffL, v.transferCaseL, v.coolantL, v.brakeFluidL]) {
        if (litres !== null) {
          expect(Number(litres)).toBeGreaterThan(0);
          expect(Number(litres)).toBeLessThan(20);
        }
      }
    }
  });
});
