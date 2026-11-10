import { formatDateLong } from "@/lib/format";
import { zonedDate, zonedTime } from "@/lib/booking/time";

export function PageHeader(props: { index: string; section: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="label">
          <span className="label-accent">{props.index}</span> / {props.section}
        </p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">{props.title}</h1>
      </div>
      {props.children}
    </header>
  );
}

export function SectionTitle({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <h2 className="label flex items-center gap-3 border-b border-line-strong pb-3">
      <span className="label-accent">{index}</span> {children}
    </h2>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="border border-line px-5 py-8 text-sm text-sand">{children}</p>;
}

/** "четвъртък, 12 ноември · 09:00 – 11:15" in workshop time. */
export function When({ startsAt, endsAt }: { startsAt: Date; endsAt?: Date }) {
  return (
    <>
      {formatDateLong(zonedDate(startsAt))} · {zonedTime(startsAt)}
      {endsAt && ` – ${zonedTime(endsAt)}`}
    </>
  );
}

/** "10.11.2026" in workshop time. */
export function shortDate(instant: Date) {
  const [y, m, d] = zonedDate(instant).split("-");
  return `${d}.${m}.${y}`;
}

export const tableHead = "label whitespace-nowrap px-3 py-3 text-left font-normal";
