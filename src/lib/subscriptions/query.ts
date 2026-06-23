import "server-only";

import { count, desc, eq } from "drizzle-orm";

import { type SubscriptionStatus, subscriptions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { decimalToNumber } from "@/lib/format";

function mapInvoice(inv: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  amount: unknown;
  status: string;
  dueAt: Date;
  paidAt: Date | null;
}) {
  return {
    id: inv.id,
    periodStart: inv.periodStart.toISOString(),
    periodEnd: inv.periodEnd.toISOString(),
    amount: decimalToNumber(inv.amount),
    status: inv.status,
    dueAt: inv.dueAt.toISOString(),
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
  };
}

export type AccountSubscription = ReturnType<typeof mapAccountSubscription>;

function mapAccountSubscription(sub: {
  id: string;
  titleFa: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingAt: Date | null;
  priceAmount: unknown;
  currency: string;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  product?: { slug: string } | null;
  invoices?: Array<Parameters<typeof mapInvoice>[0]>;
}) {
  return {
    id: sub.id,
    titleFa: sub.titleFa,
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    nextBillingAt: sub.nextBillingAt ? sub.nextBillingAt.toISOString() : null,
    priceAmount: decimalToNumber(sub.priceAmount),
    currency: sub.currency,
    autoRenew: sub.autoRenew,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    productSlug: sub.product?.slug ?? null,
    invoices: (sub.invoices ?? []).map(mapInvoice),
  };
}

/** All subscriptions for a user, newest first, with invoice history. */
export async function listUserSubscriptions(userId: string): Promise<AccountSubscription[]> {
  const rows = await getDb().query.subscriptions.findMany({
    where: (s, { eq: e }) => e(s.userId, userId),
    with: {
      product: { columns: { slug: true } },
      invoices: { orderBy: (inv, { desc: d }) => [d(inv.periodStart)] },
    },
    orderBy: (s, { desc: d }) => [d(s.createdAt)],
  });
  return rows.map(mapAccountSubscription);
}

export async function getUserSubscription(
  subId: string,
  userId: string,
): Promise<AccountSubscription | null> {
  const sub = await getDb().query.subscriptions.findFirst({
    where: (s, { eq: e, and: a }) => a(e(s.id, subId), e(s.userId, userId)),
    with: {
      product: { columns: { slug: true } },
      invoices: { orderBy: (inv, { desc: d }) => [d(inv.periodStart)] },
    },
  });
  return sub ? mapAccountSubscription(sub) : null;
}

export async function countActiveSubscriptions(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  return row?.total ?? 0;
}

// ── Admin ────────────────────────────────────────────────────────────────────

export type AdminSubscriptionRow = {
  id: string;
  titleFa: string;
  status: string;
  userId: string;
  userPhone: string | null;
  userName: string | null;
  priceAmount: number;
  currency: string;
  autoRenew: boolean;
  currentPeriodEnd: string;
  nextBillingAt: string | null;
  createdAt: string;
};

export async function listAdminSubscriptions(filters: {
  status?: SubscriptionStatus;
  userId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminSubscriptionRow[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

  const rows = await db.query.subscriptions.findMany({
    where: (s, { eq: e, and: a }) => {
      const conds = [];
      if (filters.status) conds.push(e(s.status, filters.status));
      if (filters.userId) conds.push(e(s.userId, filters.userId));
      return conds.length ? a(...conds) : undefined;
    },
    with: { user: { columns: { phone: true, fullName: true } } },
    orderBy: (s) => [desc(s.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const [totalRow] = await db.select({ total: count() }).from(subscriptions);

  return {
    rows: rows.map((sub) => ({
      id: sub.id,
      titleFa: sub.titleFa,
      status: sub.status,
      userId: sub.userId,
      userPhone: sub.user?.phone ?? null,
      userName: sub.user?.fullName ?? null,
      priceAmount: decimalToNumber(sub.priceAmount),
      currency: sub.currency,
      autoRenew: sub.autoRenew,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      nextBillingAt: sub.nextBillingAt ? sub.nextBillingAt.toISOString() : null,
      createdAt: sub.createdAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}
