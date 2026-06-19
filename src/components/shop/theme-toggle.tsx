"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["light", "dark", "system"] as const;
type ThemeChoice = (typeof ORDER)[number];

const LABEL: Record<ThemeChoice, string> = {
  light: "روشن",
  dark: "تیره",
  system: "سیستم",
};

const ICON = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Universal light/dark/system theme switch (available to all users).
 * Cycles light → dark → system on click and persists via next-themes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes resolves the active theme only on the client; render a stable
  // placeholder until mounted to avoid a hydration mismatch.
  useEffect(() => setMounted(true), []);

  const current: ThemeChoice =
    mounted && ORDER.includes(theme as ThemeChoice) ? (theme as ThemeChoice) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICON[current];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`تغییر پوسته، فعلی: ${LABEL[current]}`}
      title={`پوسته: ${LABEL[current]}`}
      className={className ?? "transition hover:text-gold"}
    >
      <Icon className="size-5" />
    </button>
  );
}
