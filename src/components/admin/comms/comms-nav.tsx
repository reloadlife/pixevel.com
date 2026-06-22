"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/communications", label: "نمای کلی", exact: true },
  { href: "/admin/communications/logs", label: "همه پیام‌ها", exact: false },
  { href: "/admin/communications/calls", label: "تماس‌ها", exact: false },
  { href: "/admin/communications/callbacks", label: "کال‌بک‌ها", exact: false },
  { href: "/admin/communications/templates", label: "قالب‌ها", exact: false },
  { href: "/admin/communications/settings", label: "تنظیمات و توکن‌ها", exact: false },
];

export function CommsNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-wrap gap-1 rounded-2xl border border-border bg-muted/30 p-1">
      {ITEMS.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-bold transition ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
