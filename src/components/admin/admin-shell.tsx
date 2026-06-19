import Link from "next/link";

import type { CurrentUser } from "@/lib/auth";

export function AdminShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return (
    <main className="admin-light min-h-dvh overflow-x-hidden bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-3 py-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Pixevel Admin
            </p>
            <h1 className="text-xl font-black">پنل مدیریت</h1>
          </div>
          <div className="max-w-full text-left text-xs text-zinc-500 sm:shrink-0" dir="ltr">
            {user.phone}
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-4 px-3 py-4 sm:px-8 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <aside className="h-fit min-w-0 border border-zinc-200 bg-white p-2 sm:p-3">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-sm font-bold lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0">
            <Link
              href="/admin"
              className="shrink-0 whitespace-nowrap px-3 py-2 hover:bg-zinc-100 lg:shrink lg:whitespace-normal"
            >
              داشبورد
            </Link>
            <Link
              href="/admin/products"
              className="shrink-0 whitespace-nowrap px-3 py-2 hover:bg-zinc-100 lg:shrink lg:whitespace-normal"
            >
              محصولات
            </Link>
            <Link
              href="/admin/products/new"
              className="shrink-0 whitespace-nowrap px-3 py-2 hover:bg-zinc-100 lg:shrink lg:whitespace-normal"
            >
              افزودن محصول
            </Link>
            <Link
              href="/admin/categories"
              className="shrink-0 whitespace-nowrap px-3 py-2 hover:bg-zinc-100 lg:shrink lg:whitespace-normal"
            >
              دسته‌ها
            </Link>
            <Link
              href="/admin/tags"
              className="shrink-0 whitespace-nowrap px-3 py-2 hover:bg-zinc-100 lg:shrink lg:whitespace-normal"
            >
              تگ‌ها
            </Link>
            <Link
              href="/admin/homepage"
              className="shrink-0 whitespace-nowrap px-3 py-2 hover:bg-zinc-100 lg:shrink lg:whitespace-normal"
            >
              صفحه خانه
            </Link>
            <Link
              href="/admin/watermarks"
              className="shrink-0 whitespace-nowrap px-3 py-2 hover:bg-zinc-100 lg:shrink lg:whitespace-normal"
            >
              واترمارک‌ها
            </Link>
            <Link
              href="/admin/users"
              className="shrink-0 whitespace-nowrap px-3 py-2 hover:bg-zinc-100 lg:shrink lg:whitespace-normal"
            >
              کاربران
            </Link>
            <Link
              href="/"
              className="shrink-0 whitespace-nowrap px-3 py-2 text-zinc-500 hover:bg-zinc-100 lg:shrink lg:whitespace-normal"
            >
              مشاهده سایت
            </Link>
          </nav>
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
