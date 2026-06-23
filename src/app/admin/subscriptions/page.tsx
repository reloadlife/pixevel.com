import { redirect } from "next/navigation";

import { SubscriptionManagement } from "@/components/admin/subscription-management";
import { getCurrentUser } from "@/lib/auth";
import { listAdminSubscriptions } from "@/lib/subscriptions/query";

export default async function AdminSubscriptionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/subscriptions");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const data = await listAdminSubscriptions({ page: 1, pageSize: 50 });

  return <SubscriptionManagement initialData={data} />;
}
