import { Gift, Sparkles, UserPlus, Users } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getReferralSummary,
  REFERRAL_REFEREE_WELCOME_POINTS,
  REFERRAL_REFERRER_POINTS,
  type ReferralListEntry,
} from "@/lib/account/referrals";
import { getCurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";
import { type StatusTone, toneClass } from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import { ShareBox } from "./share-box";

export const dynamic = "force-dynamic";

function faDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const STATUS_META: Record<ReferralListEntry["status"], { label: string; tone: StatusTone }> = {
  PENDING: { label: "در انتظار", tone: "warning" },
  QUALIFIED: { label: "واجد شرایط", tone: "info" },
  REWARDED: { label: "پاداش داده شد", tone: "success" },
};

/**
 * Resolves the public site origin from the incoming request headers so the
 * shareable link works in any environment without a hardcoded domain.
 */
async function getSiteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "pixevel.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ReferralsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/referrals");
  }

  const [summary, origin] = await Promise.all([getReferralSummary(user.id), getSiteOrigin()]);
  const shareLink = `${origin}/?ref=${encodeURIComponent(summary.code)}`;

  const stats: { label: string; value: string; icon: typeof Users }[] = [
    { label: "افراد دعوت‌شده", value: toFaNumber(summary.totalInvited), icon: Users },
    {
      label: "پاداش دریافتی",
      value: `${toFaNumber(summary.totalRewardPoints)} امتیاز`,
      icon: Gift,
    },
    { label: "در انتظار", value: toFaNumber(summary.pendingCount), icon: UserPlus },
  ];

  return (
    <main className="bg-background px-4 pt-4 text-foreground sm:px-8 lg:px-14" dir="rtl">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-3 text-4xl font-black">دعوت دوستان</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          دوستانتان را به پیکسِوِل دعوت کنید و با هر خرید موفق آن‌ها امتیاز هدیه بگیرید.
        </p>
      </header>

      {/* How it works + share */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-gold/15 text-gold">
              <Sparkles className="size-5" />
            </span>
            <h2 className="text-lg font-black">کد دعوت من</h2>
          </div>
          <ShareBox code={summary.code} link={shareLink} />
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-black">چطور کار می‌کند؟</h2>
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-black">
                ۱
              </span>
              <p className="text-muted-foreground">
                لینک یا کد دعوت خود را برای دوستانتان بفرستید.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-black">
                ۲
              </span>
              <p className="text-muted-foreground">
                دوست شما با این کد ثبت‌نام می‌کند و{" "}
                <span className="font-black text-gold">
                  {toFaNumber(REFERRAL_REFEREE_WELCOME_POINTS)} امتیاز خوش‌آمدگویی
                </span>{" "}
                دریافت می‌کند.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-black">
                ۳
              </span>
              <p className="text-muted-foreground">
                وقتی اولین خرید دوست شما پرداخت شد، شما{" "}
                <span className="font-black text-gold">
                  {toFaNumber(REFERRAL_REFERRER_POINTS)} امتیاز
                </span>{" "}
                پاداش می‌گیرید.
              </p>
            </li>
          </ol>
        </Card>
      </div>

      {/* Reward summary */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
                <stat.icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Invited list */}
      <section className="mt-5">
        <h2 className="mb-4 text-lg font-black">افرادی که دعوت کرده‌اید</h2>

        {summary.referrals.length === 0 ? (
          <Card className="p-8 text-center">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-gold/15 text-gold">
              <UserPlus className="size-6" />
            </span>
            <p className="text-base font-black">هنوز کسی را دعوت نکرده‌اید</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              کد دعوت خود را با دوستانتان به اشتراک بگذارید تا اولین امتیازهای پاداش را دریافت کنید.
            </p>
            <a
              href="#referral-code"
              className="mt-5 inline-flex items-center justify-center rounded-md bg-gold px-5 py-2.5 text-sm font-black text-background transition-opacity hover:opacity-90"
            >
              اشتراک‌گذاری کد دعوت
            </a>
          </Card>
        ) : (
          <Card className="divide-y divide-border p-0">
            {summary.referrals.map((entry) => {
              const meta = STATUS_META[entry.status];
              const display = entry.inviteeName || entry.inviteePhone || "کاربر دعوت‌شده";
              return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-black">{display}</p>
                    {entry.inviteeName && entry.inviteePhone ? (
                      <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                        {entry.inviteePhone}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      دعوت در {faDate(entry.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {entry.rewardPoints > 0 ? (
                      <span className="text-sm font-black text-gold">
                        +{toFaNumber(entry.rewardPoints)} امتیاز
                      </span>
                    ) : null}
                    <Badge className={cn("border-0", toneClass(meta.tone))}>{meta.label}</Badge>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <div className="mt-6">
        <a href="/account" className="text-sm text-muted-foreground underline underline-offset-4">
          ← بازگشت به حساب کاربری
        </a>
      </div>
    </main>
  );
}
