import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { UserManagement } from "@/components/admin/user-management";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/users");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const users = await getDb().query.users.findMany({
    columns: {
      id: true,
      phone: true,
      fullName: true,
      role: true,
      isPremium: true,
      createdAt: true,
    },
    orderBy: (item, { desc }) => [desc(item.createdAt)],
  });

  return (
    <AdminShell user={user}>
      <UserManagement
        initialUsers={users.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
    </AdminShell>
  );
}
