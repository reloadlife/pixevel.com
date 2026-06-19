import { redirect } from "next/navigation";

import { HomeBlockManagement } from "@/components/admin/home-block-management";
import { listAdminHomeBlocks, toAdminHomeBlockRow } from "@/lib/admin/home-blocks";
import { listAdminProducts, toAdminProductPickerOption } from "@/lib/admin/products";
import {
  listAdminCategories,
  listAdminTags,
  toAdminCategoryOption,
  toAdminTagOption,
} from "@/lib/admin/taxonomy";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminHomepagePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/homepage");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [blocks, products, categories, tags] = await Promise.all([
    listAdminHomeBlocks(),
    listAdminProducts(),
    listAdminCategories(),
    listAdminTags(),
  ]);

  return (
    <HomeBlockManagement
      initialBlocks={blocks.map(toAdminHomeBlockRow)}
      initialProducts={products.map(toAdminProductPickerOption)}
      initialCategories={categories.map(toAdminCategoryOption)}
      initialTags={tags.map(toAdminTagOption)}
    />
  );
}
