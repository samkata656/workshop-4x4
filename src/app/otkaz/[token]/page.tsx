import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { findBookingByCancelToken } from "@/lib/booking/engine";
import { zonedDate, zonedTime } from "@/lib/booking/time";
import { formatDateLong } from "@/lib/format";
import { cancelBookingAction } from "./actions";

export const metadata: Metadata = { title: "Отказ на час", robots: { index: false } };

export default function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
          <p className="label">
            <span className="label-accent">N° 02</span> / Вашият час
          </p>
          <Suspense fallback={<div className="skeleton mt-8 h-72" aria-label="Зареждане" />}>
            <BookingCard params={params} />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function BookingCard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = /^[0-9a-f]{64}$/.test(token) ? await findBookingByCancelToken(token) : null;

  if (!booking) {
    return (
      <>
        <h1 className="display mt-5 text-6xl sm:text-7xl">Не намираме този час</h1>
        <p className="mt-5 text-sand">Линкът е непълен или часът вече не съществува. Проверете дали сте го копирали целия.</p>
        <Link href="/zapishi-chas" className="btn mt-8">
          Запиши нов час
        </Link>
      </>
    );
  }

  const cancelled = booking.status === "cancelled";
  const upcoming = booking.status === "booked" && booking.startsAt > new Date();
  const date = zonedDate(booking.startsAt);

  return (
    <>
      <h1 className="display mt-5 text-6xl sm:text-7xl">{cancelled ? "Часът е отказан" : "Вашият час"}</h1>
      <dl className="mt-8 divide-y divide-line border-y border-line">
        <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]">
          <dt className="label pt-1">Кога</dt>
          <dd className={cancelled ? "text-muted line-through" : ""}>
            {formatDateLong(date)}, {zonedTime(booking.startsAt)} – {zonedTime(booking.endsAt)}
          </dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]">
          <dt className="label pt-1">Автомобил</dt>
          <dd>
            {booking.vehicleBrand} {booking.vehicleModel} {booking.vehicleGeneration}
          </dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]">
          <dt className="label pt-1">Услуги</dt>
          <dd>{booking.services.join(", ")}</dd>
        </div>
      </dl>

      {cancelled ? (
        <>
          <p className="mt-8 text-sand">Боксът е освободен. Можете да запишете нов час по всяко време.</p>
          <Link href="/zapishi-chas" className="btn mt-6">
            Запиши нов час
          </Link>
        </>
      ) : upcoming ? (
        <form action={cancelBookingAction.bind(null, token)} className="mt-8">
          <p className="text-sand">Отказът е веднага и освобождава часа за друг клиент.</p>
          <button type="submit" className="btn mt-6">
            Откажи часа
          </button>
        </form>
      ) : (
        <p className="mt-8 text-sand">Този час вече е започнал или е приключил и не може да се откаже онлайн.</p>
      )}
    </>
  );
}
