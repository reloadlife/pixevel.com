import { redirect } from "next/navigation";

import { UserManagement } from "@/components/admin/user-management";
import { listAdminUsers, toAdminUserRow } from "@/lib/admin/users";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/users");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const result = await listAdminUsers({ page: 1 });

  return (
    <UserManagement
      initialUsers={result.rows.map(toAdminUserRow)}
      initialPagination={{
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      }}
    />
  );
}
