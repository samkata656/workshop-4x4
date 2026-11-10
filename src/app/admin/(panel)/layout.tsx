import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
import { Suspense } from "react";
import { AdminNav, AdminNavFallback } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "Админ", template: "%s · Админ" }, robots: { index: false } };

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/admin/login" });
}

/**
 * Shell for every admin page. The session is checked by src/proxy.ts before
 * this renders, and again by requireAdmin() inside each page's data loader.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-line bg-carbon-raised lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <Link href="/admin" className="flex items-baseline gap-3">
            <span className="display text-3xl">
              4<span className="text-rust">×</span>4
            </span>
            <span className="label">Админ</span>
          </Link>
          <form action={logoutAction} className="lg:hidden">
            <button type="submit" className="label underline-offset-4 hover:text-paper hover:underline">
              Изход
            </button>
          </form>
        </div>
        <Suspense fallback={<AdminNavFallback />}>
          <AdminNav />
        </Suspense>
        <div className="mt-auto hidden space-y-3 border-t border-line p-5 lg:block">
          <Link href="/" className="label block hover:text-paper">
            Към сайта ↗
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="label hover:text-paper">
              Изход
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
