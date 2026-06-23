import { redirect } from "next/navigation";

import { ProductManagement } from "@/components/admin/product-management";
import {
  listAdminCategories,
  listAdminTags,
  toAdminCategoryOption,
  toAdminTagOption,
} from "@/lib/admin/taxonomy";
import { getCurrentUser } from "@/lib/auth";
import { getRatesForAdmin } from "@/lib/pricing/exchange";

export default async function NewAdminProductPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/products/new");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [categories, tags, rates] = await Promise.all([
    listAdminCategories(),
    listAdminTags(),
    getRatesForAdmin(),
  ]);

  const usdRate = rates.find((rate) => rate.currency === "USD")?.rateToman;
  const eurRate = rates.find((rate) => rate.currency === "EUR")?.rateToman;

  return (
    <ProductManagement
      initialProducts={[]}
      initialCategories={categories.map(toAdminCategoryOption)}
      initialTags={tags.map(toAdminTagOption)}
      mode="create"
      usdRate={usdRate}
      eurRate={eurRate}
    />
  );
}
