import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AiOutput } from "@/components/admin/ai-output";
import { FilterChips } from "@/components/admin/filter-chips";
import { EmptyState, PageHeader, shortDate } from "@/components/admin/ui";
import { updateRequestAction } from "@/lib/admin/actions";
import { REQUEST_STATUS, REQUEST_TYPE } from "@/lib/admin/labels";
import { listRequests } from "@/lib/admin/queries";
import { zonedTime } from "@/lib/booking/time";

export const metadata: Metadata = { title: "Заявки" };

type Search = Promise<{ type?: string; status?: string }>;

export default function RequestsPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <PageHeader index="03" section="Заявки" title="Заявки" />
      <Suspense fallback={<div className="skeleton mt-8 h-96" aria-label="Зареждане" />}>
        <Inbox searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function href(type: string | undefined, status: string | undefined) {
  const p = new URLSearchParams();
  if (type) p.set("type", type);
  if (status) p.set("status", status);
  const s = p.toString();
  return s ? `/admin/zayavki?${s}` : "/admin/zayavki";
}

async function Inbox({ searchParams }: { searchParams: Search }) {
  const { type, status } = await searchParams;
  const rows = await listRequests({ type, status });
  const activeType = type && type in REQUEST_TYPE ? type : undefined;
  const activeStatus = status && status in REQUEST_STATUS ? status : undefined;

  return (
    <>
      <div className="mt-8 space-y-3">
        <FilterChips
          label="Вид заявка"
          items={[
            { href: href(undefined, activeStatus), label: "Всички", active: !activeType },
            ...Object.entries(REQUEST_TYPE).map(([value, label]) => ({
              href: href(value, activeStatus),
              label,
              active: activeType === value,
            })),
          ]}
        />
        <FilterChips
          label="Статус"
          items={[
            { href: href(activeType, undefined), label: "Всеки статус", active: !activeStatus },
            ...Object.entries(REQUEST_STATUS).map(([value, label]) => ({
              href: href(activeType, value),
              label,
              active: activeStatus === value,
            })),
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState>
            {activeType || activeStatus ? "Няма заявки с тези филтри." : "Все още няма заявки. Ще се появят тук, щом клиент изпрати форма за ремонт или модификация."}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {rows.map((r) => (
            <li key={r.id} id={`zayavka-${r.id}`} className="scroll-mt-24 border border-line bg-carbon-raised">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <span className="label">
                  <span className="label-accent">
                    #{r.id} {REQUEST_TYPE[r.type]}
                  </span>{" "}
                  · {shortDate(r.createdAt)} {zonedTime(r.createdAt)}
                </span>
                <span className={`badge ${r.status === "new" ? "badge-warn" : ""}`}>{REQUEST_STATUS[r.status]}</span>
              </header>

              <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-4 text-sm">
                  <div>
                    <Link href={`/admin/klienti/${r.customerId}`} className="font-semibold underline-offset-4 hover:underline">
                      {r.customerName}
                    </Link>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-sand">
                      <a href={`tel:${r.customerPhone}`} className="hover:text-paper">
                        {r.customerPhone}
                      </a>
                      {r.customerEmail && (
                        <a href={`mailto:${r.customerEmail}`} className="break-all hover:text-paper">
                          {r.customerEmail}
                        </a>
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="label">Автомобил</p>
                    <p className="mt-1">
                      {r.vehicle}
                      {r.nonStock && <span className="badge badge-warn ml-2">Не е стоков</span>}
                    </p>
                    {r.mileageKm !== null && (
                      <p className="mt-1 font-mono text-xs text-muted">{r.mileageKm.toLocaleString("bg-BG")} км</p>
                    )}
                  </div>

                  {r.options.length > 0 && (
                    <div>
                      <p className="label">{r.type === "repair" ? "Симптоми" : "Желани модификации"}</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {r.options.map((o) => (
                          <li key={o} className="border border-line-strong px-2 py-1 font-mono text-xs">
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {r.description && (
                    <div>
                      <p className="label">Описание от клиента</p>
                      <p className="mt-1 whitespace-pre-line break-words">{r.description}</p>
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-5">
                  <div>
                    <p className="label">AI анализ</p>
                    <div className="mt-2">
                      <AiOutput value={r.aiOutput} />
                    </div>
                  </div>

                  <ActionForm action={updateRequestAction} className="grid gap-3 border-t border-line pt-4">
                    <input type="hidden" name="id" value={r.id} />
                    <div>
                      <label htmlFor={`status-${r.id}`} className="field-label">
                        Статус
                      </label>
                      <select id={`status-${r.id}`} name="status" defaultValue={r.status} className="input">
                        {Object.entries(REQUEST_STATUS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`notes-${r.id}`} className="field-label">
                        Бележки на сервиза
                      </label>
                      <textarea
                        id={`notes-${r.id}`}
                        name="notes"
                        rows={3}
                        maxLength={4000}
                        defaultValue={r.notes ?? ""}
                        className="input h-auto py-3"
                      />
                    </div>
                    <div>
                      <SubmitButton>Запиши</SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
