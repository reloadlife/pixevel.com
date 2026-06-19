"use client";

import { Check, ChevronLeft, Share2, ShoppingBag, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ProductReviews } from "@/components/shop/product-reviews";
import { Button } from "@/components/ui/button";
import { formatToman, toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type DetailImage = {
  id: string;
  url: string;
  altFa: string | null;
  variantId: string | null;
};

type DetailVariant = {
  id: string;
  sku: string;
  titleFa: string;
  colorNameFa: string;
  colorSlug: string;
  colorHex: string | null;
  materialNameFa: string;
  materialSlug: string;
  size: string;
  price: number;
  compareAtAmount: number;
  availableStock: number;
  images: DetailImage[];
};

type ProductCategory = {
  slug: string;
  titleFa: string;
} | null;

type ProductDetail = {
  id: string;
  slug: string;
  titleFa: string;
  summaryFa: string | null;
  descriptionFa: string | null;
  fitFa: string | null;
  careFa: string | null;
  status: string;
  category: ProductCategory;
  images: DetailImage[];
  variants: DetailVariant[];
};

type ReviewAggregate = {
  count: number;
  average: number;
};

export function ProductDetailClient({
  product,
  isAuthenticated,
}: {
  product: ProductDetail;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aggregate, setAggregate] = useState<ReviewAggregate>({ count: 0, average: 0 });
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
  const priceVariant = selectedVariant ?? product.variants[0];
  const skuToShow = selectedVariant?.sku ?? product.variants[0]?.sku ?? null;
  const compareAtAmount = priceVariant?.compareAtAmount ?? 0;
  const currentPrice = priceVariant?.price ?? 0;
  const hasDiscount = compareAtAmount > currentPrice && currentPrice > 0;
  const discountPercent = hasDiscount
    ? Math.round(((compareAtAmount - currentPrice) / compareAtAmount) * 100)
    : 0;
  const visibleImages = useMemo(() => {
    if (!selectedVariant) {
      return product.images;
    }

    const hasVariantImages = product.images.some((image) => image.variantId === selectedVariant.id);

    if (!hasVariantImages) {
      return product.images;
    }

    const variantImages = product.images.filter(
      (image) => !image.variantId || image.variantId === selectedVariant.id,
    );

    return variantImages.length > 0 ? variantImages : product.images;
  }, [product.images, selectedVariant]);
  const galleryImages = useMemo(
    () =>
      visibleImages.length
        ? visibleImages
        : [{ id: "empty", url: "", altFa: null, variantId: null }],
    [visibleImages],
  );
  const canAdd = product.status === "ACTIVE" && Boolean(selectedVariant?.availableStock);
  const addButtonLabel = canAdd ? "افزودن به سبد" : "قابل افزودن نیست";
  const addButtonClassName =
    "h-14 w-full rounded-full bg-foreground px-6 text-base font-black text-background shadow-2xl lg:h-12 lg:rounded-lg lg:bg-primary lg:text-primary-foreground lg:shadow-none";

  function handleGalleryScroll() {
    const gallery = galleryRef.current;

    if (!gallery) {
      return;
    }

    const imageWidth = gallery.clientWidth;

    if (imageWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(gallery.scrollLeft / imageWidth);
    setActiveImageIndex(Math.max(0, Math.min(nextIndex, galleryImages.length - 1)));
  }

  function scrollGalleryTo(index: number) {
    const gallery = galleryRef.current;

    if (!gallery) {
      return;
    }

    gallery.scrollTo({ left: gallery.clientWidth * index, behavior: "smooth" });
    setActiveImageIndex(index);
  }

  function selectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    setActiveImageIndex(0);
    galleryRef.current?.scrollTo({ left: 0 });
  }

  async function handleAddToBasket() {
    if (!selectedVariant || pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId: selectedVariant.id, quantity: 1 }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "افزودن به سبد ناموفق بود.");
        return;
      }

      window.dispatchEvent(new CustomEvent("cart:changed"));
      toast.success("به سبد خرید اضافه شد.");
      router.push("/basket");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setPending(false);
    }
  }

  async function handleShare() {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const shareData = {
      title: product.titleFa,
      text: product.summaryFa ?? product.titleFa,
      url: shareUrl,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share failed → fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("لینک کپی شد");
    } catch {
      toast.error("امکان کپی لینک وجود نداشت.");
    }
  }

  const handleAggregateChange = useCallback((next: ReviewAggregate) => {
    setAggregate(next);
  }, []);

  return (
    <>
      <nav aria-label="مسیر" className="mb-4 text-xs font-bold text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="transition hover:text-foreground">
              خانه
            </Link>
          </li>
          {product.category ? (
            <>
              <li aria-hidden="true">
                <ChevronLeft className="size-3.5" />
              </li>
              <li>
                <Link
                  href={`/products?category=${encodeURIComponent(product.category.slug)}`}
                  className="transition hover:text-foreground"
                >
                  {product.category.titleFa}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">
            <ChevronLeft className="size-3.5" />
          </li>
          <li className="text-foreground" aria-current="page">
            {product.titleFa}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="relative -mx-4 sm:mx-0">
          <div
            ref={galleryRef}
            dir="ltr"
            onScroll={handleGalleryScroll}
            className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth sm:grid sm:snap-none sm:grid-cols-2 sm:gap-3 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          >
            {galleryImages.map((image) => (
              <div
                key={image.id}
                data-product-gallery-slide
                className="aspect-[3/4] min-w-full snap-center overflow-hidden bg-muted sm:min-w-0"
              >
                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.altFa ?? product.titleFa}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    بدون تصویر
                  </div>
                )}
              </div>
            ))}
          </div>

          {galleryImages.length > 1 ? (
            <div
              dir="ltr"
              className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full bg-background/92 px-4 py-3 shadow-2xl backdrop-blur-sm sm:hidden"
              aria-label="گالری تصاویر محصول"
            >
              {galleryImages.map((image, index) => (
                <button
                  key={`${image.id}-dot`}
                  type="button"
                  onClick={() => scrollGalleryTo(index)}
                  className={`h-2 rounded-full transition-all ${
                    activeImageIndex === index
                      ? "w-9 bg-foreground/75"
                      : "w-2 bg-foreground/20 hover:bg-foreground/35"
                  }`}
                >
                  <span className="sr-only">
                    تصویر {toFaNumber(index + 1)} از {toFaNumber(galleryImages.length)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <section className="lg:sticky lg:top-8 lg:self-start">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
              Pixevel
            </p>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:border-foreground hover:text-foreground"
            >
              <Share2 className="size-3.5" />
              اشتراک‌گذاری
            </button>
          </div>
          <h1 className="mt-3 text-4xl font-black leading-tight">{product.titleFa}</h1>

          {aggregate.count > 0 ? (
            <a
              href="#reviews-heading"
              className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
            >
              <span dir="ltr" className="inline-flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, index) => index + 1).map((position) => (
                  <Star
                    key={position}
                    className={cn(
                      "size-4",
                      position <= Math.round(aggregate.average)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-muted-foreground/40",
                    )}
                    aria-hidden="true"
                  />
                ))}
              </span>
              <span>
                {toFaNumber(aggregate.average)} ({toFaNumber(aggregate.count)} دیدگاه)
              </span>
            </a>
          ) : null}

          {product.summaryFa ? (
            <p className="mt-3 leading-8 text-muted-foreground">{product.summaryFa}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="text-2xl font-black">
              {priceVariant ? formatToman(currentPrice) : "انتخاب تنوع"}
            </p>
            {hasDiscount ? (
              <>
                <span className="text-base font-bold text-muted-foreground line-through">
                  {formatToman(compareAtAmount)}
                </span>
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-black text-destructive">
                  {toFaNumber(discountPercent)}٪ تخفیف
                </span>
              </>
            ) : null}
          </div>

          {skuToShow ? (
            <p className="mt-2 text-xs text-muted-foreground">
              کد محصول:{" "}
              <span dir="ltr" className="font-mono">
                {skuToShow}
              </span>
            </p>
          ) : null}

          <div className="mt-8 space-y-5">
            <div>
              <p className="mb-3 text-sm font-black">تنوع محصول</p>
              <div className="grid gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => selectVariant(variant.id)}
                    className={`flex items-center justify-between border px-3 py-3 text-sm transition ${
                      selectedVariantId === variant.id
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground"
                    }`}
                  >
                    <span className="font-bold">{variant.titleFa}</span>
                    <span className="text-xs">{stockLabel(variant.availableStock)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div id="basket">
              <Button
                type="button"
                className={addButtonClassName}
                disabled={!canAdd || pending}
                onClick={handleAddToBasket}
              >
                <ShoppingBag className="size-5" />
                {pending ? "در حال افزودن…" : addButtonLabel}
              </Button>
              {error ? <p className="mt-2 text-sm font-bold text-destructive">{error}</p> : null}
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
              <Zap className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
              <div className="text-sm leading-6">
                <p className="font-black">تحویل آنی کد پس از پرداخت</p>
                <p className="mt-1 text-muted-foreground">
                  بلافاصله پس از تأیید پرداخت، کد محصول در حساب کاربری شما و از طریق پیامک در دسترس
                  قرار می‌گیرد. نیازی به انتظار یا ارسال فیزیکی نیست.
                </p>
                <ul className="mt-3 space-y-1.5 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    تحویل دیجیتال و فوری
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    کد اورجینال و معتبر
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-5 border-t border-border pt-6 text-sm leading-8 text-muted-foreground">
            {product.descriptionFa ? <p>{product.descriptionFa}</p> : null}
            {product.fitFa ? (
              <p>
                <strong className="text-foreground">فیت:</strong> {product.fitFa}
              </p>
            ) : null}
            {product.careFa ? (
              <p>
                <strong className="text-foreground">نگهداری:</strong> {product.careFa}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <ProductReviews
        productId={product.id}
        isAuthenticated={isAuthenticated}
        onAggregateChange={handleAggregateChange}
      />
    </>
  );
}

function stockLabel(availableStock: number) {
  if (availableStock <= 0) {
    return "ناموجود";
  }

  if (availableStock < 3) {
    return `فقط ${toFaNumber(availableStock)} عدد`;
  }

  return "موجود";
}
