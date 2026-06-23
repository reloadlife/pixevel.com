import { SeoManagement } from "@/components/admin/seo-management";
import { requireAdmin } from "@/lib/admin/guard";
import { countSeoPages, listSeoHub } from "@/lib/admin/seo";
import { getGlobalDefaultsForAdmin } from "@/lib/seo/defaults";

export default async function AdminSeoPage() {
  await requireAdmin("/admin/seo");

  const [initialData, defaults, totalPages] = await Promise.all([
    listSeoHub({ page: 1 }),
    getGlobalDefaultsForAdmin(),
    countSeoPages(),
  ]);

  return <SeoManagement initialData={initialData} defaults={defaults} totalPages={totalPages} />;
}
