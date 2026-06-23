import { eq } from "drizzle-orm";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { type AccountProfile, ProfileCard } from "@/components/account/profile-card";
import { Card } from "@/components/ui/card";
import { notificationPreferences, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { DangerZone } from "./danger-zone";
import { type NotificationPrefs, NotificationPrefsForm } from "./notification-prefs";

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-black text-muted-foreground">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

export default async function SettingsPage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    redirect("/login?redirect=/account/settings");
  }

  const db = getDb();

  const profileRow = await db.query.users.findFirst({
    where: eq(users.id, sessionUser.id),
    columns: {
      fullName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      isPremium: true,
      createdAt: true,
      defaultAddressLine: true,
      defaultCity: true,
      defaultProvince: true,
      defaultPostalCode: true,
    },
  });

  if (!profileRow) {
    redirect("/login?redirect=/account/settings");
  }

  // Get-or-create notification preferences with schema defaults.
  let prefsRow = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, sessionUser.id),
  });
  if (!prefsRow) {
    [prefsRow] = await db
      .insert(notificationPreferences)
      .values({ userId: sessionUser.id })
      .onConflictDoNothing({ target: notificationPreferences.userId })
      .returning();
    if (!prefsRow) {
      prefsRow = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, sessionUser.id),
      });
    }
  }

  const profile: AccountProfile = profileRow;

  const prefs: NotificationPrefs = {
    orderEmail: prefsRow?.orderEmail ?? true,
    orderSms: prefsRow?.orderSms ?? true,
    subscriptionEmail: prefsRow?.subscriptionEmail ?? true,
    subscriptionSms: prefsRow?.subscriptionSms ?? true,
    promoEmail: prefsRow?.promoEmail ?? false,
    promoSms: prefsRow?.promoSms ?? false,
    newsletterEmail: prefsRow?.newsletterEmail ?? false,
  };

  return (
    <main className="space-y-6 pb-10">
      <header>
        <h1 className="text-xl font-black">تنظیمات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          مدیریت پروفایل، اعلان‌ها و امنیت حساب کاربری.
        </p>
      </header>

      <section>
        <SectionHeader title="پروفایل" hint="ویرایش نام، ایمیل، تصویر و شماره موبایل" />
        <ProfileCard profile={profile} />
      </section>

      <section>
        <SectionHeader title="اعلان‌ها" hint="انتخاب اینکه چه اطلاع‌رسانی‌هایی دریافت کنید" />
        <Card className="p-5 sm:p-6">
          <NotificationPrefsForm initial={prefs} />
        </Card>
      </section>

      <section>
        <SectionHeader title="امنیت" />
        <Link href="/account/security" className="group block">
          <Card className="p-5 transition group-hover:ring-foreground/15 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
                  <ShieldCheck className="size-5 text-muted-foreground" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-bold">نشست‌ها و امنیت</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    دستگاه‌های فعال و تاریخچهٔ ورود
                  </p>
                </div>
              </div>
              <ChevronLeft className="size-5 text-muted-foreground" aria-hidden />
            </div>
          </Card>
        </Link>
      </section>

      <section>
        <SectionHeader title="منطقهٔ خطر" />
        <Card className="p-5 sm:p-6">
          <DangerZone />
        </Card>
      </section>
    </main>
  );
}
