"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Theme = "dark" | "light";

type Props = {
  currentTheme: Theme;
};

export function ThemeToggle({ currentTheme }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggleTheme() {
    const nextTheme: Theme = currentTheme === "dark" ? "light" : "dark";
    setPending(true);
    try {
      await fetch("/api/preferences/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const isDark = currentTheme === "dark";

  return (
    <section className="border border-border bg-card p-4">
      <h2 className="font-black text-amber-400">تنظیمات ویژه</h2>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">{isDark ? "حالت تیره" : "حالت روشن"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isDark ? "پوسته تیره فعال است" : "پوسته روشن فعال است"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          disabled={pending}
          className="relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
          style={{ backgroundColor: isDark ? "rgb(251 191 36)" : "transparent" }}
          aria-label={isDark ? "تغییر به حالت روشن" : "تغییر به حالت تیره"}
        >
          <span
            className="pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform"
            style={{ transform: isDark ? "translateX(-1.75rem)" : "translateX(-0.25rem)" }}
          />
        </button>
      </div>
    </section>
  );
}
