import type { OrderStatus, PaymentStatus } from "@/db/schema";
import {
  type AdminOrderFilter,
  countPendingReceipts,
  listAdminOrdersPaged,
  toAdminOrderRow,
} from "@/lib/admin/orders";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("FORBIDDEN", "دسترسی مجاز نیست.", 403);
  }

  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") as OrderStatus | null;
  const paymentStatus = searchParams.get("paymentStatus") as PaymentStatus | null;
  const provider = searchParams.get("provider");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const pendingReceipts = searchParams.get("pendingReceipts") === "1";

  const pageRaw = Number(searchParams.get("page"));
  const pageSizeRaw = Number(searchParams.get("pageSize"));

  const filter: AdminOrderFilter = {
    status: status ?? undefined,
    paymentStatus: paymentStatus ?? undefined,
    provider: provider ?? undefined,
    search: search ?? undefined,
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
    pendingReceipts: pendingReceipts || undefined,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : undefined,
    pageSize: Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : undefined,
  };

  const [{ rows, meta }, pendingReceiptsCount] = await Promise.all([
    listAdminOrdersPaged(filter),
    countPendingReceipts(),
  ]);

  return apiOk({
    orders: rows.map(toAdminOrderRow),
    meta,
    pendingReceiptsCount,
  });
}
