import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { SiteHeader } from "@/components/site-header";
import { formatDuration, formatEur, formatTime, pad2, WEEKDAYS_BG } from "@/lib/format";
import { listActiveServices, listOpeningHours, listVehicleFamilies } from "@/lib/queries";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <Entrances />
        <section id="uslugi" className="border-t border-line">
          <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-32">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="label">
                <span className="label-accent">01</span> / Услуги
              </p>
              <h2 className="display mt-6 text-[clamp(3rem,9vw,6.5rem)]">
                Течности.
                <br />
                Спирачки.
                <br />
                <span className="text-rust">Без изненади.</span>
              </h2>
              <p className="mt-8 max-w-md text-sand">
                Цената се смята по вашия автомобил: труд, точното количество течности, филтър и
                консумативи. Виждате разбивката, преди да запишете час.
              </p>
            </div>
            <Suspense fallback={<RowsSkeleton rows={7} />}>
              <ServiceList />
            </Suspense>
          </div>
        </section>

        <section id="modeli" className="border-t border-line bg-olive/40">
          <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8 lg:py-32">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="label">
                  <span className="label-accent">02</span> / Модели
                </p>
                <h2 className="display mt-6 text-[clamp(3rem,9vw,6.5rem)]">Само на рама.</h2>
              </div>
              <p className="max-w-sm text-sand">
                Работим само с рамкови модели на Toyota и Lexus GX/LX. Тесният фокус е причината
                да ги познаваме до болт.
              </p>
            </div>
            <Suspense fallback={<div className="skeleton mt-14 h-72" />}>
              <VehicleFamilies />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

const ENTRANCES = [
  { href: "/zapishi-chas", index: "A", title: "Запиши час", text: "Обслужване с ясна цена и свободен час, избран от вас." },
  { href: "/remont", index: "B", title: "Ремонт", text: "Опишете проблема. Връщаме се с диагноза и оферта." },
  { href: "/modifikatsiya", index: "C", title: "Модификация", text: "Окачване, шнорхел, брони, гуми, осветление." },
];

