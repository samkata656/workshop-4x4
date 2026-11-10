import { inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { vehicleSeed } from "./seed-data/vehicles";
import {
  baySeed,
  consumableSeed,
  fluidPriceSeed,
  openingHoursSeed,
  serviceSeed,
  settingsSeed,
} from "./seed-data/workshop";

/**
 * Inserts starter data. Safe to run on every start: each insert skips rows that
 * already exist, so it never overwrites what the owner changed in the admin panel.
 */
export async function seed(db: PostgresJsDatabase<typeof schema>) {
  await db.transaction(async (tx) => {
    await tx.insert(schema.bays).values(baySeed).onConflictDoNothing();
    await tx.insert(schema.openingHours).values(openingHoursSeed).onConflictDoNothing();
    await tx.insert(schema.settings).values(settingsSeed).onConflictDoNothing();
    await tx.insert(schema.fluidPrices).values([...fluidPriceSeed]).onConflictDoNothing();
    await tx.insert(schema.consumables).values(consumableSeed).onConflictDoNothing();

    // Services: link consumables only for services this run actually created.
    const created = await tx
      .insert(schema.services)
      .values(serviceSeed.map((s, i) => ({ slug: s.slug, name: s.name, durationMin: s.durationMin, fluidSource: s.fluidSource, labourEur: s.labourEur, sortOrder: (i + 1) * 10 })))
      .onConflictDoNothing()
      .returning({ id: schema.services.id, slug: schema.services.slug });

    if (created.length > 0) {
      const consumableRows = await tx
        .select({ id: schema.consumables.id, slug: schema.consumables.slug })
        .from(schema.consumables)
        .where(inArray(schema.consumables.slug, consumableSeed.map((c) => c.slug)));
      const consumableId = new Map(consumableRows.map((c) => [c.slug, c.id]));

      const links = created.flatMap((service) => {
        const def = serviceSeed.find((s) => s.slug === service.slug)!;
        return def.consumables
          .filter((slug) => consumableId.has(slug))
          .map((slug) => ({ serviceId: service.id, consumableId: consumableId.get(slug)! }));
      });
      if (links.length > 0) {
        await tx.insert(schema.serviceConsumables).values(links).onConflictDoNothing();
      }
    }

    await tx.insert(schema.vehicles).values(vehicleSeed).onConflictDoNothing();
  });
}
