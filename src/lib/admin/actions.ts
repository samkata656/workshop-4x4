"use server";

/**
 * Admin server actions. Each one calls requireAdmin() first: a server action is
 * an ordinary POST endpoint, so it must never trust that the page was protected.
 */
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/admin/action-form";
import { getDb, schema } from "@/db";
import { BookingError, moveBooking, setBookingStatus } from "@/lib/booking/engine";
import { isValidDate, isValidTime } from "@/lib/booking/time";
import { parseOfferText, saveOfferText, sendOffer } from "@/lib/requests/offer";
import { requireAdmin } from "./session";

const { bookings, consumables, fluidPrices, openingHours, quotes, requests, services, settings, vehicles } = schema;

const ok = (message = "Записано."): FormState => ({ ok: true, message });
const fail = (message: string): FormState => ({ ok: false, message });
const UNEXPECTED = "Нещо се обърка при записа. Опитайте отново.";

// --- small FormData parsers -------------------------------------------------

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const id = (form: FormData, key = "id") => {
  const n = Number(form.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
};
/** "12,5" or "12.50" -> "12.50". null when it is not a sensible amount. */
function money(raw: string): string | null {
  const n = Number(raw.replace(",", ".").replace(/\s/g, ""));
  return raw !== "" && Number.isFinite(n) && n >= 0 && n < 100_000 ? n.toFixed(2) : null;
}
function wholeNumber(raw: string, min: number, max: number): number | null {
  const n = Number(raw);
  return raw !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}
/** Litres: empty -> null (unknown); otherwise a positive number. `false` = invalid. */
function litres(raw: string): string | null | false {
  if (raw === "") return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 100 ? n.toFixed(2) : false;
}
const pick = <T extends string>(values: readonly T[], raw: string) => values.find((v) => v === raw) ?? null;

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

function explainBookingError(error: unknown): FormState {
  if (error instanceof BookingError) {
    if (error.code === "SLOT_TAKEN") return fail("Боксът е зает по това време. Изберете друг час или бокс.");
    if (error.code === "SLOT_UNAVAILABLE") return fail("Часът е извън работното време или работата не свършва преди затваряне.");
    if (error.code === "BOOKING_NOT_FOUND") return fail("Този час вече не съществува. Презаредете календара.");
  }
  console.error("[admin] booking action failed", error);
  return fail(UNEXPECTED);
}

/** Drag-and-drop in the calendar, and the "Премести" form in the detail panel. */
export async function moveBookingAction(input: { id: number; date: string; time: string; bayId: number }): Promise<FormState> {
  await requireAdmin();
  if (!Number.isInteger(input.id) || !Number.isInteger(input.bayId) || !isValidDate(input.date) || !isValidTime(input.time)) {
    return fail("Изберете валидни дата, час и бокс.");
  }
  try {
    await moveBooking(input);
    refresh();
    return ok("Часът е преместен.");
  } catch (error) {
    return explainBookingError(error);
  }
}

export async function setBookingStatusAction(bookingId: number, status: string): Promise<FormState> {
  await requireAdmin();
  const next = pick(schema.bookingStatus.enumValues, status);
  if (!Number.isInteger(bookingId) || !next) return fail("Непознат статус.");
  try {
    await setBookingStatus(bookingId, next);
    refresh();
    return ok(next === "cancelled" ? "Часът е отказан и боксът е свободен." : "Статусът е променен.");
  } catch (error) {
    return explainBookingError(error);
  }
}

export async function saveBookingNotesAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const bookingId = id(form);
  if (!bookingId) return fail(UNEXPECTED);
  await getDb()
    .update(bookings)
    .set({ notes: text(form, "notes").slice(0, 4000) || null, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
  refresh();
  return ok("Бележката е записана.");
}

// ---------------------------------------------------------------------------
// Requests and quotes
// ---------------------------------------------------------------------------

export async function updateRequestAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const requestId = id(form);
  const status = pick(schema.requestStatus.enumValues, text(form, "status"));
  if (!requestId || !status) return fail("Изберете статус от списъка.");
  await getDb()
    .update(requests)
    .set({ status, notes: text(form, "notes").slice(0, 4000) || null, updatedAt: new Date() })
    .where(eq(requests.id, requestId));
  refresh();
  return ok();
}

/** Offer e-mail on a modification request: "save" keeps the owner's edits, "send" also e-mails the customer. */
export async function offerAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const requestId = id(form);
  if (!requestId) return fail(UNEXPECTED);
  const parsed = parseOfferText(form.get("subject"), form.get("body"));
  if (!parsed.ok) return fail("Попълнете тема и текст на имейла. Темата е до 200 знака, текстът — до 6000.");

  await saveOfferText(requestId, parsed.subject, parsed.body);
  if (form.get("intent") !== "send") {
    refresh();
    return ok("Черновата е записана. Още не е изпратена.");
  }

  const sent = await sendOffer(requestId);
  refresh();
  if (sent.ok) return ok(`Офертата е изпратена на ${sent.to}.`);
  switch (sent.reason) {
    case "NO_EMAIL":
      return fail("Клиентът няма записан имейл. Черновата е записана, но не е изпратена.");
    case "NOT_CONFIGURED":
      return fail("Изпращането на имейли не е настроено (N8N_OFFER_EMAIL_WEBHOOK_URL). Черновата е записана, но не е изпратена.");
    case "SEND_FAILED":
      return fail("Имейлът НЕ е изпратен — n8n не потвърди изпращането. Черновата е записана; опитайте отново.");
    default:
      return fail(UNEXPECTED);
  }
}

