import Link from "next/link";

/** A row of link chips; the current one is highlighted. */
export function FilterChips(props: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  return (
    <nav aria-label={props.label} className="flex flex-wrap gap-2">
      {props.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className="chip inline-flex min-h-10 items-center border border-line-strong"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
