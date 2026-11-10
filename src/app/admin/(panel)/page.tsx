import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, SectionTitle } from "@/components/admin/ui";
import { BOOKING_STATUS } from "@/lib/admin/labels";
import { requireAdmin } from "@/lib/admin/session";
import { isoWeekday, zonedDate, zonedTime } from "@/lib/booking/time";
import { formatDateLong, formatTime } from "@/lib/format";
import { getAdminCounts, listBays, listOpeningHours, listTodaysBookings } from "@/lib/queries";

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader index="CMD" section="Преглед" title="Команден център" />
      <Suspense fallback={<div className="skeleton mt-10 h-28" />}>
        <Counters />
      </Suspense>
      <section className="mt-12">
        <SectionTitle index="01">Днес по боксове</SectionTitle>
        <Suspense fallback={<div className="skeleton mt-5 h-56" />}>
          <BayBoard />
        </Suspense>
      </section>
    </>
  );
}

async function Counters() {
  await requireAdmin();
  const c = await getAdminCounts();
  const tiles = [
    { label: "Нови заявки", value: c.newRequests, warn: c.newRequests > 0, href: "/admin/zayavki?status=new" },
    { label: "Нови оферти", value: c.newQuotes, warn: c.newQuotes > 0, href: "/admin/oferti" },
    { label: "Активни услуги", value: c.activeServices, warn: false, href: "/admin/nastroyki" },
    { label: "Автомобили", value: c.vehicles, warn: false, href: "/admin/nastroyki/avtomobili" },
    { label: "За проверка", value: c.unverifiedVehicles, warn: c.unverifiedVehicles > 0, href: "/admin/nastroyki/avtomobili?only=unverified" },
  ];
  return (
    <ul className="mt-10 grid grid-cols-2 border-l border-t border-line sm:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => (
        <li key={tile.label} className="border-b border-r border-line bg-carbon-raised">
          <Link href={tile.href} className="row-mech block p-5">
            <span className="label">{tile.label}</span>
            <span className={`display mt-4 block text-6xl ${tile.warn ? "text-rust-bright" : ""}`}>{tile.value}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function BayBoard() {
  await requireAdmin();
  const [bays, bookings, hours] = await Promise.all([listBays(), listTodaysBookings(), listOpeningHours()]);
  const todayDate = zonedDate(new Date());
  const today = hours.find((h) => h.weekday === isoWeekday(todayDate));

  return (
    <>
      <p className="mt-4 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted">
        <span>
          {formatDateLong(todayDate)} ·{" "}
          {!today || today.closed ? "почивен ден" : `отворено ${formatTime(today.opensAt)} – ${formatTime(today.closesAt)}`}
        </span>
        <Link href="/admin/kalendar" className="label underline underline-offset-4 hover:text-paper">
          Към календара →
        </Link>
      </p>
      <div className="mt-4 grid border-l border-t border-line sm:grid-cols-2 xl:grid-cols-4">
        {bays.map((bay) => {
          const jobs = bookings.filter((b) => b.bayId === bay.id);
          return (
            <article key={bay.id} className="min-h-44 border-b border-r border-line p-5">
              <header className="flex items-center justify-between">
                <h3 className="display text-3xl">{bay.name}</h3>
                <span className={`badge ${jobs.length > 0 ? "badge-warn" : ""}`}>
                  {jobs.length > 0 ? `${jobs.length} за днес` : "Свободен"}
                </span>
              </header>
              {jobs.length === 0 ? (
                <p className="mt-6 text-sm text-muted">Няма записани часове за днес.</p>
              ) : (
                <ul className="mt-5 space-y-2">
                  {jobs.map((job) => (
                    <li key={job.id} className="flex items-center justify-between border-l-2 border-rust bg-olive/50 px-3 py-2">
                      <span className="font-mono text-sm">
                        {zonedTime(job.startsAt)} – {zonedTime(job.endsAt)}
                      </span>
                      <span className="badge">{BOOKING_STATUS[job.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