export async function updateQuoteAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const quoteId = id(form);
  const status = pick(schema.quoteStatus.enumValues, text(form, "status"));
  if (!quoteId || !status) return fail("Изберете статус от списъка.");
  await getDb()
    .update(quotes)
    .set({ status, notes: text(form, "notes").slice(0, 4000) || null, updatedAt: new Date() })
    .where(eq(quotes.id, quoteId));
  refresh();
  return ok();
}

// ---------------------------------------------------------------------------
// Settings — services and prices
// ---------------------------------------------------------------------------

/** Updates a service, or creates one when the form has no id. */
export async function saveServiceAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const serviceId = id(form);
  const name = text(form, "name");
  const durationMin = wholeNumber(text(form, "durationMin"), 5, 600);
  const labourEur = money(text(form, "labourEur"));
  const fluidSource = pick(schema.serviceFluidSource.enumValues, text(form, "fluidSource"));
  const sortOrder = wholeNumber(text(form, "sortOrder") || "0", 0, 9999);

  if (name.length < 3 || name.length > 120) return fail("Името на услугата трябва да е между 3 и 120 знака.");
  if (durationMin === null) return fail("Времетраенето е в минути, между 5 и 600.");
  if (labourEur === null) return fail("Въведете цена на труда в евро, например 40 или 40,50.");
  if (!fluidSource || sortOrder === null) return fail("Проверете течността и подредбата.");

  const values = { name, durationMin, labourEur, fluidSource, sortOrder, active: form.get("active") === "on", updatedAt: new Date() };
  const db = getDb();
  try {
    if (serviceId) {
      await db.update(services).set(values).where(eq(services.id, serviceId));
    } else {
      const [created] = await db
        .insert(services)
        .values({ ...values, slug: `custom-${Date.now().toString(36)}` })
        .returning({ id: services.id });
      // Every service carries the basic consumables kit by default.
      const [kit] = await db.select({ id: consumables.id }).from(consumables).where(eq(consumables.slug, "basic-consumables"));
      if (kit) await db.insert(schema.serviceConsumables).values({ serviceId: created.id, consumableId: kit.id });
    }
  } catch (error) {
    console.error("[admin] save service failed", error);
    return fail(UNEXPECTED);
  }
  refresh();
  return ok(serviceId ? "Услугата е записана." : "Услугата е добавена.");
}

export async function savePricesAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const db = getDb();
  const fluidUpdates: { fluid: (typeof schema.fluidKind.enumValues)[number]; price: string }[] = [];
  for (const fluid of schema.fluidKind.enumValues) {
    const raw = form.get(`fluid:${fluid}`);
    if (raw === null) continue;
    const price = money(String(raw).trim());
    if (price === null) return fail("Цените са в евро, например 12 или 12,50. Проверете отбелязаните полета.");
    fluidUpdates.push({ fluid, price });
  }
  const consumableUpdates: { id: number; price: string }[] = [];
  for (const [key, raw] of form.entries()) {
    if (!key.startsWith("consumable:")) continue;
    const consumableId = Number(key.slice("consumable:".length));
    const price = money(String(raw).trim());
    if (!Number.isInteger(consumableId) || price === null) return fail("Цените са в евро, например 20 или 20,50.");
    consumableUpdates.push({ id: consumableId, price });
  }

  await db.transaction(async (tx) => {
    for (const f of fluidUpdates) {
      await tx.update(fluidPrices).set({ pricePerLitreEur: f.price, updatedAt: new Date() }).where(eq(fluidPrices.fluid, f.fluid));
    }
    for (const c of consumableUpdates) {
      await tx.update(consumables).set({ priceEur: c.price, updatedAt: new Date() }).where(eq(consumables.id, c.id));
    }
  });
  refresh();
  return ok("Цените са записани. Новите резервации ще се смятат по тях.");
}

// ---------------------------------------------------------------------------
// Settings — opening hours and booking window
// ---------------------------------------------------------------------------

