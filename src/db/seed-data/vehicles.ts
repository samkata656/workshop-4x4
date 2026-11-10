/**
 * Starter vehicle catalogue: 33 common body-on-frame Toyota / Lexus combinations.
 *
 * IMPORTANT — every number here is UNVERIFIED.
 * Capacities, gearbox codes and years were written from an AI model's memory, with
 * no workshop manual open. Each row is seeded with verified = false and must be
 * checked by the owner before it is trusted (SPEC.md section 2).
 *
 * null means "not known with enough confidence" — it is deliberately left empty
 * rather than guessed. A service that needs a null capacity shows "цена след оглед".
 * Coolant, brake fluid and most automatic-gearbox quantities are null for that
 * reason: they vary too much by market and year to quote from memory.
 *
 * Column order of each tuple:
 *   brand, model, generation, yearsFrom, yearsTo, engine, fuel, gearbox, gearboxType,
 *   engineOil+filter, gearbox, frontDiff, rearDiff, transferCase, coolant, brakeFluid
 */
type Brand = "Toyota" | "Lexus";
type Fuel = "petrol" | "diesel";
type Gearbox = "manual" | "automatic";
type L = number | null;

type Row = [Brand, string, string, number, number | null, string, Fuel, string, Gearbox, L, L, L, L, L, L, L];

const P = "petrol";
const D = "diesel";
const MT = "manual";
const AT = "automatic";
const HILUX_5 = "5-то поколение (N80–N110)";
const HILUX_7 = "7-мо поколение (AN10/AN20/AN30)";
const HILUX_8 = "8-мо поколение (AN120/AN130)";

