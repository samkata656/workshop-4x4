import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { RequestForm } from "@/components/request-form";
import { SiteHeader } from "@/components/site-header";
import { listPickerVehicles } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Ремонт",
  description: "Заявка за ремонт на рамкова Toyota или Lexus GX/LX.",
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
          <p className="label">
            <span className="label-accent">N° 02</span> / Заявка
          </p>
          <h1 className="display mt-5 text-[clamp(3.5rem,11vw,7.5rem)]">Ремонт</h1>
          <p className="mt-5 max-w-xl text-sand">Опишете какво се случва с автомобила. Преглеждаме заявката и се свързваме с вас до 1 работен ден — без да запазвате час предварително.</p>
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
  return <RequestForm type="repair" vehicles={await listPickerVehicles()} />;
}
