"use server";

import { BookingError, createBooking, createQuote, getAvailableSlots } from "@/lib/booking/engine";
import { isValidDate, isValidTime, zonedDate, zonedTime } from "@/lib/booking/time";
import { headers } from "next/headers";
import { hit } from "@/lib/agent/rate-limit";
import { parseContact, parseId, parseIdList, type ContactErrors } from "@/lib/booking/validation";
import { clientAddress } from "@/lib/n8n";
import { NonStockError, findOrCreateNonStockVehicle, parseNonStockInput, type NonStockErrors } from "@/lib/vehicles/non-stock";

/**
 * Server actions for the public booking form. They only validate input and
 * translate errors into Bulgarian; every rule lives in src/lib/booking.
 */

export type SubmitResult =
  | {
      ok: true;
      kind: "booking";
      date: string;
      time: string;
      endTime: string;
      cancelPath: string;
      totalCents: number | null;
      knownTotalCents: number;
    }
  | { ok: true; kind: "quote"; totalCents: number | null; knownTotalCents: number }
  | { ok: false; message: string; fieldErrors?: ContactErrors; slotGone?: boolean };

const GENERIC = "Нещо се обърка при нас и заявката не е записана. Опитайте отново след малко.";
const INVALID = "Изборът на автомобил или услуги не е пълен. Проверете стъпки 1 и 2 и опитайте отново.";

function explain(error: unknown): SubmitResult {
  if (error instanceof BookingError) {
    switch (error.code) {
      case "SLOT_TAKEN":
        return { ok: false, slotGone: true, message: "Този час току-що беше зает. Изберете друг от свободните." };
      case "SLOT_UNAVAILABLE":
        return { ok: false, slotGone: true, message: "Този час вече не е свободен. Изберете друг от списъка." };
      case "VEHICLE_NOT_FOUND":
      case "SERVICE_NOT_FOUND":
        return { ok: false, message: "Услуга или автомобил от избора вече не се предлага. Презаредете страницата и изберете отново." };
    }
  }
  console.error("[booking] unexpected error", error);
  return { ok: false, message: GENERIC };
}

/** Free start times ("HH:MM") for the chosen services on one day. */
export async function fetchSlotsAction(serviceIds: unknown, date: unknown): Promise<string[]> {
  const ids = parseIdList(serviceIds);
  if (!ids || !isValidDate(date)) return [];
  try {
    const slots = await getAvailableSlots({ serviceIds: ids, date });
    return slots.map((s) => s.time);
  } catch (error) {
    if (!(error instanceof BookingError)) console.error("[booking] slots failed", error);
    return [];
  }
}

type FormInput = { vehicleId?: unknown; serviceIds?: unknown; date?: unknown; time?: unknown; contact?: unknown };

export async function submitBookingAction(input: FormInput): Promise<SubmitResult> {
  const vehicleId = parseId(input.vehicleId);
  const serviceIds = parseIdList(input.serviceIds);
  if (!vehicleId || !serviceIds) return { ok: false, message: INVALID };
  if (!isValidDate(input.date) || !isValidTime(input.time)) {
    return { ok: false, message: "Изберете ден и начален час от стъпка 3." };
  }
  const parsed = parseContact(input.contact);
  if (!parsed.ok) return { ok: false, message: "Проверете отбелязаните полета.", fieldErrors: parsed.errors };

  try {
    const booking = await createBooking({
      vehicleId,
      serviceIds,
      date: input.date,
      time: input.time,
      contact: parsed.contact,
      source: "web",
    });
    return {
      ok: true,
      kind: "booking",
      date: zonedDate(booking.startsAt),
      time: zonedTime(booking.startsAt),
      endTime: zonedTime(booking.endsAt),
      cancelPath: `/otkaz/${booking.cancelToken}`,
      totalCents: booking.price.totalCents,
      knownTotalCents: booking.price.knownTotalCents,
    };
  } catch (error) {
    return explain(error);
  }
}

/** "Поискай оферта без записване на час" — saves a quote, never touches a bay. */
export async function submitQuoteAction(input: FormInput): Promise<SubmitResult> {
  const vehicleId = parseId(input.vehicleId);
  const serviceIds = parseIdList(input.serviceIds);
  if (!vehicleId || !serviceIds) return { ok: false, message: INVALID };
  const parsed = parseContact(input.contact);
  if (!parsed.ok) return { ok: false, message: "Проверете отбелязаните полета.", fieldErrors: parsed.errors };

  try {
    const quote = await createQuote({ vehicleId, serviceIds, contact: parsed.contact, source: "web" });
    return { ok: true, kind: "quote", totalCents: quote.price.totalCents, knownTotalCents: quote.price.knownTotalCents };
  } catch (error) {
    return explain(error);
  }
}

// ---------------------------------------------------------------------------
// "Не е стоков джип?" — AI capacity lookup for a swapped engine / gearbox
// ---------------------------------------------------------------------------

type Row = Awaited<ReturnType<typeof findOrCreateNonStockVehicle>>;

/** The same shape the booking page gives the form for catalogue vehicles. */
export type LookedUpVehicle = Pick<
  Row,
  | "id" | "brand" | "model" | "generation" | "yearsFrom" | "yearsTo" | "engineCode" | "fuel" | "transmission" | "transmissionType"
  | "engineOilWithFilterL" | "transmissionL" | "frontDiffL" | "rearDiffL" | "transferCaseL" | "coolantL" | "brakeFluidL" | "verified"
>;

export type LookupResult =
  | { ok: true; vehicle: LookedUpVehicle; capacitiesFound: boolean }
  | { ok: false; message: string; fieldErrors?: NonStockErrors };

const HOUR = 60 * 60_000;
/** Every lookup is a paid web search and adds a row, so the limits are tight. */
const LOOKUPS_PER_VISITOR = { limit: 5, windowMs: HOUR };
const LOOKUPS_EVERYONE = { limit: 60, windowMs: 24 * HOUR, shared: true };

export async function lookupNonStockAction(input: unknown): Promise<LookupResult> {
  const parsed = parseNonStockInput(input);
  if (!parsed.ok) return { ok: false, message: "Попълнете отбелязаните полета за автомобила.", fieldErrors: parsed.errors };

  const address = clientAddress(await headers());
  if (!hit(`lookup:${address}`, LOOKUPS_PER_VISITOR).allowed || !hit("lookup:everyone", LOOKUPS_EVERYONE).allowed) {
    return { ok: false, message: "Направихте твърде много търсения. Опитайте отново след час или ни се обадете." };
  }

  try {
    const v = await findOrCreateNonStockVehicle(parsed.value);
    const capacities = [v.engineOilWithFilterL, v.transmissionL, v.frontDiffL, v.rearDiffL, v.transferCaseL, v.coolantL, v.brakeFluidL];
    return {
      ok: true,
      capacitiesFound: capacities.some((litres) => litres !== null),
      vehicle: {
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
        engineOilWithFilterL: v.engineOilWithFilterL,
        transmissionL: v.transmissionL,
        frontDiffL: v.frontDiffL,
        rearDiffL: v.rearDiffL,
        transferCaseL: v.transferCaseL,
        coolantL: v.coolantL,
        brakeFluidL: v.brakeFluidL,
        verified: v.verified,
      },
    };
  } catch (error) {
    if (error instanceof NonStockError) {
      return { ok: false, message: "Работим само с рамкови модели на Toyota и Lexus GX/LX от списъка." };
    }
    console.error("[non-stock] unexpected error", error);
    return { ok: false, message: GENERIC };
  }
}