// prettier-ignore
const rows: Row[] = [
  // Land Cruiser 70 series
  ["Toyota", "Land Cruiser 70", "J76", 2007, null, "1VD-FTV", D, "H150F", MT, 9.2, 2.7, null, null, null, null, null],
  ["Toyota", "Land Cruiser 70", "J78", 1999, null, "1HZ", D, "H55F", MT, 9.5, 4.9, null, null, null, null, null],
  ["Toyota", "Land Cruiser 70", "J79", 2007, null, "1VD-FTV", D, "H150F", MT, 9.2, 2.7, null, null, null, null, null],

  // Land Cruiser (station wagon)
  ["Toyota", "Land Cruiser", "J80", 1995, 1997, "1FZ-FE", P, "A343F", AT, 7.4, null, 2.8, 3.25, 1.7, null, null],
  ["Toyota", "Land Cruiser", "J80", 1990, 1995, "1HD-T", D, "H151F", MT, 9.3, 2.7, 2.8, 3.25, 1.7, null, null],
  ["Toyota", "Land Cruiser", "J100", 2003, 2007, "2UZ-FE", P, "A750F", AT, 6.4, null, 1.7, 3.3, 1.3, null, null],
  ["Toyota", "Land Cruiser", "J100", 1998, 2007, "1HD-FTE", D, "H151F", MT, 11.4, 2.7, 1.7, 3.3, 1.3, null, null],
  ["Toyota", "Land Cruiser", "J200", 2007, 2021, "1VD-FTV", D, "AB60F", AT, 9.2, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser", "J200", 2008, 2015, "3UR-FE", P, "AB60F", AT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser", "J300", 2021, null, "V35A-FTS", P, "AWR10L65", AT, 7.3, null, null, null, null, null, null],

  // Land Cruiser Prado
  ["Toyota", "Land Cruiser Prado", "J90", 1996, 2002, "1KZ-TE", D, "R151F", MT, null, 2.2, null, null, null, null, null],
  ["Toyota", "Land Cruiser Prado", "J120", 2002, 2009, "1KD-FTV", D, "A750F", AT, 7.0, null, 1.4, 2.95, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J120", 2002, 2009, "1KD-FTV", D, "R151F", MT, 7.0, 2.2, 1.4, 2.95, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J120", 2002, 2009, "1GR-FE", P, "A750F", AT, 5.2, null, 1.4, 2.95, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J150", 2009, 2015, "1KD-FTV", D, "A750F", AT, 7.0, null, null, null, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J150", 2015, 2023, "1GD-FTV", D, "AC60F", AT, 7.5, null, null, null, 1.4, null, null],

  // FJ Cruiser (the 2010 engine update changed the oil quantity)
  ["Toyota", "FJ Cruiser", "J15", 2006, 2009, "1GR-FE", P, "A750F", AT, 5.2, null, 1.4, 2.95, null, null, null],
  ["Toyota", "FJ Cruiser", "J15", 2010, 2022, "1GR-FE", P, "A750F", AT, 6.2, null, 1.4, 2.95, null, null, null],

  // 4Runner / Hilux Surf
  ["Toyota", "4Runner", "N210", 2005, 2009, "1GR-FE", P, "A750F", AT, 5.2, null, 1.4, 2.95, 1.4, null, null],
  ["Toyota", "4Runner", "N280", 2009, 2024, "1GR-FE", P, "A750F", AT, 6.2, null, null, null, null, null, null],

  // Hilux
  ["Toyota", "Hilux", HILUX_5, 1988, 1997, "22R-E", P, "W56", MT, 4.3, 3.0, 1.6, 2.2, 1.6, null, null],
  ["Toyota", "Hilux", HILUX_7, 2004, 2015, "1KD-FTV", D, "R151F", MT, 6.9, 2.2, null, null, 1.0, null, null],
  ["Toyota", "Hilux", HILUX_8, 2015, null, "1GD-FTV", D, "AC60F", AT, 7.5, null, null, null, null, null, null],

  // Tacoma
  ["Toyota", "Tacoma", "1-во поколение", 1995, 2004, "5VZ-FE", P, "A340F", AT, 5.2, null, null, null, null, null, null],
  ["Toyota", "Tacoma", "2-ро поколение", 2005, 2015, "1GR-FE", P, "A750F", AT, 5.2, null, null, null, null, null, null],

  // Fortuner
  ["Toyota", "Fortuner", "AN50/AN60", 2005, 2015, "1KD-FTV", D, "A750F", AT, 6.9, null, null, null, null, null, null],
  ["Toyota", "Fortuner", "AN150/AN160", 2015, null, "1GD-FTV", D, "AC60F", AT, 7.5, null, null, null, null, null, null],

  // Tundra / Sequoia
  ["Toyota", "Tundra", "2-ро поколение", 2007, 2021, "3UR-FE", P, "AB60F", AT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Sequoia", "2-ро поколение", 2008, 2022, "3UR-FE", P, "AB60F", AT, 7.5, null, null, null, null, null, null],

  // Lexus GX
  ["Lexus", "GX", "GX 470 (J120)", 2002, 2009, "2UZ-FE", P, "A750F", AT, 6.2, null, 1.4, 2.95, 1.4, null, null],
  ["Lexus", "GX", "GX 460 (J150)", 2009, 2023, "1UR-FE", P, "A760F", AT, 7.5, null, null, null, 1.4, null, null],

  // Lexus LX
  ["Lexus", "LX", "LX 470 (J100)", 2003, 2007, "2UZ-FE", P, "A750F", AT, 6.4, null, 1.7, 3.3, 1.3, null, null],
  ["Lexus", "LX", "LX 570 (J200)", 2007, 2015, "3UR-FE", P, "AB60F", AT, 7.5, null, null, null, null, null, null],
];

const litres = (n: L) => (n === null ? null : n.toFixed(2));

export const vehicleSeed = rows.map(
  ([brand, model, generation, yearsFrom, yearsTo, engineCode, fuel, transmission, transmissionType, oil, gearbox, front, rear, transfer, coolant, brake]) => ({
    brand,
    model,
    generation,
    yearsFrom,
    yearsTo,
    engineCode,
    fuel,
    transmission,
    transmissionType,
    engineOilWithFilterL: litres(oil),
    transmissionL: litres(gearbox),
    frontDiffL: litres(front),
    rearDiffL: litres(rear),
    transferCaseL: litres(transfer),
    coolantL: litres(coolant),
    brakeFluidL: litres(brake),
    verified: false,
    source: "AI lookup (model memory, not checked against a manual)",
    createdBy: "seed" as const,
  }),
);
