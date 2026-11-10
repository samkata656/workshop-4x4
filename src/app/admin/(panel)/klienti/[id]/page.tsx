import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AiOutput } from "@/components/admin/ai-output";
import { EmptyState, PageHeader, SectionTitle, shortDate, When } from "@/components/admin/ui";
import { BOOKING_STATUS, QUOTE_KIND, QUOTE_STATUS, REQUEST_STATUS, REQUEST_TYPE } from "@/lib/admin/labels";
import { getCustomer } from "@/lib/admin/queries";
import { zonedDate } from "@/lib/booking/time";
import { formatEur } from "@/lib/format";

export const metadata: Metadata = { title: "Клиент" };

type Params = Promise<{ id: string }>;

export default function CustomerPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="skeleton h-[60vh]" aria-label="Зареждане" />}>
      <CustomerDetail params={params} />
    </Suspense>
  );
}

async function CustomerDetail({ params }: { params: Params }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const data = await getCustomer(id);
  if (!data) notFound();
  const { customer, bookings, requests, quotes, vehicles } = data;

  const now = new Date();
  const upcoming = bookings.filter((b) => b.endsAt >= now && (b.status === "booked" || b.status === "in_progress")).reverse();
  const history = bookings.filter((b) => !upcoming.includes(b));

  return (
    <>
      <p className="label">
        <Link href="/admin/klienti" className="hover:text-paper">
          ← Клиенти
        </Link>
      </p>
      <div className="mt-4">
        <PageHeader index="02" section="Клиент" title={customer.name} />
      </div>

      <dl className="mt-8 grid border-l border-t border-line sm:grid-cols-3">
        <Fact label="Телефон">
          <a href={`tel:${customer.phone}`} className="font-mono underline-offset-4 hover:underline">
            {customer.phone}
          </a>
        </Fact>
        <Fact label="Имейл">
          {customer.email ? (
            <a href={`mailto:${customer.email}`} className="break-all underline-offset-4 hover:underline">
              {customer.email}
            </a>
          ) : (
            "—"
          )}
        </Fact>
        <Fact label="Клиент от">{shortDate(customer.createdAt)}</Fact>
      </dl>

      <section className="mt-12">
        <SectionTitle index="01">Автомобили</SectionTitle>
        {vehicles.length === 0 ? (
          <div className="mt-4">
            <EmptyState>Няма свързани автомобили.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {vehicles.map((v) => (
              <li key={v.label} className="border border-line bg-carbon-raised p-4">
                <span className="block">{v.label}</span>
                {v.plate && <span className="mt-1 block font-mono text-xs text-sand">{v.plate}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <SectionTitle index="02">Предстоящи часове</SectionTitle>
        {upcoming.length === 0 ? (
          <div className="mt-4">
            <EmptyState>Няма предстоящи часове.</EmptyState>
          </div>
        ) : (
          <BookingList items={upcoming} />
        )}
      </section>

      <section className="mt-12">
        <SectionTitle index="03">История</SectionTitle>
        {history.length === 0 ? (
          <div className="mt-4">
            <EmptyState>Все още няма минали посещения.</EmptyState>
          </div>
        ) : (
          <BookingList items={history} />
        )}
      </section>

      <section className="mt-12">
        <SectionTitle index="04">Заявки</SectionTitle>
        {requests.length === 0 ? (
          <div className="mt-4">
            <EmptyState>Няма заявки за ремонт или модификация.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="border border-line bg-carbon-raised p-4">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="label">
                    <span className="label-accent">{REQUEST_TYPE[r.type]}</span> · {shortDate(r.createdAt)}
                  </span>
                  <span className={`badge ${r.status === "new" ? "badge-warn" : ""}`}>{REQUEST_STATUS[r.status]}</span>
                </p>
                <p className="mt-2 text-sm text-sand">{r.vehicle}</p>
                {r.description && <p className="mt-2 whitespace-pre-line text-sm">{r.description}</p>}
                <details className="mt-3">
                  <summary className="label cursor-pointer hover:text-paper">AI анализ</summary>
                  <div className="mt-3">
                    <AiOutput value={r.aiOutput} />
                  </div>
                </details>
                <Link href={`/admin/zayavki#zayavka-${r.id}`} className="label mt-3 inline-block underline underline-offset-4 hover:text-paper">
                  Отвори в заявките →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <SectionTitle index="05">Оферти</SectionTitle>
        {quotes.length === 0 ? (
          <div className="mt-4">
            <EmptyState>Няма оферти.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-carbon-raised p-4 text-sm">
                <span>
                  <span className="label">
                    <span className="label-accent">{QUOTE_KIND[q.kind]}</span> · {shortDate(q.createdAt)}
                  </span>
                  <span className="mt-1 block text-sand">{q.vehicle ?? "—"}</span>
                </span>
                <span className="flex items-center gap-3">
                  {q.priceTotalEur && <span className="font-mono">{formatEur(q.priceTotalEur)}</span>}
                  <span className={`badge ${q.status === "new" ? "badge-warn" : ""}`}>{QUOTE_STATUS[q.status]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-r border-line p-4">
      <dt className="label">{label}</dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}

type BookingItem = NonNullable<Awaited<ReturnType<typeof getCustomer>>>["bookings"][number];

function BookingList({ items }: { items: BookingItem[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((b) => (
        <li key={b.id} className="border border-line bg-carbon-raised p-4 text-sm">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/admin/kalendar?date=${zonedDate(b.startsAt)}`}
              className="font-mono underline-offset-4 hover:underline"
            >
              <When startsAt={b.startsAt} endsAt={b.endsAt} />
            </Link>
            <span className={`badge ${b.status === "in_progress" ? "badge-warn" : ""}`}>{BOOKING_STATUS[b.status]}</span>
          </p>
          <p className="mt-2 text-sand">
            {b.bayName} · {b.vehicle}
          </p>
          <p className="mt-1 flex flex-wrap justify-between gap-2">
            <span>{b.services ?? "—"}</span>
            {b.priceTotalEur && <span className="font-mono">{formatEur(b.priceTotalEur)}</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}
