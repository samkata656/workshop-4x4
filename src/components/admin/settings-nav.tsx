import { FilterChips } from "./filter-chips";

const PAGES = [
  { key: "services", href: "/admin/nastroyki", label: "Услуги" },
  { key: "prices", href: "/admin/nastroyki/ceni", label: "Цени" },
  { key: "hours", href: "/admin/nastroyki/rabotno-vreme", label: "Работно време" },
  { key: "vehicles", href: "/admin/nastroyki/avtomobili", label: "Автомобили" },
] as const;

export function SettingsNav({ current }: { current: (typeof PAGES)[number]["key"] }) {
  return (
    <div className="mt-6">
      <FilterChips
        label="Раздели на настройките"
        items={PAGES.map((p) => ({ href: p.href, label: p.label, active: p.key === current }))}
      />
    </div>
  );
}
