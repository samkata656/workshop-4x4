import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader, shortDate, tableHead } from "@/components/admin/ui";
import { listCustomers } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Клиенти" };

type Search = Promise<{ q?: string }>;

export default function CustomersPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <PageHeader index="02" section="Клиенти" title="Клиенти" />
      <Suspense fallback={<div className="skeleton mt-8 h-96" aria-label="Зареждане" />}>
        <CustomerList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomerList({ searchParams }: { searchParams: Search }) {
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const rows = await listCustomers(q);

  return (
    <>
      <form method="get" role="search" className="mt-8 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">
          Търсене на клиент
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Име, телефон, имейл или номер" className="input" />
        <button type="submit" className="btn min-h-12 px-5">
          Търси
        </button>
      </form>

      <p className="mt-4 font-mono text-xs text-muted">
        {rows.length} {rows.length === 1 ? "клиент" : "клиента"}
        {q && (
          <>
            {" "}за „{q}“ ·{" "}
            <Link href="/admin/klienti" className="underline underline-offset-4 hover:text-paper">
              покажи всички
            </Link>
          </>
        )}
      </p>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState>{q ? "Няма клиенти, които отговарят на търсенето." : "Все още няма клиенти. Ще се появят с първия записан час или заявка."}</EmptyState>
        </div>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="mt-6 space-y-2 md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/klienti/${c.id}`} className="row-mech block border border-line bg-carbon-raised p-4">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="mt-1 block font-mono text-sm text-sand">{c.phone}</span>
                  <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
                    <span>Часове: {c.bookings}</span>
                    <span>Заявки: {c.requests}</span>
                    <span>Последно: {c.lastVisit ? shortDate(c.lastVisit) : "—"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="mt-6 hidden overflow-x-auto border border-line md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line-strong bg-carbon-raised">
                <tr>
                  <th className={tableHead}>Име</th>
                  <th className={tableHead}>Телефон</th>
                  <th className={tableHead}>Имейл</th>
                  <th className={`${tableHead} text-right`}>Часове</th>
                  <th className={`${tableHead} text-right`}>Заявки</th>
                  <th className={tableHead}>Последно посещение</th>
                  <th className={tableHead}>Клиент от</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-olive/30">
                    <td className="px-3 py-3">
                      <Link href={`/admin/klienti/${c.id}`} className="font-semibold underline-offset-4 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono">{c.phone}</td>
                    <td className="px-3 py-3 text-sand">{c.email ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-mono">{c.bookings}</td>
                    <td className="px-3 py-3 text-right font-mono">{c.requests}</td>
                    <td className="px-3 py-3 font-mono">{c.lastVisit ? shortDate(c.lastVisit) : "—"}</td>
                    <td className="px-3 py-3 font-mono text-muted">{shortDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
