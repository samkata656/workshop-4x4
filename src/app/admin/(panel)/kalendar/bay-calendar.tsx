"use client";

import { format, getDay, parse, startOfWeek } from "date-fns";
import { bg } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { ActionForm, SubmitButton, type FormState } from "@/components/admin/action-form";
import { moveBookingAction, saveBookingNotesAction, setBookingStatusAction } from "@/lib/admin/actions";
import { BOOKING_SOURCE, BOOKING_STATUS } from "@/lib/admin/labels";
import type { CalendarBooking } from "@/lib/admin/queries";
import { formatDateLong, formatEur } from "@/lib/format";

type Bay = { id: number; name: string };
type Hours = { weekday: number; closed: boolean; opensAt: string | null; closesAt: string | null };
type CalendarEvent = { id: number; title: string; start: Date; end: Date; resourceId: number; booking: CalendarBooking };

const localizer = dateFnsLocalizer({
  format,
  parse,
  getDay,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  locales: { bg },
});
const DnDCalendar = withDragAndDrop<CalendarEvent, Bay>(Calendar);

/**
 * Bookings arrive as workshop wall-clock strings ("2026-11-12", "09:00").
 * We turn them into browser-local Dates with the same wall-clock numbers, so the
 * grid shows workshop time even if the owner's laptop is set to another zone.
 */
const toLocal = (date: string, time: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
};
const toDateString = (d: Date) => format(d, "yyyy-MM-dd");
const toTimeString = (d: Date) => format(d, "HH:mm");
const MOVABLE = ["booked", "in_progress"];

