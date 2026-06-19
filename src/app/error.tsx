"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Segment error boundary. Next 16 passes `unstable_retry` as the preferred
 * recovery function (it re-fetches and re-renders the boundary's children).
 */
export default function SegmentError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      className="mx-auto grid min-h-[70dvh] w-full max-w-2xl place-items-center px-4 py-16 text-center text-foreground sm:px-6"
      dir="rtl"
    >
      <div>
        <p className="text-5xl font-black text-gold">خطا</p>
        <h1 className="mt-4 text-2xl font-black">مشکلی پیش آمد</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          متأسفیم، در بارگذاری این بخش خطایی رخ داد. لطفاً دوباره تلاش کنید؛ اگر مشکل ادامه داشت با
          پشتیبانی در تماس باشید.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground" dir="ltr">
            کد خطا: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-lg bg-gold px-5 py-2.5 font-black text-background transition hover:bg-gold-strong"
          >
            تلاش دوباره
          </button>
          <Link
            href="/"
            className="rounded-lg border border-border px-5 py-2.5 font-bold transition hover:bg-muted"
          >
            بازگشت به خانه
          </Link>
        </div>
      </div>
    </main>
  );
}
