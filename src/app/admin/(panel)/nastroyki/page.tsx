import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SettingsNav } from "@/components/admin/settings-nav";
import { PageHeader, SectionTitle } from "@/components/admin/ui";
import { saveServiceAction } from "@/lib/admin/actions";
import { FLUID_SOURCE } from "@/lib/admin/labels";
import { getServiceSettings } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Настройки — услуги" };

export default function ServiceSettingsPage() {
  return (
    <>
      <PageHeader index="05" section="Настройки" title="Услуги" />
      <SettingsNav current="services" />
      <p className="mt-6 max-w-2xl text-sm text-sand">
        Цената на една услуга = труд + течност по вместимостта на автомобила + консумативи. Промените важат за новите
        резервации; вече записаните часове пазят старата цена.
      </p>
      <Suspense fallback={<div className="skeleton mt-8 h-96" aria-label="Зареждане" />}>
        <ServiceList />
      </Suspense>
    </>
  );
}

type Service = Awaited<ReturnType<typeof getServiceSettings>>[number];

async function ServiceList() {
  const rows = await getServiceSettings();
  return (
    <>
      <section className="mt-10">
        <SectionTitle index="01">Активни и скрити услуги</SectionTitle>
        <ul className="mt-4 space-y-3">
          {rows.map((s) => (
            <li key={s.id} className="border border-line bg-carbon-raised p-4">
              <ServiceForm service={s} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <SectionTitle index="02">Нова услуга</SectionTitle>
        <div className="mt-4 border border-dashed border-line-strong p-4">
          <ServiceForm />
        </div>
      </section>
    </>
  );
}

function ServiceForm({ service }: { service?: Service }) {
  const key = service ? `s${service.id}` : "new";
  return (
    <ActionForm action={saveServiceAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_7rem_7rem_minmax(0,1.4fr)_5rem_auto]">
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor={`${key}-name`} className="field-label">
          Име
        </label>
        <input id={`${key}-name`} name="name" required minLength={3} maxLength={120} defaultValue={service?.name ?? ""} className="input" />
      </div>
      <div>
        <label htmlFor={`${key}-dur`} className="field-label">
          Минути
        </label>
        <input id={`${key}-dur`} name="durationMin" type="number" inputMode="numeric" min={5} max={600} step={5} required defaultValue={service?.durationMin ?? 60} className="input" />
      </div>
      <div>
        <label htmlFor={`${key}-lab`} className="field-label">
          Труд, €
        </label>
        <input id={`${key}-lab`} name="labourEur" inputMode="decimal" required defaultValue={service?.labourEur ?? ""} className="input" />
      </div>
      <div>
        <label htmlFor={`${key}-fluid`} className="field-label">
          Течност
        </label>
        <select id={`${key}-fluid`} name="fluidSource" defaultValue={service?.fluidSource ?? "none"} className="input">
          {Object.entries(FLUID_SOURCE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${key}-sort`} className="field-label">
          Ред
        </label>
        <input id={`${key}-sort`} name="sortOrder" type="number" inputMode="numeric" min={0} max={9999} defaultValue={service?.sortOrder ?? 100} className="input" />
      </div>
      <div className="flex flex-wrap items-end gap-4 sm:col-span-2 lg:col-span-1">
        <label className="flex min-h-12 items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={service?.active ?? true} className="check" />
          Активна
        </label>
        <SubmitButton className="btn min-h-12 px-4">{service ? "Запиши" : "Добави"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
