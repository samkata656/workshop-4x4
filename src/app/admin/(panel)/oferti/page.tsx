import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EmptyState, PageHeader, shortDate } from "@/components/admin/ui";
import { updateQuoteAction } from "@/lib/admin/actions";
import { QUOTE_KIND, QUOTE_STATUS } from "@/lib/admin/labels";
import { listQuotes } from "@/lib/admin/queries";
import { zonedTime } from "@/lib/booking/time";
import { formatEur } from "@/lib/format";

export const metadata: Metadata = { title: "Оферти" };

export default function QuotesPage() {
  return (
    <>
      <PageHeader index="04" section="Оферти" title="Оферти" />
      <p className="mt-4 max-w-2xl text-sm text-sand">
        Запитвания „Поискай оферта без записване на час“. Не заемат бокс — обадете се на клиента и сменете статуса.
      </p>
      <Suspense fallback={<div className="skeleton mt-8 h-96" aria-label="Зареждане" />}>
        <QuoteList />
      </Suspense>
    </>
  );
}

async function QuoteList() {
  const rows = await listQuotes();
  if (rows.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState>Все още няма оферти.</EmptyState>
      </div>
    );
  }

  return (
    <ul className="mt-8 space-y-3">
      {rows.map((q) => (
        <li key={q.id} className="border border-line bg-carbon-raised">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <span className="label">
              <span className="label-accent">
                #{q.id} {QUOTE_KIND[q.kind]}
              </span>{" "}
              · {shortDate(q.createdAt)} {zonedTime(q.createdAt)}
            </span>
            <span className={`badge ${q.status === "new" ? "badge-warn" : ""}`}>{QUOTE_STATUS[q.status]}</span>
          </header>
          <div className="grid gap-6 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="min-w-0 space-y-3 text-sm">
              <div>
                <Link href={`/admin/klienti/${q.customerId}`} className="font-semibold underline-offset-4 hover:underline">
                  {q.customerName}
                </Link>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-sand">
                  <a href={`tel:${q.customerPhone}`} className="hover:text-paper">
                    {q.customerPhone}
                  </a>
                  {q.customerEmail && (
                    <a href={`mailto:${q.customerEmail}`} className="break-all hover:text-paper">
                      {q.customerEmail}
                    </a>
                  )}
                </p>
              </div>
              {q.vehicle && <p className="text-sand">{q.vehicle}</p>}
              {q.services && <p>{q.services}</p>}
              <p className="font-mono">
                {q.priceTotalEur ? `Ориентировъчно ${formatEur(q.priceTotalEur)}` : "Цена след оглед"}
              </p>
              {q.requestId && (
                <Link href={`/admin/zayavki#zayavka-${q.requestId}`} className="label inline-block underline underline-offset-4 hover:text-paper">
                  Заявка #{q.requestId} →
                </Link>
              )}
            </div>

            <ActionForm action={updateQuoteAction} className="grid gap-3">
              <input type="hidden" name="id" value={q.id} />
              <div>
                <label htmlFor={`qstatus-${q.id}`} className="field-label">
                  Статус
                </label>
                <select id={`qstatus-${q.id}`} name="status" defaultValue={q.status} className="input">
                  {Object.entries(QUOTE_STATUS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`qnotes-${q.id}`} className="field-label">
                  Бележки
                </label>
                <textarea
                  id={`qnotes-${q.id}`}
                  name="notes"
                  rows={2}
                  maxLength={4000}
                  defaultValue={q.notes ?? ""}
                  className="input h-auto py-3"
                />
              </div>
              <div>
                <SubmitButton>Запиши</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </li>
      ))}
    </ul>
  );
}
