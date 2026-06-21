import {
  Bell,
  CreditCard,
  Gift,
  Globe,
  Heart,
  KeyRound,
  LifeBuoy,
  type LucideIcon,
  MapPin,
  Server,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { type AccountDashboard, getAccountDashboard } from "@/lib/account/dashboard";
import { getCurrentUser } from "@/lib/auth";
import { formatToman, toFaNumber } from "@/lib/format";
import {
  orderStatusMeta,
  paymentStatusMeta,
  type StatusTone,
  toneClass,
} from "@/lib/status-labels";
import { cn } from "@/lib/utils";

function faDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
        toneClass(tone),
      )}
    >
      {label}
    </span>
  );
}

type Stat = {
  label: string;
  value: string;
  icon: LucideIcon;
  href: string;
  /** Highlight in gold for premium-relevant or attention metrics. */
  gold?: boolean;
};

function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon;
  return (
    <Link href={stat.href} className="group">
      <Card size="sm" className="h-full justify-between transition group-hover:ring-foreground/15">
        <div className="flex items-center justify-between px-4">
          <span className="text-xs font-bold text-muted-foreground">{stat.label}</span>
          <Icon
            className={cn("size-4.5", stat.gold ? "text-gold" : "text-muted-foreground")}
            aria-hidden
          />
        </div>
        <p className={cn("px-4 text-lg font-black", stat.gold && "text-gold")}>{stat.value}</p>
      </Card>
    </Link>
  );
}

type QuickLink = { href: string; label: string; icon: LucideIcon };

const QUICK_LINKS: QuickLink[] = [
  { href: "/account/orders", label: "سفارش‌ها", icon: ShoppingBag },
  { href: "/account/keys", label: "کلیدها و کدها", icon: KeyRound },
  { href: "/account/wishlist", label: "علاقه‌مندی‌ها", icon: Heart },
  { href: "/account/wallet", label: "کیف پول", icon: Wallet },
  { href: "/account/rewards", label: "باشگاه مشتریان", icon: Gift },
  { href: "/account/referrals", label: "معرفی دوستان", icon: Users },
  { href: "/account/addresses", label: "آدرس‌ها", icon: MapPin },
  { href: "/account/reviews", label: "دیدگاه‌ها", icon: Star },
  { href: "/account/domains", label: "دامنه‌ها", icon: Globe },
  { href: "/account/servers", label: "سرورها", icon: Server },
  { href: "/account/settings", label: "تنظیمات", icon: Settings },
  { href: "/account/support", label: "پشتیبانی", icon: LifeBuoy },
];

function Greeting({ profile }: { profile: AccountDashboard["profile"] }) {
  const name = profile.fullName?.trim() || "کاربر پیسکول";
  const initial = profile.fullName?.trim()?.[0] || profile.phone?.slice(-1) || "؟";

  return (
    <Card className={cn("p-5 sm:p-6", profile.isPremium && "ring-gold/30 dark:ring-gold/30")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gold/15 text-xl font-black text-gold",
              profile.isPremium && "ring-2 ring-gold ring-offset-2 ring-offset-card",
            )}
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={name} className="size-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black">سلام، {name}</h1>
              {profile.isPremium ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-black text-gold">
                  <Sparkles className="size-3.5" aria-hidden />
                  کاربر طلایی
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
              {profile.phone}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              عضو از {faDate(profile.createdAt)}
            </p>
          </div>
        </div>
        <Link
          href="/account/settings"
          className="shrink-0 rounded-xl border px-4 py-2 text-sm font-bold transition hover:bg-muted"
        >
          ویرایش پروفایل
        </Link>
      </div>
    </Card>
  );
}

export default async function AccountPage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    redirect("/login?redirect=/account");
  }

  const dashboard = await getAccountDashboard(sessionUser.id);
  if (!dashboard) {
    redirect("/login?redirect=/account");
  }

  const { profile, stats, recentOrders } = dashboard;

  const statCards: Stat[] = [
    {
      label: "سفارش‌ها",
      value: toFaNumber(stats.ordersCount),
      icon: ShoppingBag,
      href: "/account/orders",
    },
    {
      label: "مجموع خرید",
      value: formatToman(stats.totalSpent),
      icon: CreditCard,
      href: "/account/payments",
    },
    {
      label: "موجودی کیف پول",
      value: formatToman(stats.walletBalance),
      icon: Wallet,
      href: "/account/wallet",
      gold: true,
    },
    {
      label: "امتیاز باشگاه",
      value: toFaNumber(stats.loyaltyPoints),
      icon: Gift,
      href: "/account/rewards",
      gold: true,
    },
    {
      label: "سرویس‌های فعال",
      value: toFaNumber(stats.activeServices),
      icon: Server,
      href: "/account/servers",
    },
    {
      label: "اعلان‌های خوانده‌نشده",
      value: toFaNumber(stats.unreadNotifications),
      icon: Bell,
      href: "/account/notifications",
    },
  ];

  return (
    <main className="space-y-6 pb-10">
      <Greeting profile={profile} />

      <section>
        <h2 className="mb-3 text-sm font-black text-muted-foreground">یک نگاه کلی</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {statCards.map((stat) => (
            <StatCard key={stat.href + stat.label} stat={stat} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-black text-muted-foreground">دسترسی سریع</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center text-xs font-bold text-foreground/80 transition hover:bg-muted hover:text-foreground"
              >
                <Icon className="size-6 text-muted-foreground" aria-hidden />
                {link.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-black">سفارش‌های اخیر</h2>
            <Link
              href="/account/orders"
              className="text-xs font-bold text-primary underline-offset-4 hover:underline"
            >
              مشاهده همه
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="grid place-items-center px-5 py-12 text-center">
              <ShoppingBag className="size-9 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">هنوز سفارشی ثبت نکرده‌اید.</p>
              <Link
                href="/"
                className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground transition hover:opacity-90"
              >
                شروع خرید
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recentOrders.map((order) => {
                const meta = orderStatusMeta(order.status);
                const payMeta = paymentStatusMeta(order.paymentStatus);
                return (
                  <Link
                    key={order.id}
                    href={`/account/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="font-black" dir="ltr">
                        {order.orderNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {faDate(order.createdAt)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge label={meta.label} tone={meta.tone} />
                        <StatusBadge label={payMeta.label} tone={payMeta.tone} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold">
                        {formatToman(order.totalAmount.toString())}
                      </span>
                      <span aria-hidden className="text-muted-foreground">
                        ‹
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}
