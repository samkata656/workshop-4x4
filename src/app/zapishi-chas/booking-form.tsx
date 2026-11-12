"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import type { BookableDay } from "@/lib/booking/availability";
import {
  priceBooking,
  type FluidPrice,
  type PriceBreakdown,
  type PricingService,
  type PricingVehicle,
  type ServiceConsumable,
} from "@/lib/booking/pricing";
import { formatCents, formatDateLong, formatDayParts, formatDuration, formatLitresNumber } from "@/lib/format";
import { ConsentCheckbox, Select, Step, TextField } from "@/components/form-fields";
import { EMPTY_PICK, VehiclePicker, type PickerVehicle, type VehiclePick } from "@/components/vehicle-picker";
import { fetchSlotsAction, lookupNonStockAction, submitBookingAction, submitQuoteAction, type SubmitResult } from "./actions";

export type VehicleOption = PricingVehicle & PickerVehicle;

type Props = {
  vehicles: VehicleOption[];
  services: PricingService[];
  fluidPrices: FluidPrice[];
  consumables: ServiceConsumable[];
  days: BookableDay[];
};

type Errors = Partial<Record<"vehicle" | "services" | "slot" | "name" | "phone" | "email" | "consent", string>>;
const STALE_PAGE = "Страницата е обновена или връзката прекъсна. Презаредете я и опитайте отново.";

type SlotState = { status: "idle" | "loading" | "ready"; times: string[] };
/** "Не е стоков джип?": what the picker cannot know about a swapped drivetrain, and the lookup's state. */
type Swap = { fuel: string; transmissionType: string };
type LookupState = { status: "idle" | "loading" | "done" | "error"; message?: string; fields?: { engine?: string; transmission?: string } };

