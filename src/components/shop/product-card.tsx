/* eslint-disable @next/next/no-img-element -- Product media can be admin-entered URLs until a CDN allowlist exists. */
import Link from "next/link";

import { formatToman } from "@/lib/format";

type ProductCardData = {
  slug: string;
  titleFa: string;
  summaryFa: string | null;
  status: string;
  imageUrl?: string | null;
  price: number;
  availableStock: number;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const unavailable = product.status !== "ACTIVE" || product.availableStock <= 0;

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
        <p className="mt-2 text-sm font-bold">{formatToman(product.price)}</p>
      </div>
    </Link>
  );
}
