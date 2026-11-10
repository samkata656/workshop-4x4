import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Поверителност" };

// TODO(owner): add the company name, address and a contact email before going live.
const SECTIONS: [string, string][] = [
  [
    "Какви данни събираме",
    "Само това, което попълвате във формите: име, телефон, имейл (ако го посочите), избрания автомобил и услугите или описанието на заявката.",
  ],
  [
    "Защо ги използваме",
    "За да запазим часа ви, да изготвим оферта и да се свържем с вас за тази заявка. Не ги използваме за реклама и не ги предаваме на трети лица.",
  ],
  [
    "Колко дълго ги пазим",
    "Докато са нужни за обслужването на автомобила ви и за законовите ни задължения. След това ги изтриваме.",
  ],
  [
    "Вашите права",
    "Можете да поискате справка, поправка или изтриване на данните си, както и да оттеглите съгласието си. Свържете се със сервиза и ще го направим.",
  ],
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
          <p className="label">
            <span className="label-accent">GDPR</span> / Лични данни
          </p>
          <h1 className="display mt-5 text-6xl sm:text-7xl">Поверителност</h1>
          <div className="mt-10 divide-y divide-line border-y border-line">
            {SECTIONS.map(([title, text]) => (
              <section key={title} className="py-6">
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sand">{text}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
