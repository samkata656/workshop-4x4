import Link from "next/link";

/** Public site header. `cta={false}` on the booking page itself. */
export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-carbon/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="display text-3xl tracking-wide">
            4<span className="text-rust">×</span>4
          </span>
          <span className="label hidden md:inline">Toyota · Lexus GX/LX</span>
        </Link>
        <nav aria-label="Основна навигация" className="flex items-center gap-5 sm:gap-6">
          <Link href="/remont" className="label transition-colors hover:text-paper">
            Ремонт
          </Link>
          <Link href="/modifikatsiya" className="label transition-colors hover:text-paper">
            Модификация
          </Link>
          {cta && (
            <Link href="/zapishi-chas" className="btn hidden min-h-10 px-4 sm:inline-flex">
              Запиши час
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