export function BookingForm({ vehicles, services, fluidPrices, consumables, days }: Props) {
  // --- 1. vehicle ----------------------------------------------------------
  const [pick, setPick] = useState<VehiclePick>(EMPTY_PICK);
  const [swap, setSwap] = useState<Swap>({ fuel: "", transmissionType: "" });
  const [lookedUp, setLookedUp] = useState<VehicleOption | null>(null);
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const lookupRequest = useRef(0);
  // A swapped drivetrain has no catalogue row: the vehicle is the one the lookup saved.
  const vehicle = pick.nonStock ? lookedUp : (vehicles.find((v) => v.id === pick.vehicleId) ?? null);
  const vehicleId = vehicle?.id ?? null;
  const canLookUp =
    Boolean(pick.brand && pick.model && pick.generation && swap.fuel && swap.transmissionType) &&
    pick.customEngine.trim().length >= 2 &&
    pick.customTransmission.trim().length >= 2;

  /** Any change to the described car makes an earlier lookup stale. */
  function forgetLookup() {
    lookupRequest.current++;
    setLookedUp(null);
    setLookup({ status: "idle" });
  }

  async function runLookup() {
    const request = ++lookupRequest.current;
    setLookedUp(null);
    setLookup({ status: "loading" });
    // The call itself fails when the site was updated while this page was open, or the network dropped.
    const response = await lookupNonStockAction({
      brand: pick.brand,
      model: pick.model,
      generation: pick.generation,
      engine: pick.customEngine,
      transmission: pick.customTransmission,
      ...swap,
    }).catch(() => ({ ok: false as const, message: STALE_PAGE, fieldErrors: undefined }));
    if (request !== lookupRequest.current) return; // the customer changed the car meanwhile
    if (!response.ok) {
      setLookup({ status: "error", message: response.message, fields: response.fieldErrors });
      return;
    }
    setLookedUp(response.vehicle);
    setErrors((e) => ({ ...e, vehicle: undefined }));
    setLookup({
      status: "done",
      message: response.capacitiesFound
        ? "Намерихме ориентировъчни количества течности. Ще ги потвърдим в сервиза, преди да започнем работа."
        : "Не намерихме количествата за тази комбинация. Можете да запишете час — цената на течностите ще определим след оглед.",
    });
  }

  // --- 2. services ---------------------------------------------------------
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const chosen = useMemo(() => services.filter((s) => serviceIds.includes(s.id)), [services, serviceIds]);
  const price = useMemo(
    () => (vehicle && chosen.length > 0 ? priceBooking(vehicle, chosen, fluidPrices, consumables) : null),
    [vehicle, chosen, fluidPrices, consumables],
  );
  const totalDuration = chosen.reduce((sum, s) => sum + s.durationMin, 0);

  // --- 3. day and time -----------------------------------------------------
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotState>({ status: "idle", times: [] });
  const slotRequest = useRef(0);

  async function loadSlots(ids: number[], day: string | null) {
    setTime(null);
    const request = ++slotRequest.current;
    if (!day || ids.length === 0) {
      setSlots({ status: "idle", times: [] });
      return;
    }
    setSlots({ status: "loading", times: [] });
    const times = await fetchSlotsAction(ids, day);
    if (request === slotRequest.current) setSlots({ status: "ready", times }); // ignore stale answers
  }

  function toggleService(id: number) {
    const next = serviceIds.includes(id) ? serviceIds.filter((s) => s !== id) : [...serviceIds, id];
    setServiceIds(next);
    setErrors((e) => ({ ...e, services: undefined, slot: undefined }));
    void loadSlots(next, date);
  }

  function pickDate(day: string) {
    setDate(day);
    setErrors((e) => ({ ...e, slot: undefined }));
    void loadSlots(serviceIds, day);
  }

  // --- 4. contact ----------------------------------------------------------
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);

  // --- submit --------------------------------------------------------------
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<SubmitResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<"booking" | "quote" | null>(null);

  function validate(kind: "booking" | "quote"): Errors {
    const found: Errors = {};
    if (!vehicle) {
      found.vehicle = pick.nonStock
        ? "Опишете двигателя и кутията и натиснете „Намери количествата“, за да изчислим цената."
        : "Изберете автомобила до скоростна кутия, за да изчислим цената.";
    }
    if (serviceIds.length === 0) found.services = "Изберете поне една услуга.";
    if (kind === "booking" && (!date || !time)) found.slot = "Изберете ден и начален час.";
    if (name.trim().length < 2) found.name = "Въведете име, за да знаем към кого да се обърнем.";
    if (phone.replace(/\D/g, "").length < 8) found.phone = "Въведете телефон във формат 0888 123 456.";
    if (!consent) found.consent = "Отбележете съгласието, за да обработим заявката.";
    return found;
  }

  function submit(kind: "booking" | "quote") {
    const found = validate(kind);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMessage("Остават няколко неща за попълване — отбелязани са по-горе.");
      return;
    }
    setMessage(null);
    setPendingKind(kind);
    startTransition(async () => {
      const payload = { vehicleId, serviceIds, date, time, contact: { name, phone, email, consent } };
      const response = await (kind === "booking" ? submitBookingAction(payload) : submitQuoteAction(payload)).catch(
        (): SubmitResult => ({ ok: false, message: STALE_PAGE }),
      );
      if (response.ok) {
        setResult(response);
        window.scrollTo({ top: 0 });
        return;
      }
      setMessage(response.message);
      if (response.fieldErrors) setErrors((e) => ({ ...e, ...response.fieldErrors }));
      if (response.slotGone) void loadSlots(serviceIds, date);
    });
  }

  if (result) {
    return <Confirmation result={result} vehicle={vehicle} chosen={chosen} />;
  }

  const summary = <PriceSummary vehicle={vehicle} price={price} date={date} time={time} />;

  return (
    <form
      noValidate
      className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16"
      onSubmit={(event) => {
        event.preventDefault();
        submit("booking");
      }}
    >
      <div className="min-w-0 space-y-14">
        {/* 1 — vehicle */}
        <Step index="01" title="Автомобил" error={errors.vehicle}>
          <VehiclePicker
            vehicles={vehicles}
            value={pick}
            allowNonStock
            errors={lookup.fields}
            onChange={(next) => {
              setPick(next);
              setErrors((e) => ({ ...e, vehicle: undefined }));
              if (next.nonStock || pick.nonStock) forgetLookup();
            }}
          />
          {pick.nonStock && (
            <div className="mt-6 border border-line p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Гориво"
                  value={swap.fuel}
                  options={[
                    { value: "petrol", label: "Бензин" },
                    { value: "diesel", label: "Дизел" },
                  ]}
                  onChange={(fuel) => {
                    setSwap((s) => ({ ...s, fuel }));
                    forgetLookup();
                  }}
                />
                <Select
                  label="Вид на кутията"
                  value={swap.transmissionType}
                  options={[
                    { value: "automatic", label: "Автоматична" },
                    { value: "manual", label: "Ръчна" },
                  ]}
                  onChange={(transmissionType) => {
                    setSwap((s) => ({ ...s, transmissionType }));
                    forgetLookup();
                  }}
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost mt-5 justify-center"
                disabled={!canLookUp || lookup.status === "loading"}
                onClick={() => void runLookup()}
              >
                {lookup.status === "loading" ? "Търсим количествата…" : "Намери количествата"}
              </button>
              <p aria-live="polite" className={`mt-3 text-sm ${lookup.status === "error" ? "text-rust-bright" : "text-sand"}`}>
                {lookup.status === "loading"
                  ? "Търсим количествата на течностите за този двигател и кутия. Отнема до една минута."
                  : (lookup.message ?? "Попълнете полетата и натиснете бутона, за да изчислим ориентировъчна цена.")}
              </p>
            </div>
          )}
        </Step>

        {/* 2 — services */}
        <Step index="02" title="Услуги" error={errors.services}>
          <ul className="border-t border-line-strong">
            {services.map((service) => {
              const checked = serviceIds.includes(service.id);
              const priced = price?.services.find((s) => s.serviceId === service.id);
              return (
                <li key={service.id} className="border-b border-line">
                  <label className={`row-mech flex cursor-pointer items-center gap-4 px-3 py-4 ${checked ? "bg-olive/40" : ""}`}>
                    <input type="checkbox" className="check" checked={checked} onChange={() => toggleService(service.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug">{service.name}</span>
                      <span className="mt-1 block font-mono text-xs text-muted">{formatDuration(service.durationMin)}</span>
                    </span>
                    {priced && (
                      <span className="shrink-0 text-right font-mono text-sm">
                        {priced.totalCents === null ? "след оглед" : formatCents(priced.totalCents)}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </Step>

        <div className="lg:hidden">{summary}</div>

        {/* 3 — day and time */}
        <Step index="03" title="Ден и час" error={errors.slot}>
          <p className="field-label" id="day-label">
            Ден
          </p>
          <div role="group" aria-labelledby="day-label" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
            {days.map((day) => {
              const parts = formatDayParts(day.date);
              return (
                <button
                  key={day.date}
                  type="button"
                  className="chip w-16 shrink-0 px-1"
                  disabled={!day.open}
                  aria-pressed={date === day.date}
                  aria-label={formatDateLong(day.date) + (day.open ? "" : " — почивен ден")}
                  onClick={() => pickDate(day.date)}
                >
                  <span className="block text-[0.625rem] uppercase tracking-widest opacity-80">{parts.weekday}</span>
                  <span className="display block text-3xl leading-none">{parts.day}</span>
                  <span className="block text-[0.625rem] uppercase tracking-widest opacity-80">{parts.month}</span>
                </button>
              );
            })}
          </div>

          <p className="field-label mt-8" id="time-label">
            Начален час{totalDuration > 0 && ` · работата отнема ${formatDuration(totalDuration)}`}
          </p>
          <div aria-live="polite">
            {serviceIds.length === 0 ? (
              <p className="text-sm text-muted">Изберете услуги, за да видите свободните часове.</p>
            ) : !date ? (
              <p className="text-sm text-muted">Изберете ден, за да видите свободните часове.</p>
            ) : slots.status === "loading" ? (
              <div className="skeleton h-12" aria-label="Зареждане на свободните часове" />
            ) : slots.times.length === 0 ? (
              <p className="border border-line p-4 text-sm text-sand">
                Няма свободен час за {formatDuration(totalDuration)} на {formatDateLong(date)}. Изберете друг ден.
              </p>
            ) : (
              <div role="group" aria-labelledby="time-label" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.times.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className="chip"
                    aria-pressed={time === slot}
                    onClick={() => {
                      setTime(slot);
                      setErrors((e) => ({ ...e, slot: undefined }));
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Step>

        {/* 4 — contact */}
        <Step index="04" title="Контакт">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Име"
              autoComplete="name"
              value={name}
              error={errors.name}
              onChange={(value) => {
                setName(value);
                setErrors((e) => ({ ...e, name: undefined }));
              }}
            />
            <TextField
              label="Телефон"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              hint="0888 123 456"
              value={phone}
              error={errors.phone}
              onChange={(value) => {
                setPhone(value);
                setErrors((e) => ({ ...e, phone: undefined }));
              }}
            />
            <div className="sm:col-span-2">
              <TextField
                label="Имейл (по желание)"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                error={errors.email}
                onChange={(value) => {
                  setEmail(value);
                  setErrors((e) => ({ ...e, email: undefined }));
                }}
              />
            </div>
          </div>

          <ConsentCheckbox
            checked={consent}
            error={errors.consent}
            onChange={(checked) => {
              setConsent(checked);
              setErrors((e) => ({ ...e, consent: undefined }));
            }}
          />
        </Step>

        <div className="border-t border-line-strong pt-8">
          {message && (
            <p role="alert" className="mb-6 border-l-2 border-rust bg-olive/40 px-4 py-3 text-sm">
              {message}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="submit" className="btn justify-center" disabled={pending}>
              {pending && pendingKind === "booking" ? "Записваме часа…" : "Запиши часа"}
              <span aria-hidden className="arrow">
                →
              </span>
            </button>
            <button type="button" className="btn btn-ghost justify-center" disabled={pending} onClick={() => submit("quote")}>
              {pending && pendingKind === "quote" ? "Изпращаме…" : "Поискай оферта без записване на час"}
            </button>
          </div>
          <p className="mt-4 text-sm text-muted">Офертата не запазва час и не заема бокс. Плащате в сервиза.</p>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24">{summary}</div>
      </aside>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function PriceSummary(props: { vehicle: VehicleOption | null; price: PriceBreakdown | null; date: string | null; time: string | null }) {
  const { vehicle, price, date, time } = props;
  return (
    <section aria-label="Цена" className="border border-line-strong bg-carbon-raised">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="label">Разбивка на цената</h2>
        <span className="label">EUR с ДДС</span>
      </header>

      {!price ? (
        <p className="px-5 py-8 text-sm text-muted">
          {vehicle ? "Изберете услуги, за да видите цената." : "Изберете автомобил и услуги, за да видите цената."}
        </p>
      ) : (
        <>
          <ul>
            {price.services.map((service) => (
              <li key={service.serviceId} className="border-b border-line px-5 py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-semibold leading-snug">{service.name}</h3>
                  <span className="shrink-0 font-mono text-sm">
                    {service.totalCents === null ? "цена след оглед" : formatCents(service.totalCents)}
                  </span>
                </div>
                <dl className="mt-3 space-y-1.5 text-sm text-sand">
                  {service.lines.map((line, i) => (
                    <div key={i} className="flex justify-between gap-4">
                      <dt>
                        {line.label}
                        {line.kind === "fluid" && (
                          <span className="text-muted">
                            {" "}
                            · {formatLitresNumber(line.litres)} л × {formatCents(line.perLitreCents)}
                          </span>
                        )}
                      </dt>
                      <dd className="shrink-0 font-mono">{formatCents(line.cents)}</dd>
                    </div>
                  ))}
                  {service.totalCents === null && (
                    <div className="flex justify-between gap-4">
                      <dt>Течности</dt>
                      <dd className="shrink-0 font-mono text-muted">след оглед</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>

          <div className="flex items-end justify-between gap-4 px-5 py-5">
            <div>
              <p className="label">Общо</p>
              <p className="mt-2 font-mono text-xs text-muted">{formatDuration(price.totalDurationMin)} в сервиза</p>
            </div>
            <p className="display text-6xl text-rust-bright">
              {price.totalCents === null && price.knownTotalCents > 0 && <span className="mr-2 text-2xl text-sand">от</span>}
              {formatCents(price.knownTotalCents)}
            </p>
          </div>

          {(price.totalCents === null || price.approximateFluids) && (
            <div className="space-y-2 border-t border-line px-5 py-4 text-sm text-sand">
              {price.totalCents === null && (
                <p>За част от услугите цената се определя след оглед — количеството течности за този автомобил още не е въведено.</p>
              )}
              {price.approximateFluids && <p>Количеството течности е ориентировъчно и се потвърждава в сервиза.</p>}
            </div>
          )}
        </>
      )}

      {date && time && (
        <p className="border-t border-line px-5 py-4 font-mono text-sm">
          {formatDateLong(date)} · {time}
        </p>
      )}
    </section>
  );
}

function Confirmation(props: {
  result: Extract<SubmitResult, { ok: true }>;
  vehicle: VehicleOption | null;
  chosen: PricingService[];
}) {
  const { result, vehicle, chosen } = props;
  const isBooking = result.kind === "booking";
  const priceText =
    result.totalCents !== null
      ? formatCents(result.totalCents)
      : result.knownTotalCents > 0
        ? `от ${formatCents(result.knownTotalCents)} + услуги след оглед`
        : "цена след оглед";

  return (
    <section className="mt-12 max-w-3xl border border-line-strong bg-carbon-raised" aria-live="polite">
      <div className="hatch h-2" aria-hidden />
      <div className="p-6 sm:p-10">
        <p className="label label-accent">{isBooking ? "Потвърдено" : "Получено"}</p>
        <h2 className="display mt-4 text-6xl sm:text-7xl" tabIndex={-1} ref={(el) => el?.focus()}>
          {isBooking ? "Часът е записан." : "Запитването е получено."}
        </h2>

        <dl className="mt-8 divide-y divide-line border-y border-line">
          {result.kind === "booking" && (
            <Row term="Кога">
              {formatDateLong(result.date)}, {result.time} – {result.endTime}
            </Row>
          )}
          {vehicle && (
            <Row term="Автомобил">
              {vehicle.brand} {vehicle.model} {vehicle.generation} · {vehicle.engineCode} · {vehicle.transmission}
            </Row>
          )}
          <Row term="Услуги">{chosen.map((s) => s.name).join(", ")}</Row>
          <Row term={isBooking ? "Цена" : "Ориентировъчна цена"}>{priceText}</Row>
        </dl>

        {result.kind === "booking" ? (
          <>
            <p className="mt-8 text-sand">
              Ако плановете ви се променят, откажете часа от този линк — без обаждане и без вход. Запазете го.
            </p>
            <Link href={result.cancelPath} className="mt-3 block break-all font-mono text-sm underline underline-offset-4 hover:text-rust-bright">
              {typeof window === "undefined" ? result.cancelPath : window.location.origin + result.cancelPath}
            </Link>
          </>
        ) : (
          <p className="mt-8 text-sand">Не сме запазили час. Ще се свържем с вас по телефона с оферта.</p>
        )}

        <Link href="/" className="btn btn-ghost mt-10">
          Към началото
        </Link>
      </div>
    </section>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]">
      <dt className="label pt-1">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}
