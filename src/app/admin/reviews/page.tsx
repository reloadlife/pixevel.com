import { ReviewManagement } from "@/components/admin/review-management";
import { requireAdmin } from "@/lib/admin/guard";
import { listReviews } from "@/lib/admin/reviews";

export default async function AdminReviewsPage() {
  await requireAdmin("/admin/reviews");

  const initialData = await listReviews();

  return <ReviewManagement initialData={initialData} />;
}
