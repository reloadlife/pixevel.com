import { ReviewManagement } from "@/components/admin/review-management";
import { requireAdmin } from "@/lib/admin/guard";
import { listReviews } from "@/lib/admin/reviews";

export default async function AdminReviewsPage() {
  await requireAdmin("/admin/reviews");

  // Default tab is PENDING — fetch the same filter so the client's initialData
  // matches the initial query key (no wrong-data flash on mount).
  const initialData = await listReviews({ status: "PENDING" });

  return <ReviewManagement initialData={initialData} />;
}
