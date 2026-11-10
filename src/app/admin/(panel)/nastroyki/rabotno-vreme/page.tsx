import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SettingsNav } from "@/components/admin/settings-nav";
import { PageHeader, SectionTitle } from "@/components/admin/ui";
import { saveHoursAction } from "@/lib/admin/actions";
import { getHoursSettings } from "@/lib/admin/queries";
import { WEEKDAYS_BG } from "@/lib/format";

export const metadata: Metadata = { title: "Настройки — работно време" };

export default function HoursSettingsPage() {
  return (
    <>
      <PageHeader index="05" section="Настройки" title="Работно време" />
      <SettingsNav current="hours" />
      <Suspense fallback={<div className="skeleton mt-8 h-96" aria-label="Зареждане" />}>
        <HoursForm />
      </Suspense>
    </>
  );
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

async function HoursForm() {
  const { hours, rules } = await getHoursSettings();
  return (
    <ActionForm action={saveHoursAction} className="mt-10 max-w-3xl">
      <section>
        <SectionTitle index="01">Седмица</SectionTitle>
        <p className="mt-3 text-sm text-sand">Работата трябва да свърши преди часа на затваряне. Часът е българско време.</p>
        <ul className="mt-4 divide-y divide-line border border-line">
          {hours.map((h) => (
            <li key={h.weekday} className="grid grid-cols-2 items-end gap-3 p-4 sm:grid-cols-[10rem_1fr_1fr_auto]">
              <p className="col-span-2 font-semibold sm:col-span-1 sm:self-center">{WEEKDAYS_BG[h.weekday - 1]}</p>
              <div>
                <label htmlFor={`opens-${h.weekday}`} className="field-label">
                  Отваря
                </label>
                <input id={`opens-${h.weekday}`} name={`opens:${h.weekday}`} type="time" step={900} defaultValue={hhmm(h.opensAt) || "09:00"} className="input font-mono" />
              </div>
              <div>
                <label htmlFor={`closes-${h.weekday}`} className="field-label">
                  Затваря
                </label>
                <input id={`closes-${h.weekday}`} name={`closes:${h.weekday}`} type="time" step={900} defaultValue={hhmm(h.closesAt) || "18:00"} className="input font-mono" />
              </div>
              <label className="col-span-2 flex min-h-12 items-center gap-2 text-sm sm:col-span-1">
                <input type="checkbox" name={`closed:${h.weekday}`} defaultChecked={h.closed} className="check" />
                Почивен ден
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <SectionTitle index="02">Онлайн записване</SectionTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="slotMinutes" className="field-label">
              Стъпка на часовете, мин
            </label>
            <input id="slotMinutes" name="slotMinutes" type="number" inputMode="numeric" min={5} max={240} required defaultValue={rules?.slotMinutes ?? 30} className="input font-mono" />
          </div>
          <div>
            <label htmlFor="bookingMinDaysAhead" className="field-label">
              Най-рано след, дни
            </label>
            <input id="bookingMinDaysAhead" name="bookingMinDaysAhead" type="number" inputMode="numeric" min={0} max={60} required defaultValue={rules?.bookingMinDaysAhead ?? 1} className="input font-mono" />
          </div>
          <div>
            <label htmlFor="bookingMaxDaysAhead" className="field-label">
              Най-късно след, дни
            </label>
            <input id="bookingMaxDaysAhead" name="bookingMaxDaysAhead" type="number" inputMode="numeric" min={1} max={365} required defaultValue={rules?.bookingMaxDaysAhead ?? 30} className="input font-mono" />
          </div>
        </div>
      </section>

      <div className="mt-8">
        <SubmitButton className="btn min-h-12 px-6">Запиши работното време</SubmitButton>
      </div>
    </ActionForm>
  );
}
