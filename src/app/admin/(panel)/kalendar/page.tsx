import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/ui";
import { getCalendarSetup, listCalendarBookings } from "@/lib/admin/queries";
import { addDays, isoWeekday, isValidDate, zonedDate } from "@/lib/booking/time";
import { BayCalendar } from "./bay-calendar";

export const metadata: Metadata = { title: "Календар" };

type Search = Promise<{ date?: string; view?: string }>;

export default function CalendarPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <PageHeader index="01" section="Календар" title="Календар" />
      <Suspense fallback={<div className="skeleton mt-8 h-[70vh]" aria-label="Зареждане" />}>
        <CalendarLoader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CalendarLoader({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const view = params.view === "week" ? "week" : "day";
  const date = isValidDate(params.date) ? params.date : zonedDate(new Date());

  // Day view loads one day; week view loads Monday through Sunday.
  const from = view === "week" ? addDays(date, 1 - isoWeekday(date)) : date;
  const to = addDays(from, view === "week" ? 7 : 1);

  const [setup, bookings] = await Promise.all([getCalendarSetup(), listCalendarBookings(from, to)]);
  return <BayCalendar date={date} view={view} bays={setup.bays} hours={setup.hours} bookings={bookings} />;
}
