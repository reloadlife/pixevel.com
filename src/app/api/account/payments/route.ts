import { eq, sql } from "drizzle-orm";

import { payments } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/**
 * GET /api/account/payments
 * Paginated payment history for the authenticated user.
 * Query: ?page=1&pageSize=20
 * Each item is suitable for both the web account UI and a future Android client.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "", 10) || DEFAULT_PAGE_SIZE),
  );

  const db = getDb();

  const [rows, [{ total }]] = await Promise.all([
    db.query.payments.findMany({
      where: (p, { eq: eqOp }) => eqOp(p.userId, user.id),
      orderBy: (p, { desc: descOp }) => [descOp(p.createdAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      with: {
        order: {
          columns: { id: true, orderNumber: true },
        },
      },
    }),
    db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(payments)
      .where(eq(payments.userId, user.id)),
  ]);

  const items = rows.map((p) => ({
    id: p.id,
    orderId: p.orderId,
    orderNumber: p.order?.orderNumber ?? null,
    provider: p.provider,
    reference: p.reference,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    receiptUrl: p.receiptUrl,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  }));

  return apiOk({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasMore: page * pageSize < total,
    },
  });
}
