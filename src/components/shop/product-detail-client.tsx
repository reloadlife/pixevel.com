"use client";

import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatToman, toFaNumber } from "@/lib/format";

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

type ProductDetail = {
  titleFa: string;
  summaryFa: string | null;
  descriptionFa: string | null;
  fitFa: string | null;
  careFa: string | null;
  status: string;
  images: DetailImage[];
  variants: DetailVariant[];
};

export function ProductDetailClient({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
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
      router.push("/basket");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setPending(false);
    }
  }

  return (
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
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight">{product.titleFa}</h1>
        {product.summaryFa ? (
          <p className="mt-3 leading-8 text-muted-foreground">{product.summaryFa}</p>
        ) : null}
        <p className="mt-5 text-2xl font-black">
          {selectedVariant ? formatToman(selectedVariant.price) : "انتخاب تنوع"}
        </p>

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
