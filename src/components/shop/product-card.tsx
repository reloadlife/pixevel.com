import { Star } from "lucide-react";
import Link from "next/link";

import { formatToman, toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type ProductCardData = {
  slug: string;
  titleFa: string;
  summaryFa: string | null;
  status: string;
  imageUrl?: string | null;
  price: number;
  compareAtAmount?: number;
  availableStock: number;
  ratingAvg?: number | null;
  ratingCount?: number;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const unavailable = product.status !== "ACTIVE" || product.availableStock <= 0;
  const compareAt = product.compareAtAmount ?? 0;
  const onSale = compareAt > product.price && product.price > 0;
  const discountPercent = onSale ? Math.round(((compareAt - product.price) / compareAt) * 100) : 0;
  const ratingCount = product.ratingCount ?? 0;
  const hasRating = ratingCount > 0 && product.ratingAvg != null;

  return (
    <Link href={`/products/${product.slug}`} className="product-card-motion group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.titleFa}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-zinc-100 text-sm text-muted-foreground">
            بدون تصویر
          </div>
        )}
        {onSale && discountPercent > 0 ? (
          <div className="absolute end-3 top-3 rounded-full bg-destructive px-2 py-0.5 text-xs font-black text-white">
            {discountPercent}٪ تخفیف
          </div>
        ) : null}
        {unavailable ? (
          <div className="absolute inset-x-3 bottom-3 bg-background/92 px-3 py-2 text-center text-xs font-black text-foreground backdrop-blur">
            {product.status !== "ACTIVE" ? "غیرفعال" : "ناموجود"}
          </div>
        ) : null}
      </div>
      <div className="pt-3">
        <h3 className="line-clamp-1 text-sm font-black">{product.titleFa}</h3>
        {product.summaryFa ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{product.summaryFa}</p>
        ) : null}
        {hasRating ? (
          <div
            dir="ltr"
            role="img"
            className="mt-1.5 flex items-center justify-end gap-1 text-xs font-bold text-foreground"
            aria-label={`امتیاز ${toFaNumber((product.ratingAvg ?? 0).toFixed(1))} از ۵ بر اساس ${toFaNumber(ratingCount)} دیدگاه`}
          >
            <Star className={cn("size-3.5 fill-current text-gold")} aria-hidden="true" />
            <span>{toFaNumber((product.ratingAvg ?? 0).toFixed(1))}</span>
            <span className="font-medium text-muted-foreground">({toFaNumber(ratingCount)})</span>
          </div>
        ) : null}
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-sm font-bold">{formatToman(product.price)}</p>
          {onSale ? (
            <p className="text-xs font-medium text-muted-foreground line-through">
              {formatToman(compareAt)}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