export function BayCalendar(props: { date: string; view: "day" | "week"; bays: Bay[]; hours: Hours[]; bookings: CalendarBooking[] }) {
  const { date, view, bays, hours, bookings } = props;
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();

  const events = useMemo<CalendarEvent[]>(
    () =>
      bookings.map((b) => ({
        id: b.id,
        title: `${b.customerName} · ${b.vehicle.split(" · ")[0]}`,
        start: toLocal(b.date, b.start),
        end: toLocal(b.date, b.end),
        resourceId: b.bayId,
        booking: b,
      })),
    [bookings],
  );
  const selected = bookings.find((b) => b.id === selectedId) ?? null;

  // Visible hours: from the earliest opening to the latest closing of the week.
  const open = hours.filter((h) => !h.closed && h.opensAt && h.closesAt);
  const firstHour = Math.min(8, ...open.map((h) => Number(h.opensAt!.slice(0, 2))));
  const lastHour = Math.max(18, ...open.map((h) => Math.ceil(Number(h.closesAt!.slice(0, 2)) + Number(h.closesAt!.slice(3, 5)) / 60)));
  const current = toLocal(date, "12:00");

  const go = (nextDate: string, nextView = view) => {
    setSelectedId(null);
    router.push(`/admin/kalendar?date=${nextDate}&view=${nextView}`);
  };
  const shift = (direction: 1 | -1) => {
    const next = new Date(current);
    next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1));
    go(toDateString(next));
  };

  function run(action: () => Promise<FormState>) {
    setFeedback(null);
    startTransition(async () => setFeedback(await action()));
  }

  function onEventDrop({ event, start, resourceId }: EventInteractionArgs<CalendarEvent>) {
    const begin = new Date(start);
    const bayId = typeof resourceId === "number" ? resourceId : event.resourceId;
    run(() => moveBookingAction({ id: event.id, date: toDateString(begin), time: toTimeString(begin), bayId }));
  }

  const weekStart = startOfWeek(current, { weekStartsOn: 1 });
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const heading =
    view === "day"
      ? formatDateLong(date)
      : `${format(weekStart, "d MMM", { locale: bg })} – ${format(weekEnd, "d MMM yyyy", { locale: bg })}`;

  return (
    <div className="mt-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" className="chip min-h-10 px-3" onClick={() => shift(-1)} aria-label={view === "week" ? "Предишна седмица" : "Предишен ден"}>
            ←
          </button>
          <button type="button" className="chip min-h-10" onClick={() => go(toDateString(new Date()))}>
            Днес
          </button>
          <button type="button" className="chip min-h-10 px-3" onClick={() => shift(1)} aria-label={view === "week" ? "Следваща седмица" : "Следващ ден"}>
            →
          </button>
          <label className="sr-only" htmlFor="calendar-date">
            Отиди на дата
          </label>
          <input id="calendar-date" type="date" className="input min-h-10 w-auto" value={date} onChange={(e) => e.target.value && go(e.target.value)} />
        </div>
        <div className="flex gap-2" role="group" aria-label="Изглед">
          <button type="button" className="chip min-h-10" aria-pressed={view === "day"} onClick={() => go(date, "day")}>
            Ден
          </button>
          <button type="button" className="chip min-h-10" aria-pressed={view === "week"} onClick={() => go(date, "week")}>
            Седмица
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-3xl">{heading}</h2>
        <p className="font-mono text-xs text-muted" aria-live="polite">
          {pending ? "Записваме…" : `${bookings.length} ${bookings.length === 1 ? "час" : "часа"} · влачете, за да преместите`}
        </p>
      </div>

      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`mt-3 border-l-2 px-3 py-2 text-sm ${feedback.ok ? "border-sand text-sand" : "border-rust bg-olive/40"}`}
        >
          {feedback.message}
        </p>
      )}

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="bay-calendar overflow-x-auto">
          {/* Week view shows 7 days x bays, so it needs room and scrolls sideways on small screens. */}
          <div style={{ minWidth: view === "week" ? Math.max(1100, bays.length * 7 * 44) : bays.length * 84, height: "max(34rem, 70vh)" }}>
            <DnDCalendar
              localizer={localizer}
              culture="bg"
              events={events}
              date={current}
              view={view as View}
              views={["day", "week"]}
              onNavigate={(next) => go(toDateString(next))}
              onView={(next) => go(date, next === "week" ? "week" : "day")}
              toolbar={false}
              resources={bays}
              resourceIdAccessor="id"
              resourceTitleAccessor="name"
              resourceAccessor="resourceId"
              resourceGroupingLayout
              step={30}
              timeslots={2}
              min={new Date(1970, 0, 1, firstHour, 0)}
              max={new Date(1970, 0, 1, lastHour, 0)}
              scrollToTime={new Date(1970, 0, 1, firstHour, 0)}
              formats={{
                timeGutterFormat: "HH:mm",
                eventTimeRangeFormat: ({ start, end }) => `${format(start, "HH:mm")}–${format(end, "HH:mm")}`,
                dayFormat: (d) => format(d, "EEEEEE d.MM", { locale: bg }),
              }}
              selected={events.find((e) => e.id === selectedId)}
              onSelectEvent={(event) => {
                setSelectedId(event.id);
                setFeedback(null);
              }}
              onEventDrop={onEventDrop}
              resizable={false}
              draggableAccessor={(event) => MOVABLE.includes(event.booking.status)}
              eventPropGetter={(event) => ({ className: `status-${event.booking.status}` })}
              tooltipAccessor={(event) => `${event.booking.customerName} · ${event.booking.services.map((s) => s.name).join(", ")}`}
            />
          </div>
        </div>

        <aside aria-label="Избран час">
          {selected ? (
            <BookingPanel key={selected.id} booking={selected} bays={bays} pending={pending} run={run} />
          ) : (
            <p className="border border-line px-5 py-8 text-sm text-sand">
              Натиснете час в календара, за да видите клиента, услугите и цената, да смените статуса или да го преместите.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function BookingPanel(props: { booking: CalendarBooking; bays: Bay[]; pending: boolean; run: (action: () => Promise<FormState>) => void }) {
  const { booking, bays, pending, run } = props;
  const [moveDate, setMoveDate] = useState(booking.date);
  const [moveTime, setMoveTime] = useState(booking.start);
  const [moveBay, setMoveBay] = useState(booking.bayId);
  const times = useMemo(() => {
    const list: string[] = [];
    for (let m = 6 * 60; m <= 21 * 60; m += 30) list.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    return list.includes(booking.start) ? list : [...list, booking.start].sort();
  }, [booking.start]);

  return (
    <div className="border border-line-strong bg-carbon-raised">
      <header className="border-b border-line px-5 py-4">
        <p className="label">
          {bays.find((b) => b.id === booking.bayId)?.name} · {booking.start}–{booking.end}
        </p>
        <h3 className="display mt-2 text-4xl">{booking.customerName}</h3>
        <p className="mt-2 text-sm">
          <a href={`tel:${booking.customerPhone}`} className="font-mono underline underline-offset-4 hover:text-rust-bright">
            {booking.customerPhone}
          </a>
          {booking.customerEmail && (
            <>
              {" · "}
              <a href={`mailto:${booking.customerEmail}`} className="underline underline-offset-4 hover:text-rust-bright">
                {booking.customerEmail}
              </a>
            </>
          )}
        </p>
        <Link href={`/admin/klienti/${booking.customerId}`} className="label mt-3 inline-block underline underline-offset-4 hover:text-paper">
          Картон на клиента →
        </Link>
      </header>

      <dl className="border-b border-line px-5 py-4 text-sm">
        <dt className="label">Автомобил</dt>
        <dd className="mt-1.5">{booking.vehicle}</dd>
        <dt className="label mt-4">Услуги</dt>
        <dd className="mt-1.5 space-y-1">
          {booking.services.map((s) => (
            <div key={s.name} className="flex justify-between gap-3">
              <span>{s.name}</span>
              <span className="shrink-0 font-mono text-sand">{s.priceEur === null ? "след оглед" : formatEur(s.priceEur)}</span>
            </div>
          ))}
        </dd>
        <div className="mt-3 flex justify-between border-t border-line pt-3">
          <dt className="label pt-1">Общо</dt>
          <dd className="font-mono">{booking.priceTotalEur === null ? "след оглед" : formatEur(booking.priceTotalEur)}</dd>
        </div>
        <p className="mt-3 font-mono text-xs text-muted">Записан през: {BOOKING_SOURCE[booking.source]}</p>
      </dl>

      <div className="border-b border-line px-5 py-4">
        <p className="label" id="status-label">
          Статус
        </p>
        <div role="group" aria-labelledby="status-label" className="mt-3 grid grid-cols-2 gap-2">
          {Object.entries(BOOKING_STATUS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="chip min-h-10 text-xs"
              aria-pressed={booking.status === value}
              disabled={pending || booking.status === value}
              onClick={() => run(() => setBookingStatusAction(booking.id, value))}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">„Отказан“ освобождава бокса и скрива часа от календара.</p>
      </div>

      <form
        className="grid grid-cols-2 gap-3 border-b border-line px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => moveBookingAction({ id: booking.id, date: moveDate, time: moveTime, bayId: moveBay }));
        }}
      >
        <p className="label col-span-2">Премести</p>
        <label className="col-span-2 block">
          <span className="field-label">Дата</span>
          <input type="date" className="input" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} required />
        </label>
        <label className="block">
          <span className="field-label">Начало</span>
          <select className="input" value={moveTime} onChange={(e) => setMoveTime(e.target.value)}>
            {times.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Бокс</span>
          <select className="input" value={moveBay} onChange={(e) => setMoveBay(Number(e.target.value))}>
            {bays.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-ghost col-span-2 min-h-10 justify-center" disabled={pending}>
          Премести часа
        </button>
      </form>

      <ActionForm action={saveBookingNotesAction} className="px-5 py-4">
        <input type="hidden" name="id" value={booking.id} />
        <label htmlFor="booking-notes" className="field-label">
          Бележки
        </label>
        <textarea id="booking-notes" name="notes" defaultValue={booking.notes ?? ""} className="input min-h-24 py-2" maxLength={4000} />
        <div className="mt-3">
          <SubmitButton className="btn btn-ghost min-h-10 px-4">Запиши бележката</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
