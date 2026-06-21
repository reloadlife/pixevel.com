import { redirect } from "next/navigation";

import { getWishlist } from "@/lib/account/wishlist";
import { getCurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";
import { WishlistGrid } from "./wishlist-grid";

export const metadata = {
  title: "علاقه‌مندی‌ها | پیکسول",
};

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/wishlist");
  }

  const items = await getWishlist(user);

  return (
    <main dir="rtl" className="text-foreground">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-black sm:text-3xl">علاقه‌مندی‌ها</h1>
          {items.length > 0 ? (
            <span className="text-sm font-bold text-muted-foreground">
              {toFaNumber(items.length)} محصول
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          محصولات ذخیره‌شده‌ی شما؛ هر زمان خواستید به سبد خرید اضافه کنید.
        </p>
      </header>

      <WishlistGrid items={items} />
    </main>
  );
}
