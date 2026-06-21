import { eq } from "drizzle-orm";
import { Globe, RotateCw, Settings2, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";

import { RenewButton } from "@/components/account/renew-button";
import { Card } from "@/components/ui/card";
import { type DomainStatus, domainRegistrations } from "@/db/schema";
import { daysUntil, isExpired, isExpiringSoon } from "@/lib/account/services";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { type StatusTone, toneClass } from "@/lib/status-labels";
import { cn } from "@/lib/utils";

const DOMAIN_STATUS_META: Record<DomainStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: "در حال ثبت", tone: "warning" },
  REGISTERED: { label: "ثبت‌شده", tone: "success" },
  FAILED: { label: "ناموفق", tone: "danger" },
  EXPIRED: { label: "منقضی", tone: "muted" },
};

function domainStatusMeta(status: DomainStatus) {
  return DOMAIN_STATUS_META[status] ?? { label: status, tone: "muted" as StatusTone };
}

function faDate(value: Date | string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function AccountDomainsPage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    redirect("/login?redirect=/account/domains");
  }

  const registrations = await getDb().query.domainRegistrations.findMany({
    where: eq(domainRegistrations.userId, sessionUser.id),
    orderBy: (row, { desc }) => [desc(row.createdAt)],
    limit: 100,
  });

  return (
    <main className="bg-background px-4 pb-10 pt-4 text-foreground sm:px-8 lg:px-14" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-3xl font-black">دامنه‌های من</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            فهرست دامنه‌هایی که ثبت کرده‌اید به همراه وضعیت و تاریخ انقضا.
          </p>
        </header>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-black">دامنه‌ها</h2>
            {registrations.length > 0 ? (
              <span className="text-xs text-muted-foreground">{registrations.length} مورد</span>
            ) : null}
          </div>

          {registrations.length === 0 ? (
            <div className="grid place-items-center px-5 py-14 text-center">
              <Globe className="size-9 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">هنوز دامنه‌ای ثبت نکرده‌اید.</p>
              <a
                href="/domains"
                className="mt-4 text-sm font-bold text-primary underline-offset-4 hover:underline"
              >
                جستجوی دامنه
              </a>
            </div>
          ) : (
            <div className="divide-y">
              {registrations.map((registration) => {
                const meta = domainStatusMeta(registration.status);
                const expired = isExpired(registration.expiresAt);
                const expiringSoon = isExpiringSoon(registration.expiresAt);
                const remaining = daysUntil(registration.expiresAt);
                const autoRenew = registration.autoRenew;
                const renewable =
                  registration.status === "REGISTERED" || registration.status === "EXPIRED";

                return (
                  <div
                    key={registration.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-black" dir="ltr">
                          {registration.domainName}
                        </p>
                        {autoRenew ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                            <RotateCw className="size-3" aria-hidden />
                            تمدید خودکار
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        مدت ثبت: {registration.years} سال
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                          toneClass(meta.tone),
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        انقضا: {faDate(registration.expiresAt)}
                      </span>
                      {expired ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                          <TriangleAlert className="size-3" aria-hidden />
                          منقضی شده
                        </span>
                      ) : expiringSoon && remaining != null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <TriangleAlert className="size-3" aria-hidden />
                          {remaining} روز تا انقضا
                        </span>
                      ) : null}
                    </div>

                    <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                      <a
                        href={`/account/domains/${registration.id}`}
                        className="inline-flex h-7 items-center gap-1 rounded-2xl border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Settings2 className="size-3.5" aria-hidden />
                        مدیریت
                      </a>
                      {renewable ? (
                        <RenewButton endpoint={`/api/domains/${registration.id}/renew`} />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
