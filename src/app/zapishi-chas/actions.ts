"use server";

import { BookingError, createBooking, createQuote, getAvailableSlots } from "@/lib/booking/engine";
import { isValidDate, isValidTime, zonedDate, zonedTime } from "@/lib/booking/time";
import { parseContact, parseId, parseIdList, type ContactErrors } from "@/lib/booking/validation";

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
