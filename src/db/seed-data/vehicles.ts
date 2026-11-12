/**
 * Starter vehicle catalogue: common body-on-frame Toyota / Lexus combinations
 * (model + generation + engine + gearbox), in two batches.
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
const HILUX_6 = "6-то поколение (N140–N170)";
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

  // -------------------------------------------------------------------------
  // Second batch. Same rules as above: written from model memory, unverified,
  // null wherever the number is not known with enough confidence. Axle and
  // transfer quantities are repeated only where the chassis is the same as a
  // row above (J80, J100, J120 platform).
  // -------------------------------------------------------------------------

  // Land Cruiser 60 / 70 series
  ["Toyota", "Land Cruiser 60", "J60", 1980, 1990, "2H", D, "H55F", MT, null, 4.9, null, null, null, null, null],
  ["Toyota", "Land Cruiser 60", "J60", 1985, 1990, "12H-T", D, "H55F", MT, null, 4.9, null, null, null, null, null],
  ["Toyota", "Land Cruiser 60", "J62", 1987, 1990, "3F-E", P, "A440F", AT, null, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser 70", "J75", 1990, 1999, "1HZ", D, "H55F", MT, 9.5, 4.9, null, null, null, null, null],
  ["Toyota", "Land Cruiser 70", "J76", 2007, null, "1HZ", D, "H55F", MT, 9.5, 4.9, null, null, null, null, null],
  ["Toyota", "Land Cruiser 70", "J76", 2023, null, "1GD-FTV", D, "AC60F", AT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser 70", "J78", 2007, null, "1VD-FTV", D, "H150F", MT, 9.2, 2.7, null, null, null, null, null],
  ["Toyota", "Land Cruiser 70", "J79", 1999, null, "1HZ", D, "H55F", MT, 9.5, 4.9, null, null, null, null, null],
  ["Toyota", "Land Cruiser 70", "J79", 2023, null, "1GD-FTV", D, "AC60F", AT, 7.5, null, null, null, null, null, null],

  // Land Cruiser 80
  ["Toyota", "Land Cruiser", "J80", 1990, 1997, "1HZ", D, "H151F", MT, 9.5, 2.7, 2.8, 3.25, 1.7, null, null],
  ["Toyota", "Land Cruiser", "J80", 1995, 1997, "1HD-FT", D, "H151F", MT, null, 2.7, 2.8, 3.25, 1.7, null, null],
  ["Toyota", "Land Cruiser", "J80", 1995, 1997, "1HD-FT", D, "A442F", AT, null, null, 2.8, 3.25, 1.7, null, null],
  ["Toyota", "Land Cruiser", "J80", 1990, 1995, "1HD-T", D, "A442F", AT, 9.3, null, 2.8, 3.25, 1.7, null, null],
  ["Toyota", "Land Cruiser", "J80", 1992, 1997, "1FZ-FE", P, "H151F", MT, 7.4, 2.7, 2.8, 3.25, 1.7, null, null],
  ["Toyota", "Land Cruiser", "J80", 1990, 1992, "3F-E", P, "A440F", AT, null, null, 2.8, 3.25, 1.7, null, null],

  // Land Cruiser 100 / 105
  ["Toyota", "Land Cruiser", "J100", 1998, 2002, "2UZ-FE", P, "A343F", AT, 6.4, null, 1.7, 3.3, 1.3, null, null],
  ["Toyota", "Land Cruiser", "J100", 1998, 2002, "1HD-FTE", D, "A442F", AT, 11.4, null, 1.7, 3.3, 1.3, null, null],
  ["Toyota", "Land Cruiser", "J100", 2002, 2007, "1HD-FTE", D, "A750F", AT, 11.4, null, 1.7, 3.3, 1.3, null, null],
  ["Toyota", "Land Cruiser", "J105", 1998, 2007, "1HZ", D, "H151F", MT, 9.5, 2.7, null, null, null, null, null],
  ["Toyota", "Land Cruiser", "J105", 1998, 2007, "1FZ-FE", P, "H151F", MT, 7.4, 2.7, null, null, null, null, null],

  // Land Cruiser 200 / 300
  ["Toyota", "Land Cruiser", "J200", 2007, 2011, "2UZ-FE", P, "A750F", AT, 6.4, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser", "J200", 2012, 2021, "1UR-FE", P, "A760F", AT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser", "J200", 2015, 2021, "3UR-FE", P, "AE80F", AT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser", "J300", 2021, null, "F33A-FTV", D, "AWR10L65", AT, null, null, null, null, null, null, null],

  // Land Cruiser Prado
  ["Toyota", "Land Cruiser Prado", "J90", 1996, 2002, "5VZ-FE", P, "A340F", AT, 5.2, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser Prado", "J90", 1996, 2002, "1KZ-TE", D, "A343F", AT, null, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser Prado", "J90", 1996, 2002, "3RZ-FE", P, "R150F", MT, null, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser Prado", "J90", 2000, 2002, "1KD-FTV", D, "R151F", MT, 7.0, 2.2, null, null, null, null, null],
  ["Toyota", "Land Cruiser Prado", "J120", 2004, 2009, "2TR-FE", P, "A340F", AT, 5.8, null, 1.4, 2.95, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J120", 2002, 2009, "5L-E", D, "R151F", MT, null, 2.2, 1.4, 2.95, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J120", 2002, 2004, "1KZ-TE", D, "R151F", MT, null, 2.2, 1.4, 2.95, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J150", 2009, 2023, "1GR-FE", P, "A750F", AT, 6.2, null, null, null, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J150", 2009, 2023, "2TR-FE", P, "A340F", AT, 5.8, null, null, null, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J150", 2009, 2015, "1KD-FTV", D, "RA61F", MT, 7.0, null, null, null, 1.4, null, null],
  ["Toyota", "Land Cruiser Prado", "J250", 2024, null, "1GD-FTV", D, "8-ст. автоматична (Direct Shift)", AT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Land Cruiser Prado", "J250", 2024, null, "T24A-FTS", P, "8-ст. автоматична (Direct Shift)", AT, null, null, null, null, null, null, null],

  // FJ Cruiser, manual
  ["Toyota", "FJ Cruiser", "J15", 2006, 2009, "1GR-FE", P, "RA61F", MT, 5.2, null, 1.4, 2.95, null, null, null],
  ["Toyota", "FJ Cruiser", "J15", 2010, 2014, "1GR-FE", P, "RA61F", MT, 6.2, null, 1.4, 2.95, null, null, null],

  // 4Runner / Hilux Surf
  ["Toyota", "4Runner", "N130", 1989, 1995, "3VZ-E", P, "A340H", AT, null, null, null, null, null, null, null],
  ["Toyota", "4Runner", "N130", 1989, 1995, "22R-E", P, "W56", MT, 4.3, 3.0, null, null, null, null, null],
  ["Toyota", "4Runner", "N180", 1995, 2002, "5VZ-FE", P, "A340F", AT, 5.2, null, null, null, null, null, null],
  ["Toyota", "4Runner", "N180", 1995, 2002, "5VZ-FE", P, "R150F", MT, 5.2, null, null, null, null, null, null],
  ["Toyota", "4Runner", "N180", 1995, 2000, "3RZ-FE", P, "A340F", AT, null, null, null, null, null, null, null],
  ["Toyota", "4Runner", "N180", 1995, 2002, "1KZ-TE", D, "A340F", AT, null, null, null, null, null, null, null],
  ["Toyota", "4Runner", "N210", 2002, 2004, "2UZ-FE", P, "A750F", AT, 6.2, null, 1.4, 2.95, 1.4, null, null],
  ["Toyota", "4Runner", "N210", 2002, 2004, "1GR-FE", P, "A340F", AT, 5.2, null, 1.4, 2.95, 1.4, null, null],
  ["Toyota", "4Runner", "N210", 2005, 2009, "2UZ-FE", P, "A750F", AT, 6.2, null, 1.4, 2.95, 1.4, null, null],

  // Hilux
  ["Toyota", "Hilux", HILUX_5, 1988, 1997, "2L", D, "G58", MT, null, null, 1.6, 2.2, 1.6, null, null],
  ["Toyota", "Hilux", HILUX_5, 1988, 1997, "3VZ-E", P, "R150F", MT, null, null, 1.6, 2.2, 1.6, null, null],
  ["Toyota", "Hilux", HILUX_6, 1997, 2005, "5L", D, "G58", MT, null, null, null, null, null, null, null],
  ["Toyota", "Hilux", HILUX_6, 1997, 2005, "1KZ-TE", D, "R150F", MT, null, null, null, null, null, null, null],
  ["Toyota", "Hilux", HILUX_6, 2001, 2005, "2KD-FTV", D, "R151F", MT, 6.9, 2.2, null, null, null, null, null],
  ["Toyota", "Hilux", HILUX_6, 1997, 2005, "3RZ-FE", P, "R150F", MT, null, null, null, null, null, null, null],
  ["Toyota", "Hilux", HILUX_7, 2004, 2015, "2KD-FTV", D, "R151F", MT, 6.9, 2.2, null, null, 1.0, null, null],
  ["Toyota", "Hilux", HILUX_7, 2004, 2011, "1KD-FTV", D, "A340F", AT, 6.9, null, null, null, 1.0, null, null],
  ["Toyota", "Hilux", HILUX_7, 2012, 2015, "1KD-FTV", D, "A750F", AT, 6.9, null, null, null, 1.0, null, null],
  ["Toyota", "Hilux", HILUX_7, 2004, 2015, "2TR-FE", P, "R151F", MT, 5.8, 2.2, null, null, 1.0, null, null],
  ["Toyota", "Hilux", HILUX_8, 2015, null, "1GD-FTV", D, "RC61F", MT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Hilux", HILUX_8, 2015, null, "2GD-FTV", D, "RC61F", MT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Hilux", HILUX_8, 2015, null, "2GD-FTV", D, "AC60F", AT, 7.5, null, null, null, null, null, null],

  // Tacoma
  ["Toyota", "Tacoma", "1-во поколение", 1995, 2004, "5VZ-FE", P, "R150F", MT, 5.2, null, null, null, null, null, null],
  ["Toyota", "Tacoma", "1-во поколение", 1995, 2004, "3RZ-FE", P, "W59", MT, null, null, null, null, null, null, null],
  ["Toyota", "Tacoma", "2-ро поколение", 2005, 2015, "1GR-FE", P, "RA60F", MT, 5.2, null, null, null, null, null, null],
  ["Toyota", "Tacoma", "2-ро поколение", 2005, 2015, "2TR-FE", P, "A340F", AT, 5.8, null, null, null, null, null, null],
  ["Toyota", "Tacoma", "3-то поколение", 2016, 2023, "2GR-FKS", P, "AC60F", AT, 5.9, null, null, null, null, null, null],
  ["Toyota", "Tacoma", "3-то поколение", 2016, 2023, "2GR-FKS", P, "RC62F", MT, 5.9, null, null, null, null, null, null],

  // Fortuner
  ["Toyota", "Fortuner", "AN50/AN60", 2005, 2015, "2KD-FTV", D, "R151F", MT, 6.9, 2.2, null, null, null, null, null],
  ["Toyota", "Fortuner", "AN50/AN60", 2005, 2015, "2TR-FE", P, "A340F", AT, 5.8, null, null, null, null, null, null],
  ["Toyota", "Fortuner", "AN150/AN160", 2015, null, "2GD-FTV", D, "AC60F", AT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Fortuner", "AN150/AN160", 2015, null, "2TR-FE", P, "AC60F", AT, 5.8, null, null, null, null, null, null],

  // Tundra / Sequoia
  ["Toyota", "Tundra", "1-во поколение", 2000, 2004, "2UZ-FE", P, "A340F", AT, 6.2, null, null, null, null, null, null],
  ["Toyota", "Tundra", "1-во поколение", 2005, 2006, "2UZ-FE", P, "A750F", AT, 6.2, null, null, null, null, null, null],
  ["Toyota", "Tundra", "2-ро поколение", 2010, 2019, "1UR-FE", P, "A760F", AT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Tundra", "3-то поколение", 2022, null, "V35A-FTS", P, "AWR10L65", AT, 7.3, null, null, null, null, null, null],
  ["Toyota", "Sequoia", "1-во поколение", 2001, 2004, "2UZ-FE", P, "A340F", AT, 6.2, null, null, null, null, null, null],
  ["Toyota", "Sequoia", "1-во поколение", 2005, 2007, "2UZ-FE", P, "A750F", AT, 6.2, null, null, null, null, null, null],
  ["Toyota", "Sequoia", "2-ро поколение", 2010, 2012, "1UR-FE", P, "A760F", AT, 7.5, null, null, null, null, null, null],
  ["Toyota", "Sequoia", "3-то поколение", 2023, null, "V35A-FXS (хибрид)", P, "AWR10L65", AT, 7.3, null, null, null, null, null, null],

  // Lexus GX / LX
  ["Lexus", "GX", "GX 550 (J250)", 2024, null, "V35A-FTS", P, "AWR10L65", AT, 7.3, null, null, null, null, null, null],
  ["Lexus", "LX", "LX 450 (J80)", 1996, 1997, "1FZ-FE", P, "A343F", AT, 7.4, null, 2.8, 3.25, 1.7, null, null],
  ["Lexus", "LX", "LX 470 (J100)", 1998, 2002, "2UZ-FE", P, "A343F", AT, 6.4, null, 1.7, 3.3, 1.3, null, null],
  ["Lexus", "LX", "LX 570 (J200)", 2016, 2021, "3UR-FE", P, "AE80F", AT, 7.5, null, null, null, null, null, null],
  ["Lexus", "LX", "LX 450d (J200)", 2015, 2021, "1VD-FTV", D, "AB60F", AT, 9.2, null, null, null, null, null, null],
  ["Lexus", "LX", "LX 600 (J310)", 2021, null, "V35A-FTS", P, "AWR10L65", AT, 7.3, null, null, null, null, null, null],
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
