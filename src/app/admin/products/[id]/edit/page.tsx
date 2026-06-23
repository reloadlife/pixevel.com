import { notFound, redirect } from "next/navigation";

import { ProductManagement } from "@/components/admin/product-management";
import { getAdminProduct, toAdminProductRow } from "@/lib/admin/products";
import {
  listAdminCategories,
  listAdminTags,
  toAdminCategoryOption,
  toAdminTagOption,
} from "@/lib/admin/taxonomy";
import { listAdminWatermarkImages, toAdminWatermarkImageRow } from "@/lib/admin/watermark-images";
import { getCurrentUser } from "@/lib/auth";
import { getRatesForAdmin } from "@/lib/pricing/exchange";

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/products");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const { id } = await params;
  const [product, categories, tags, watermarkImages, rates] = await Promise.all([
    getAdminProduct(id),
    listAdminCategories(),
    listAdminTags(),
    listAdminWatermarkImages(),
    getRatesForAdmin(),
  ]);

  if (!product) {
    notFound();
  }

  const usdRate = rates.find((rate) => rate.currency === "USD")?.rateToman;
  const eurRate = rates.find((rate) => rate.currency === "EUR")?.rateToman;

  return (
    <ProductManagement
      initialProducts={[toAdminProductRow(product)]}
      initialCategories={categories.map(toAdminCategoryOption)}
      initialTags={tags.map(toAdminTagOption)}
      initialWatermarkImages={watermarkImages.map(toAdminWatermarkImageRow)}
      mode="edit"
      initialEditingProductId={product.id}
      usdRate={usdRate}
      eurRate={eurRate}
    />
  );
}
