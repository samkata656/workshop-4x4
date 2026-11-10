import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { RequestForm } from "@/components/request-form";
import { SiteHeader } from "@/components/site-header";
import { listPickerVehicles } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Модификация",
  description: "Заявка за модификация: окачване, шнорхел, брони, гуми, осветление.",
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
          <p className="label">
            <span className="label-accent">N° 03</span> / Заявка
          </p>
          <h1 className="display mt-5 text-[clamp(3.5rem,11vw,7.5rem)]">Модификация</h1>
          <p className="mt-5 max-w-xl text-sand">Изберете какво искате да направим по джипа. Връщаме се с въпроси и оферта до 1 работен ден.</p>
          <Suspense fallback={<div className="skeleton mt-12 h-[36rem]" aria-label="Зареждане" />}>
            <Loader />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function Loader() {
  await connection();
  return <RequestForm type="modification" vehicles={await listPickerVehicles()} />;
}
