"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Преглед" },
  { href: "/admin/kalendar", label: "Календар" },
  { href: "/admin/klienti", label: "Клиенти" },
  { href: "/admin/zayavki", label: "Заявки" },
  { href: "/admin/oferti", label: "Оферти" },
  { href: "/admin/nastroyki", label: "Настройки" },
];

export function AdminNav() {
  return <NavLinks pathname={usePathname()} />;
}

/** Same links with nothing highlighted: the Suspense fallback while the URL is read. */
export function AdminNavFallback() {
  return <NavLinks pathname="" />;
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Админ навигация" className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:px-3">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors lg:border-b-0 lg:border-l-2 ${
              active ? "border-rust bg-olive/60 text-paper" : "border-transparent text-sand hover:bg-olive/30 hover:text-paper"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
