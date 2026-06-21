import { listUserBalances, toBalanceRow } from "@/lib/admin/balances";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim();
  const page = Number(searchParams.get("page")) || undefined;
  const pageSize = Number(searchParams.get("pageSize")) || undefined;

  const result = await listUserBalances({
    q: q && q.length > 0 ? q : undefined,
    page,
    pageSize,
  });

  return apiOk({
    users: result.rows.map(toBalanceRow),
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}
