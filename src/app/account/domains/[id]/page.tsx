import { ArrowRight, CalendarClock, Globe, TriangleAlert } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { DnsRecords } from "@/components/account/domains/dns-records";
import { DomainSettings } from "@/components/account/domains/domain-settings";
import { NameserversForm } from "@/components/account/domains/nameservers-form";
import { SyncButton } from "@/components/account/domains/sync-button";
import { RenewButton } from "@/components/account/renew-button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DomainStatus } from "@/db/schema";
import { daysUntil, isExpired, isExpiringSoon } from "@/lib/account/services";
import { getCurrentUser } from "@/lib/auth";
import { DomainManageError, getManagedDomain } from "@/lib/domains/manage";
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

export default async function DomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    redirect(`/login?redirect=/account/domains/${id}`);
  }

  let domain: Awaited<ReturnType<typeof getManagedDomain>>["domain"];
  let records: Awaited<ReturnType<typeof getManagedDomain>>["records"];
  try {
    const result = await getManagedDomain(sessionUser.id, id);
    domain = result.domain;
    records = result.records;
  } catch (error) {
    if (error instanceof DomainManageError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const meta = domainStatusMeta(domain.status);
  const expired = isExpired(domain.expiresAt);
  const expiringSoon = isExpiringSoon(domain.expiresAt);
  const remaining = daysUntil(domain.expiresAt);
  const renewable = domain.status === "REGISTERED" || domain.status === "EXPIRED";

  return (
    <main className="bg-background px-4 pb-10 pt-4 text-foreground sm:px-8 lg:px-14" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-6">
        <a
          href="/account/domains"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="size-4" aria-hidden />
          بازگشت به دامنه‌ها
        </a>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Globe className="size-5 text-muted-foreground" aria-hidden />
                <h1 className="truncate text-2xl font-black" dir="ltr">
                  {domain.domainName}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                    toneClass(meta.tone),
                  )}
                >
                  {meta.label}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3.5" aria-hidden />
                  انقضا: {faDate(domain.expiresAt)}
                </span>
                <span>مدت ثبت: {domain.years} سال</span>
                {domain.lastSyncedAt ? (
                  <span>آخرین همگام‌سازی: {faDate(domain.lastSyncedAt)}</span>
                ) : null}
              </div>

              {expired ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                  <TriangleAlert className="size-3" aria-hidden />
                  منقضی شده
                </span>
              ) : expiringSoon && remaining != null ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="size-3" aria-hidden />
                  {remaining} روز تا انقضا
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <SyncButton domainId={domain.id} />
              {renewable ? <RenewButton endpoint={`/api/domains/${domain.id}/renew`} /> : null}
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <DnsRecords domainId={domain.id} records={records} />
        </Card>

        <Card className="p-5 sm:p-6">
          <NameserversForm domainId={domain.id} initial={domain.nameservers} />
        </Card>

        <Card className="p-5 sm:p-6">
          <DomainSettings domainId={domain.id} domain={domain} />
        </Card>

        <Separator className="opacity-0" />
      </div>
    </main>
  );
}
