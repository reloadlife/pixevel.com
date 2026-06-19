import { redirect } from "next/navigation";

import { ProductManagement } from "@/components/admin/product-management";
import {
  listAdminCategories,
  listAdminTags,
  toAdminCategoryOption,
  toAdminTagOption,
} from "@/lib/admin/taxonomy";
import { getCurrentUser } from "@/lib/auth";

export default async function NewAdminProductPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/products/new");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [categories, tags] = await Promise.all([listAdminCategories(), listAdminTags()]);

  return (
    <ProductManagement
      initialProducts={[]}
      initialCategories={categories.map(toAdminCategoryOption)}
      initialTags={tags.map(toAdminTagOption)}
      mode="create"
    />
  );
}
