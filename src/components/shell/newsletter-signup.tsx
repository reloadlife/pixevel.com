"use client";

import { Check, Gift } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "done";

/**
 * Footer newsletter island, framed as a "welcome code" offer (on-brand for a
 * digital-codes store). Theme tokens (follows light/dark), single typeface
 * (Vazir) with weight for hierarchy. Posts { email } to /api/newsletter and
 * confirms inline plus a sonner toast (shared Toaster in the root layout).
 */
export function NewsletterSignup({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;

    const value = email.trim();
    if (!value) {
      toast.error("ایمیلت رو وارد کن.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok: boolean;
        error?: { message?: string };
      } | null;

      if (res.ok && json?.ok) {
        toast.success("عضو خبرنامه شدی — کد خوش‌آمد به‌زودی می‌رسه.");
        setEmail("");
        setStatus("done");
      } else {
        toast.error(json?.error?.message ?? "ثبت عضویت با خطا مواجه شد.");
        setStatus("idle");
      }
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-xl border border-border bg-foreground/[0.04] px-3.5 py-3 text-sm",
          className,
        )}
        dir="rtl"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-4" />
        </span>
        <p className="font-bold text-foreground">ثبت شد — کد تخفیف خوش‌آمد به ایمیلت می‌رسه.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-2.5", className)} dir="rtl">
      <div className="flex items-center gap-2">
        <Gift className="size-4 text-foreground" aria-hidden="true" />
        <span className="text-sm font-black text-foreground">کد تخفیف خوش‌آمد بگیر</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        ایمیلت رو بده تا تازه‌ترین گیفت‌کارت‌ها و یک کد تخفیف برات بفرستیم.
      </p>
      <div className="mt-1 flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@example.com"
          aria-label="ایمیل"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
        >
          {status === "loading" ? "…" : "دریافت کد"}
        </button>
      </div>
    </form>
  );
}
