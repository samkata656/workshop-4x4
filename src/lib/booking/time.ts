/**
 * Calendar helpers for the workshop's own time zone.
 *
 * The server may run in UTC, but every opening hour and every slot is defined in
 * Europe/Sofia. Dates travel as "YYYY-MM-DD" strings and times as "HH:MM" strings
 * so they never shift when they cross a time-zone boundary.
 */

export const WORKSHOP_TZ = "Europe/Sofia";

/** How far `tz` is ahead of UTC at the given instant, in milliseconds. */
function offsetMs(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-11-12" + "09:30" in the workshop's zone -> the exact instant. */
export function zonedToUtc(date: string, time: string, tz = WORKSHOP_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wallClock = Date.UTC(y, m - 1, d, h, min);
  // Two passes so the result is right on the days the clocks change.
  const firstGuess = wallClock - offsetMs(wallClock, tz);
  return new Date(wallClock - offsetMs(firstGuess, tz));
}

/** The calendar date ("YYYY-MM-DD") an instant falls on in the workshop's zone. */
export function zonedDate(instant: Date, tz = WORKSHOP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}

/** The wall-clock time ("HH:MM") of an instant in the workshop's zone. */
export function zonedTime(instant: Date, tz = WORKSHOP_TZ): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).format(
    instant,
  );
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** "08:30" or "08:30:00" -> minutes after midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-31). */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
