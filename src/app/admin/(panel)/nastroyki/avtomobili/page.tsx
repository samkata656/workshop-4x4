import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FilterChips } from "@/components/admin/filter-chips";
import { SettingsNav } from "@/components/admin/settings-nav";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { setVehicleVerifiedAction } from "@/lib/admin/actions";
import { listVehiclesForAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Настройки — автомобили" };

type Search = Promise<{ q?: string; only?: string }>;

export default function VehicleSettingsPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <PageHeader index="05" section="Настройки" title="Автомобили">
        <Link href="/admin/nastroyki/avtomobili/nov" className="btn min-h-12 px-5">
          Добави автомобил
        </Link>
      </PageHeader>
      <SettingsNav current="vehicles" />
      <Suspense fallback={<div className="skeleton mt-8 h-96" aria-label="Зареждане" />}>
        <VehicleTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const litres = (v: string | null) => (v ? `${Number(v).toLocaleString("bg-BG")} л` : "—");

function href(q: string, only: string | undefined) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (only) p.set("only", only);
  const s = p.toString();
  return s ? `/admin/nastroyki/avtomobili?${s}` : "/admin/nastroyki/avtomobili";
}

async function VehicleTable({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 100);
  const only = params.only === "unverified" || params.only === "ai" ? params.only : undefined;
  const rows = await listVehiclesForAdmin({ q, only });

  return (
    <>
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <form method="get" role="search" className="flex w-full max-w-xl gap-2">
          {only && <input type="hidden" name="only" value={only} />}
          <label htmlFor="q" className="sr-only">
            Търсене на автомобил
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Модел, поколение, двигател, кутия" className="input" />
          <button type="submit" className="btn min-h-12 px-5">
            Търси
          </button>
        </form>
        <FilterChips
          label="Филтър"
          items={[
            { href: href(q, undefined), label: "Всички", active: !only },
            { href: href(q, "unverified"), label: "За проверка", active: only === "unverified" },
            { href: href(q, "ai"), label: "Добавени от AI", active: only === "ai" },
          ]}
        />
      </div>

      <p className="mt-4 font-mono text-xs text-muted">{rows.length} реда</p>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState>Няма автомобили с тези условия.</EmptyState>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((v) => (
            <li key={v.id} className="grid gap-4 border border-line bg-carbon-raised p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/nastroyki/avtomobili/${v.id}`} className="font-semibold underline-offset-4 hover:underline">
                    {v.brand} {v.model} {v.generation}
                  </Link>
                  <span className="font-mono text-xs text-muted">
                    {v.yearsFrom ?? "?"}–{v.yearsTo ?? "днес"}
                  </span>
                  <span className={`badge ${v.verified ? "" : "badge-warn"}`}>{v.verified ? "Проверен" : "Непроверен"}</span>
                  {v.createdBy === "AI" && <span className="badge badge-warn">AI</span>}
                </p>
                <p className="mt-1 text-sm text-sand">
                  {v.engineCode} · {v.transmission}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
                  <span>Масло {litres(v.engineOilWithFilterL)}</span>
                  <span>Кутия {litres(v.transmissionL)}</span>
                  <span>Пр. диф. {litres(v.frontDiffL)}</span>
                  <span>З. диф. {litres(v.rearDiffL)}</span>
                  <span>Раздатка {litres(v.transferCaseL)}</span>
                  <span>Антифриз {litres(v.coolantL)}</span>
                  <span>Спирачна {litres(v.brakeFluidL)}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/nastroyki/avtomobili/${v.id}`} className="btn btn-ghost min-h-10 px-4">
                  Редактирай
                </Link>
                <ActionForm action={setVehicleVerifiedAction}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="verified" value={v.verified ? "false" : "true"} />
                  <SubmitButton className={v.verified ? "btn btn-ghost min-h-10 px-4" : "btn min-h-10 px-4"}>
                    {v.verified ? "Махни проверка" : "Отбележи проверен"}
                  </SubmitButton>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