function Entrances() {
  return (
    <nav aria-label="Какво ви трябва" className="border-t border-line">
      <ul className="mx-auto grid max-w-[1400px] sm:grid-cols-3">
        {ENTRANCES.map((entry) => (
          <li key={entry.href} className="min-w-0 border-b border-line sm:border-b-0 sm:[&:not(:first-child)]:border-l">
            <Link href={entry.href} className="row-mech group flex h-full flex-col px-4 py-8 sm:px-8 sm:py-10">
              <span className="label label-accent">{entry.index}</span>
              <span className="display mt-4 text-5xl sm:text-[clamp(1.75rem,3.4vw,3rem)]">{entry.title}</span>
              <span className="mt-3 text-sm text-sand">{entry.text}</span>
              <span aria-hidden className="mt-6 font-mono text-rust-bright transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="survey-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="ghost reveal absolute -right-6 top-6 -z-10 text-[clamp(14rem,42vw,38rem)] sm:right-4"
        style={{ "--i": 4 } as React.CSSProperties}
      >
        4×4
      </div>

      <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 sm:px-8 sm:pt-32 lg:pb-24 lg:pt-44">
        <p className="label reveal" style={{ "--i": 0 } as React.CSSProperties}>
          <span className="label-accent">N° 00</span> / Специализиран сервиз
        </p>
        <h1
          className="display reveal mt-8 max-w-[11ch] text-[clamp(4.25rem,15vw,13rem)]"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Рамата <span className="text-rust">носи</span> всичко.
        </h1>
        <div
          className="reveal mt-10 grid gap-8 lg:mt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <p className="max-w-md text-lg text-sand">
            Обслужване, ремонти и модификации за Land Cruiser, Prado, Hilux, 4Runner, Lexus GX и
            LX. Четири бокса, ясни цени, записване онлайн.
          </p>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/zapishi-chas" className="btn">
              Запиши час <span aria-hidden className="arrow">→</span>
            </Link>
            <a href="#uslugi" className="btn btn-ghost">
              Виж услугите
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <dl className="mx-auto grid max-w-[1400px] grid-cols-2 px-4 sm:px-8 lg:grid-cols-4">
          {[
            ["Боксове", "04", "с подемник"],
            ["Записване", "24/7", "без обаждане"],
            ["Слотове", "30′", "стъпка на часовете"],
            ["Цени", "EUR", "с включен ДДС"],
          ].map(([term, value, note], i) => (
            <div
              key={term}
              className="reveal border-line py-6 pr-4 [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:pl-6"
              style={{ "--i": 3 + i } as React.CSSProperties}
            >
              <dt className="label">{term}</dt>
              <dd className="display mt-3 text-5xl">{value}</dd>
              <dd className="mt-1 text-sm text-muted">{note}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

async function ServiceList() {
  await connection(); // read at request time, so admin edits show up immediately
  const services = await listActiveServices();

  return (
    <ol className="border-t border-line-strong">
      {services.map((service, i) => (
        <li
          key={service.id}
          className="row-mech grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 border-b border-line px-3 py-6 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:px-5"
        >
          <span className="label label-accent">{pad2(i + 1)}</span>
          <h3 className="text-lg font-semibold leading-snug sm:text-xl">{service.name}</h3>
          <dl className="col-start-2 flex gap-8 sm:col-start-3 sm:justify-end">
            <div>
              <dt className="label">Време</dt>
              <dd className="mt-2 font-mono text-sm">{formatDuration(service.durationMin)}</dd>
            </div>
            <div>
              <dt className="label">Труд</dt>
              <dd className="mt-2 font-mono text-sm">{formatEur(service.labourEur)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}

async function VehicleFamilies() {
  await connection();
  const families = await listVehicleFamilies();

  return (
    <ul className="mt-14 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
      {families.map((family) => (
        <li key={`${family.brand}-${family.model}`} className="row-mech border-b border-r border-line p-6">
          <p className="label">{family.brand}</p>
          <h3 className="display mt-3 text-4xl">{family.model}</h3>
          <p className="mt-4 text-sm leading-relaxed text-sand">{family.generations.join(" · ")}</p>
        </li>
      ))}
    </ul>
  );
}

async function OpeningHours() {
  await connection();
  const hours = await listOpeningHours();

  return (
    <dl className="mt-6 max-w-sm">
      {hours.map((day) => (
        <div key={day.weekday} className="flex justify-between border-b border-line py-2.5 text-sm">
          <dt className="text-sand">{WEEKDAYS_BG[day.weekday - 1]}</dt>
          <dd className="font-mono">
            {day.closed ? (
              <span className="text-muted">почивен ден</span>
            ) : (
              `${formatTime(day.opensAt)} – ${formatTime(day.closesAt)}`
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Footer() {
  return (
    <footer id="kontakt" className="border-t border-line">
      <div aria-hidden className="hatch h-2 opacity-70" />
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-16 sm:px-8 lg:grid-cols-2">
        <div>
          <p className="label">
            <span className="label-accent">03</span> / Работно време
          </p>
          <Suspense fallback={<div className="skeleton mt-6 h-64 max-w-sm" />}>
            <OpeningHours />
          </Suspense>
        </div>
        <div className="lg:text-right">
          <p className="display text-6xl">
            4<span className="text-rust">×</span>4 Сервиз
          </p>
          <p className="mt-4 text-sm text-muted">
            Работим само с рамкови модели на Toyota и Lexus GX/LX.
            <br />
            Всички цени са в евро с включен ДДС.
          </p>
        </div>
      </div>
    </footer>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="border-t border-line-strong" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-b border-line px-5 py-6">
          <div className="skeleton h-7" />
        </div>
      ))}
    </div>
  );
}
