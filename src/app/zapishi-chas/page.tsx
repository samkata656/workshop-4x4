import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { SiteHeader } from "@/components/site-header";
import { listBookableDays } from "@/lib/booking/availability";
import { loadRules } from "@/lib/booking/engine";
import { listActiveServices, listVehicles } from "@/lib/queries";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = {
  title: "Запиши час",
  description: "Изберете автомобил и услуги, вижте цената и запишете свободен час онлайн.",
};

export default function BookingPage() {
  return (
    <>
      <SiteHeader cta={false} />
      <main className="flex-1">
        <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
          <p className="label">
            <span className="label-accent">N° 01</span> / Записване
          </p>
          <h1 className="display mt-5 text-[clamp(3.5rem,11vw,7.5rem)]">Запиши час</h1>
          <p className="mt-5 max-w-xl text-sand">
            Четири стъпки, без обаждане. Виждате цената, преди да потвърдите, и можете да откажете часа
            с един линк.
          </p>
          <Suspense fallback={<div className="skeleton mt-12 h-[36rem]" aria-label="Зареждане" />}>
            <BookingLoader />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function BookingLoader() {
  await connection(); // prices, services and free days are always read fresh
  const [vehicles, services, ctx] = await Promise.all([listVehicles(), listActiveServices(), loadRules()]);

  return (
    <BookingForm
      vehicles={vehicles.map((v) => ({
        id: v.id,
        brand: v.brand,
        model: v.model,
        generation: v.generation,
        yearsFrom: v.yearsFrom,
        yearsTo: v.yearsTo,
        engineCode: v.engineCode,
        fuel: v.fuel,
        transmission: v.transmission,
        transmissionType: v.transmissionType,
        engineOilWithFilterL: v.engineOilWithFilterL,
        transmissionL: v.transmissionL,
        frontDiffL: v.frontDiffL,
        rearDiffL: v.rearDiffL,
        transferCaseL: v.transferCaseL,
        coolantL: v.coolantL,
        brakeFluidL: v.brakeFluidL,
        verified: v.verified,
      }))}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        fluidSource: s.fluidSource,
        labourEur: s.labourEur,
      }))}
      fluidPrices={ctx.fluidPrices.map((f) => ({ fluid: f.fluid, name: f.name, pricePerLitreEur: f.pricePerLitreEur }))}
      consumables={ctx.consumables}
      days={listBookableDays(new Date(), ctx.rules, ctx.hours)}
    />
  );
}
