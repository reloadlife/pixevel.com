import { notFound } from "next/navigation";
import { ProductCard } from "@/components/shop/product-card";
import { ProductDetailClient } from "@/components/shop/product-detail-client";
import { getCurrentUser } from "@/lib/auth";
import { getProductDetailView } from "@/lib/catalog";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  const { slug } = await params;
  const product = await getProductDetailView(slug, user);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-14 text-foreground sm:px-8 lg:px-14">
      <ProductDetailClient product={product} />
      {product.relatedProducts.length > 0 ? (
        <section className="mt-16 border-t border-border pt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
                Pixevel
              </p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">محصولات مشابه</h2>
            </div>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14 [&::-webkit-scrollbar]:hidden">
            <div className="grid grid-flow-col grid-rows-2 gap-x-3 gap-y-6 auto-cols-[minmax(160px,44vw)] sm:auto-cols-[minmax(190px,28vw)] lg:auto-cols-[minmax(220px,18vw)]">
              {product.relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
