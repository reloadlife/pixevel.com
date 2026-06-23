import { TaxReportManagement } from "@/components/admin/tax-report-management";
import { requireAdmin } from "@/lib/admin/guard";
import type { AdminListResponse } from "@/lib/admin/list-response";
import type { TaxReportRow } from "@/lib/admin/tax-report";
import { getTaxReport } from "@/lib/admin/tax-report";

export default async function AdminTaxPage() {
  await requireAdmin("/admin/tax");

  const report = await getTaxReport({});

  // Summary numeric values are stored in `counts` so they survive through
  // normalizeListResponse on the client (which only forwards rows/pagination/counts).
  const initialData: AdminListResponse<TaxReportRow> = {
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
      totalTaxCollected: Number(report.summary.totalTaxCollected),
    },
  };

  return <TaxReportManagement initialData={initialData} />;
}
