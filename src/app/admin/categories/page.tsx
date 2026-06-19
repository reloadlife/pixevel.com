import { redirect } from "next/navigation";

import { CategoryManagement } from "@/components/admin/taxonomy-management";
import { listAdminCategories, toAdminCategoryOption } from "@/lib/admin/taxonomy";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminCategoriesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/categories");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const categories = await listAdminCategories();

  return <CategoryManagement initialCategories={categories.map(toAdminCategoryOption)} />;
}
