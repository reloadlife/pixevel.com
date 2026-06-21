import { desc, eq } from "drizzle-orm";
import { RotateCw, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RenewButton } from "@/components/account/renew-button";
import { Card } from "@/components/ui/card";
import { serverInstances } from "@/db/schema";
import { daysUntil, isExpired, isExpiringSoon, readAutoRenew } from "@/lib/account/services";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { type StatusTone, toneClass } from "@/lib/status-labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "سرورهای من | Pixevel",
};

const SERVER_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: "در حال آماده‌سازی", tone: "warning" },
  ACTIVE: { label: "فعال", tone: "success" },
  FAILED: { label: "ناموفق", tone: "danger" },
  SUSPENDED: { label: "معلق", tone: "warning" },
  TERMINATED: { label: "خاتمه‌یافته", tone: "muted" },
};

function statusMeta(status: string) {
  return SERVER_STATUS[status] ?? { label: status, tone: "muted" as StatusTone };
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

type Specs = { cpu?: number; ram?: number; diskGb?: number };

function readSpecs(value: unknown): Specs {
  return value && typeof value === "object" ? (value as Specs) : {};
}

function specsLabel(specs: Specs): string {
  const parts: string[] = [];
  if (specs.cpu != null) parts.push(`${specs.cpu} هسته`);
  if (specs.ram != null) parts.push(`${specs.ram} گیگ رم`);
  if (specs.diskGb != null) parts.push(`${specs.diskGb} گیگ دیسک`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default async function AccountServersPage() {
  noStore();

  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    redirect("/login?redirect=/account/servers");
  }

  const ordered = await getDb()
    .select()
    .from(serverInstances)
    .where(eq(serverInstances.userId, sessionUser.id))
    .orderBy(desc(serverInstances.createdAt));

  return (
    <main className="bg-background px-4 pb-12 pt-4 text-foreground sm:px-8 lg:px-14" dir="rtl">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">سرورهای من</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              سرورهای ابری فعال و سفارش‌های سرور شما.
            </p>
          </div>
          <Link
            href="/servers"
            className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground transition hover:opacity-90"
          >
            خرید سرور جدید
          </Link>
        </header>

        {ordered.length === 0 ? (
          <Card className="px-5 py-14 text-center">
            <p className="text-sm text-muted-foreground">هنوز سروری ندارید.</p>
            <Link
              href="/servers"
              className="mt-4 inline-block text-sm font-black text-primary underline-offset-4 hover:underline"
            >
              مشاهده پلن‌های سرور
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {ordered.map((instance) => {
              const meta = statusMeta(instance.status);
              const specs = readSpecs(instance.specs);
              const expired = isExpired(instance.expiresAt);
              const expiringSoon = isExpiringSoon(instance.expiresAt);
              const remaining = daysUntil(instance.expiresAt);
              const autoRenew = readAutoRenew(instance.providerPayload);
              const renewable = instance.status === "ACTIVE" || instance.status === "SUSPENDED";

              return (
                <Card key={instance.id} className="overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black" dir="ltr">
                          {instance.planCode}
                        </h2>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                            toneClass(meta.tone),
                          )}
                        >
                          {meta.label}
                        </span>
                        {autoRenew ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                            <RotateCw className="size-3" aria-hidden />
                            تمدید خودکار
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{specsLabel(specs)}</p>
                    </div>

                    <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">آی‌پی</dt>
                        <dd className="font-bold" dir="ltr">
                          {instance.ipAddress ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">دوره</dt>
                        <dd className="font-bold">{instance.periodMonths} ماه</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">انقضا</dt>
                        <dd className="font-bold">{faDate(instance.expiresAt)}</dd>
                      </div>
                    </dl>
                  </div>

                  {expired || expiringSoon || renewable ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
                      <div>
                        {expired ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">
                            <TriangleAlert className="size-3" aria-hidden />
                            منقضی شده
                          </span>
                        ) : expiringSoon && remaining != null ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <TriangleAlert className="size-3" aria-hidden />
                            {remaining} روز تا انقضا
                          </span>
                        ) : null}
                      </div>
                      {renewable ? (
                        <RenewButton endpoint={`/api/account/servers/${instance.id}/renew`} />
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
