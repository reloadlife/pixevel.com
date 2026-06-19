import { redirect } from "next/navigation";

import { ReviewManagement } from "@/components/admin/review-management";
import { listReviews } from "@/lib/admin/reviews";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminReviewsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/reviews");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const initial = await listReviews();

  return <ReviewManagement initialData={initial} />;
}