export async function saveHoursAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const days: { weekday: number; closed: boolean; opensAt: string | null; closesAt: string | null }[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const closed = form.get(`closed:${weekday}`) === "on";
    const opensAt = text(form, `opens:${weekday}`);
    const closesAt = text(form, `closes:${weekday}`);
    if (closed) {
      days.push({ weekday, closed: true, opensAt: null, closesAt: null });
      continue;
    }
    if (!isValidTime(opensAt) || !isValidTime(closesAt) || closesAt <= opensAt) {
      return fail("За всеки работен ден въведете начало и край, като краят е след началото.");
    }
    days.push({ weekday, closed: false, opensAt, closesAt });
  }

  const slotMinutes = wholeNumber(text(form, "slotMinutes"), 5, 240);
  const minDays = wholeNumber(text(form, "bookingMinDaysAhead"), 0, 60);
  const maxDays = wholeNumber(text(form, "bookingMaxDaysAhead"), 1, 365);
  if (slotMinutes === null || minDays === null || maxDays === null || maxDays < minDays) {
    return fail("Проверете стъпката на часовете и периода за записване (най-ранният ден не може да е след най-късния).");
  }

  await getDb().transaction(async (tx) => {
    for (const day of days) {
      await tx.update(openingHours).set(day).where(eq(openingHours.weekday, day.weekday));
    }
    await tx
      .update(settings)
      .set({ slotMinutes, bookingMinDaysAhead: minDays, bookingMaxDaysAhead: maxDays, updatedAt: new Date() })
      .where(eq(settings.id, 1));
  });
  refresh();
  return ok("Работното време е записано. Вече записаните часове не се променят.");
}

// ---------------------------------------------------------------------------
// Settings — vehicle table
// ---------------------------------------------------------------------------

const CAPACITY_FIELDS = [
  "engineOilWithFilterL",
  "transmissionL",
  "frontDiffL",
  "rearDiffL",
  "transferCaseL",
  "coolantL",
  "brakeFluidL",
] as const;

/** Updates a vehicle row, or creates one when the form has no id. */
export async function saveVehicleAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const vehicleId = id(form);
  const brand = pick(schema.vehicleBrand.enumValues, text(form, "brand"));
  const fuel = pick(schema.fuelType.enumValues, text(form, "fuel"));
  const transmissionType = pick(schema.transmissionType.enumValues, text(form, "transmissionType"));
  const model = text(form, "model");
  const generation = text(form, "generation");
  const engineCode = text(form, "engineCode");
  const transmission = text(form, "transmission");
  if (!brand || !fuel || !transmissionType || !model || !generation || !engineCode || !transmission) {
    return fail("Попълнете марка, модел, поколение, двигател и скоростна кутия.");
  }

  const yearsFromRaw = text(form, "yearsFrom");
  const yearsToRaw = text(form, "yearsTo");
  const yearsFrom = yearsFromRaw === "" ? null : wholeNumber(yearsFromRaw, 1950, 2100);
  const yearsTo = yearsToRaw === "" ? null : wholeNumber(yearsToRaw, 1950, 2100);
  if ((yearsFromRaw !== "" && yearsFrom === null) || (yearsToRaw !== "" && yearsTo === null) || (yearsFrom && yearsTo && yearsTo < yearsFrom)) {
    return fail("Годините са четирицифрени, а крайната не може да е преди началната.");
  }

  const capacities = {} as Record<(typeof CAPACITY_FIELDS)[number], string | null>;
  for (const field of CAPACITY_FIELDS) {
    const value = litres(text(form, field));
    if (value === false) return fail("Вместимостите са в литри, например 7 или 7,5. Оставете празно, ако не е известна.");
    capacities[field] = value;
  }

  const values = {
    brand,
    model,
    generation,
    yearsFrom,
    yearsTo,
    engineCode,
    fuel,
    transmission,
    transmissionType,
    ...capacities,
    verified: form.get("verified") === "on",
    source: text(form, "source").slice(0, 500) || null,
    updatedAt: new Date(),
  };

  let createdId: number | null = null;
  try {
    if (vehicleId) {
      await getDb().update(vehicles).set(values).where(eq(vehicles.id, vehicleId));
    } else {
      const [created] = await getDb()
        .insert(vehicles)
        .values({ ...values, createdBy: "admin" })
        .returning({ id: vehicles.id });
      createdId = created.id;
    }
  } catch (error) {
    const duplicate = JSON.stringify(error, Object.getOwnPropertyNames(error)).includes("vehicles_combination_unique") ||
      (error as { cause?: { constraint_name?: string } }).cause?.constraint_name === "vehicles_combination_unique";
    if (duplicate) return fail("Вече има ред със същите модел, поколение, двигател, кутия и начална година.");
    console.error("[admin] save vehicle failed", error);
    return fail(UNEXPECTED);
  }

  if (createdId) redirect(`/admin/nastroyki/avtomobili/${createdId}`);
  refresh();
  return ok(values.verified ? "Записано. Редът е отбелязан като проверен." : "Записано.");
}

/** One-click "mark verified" from the vehicle list. */
export async function setVehicleVerifiedAction(_p: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const vehicleId = id(form);
  if (!vehicleId) return fail(UNEXPECTED);
  await getDb()
    .update(vehicles)
    .set({ verified: form.get("verified") === "true", updatedAt: new Date() })
    .where(eq(vehicles.id, vehicleId));
  refresh();
  return ok();
}
