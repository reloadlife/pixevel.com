import { getTaxReport } from "@/lib/admin/tax-report";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const report = await getTaxReport({ from, to });

  // Summary numeric values are placed in `counts` so normalizeListResponse can
  // carry them through. vatRatePercent is multiplied by 100 to survive integer
  // storage (counts is Record<string, number>).
  return apiOk({
    rows: report.rows,
    pagination: {
      page: 1,
      pageSize: report.rows.length || 20,
      total: report.rows.length,
      totalPages: 1,
    },
    counts: {
      vatRatePercent: report.summary.vatRatePercent,
      taxedOrderCount: report.summary.taxedOrderCount,
      paidOrderCount: report.summary.paidOrderCount,
      // totalTaxCollected is a large integer string — store it as a number
      totalTaxCollected: Number(report.summary.totalTaxCollected),
    },
  });
}
