import { and, count, desc, eq, inArray, isNull, sum } from "drizzle-orm";

import {
  domainRegistrations,
  loyaltyAccounts,
  notifications,
  orders,
  serverInstances,
  users,
  wallets,
} from "@/db/schema";
import { getDb } from "@/lib/db";

export type DashboardOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: Date;
};

export type AccountDashboard = {
  profile: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    isPremium: boolean;
    premiumAt: Date | null;
    avatarUrl: string | null;
    createdAt: Date;
    lastLoginAt: Date | null;
  };
  stats: {
    ordersCount: number;
    totalSpent: number;
    walletBalance: number;
    loyaltyPoints: number;
    activeServices: number;
    unreadNotifications: number;
  };
  recentOrders: DashboardOrder[];
};

/**
 * Aggregates everything the account dashboard renders in a single batch of
 * parallel queries. Returns `null` when the user no longer exists (caller
 * should redirect to login).
 */
export async function getAccountDashboard(userId: string): Promise<AccountDashboard | null> {
  const db = getDb();

  const [
    profile,
    ordersCountRow,
    totalSpentRow,
    walletRow,
    loyaltyRow,
    domainsCountRow,
    serversCountRow,
    unreadRow,
    recentOrders,
  ] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        fullName: true,
        phone: true,
        email: true,
        isPremium: true,
        premiumAt: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    db.select({ value: count() }).from(orders).where(eq(orders.userId, userId)),
    db
      .select({ value: sum(orders.totalAmount) })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.paymentStatus, "PAID"))),
    db
      .select({ value: wallets.balanceAmount })
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1),
    db
      .select({ value: loyaltyAccounts.pointsBalance })
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.userId, userId))
      .limit(1),
    db
      .select({ value: count() })
      .from(domainRegistrations)
      .where(
        and(eq(domainRegistrations.userId, userId), eq(domainRegistrations.status, "REGISTERED")),
      ),
    db
      .select({ value: count() })
      .from(serverInstances)
      .where(and(eq(serverInstances.userId, userId), inArray(serverInstances.status, ["ACTIVE"]))),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    db.query.orders.findMany({
      where: eq(orders.userId, userId),
      orderBy: [desc(orders.createdAt)],
      limit: 5,
      columns: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
      },
    }),
  ]);

  if (!profile) {
    return null;
  }

  const activeServices =
    Number(domainsCountRow[0]?.value ?? 0) + Number(serversCountRow[0]?.value ?? 0);

  return {
    profile,
    stats: {
      ordersCount: Number(ordersCountRow[0]?.value ?? 0),
      totalSpent: Number(totalSpentRow[0]?.value ?? 0),
      walletBalance: Number(walletRow[0]?.value ?? 0),
      loyaltyPoints: Number(loyaltyRow[0]?.value ?? 0),
      activeServices,
      unreadNotifications: Number(unreadRow[0]?.value ?? 0),
    },
    recentOrders,
  };
}
