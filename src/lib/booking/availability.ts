/**
 * Availability — pure functions, no database, no framework.
 * One implementation for the website, the admin calendar and the agent API.
 *
 * A start time is offered only when ALL of these hold:
 *   1. the day is inside the booking window (from tomorrow, up to N days ahead),
 *   2. the workshop is open that day,
 *   3. the start is on the slot grid (every 30 minutes from opening),
 *   4. start + total duration is at or before closing time the same day,
 *   5. at least one bay has nothing overlapping that whole interval.
 */
import { addDays, fromMinutes, isoWeekday, toMinutes, zonedDate, zonedToUtc } from "./time";

export type DayHours = { weekday: number; closed: boolean; opensAt: string | null; closesAt: string | null };

export type BookingRules = {
  timezone: string;
  slotMinutes: number;
  bookingMinDaysAhead: number;
  bookingMaxDaysAhead: number;
};

/** An existing, non-cancelled booking. */
export type BusyInterval = { bayId: number; startsAt: Date; endsAt: Date };

export type Slot = {
  time: string; // "09:30" workshop local time
  startsAt: Date;
  endsAt: Date;
  /** Free bays for the whole job, lowest number first. */
  freeBayIds: number[];
};

export type BookableDay = { date: string; weekday: number; open: boolean };

/** First and last calendar date a customer may book, in the workshop's zone. */
export function bookingWindow(now: Date, rules: BookingRules) {
  const today = zonedDate(now, rules.timezone);
  return { from: addDays(today, rules.bookingMinDaysAhead), to: addDays(today, rules.bookingMaxDaysAhead) };
}

/** Every day in the booking window, flagged open or closed — feeds the day picker. */
export function listBookableDays(now: Date, rules: BookingRules, hours: DayHours[]): BookableDay[] {
  const { from, to } = bookingWindow(now, rules);
  const days: BookableDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = isoWeekday(date);
    const day = hours.find((h) => h.weekday === weekday);
    days.push({ date, weekday, open: Boolean(day && !day.closed && day.opensAt && day.closesAt) });
  }
  return days;
}

/** Bays with nothing overlapping [startsAt, endsAt). Touching ends do not overlap. */
export function freeBays(bayIds: number[], busy: BusyInterval[], startsAt: Date, endsAt: Date): number[] {
  return [...bayIds]
    .sort((a, b) => a - b)
    .filter((bayId) => !busy.some((b) => b.bayId === bayId && b.startsAt < endsAt && b.endsAt > startsAt));
}

export function computeSlots(input: {
  date: string;
  durationMin: number;
  hours: DayHours[];
  rules: BookingRules;
  bayIds: number[];
  busy: BusyInterval[];
  now: Date;
}): Slot[] {
  const { date, durationMin, hours, rules, bayIds, busy, now } = input;
  if (durationMin <= 0 || rules.slotMinutes <= 0) return [];

  const window = bookingWindow(now, rules);
  if (date < window.from || date > window.to) return [];

  const day = hours.find((h) => h.weekday === isoWeekday(date));
  if (!day || day.closed || !day.opensAt || !day.closesAt) return [];

  const opens = toMinutes(day.opensAt);
  const closes = toMinutes(day.closesAt);
  const slots: Slot[] = [];

  // The job must finish at or before closing, so the last start is closes - duration.
  for (let start = opens; start + durationMin <= closes; start += rules.slotMinutes) {
    const time = fromMinutes(start);
    const startsAt = zonedToUtc(date, time, rules.timezone);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    const free = freeBays(bayIds, busy, startsAt, endsAt);
    if (free.length > 0) slots.push({ time, startsAt, endsAt, freeBayIds: free });
  }
  return slots;
}
