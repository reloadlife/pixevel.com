import { redirect } from "next/navigation";

import { ProductManagement } from "@/components/admin/product-management";
import { listAdminProducts, toAdminProductRow } from "@/lib/admin/products";
import {
  listAdminCategories,
  listAdminTags,
  toAdminCategoryOption,
  toAdminTagOption,
} from "@/lib/admin/taxonomy";
import { getCurrentUser } from "@/lib/auth";
import { getRatesForAdmin } from "@/lib/pricing/exchange";

export default async function AdminProductsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/products");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [products, categories, tags, rates] = await Promise.all([
    listAdminProducts(),
    listAdminCategories(),
    listAdminTags(),
    getRatesForAdmin(),
  ]);

  const usdRate = rates.find((rate) => rate.currency === "USD")?.rateToman;
  const eurRate = rates.find((rate) => rate.currency === "EUR")?.rateToman;

  return (
    <ProductManagement
      initialProducts={products.map(toAdminProductRow)}
      initialCategories={categories.map(toAdminCategoryOption)}
      initialTags={tags.map(toAdminTagOption)}
      mode="list"
      usdRate={usdRate}
      eurRate={eurRate}
    />
  );
}
