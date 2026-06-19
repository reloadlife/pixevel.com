import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { ProductManagement } from "@/components/admin/product-management";
import { listAdminProducts, toAdminProductRow } from "@/lib/admin/products";
import {
  listAdminCategories,
  listAdminTags,
  toAdminCategoryOption,
  toAdminTagOption,
} from "@/lib/admin/taxonomy";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminProductsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/products");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [products, categories, tags] = await Promise.all([
    listAdminProducts(),
    listAdminCategories(),
    listAdminTags(),
  ]);

  return (
    <AdminShell user={user}>
      <ProductManagement
        initialProducts={products.map(toAdminProductRow)}
        initialCategories={categories.map(toAdminCategoryOption)}
        initialTags={tags.map(toAdminTagOption)}
        mode="list"
      />
    </AdminShell>
  );
}
