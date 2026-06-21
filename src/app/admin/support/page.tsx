import { redirect } from "next/navigation";

import { SupportManagement } from "@/components/admin/support-management";
import { listAdminTickets } from "@/lib/admin/support";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminSupportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/support");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const initial = await listAdminTickets();

  return <SupportManagement initialData={initial} />;
}
