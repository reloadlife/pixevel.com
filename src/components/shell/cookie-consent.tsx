"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "pixevel.cookie-consent";
type Choice = "accepted" | "declined";

/**
 * Minimal, privacy-respecting cookie banner. Essential cookies (session, cart)
 * always run; this gate only governs optional/analytics cookies and defaults to
 * declined until the user explicitly accepts. The choice is remembered in
 * localStorage so the banner shows once.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== "accepted" && stored !== "declined") {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (private mode / SSR mismatch) — stay hidden.
    }
  }, []);

  function decide(choice: Choice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Ignore persistence failures; still dismiss for this session.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="اعلان کوکی‌ها"
      dir="rtl"
      className="fixed inset-x-0 bottom-20 z-50 px-3 lg:bottom-4"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-popover/95 p-4 text-popover-foreground shadow-lg backdrop-blur-xl sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
          ما از کوکی‌های ضروری برای کارکرد فروشگاه استفاده می‌کنیم. کوکی‌های اختیاری فقط با اجازه شما
          فعال می‌شوند. بیشتر بخوانید در{" "}
          <Link href="/privacy" className="font-bold text-foreground underline">
            حریم خصوصی
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("declined")}
            className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
          >
            فقط ضروری
          </button>
          <button
            type="button"
            onClick={() => decide("accepted")}
            className="rounded-lg bg-gold px-4 py-2 text-xs font-black text-background transition hover:bg-gold-strong"
          >
            پذیرفتن همه
          </button>
        </div>
      </div>
    </div>
  );
}
