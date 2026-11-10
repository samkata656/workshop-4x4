import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SettingsNav } from "@/components/admin/settings-nav";
import { PageHeader, SectionTitle } from "@/components/admin/ui";
import { savePricesAction } from "@/lib/admin/actions";
import { getPriceSettings } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Настройки — цени" };

export default function PriceSettingsPage() {
  return (
    <>
      <PageHeader index="05" section="Настройки" title="Цени" />
      <SettingsNav current="prices" />
      <p className="mt-6 max-w-2xl text-sm text-sand">Всички цени са в евро с ДДС. Течностите се таксуват на литър, закръглено нагоре до 0,5 л.</p>
      <Suspense fallback={<div className="skeleton mt-8 h-96" aria-label="Зареждане" />}>
        <PriceForm />
      </Suspense>
    </>
  );
}

async function PriceForm() {
  const { fluids, consumables } = await getPriceSettings();
  return (
    <ActionForm action={savePricesAction} className="mt-10 max-w-3xl">
      <section>
        <SectionTitle index="01">Течности, € / литър</SectionTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {fluids.map((f) => (
            <div key={f.fluid}>
              <label htmlFor={`fluid-${f.fluid}`} className="field-label">
                {f.name}
              </label>
              <input
                id={`fluid-${f.fluid}`}
                name={`fluid:${f.fluid}`}
                inputMode="decimal"
                required
                defaultValue={f.pricePerLitreEur}
                className="input font-mono"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle index="02">Консумативи, € / брой</SectionTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {consumables.map((c) => (
            <div key={c.id}>
              <label htmlFor={`consumable-${c.id}`} className="field-label">
                {c.name}
              </label>
              <input
                id={`consumable-${c.id}`}
                name={`consumable:${c.id}`}
                inputMode="decimal"
                required
                defaultValue={c.priceEur}
                className="input font-mono"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8">
        <SubmitButton className="btn min-h-12 px-6">Запиши цените</SubmitButton>
      </div>
    </ActionForm>
  );
}
