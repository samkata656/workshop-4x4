const eurFormat = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** "40 €" — prices are stored with VAT included. */
export function formatEur(value: string | number) {
  return eurFormat.format(Number(value));
}

/** "9,2" or "—" when the capacity is unknown. */
export function formatLitres(value: string | null) {
  if (value === null) return "—";
  return Number(value).toLocaleString("bg-BG", { maximumFractionDigits: 2 });
}

/** "1 ч 15 мин" */
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/** Postgres time "08:30:00" -> "08:30" */
export function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

/** Index 0 = Monday (ISO weekday 1). */
export const WEEKDAYS_BG = ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Integer euro cents -> "149 €" / "149,50 €". */
export function formatCents(cents: number) {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** 7 -> "7", 2.5 -> "2,5" */
export function formatLitresNumber(litres: number) {
  return litres.toLocaleString("bg-BG", { maximumFractionDigits: 2 });
}

/** "2026-11-12" -> "четвъртък, 12 ноември" (the string is already a workshop-local date). */
export function formatDateLong(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("bg-BG", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Parts for the day picker: "чт", "12", "ное". */
export function formatDayParts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("bg-BG", { timeZone: "UTC", ...options }).format(utc);
  return { weekday: part({ weekday: "short" }), day: String(d), month: part({ month: "short" }) };
}
