import { ProductCard } from "@/components/shop/product-card";
import { getCurrentUser } from "@/lib/auth";
import { getProductsForListing } from "@/lib/catalog";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const user = await getCurrentUser();
  const products = await getProductsForListing(user, { q });

  return (
    <main
      className="min-h-dvh bg-background px-4 pb-24 pt-14 text-foreground sm:px-8 lg:px-14"
      dir="rtl"
    >
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Shop
        </p>
        <h1 className="mt-3 text-4xl font-black">محصولات</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          محصولات غیرفعال و ناموجود هم قابل مشاهده‌اند، اما به سبد اضافه نمی‌شوند.
        </p>
      </header>

      {/* Search form — GET, RTL, submits ?q= */}
      <form method="GET" action="/products" className="mb-8">
        <div className="relative">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="جستجوی محصولات..."
            className="w-full rounded-lg border border-border bg-muted/40 py-3 pe-4 ps-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            dir="rtl"
          />
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
        </div>
        {q && (
          <p className="mt-2 text-sm text-muted-foreground">
            {products.length} نتیجه برای «{q}»
          </p>
        )}
      </form>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : q ? (
        <div className="grid min-h-[50dvh] place-items-center border border-dashed border-border text-center">
          <div>
            <h2 className="text-2xl font-black">نتیجه‌ای یافت نشد</h2>
            <p className="mt-2 text-sm text-muted-foreground">جستجوی دیگری امتحان کنید.</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[50dvh] place-items-center border border-dashed border-border text-center">
          <div>
            <h2 className="text-2xl font-black">هنوز محصولی ثبت نشده</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              از پنل ادمین اولین محصول را بسازید.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
