import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { TagManagement } from "@/components/admin/taxonomy-management";
import { listAdminTags, toAdminTagOption } from "@/lib/admin/taxonomy";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminTagsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/tags");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const tags = await listAdminTags();

  return (
    <AdminShell user={user}>
      <TagManagement initialTags={tags.map(toAdminTagOption)} />
    </AdminShell>
  );
}
