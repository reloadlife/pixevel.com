import { ArrowDownCircle, ArrowUpCircle, Gift, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import {
  getLoyaltyOverview,
  LOYALTY_EARN_RATE,
  LOYALTY_MIN_REDEEM,
  LOYALTY_POINT_VALUE_TOMAN,
  type LoyaltyTransactionRow,
  tierLabel,
} from "@/lib/account/loyalty";
import { getCurrentUser } from "@/lib/auth";
import { formatToman, toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RedeemForm } from "./redeem-form";

function faDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function txnReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    EARN: "کسب امتیاز از خرید",
    REDEEM: "تبدیل به اعتبار کیف پول",
    EXPIRE: "انقضای امتیاز",
    ADJUST: "اصلاح امتیاز",
    REFERRAL: "امتیاز معرفی دوستان",
  };
  return map[reason] ?? reason;
}

const EARN_STEPS: { title: string; body: string }[] = [
  {
    title: "خرید کنید",
    body: `با هر ${formatToman(LOYALTY_EARN_RATE)} خرید پرداخت‌شده، ${toFaNumber(1)} امتیاز دریافت می‌کنید.`,
  },
  {
    title: "ارتقای سطح",
    body: "با جمع‌آوری امتیاز در طول زمان، سطح عضویت شما از برنزی به نقره‌ای و طلایی ارتقا می‌یابد.",
  },
  {
    title: "تبدیل و استفاده",
    body: `هر ${toFaNumber(1)} امتیاز را به ${formatToman(LOYALTY_POINT_VALUE_TOMAN)} اعتبار کیف پول تبدیل کنید.`,
  },
];

export default async function RewardsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/rewards");
  }

  const { account, tier, nextTier, transactions } = await getLoyaltyOverview(user.id);
  const balanceValueToman = account.pointsBalance * LOYALTY_POINT_VALUE_TOMAN;

  return (
    <main dir="rtl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Rewards
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-black sm:text-3xl">
          <Gift className="size-6 text-gold" aria-hidden />
          باشگاه مشتریان
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          امتیاز جمع کنید، سطح بگیرید و آن را به اعتبار کیف پول تبدیل کنید.
        </p>
      </header>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-gold/10 p-5 ring-gold/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">امتیاز قابل استفاده</span>
            <Sparkles className="size-4.5 text-gold" aria-hidden />
          </div>
          <p className="mt-2 text-3xl font-black text-gold">{toFaNumber(account.pointsBalance)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            معادل تقریبی {formatToman(balanceValueToman)}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">سطح عضویت</span>
            <Trophy className="size-4.5 text-gold" aria-hidden />
          </div>
          <p className="mt-2 text-3xl font-black">{tierLabel(tier)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {nextTier
              ? `${toFaNumber(nextTier.remaining)} امتیاز تا سطح ${tierLabel(nextTier.tier)}`
              : "بالاترین سطح عضویت"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">امتیاز مادام‌العمر</span>
            <ArrowUpCircle className="size-4.5 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-2 text-3xl font-black">{toFaNumber(account.lifetimePoints)}</p>
          <p className="mt-1 text-xs text-muted-foreground">مجموع امتیازهای کسب‌شده تاکنون</p>
        </Card>
      </div>

      {/* Redeem + how to earn */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <RedeemForm
          pointsBalance={account.pointsBalance}
          minRedeem={LOYALTY_MIN_REDEEM}
          pointValueToman={LOYALTY_POINT_VALUE_TOMAN}
        />

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-black">چطور امتیاز جمع کنم؟</h2>
          <ol className="mt-4 space-y-4">
            {EARN_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold/15 text-sm font-black text-gold">
                  {toFaNumber(i + 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black">{step.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* History */}
      <section className="mt-6">
        <h2 className="mb-3 text-base font-black">تاریخچه امتیازها</h2>
        {transactions.length === 0 ? (
          <Card className="items-center p-8 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold">
              <Sparkles className="size-6" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-black">هنوز امتیازی ثبت نشده است</p>
            <p className="mt-1 text-sm text-muted-foreground">
              با اولین خرید خود امتیاز جمع کنید و آن را به اعتبار تبدیل کنید.
            </p>
            <Link
              href="/products"
              className="mt-4 inline-flex items-center rounded-full bg-foreground px-5 py-2 text-sm font-black text-background transition hover:opacity-90"
            >
              مشاهده محصولات
            </Link>
          </Card>
        ) : (
          <Card className="divide-y divide-border p-0">
            {transactions.map((txn: LoyaltyTransactionRow) => {
              const positive = txn.points >= 0;
              return (
                <div key={txn.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      positive
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {positive ? (
                      <ArrowUpCircle className="size-5" aria-hidden />
                    ) : (
                      <ArrowDownCircle className="size-5" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{txnReasonLabel(txn.reason)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{faDate(txn.createdAt)}</p>
                    {txn.note ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{txn.note}</p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-black",
                      positive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                    dir="ltr"
                  >
                    {positive ? "+" : "−"}
                    {toFaNumber(Math.abs(txn.points))}
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </main>
  );
}
