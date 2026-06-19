import { BottomNav } from "@/components/shop/bottom-nav";
import { ProductCard } from "@/components/shop/product-card";
import { getCurrentUser } from "@/lib/auth";
import { getProductsForListing } from "@/lib/catalog";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  const products = await getProductsForListing(user);

  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-6 text-foreground sm:px-8 lg:px-14">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">Pixevel Shop</p>
        <h1 className="mt-3 text-4xl font-black">محصولات</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          محصولات غیرفعال و ناموجود هم قابل مشاهده‌اند، اما به سبد اضافه نمی‌شوند.
        </p>
      </header>
      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[50dvh] place-items-center border border-dashed border-border text-center">
          <div>
            <h2 className="text-2xl font-black">هنوز محصولی ثبت نشده</h2>
            <p className="mt-2 text-sm text-muted-foreground">از پنل ادمین اولین محصول را بسازید.</p>
          </div>
        </div>
      )}
      <BottomNav user={user} />
    </main>
  );
}
