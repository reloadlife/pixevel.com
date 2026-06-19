"use client";

import {
  ArrowDown,
  ArrowUp,
  Eye,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";

type CategoryOption = {
  id: string;
  slug: string;
  titleFa: string;
  parentId: string | null;
  isVisible: boolean;
  depth: number;
  pathFa: string;
};

type TagOption = {
  id: string;
  slug: string;
  titleFa: string;
  isVisible: boolean;
};

type ProductImageRecord = {
  id: string;
  url: string;
  originalUrl: string;
  altFa: string;
  vipImage: boolean;
  isPrimary: boolean;
  showcasePublic: boolean;
  showcasePremium: boolean;
  sortOrder: number;
  variantId: string;
  watermarkEnabled: boolean;
  watermarkImageId: string;
  watermarkX: number;
  watermarkY: number;
  watermarkSize: number;
  watermarkOpacity: number;
  watermarkAppliedUrl: string;
};

type ProductVariantRow = {
  id: string;
  sku: string;
  titleFa: string;
  colorNameFa: string;
  colorSlug: string;
  colorHex: string;
  materialNameFa: string;
  materialSlug: string;
  size: string;
  publicPriceAmount: string;
  registeredPriceAmount: string;
  premiumPriceAmount: string;
  compareAtAmount: string;
  isDefault: boolean;
  inventoryUnits: Array<{ id: string; status: string }>;
};

type ProductRow = {
  id: string;
  slug: string;
  titleFa: string;
  summaryFa: string;
  descriptionFa: string;
  fitFa: string;
  careFa: string;
  status: string;
  categoryId: string;
  tagIds: string[];
  tags: TagOption[];
  images: ProductImageRecord[];
  variants: ProductVariantRow[];
};

type ColorOption = {
  id: string;
  label: string;
  slug: string;
  hex: string;
};

type TextOption = {
  id: string;
  label: string;
  slug: string;
};

type SizeOption = {
  id: string;
  value: string;
};

type SelectedTag = TagOption & {
  isNew?: boolean;
};

type ImageRow = {
  id: string;
  persistedId?: string;
  url: string;
  originalUrl: string;
  altFa: string;
  vipImage: boolean;
  isPrimary: boolean;
  showcasePublic: boolean;
  showcasePremium: boolean;
  variantId: string;
  variantKey: string;
  watermarkEnabled: boolean;
  watermarkImageId: string;
  watermarkX: string;
  watermarkY: string;
  watermarkSize: string;
  watermarkOpacity: string;
  watermarkAppliedUrl: string;
};

type VariantEditRow = ProductVariantRow & {
  stockToAdd: string;
};

type VariantOption = {
  id: string;
  label: string;
};

type UploadTarget = "create" | "edit";
type ProductManagementMode = "create" | "list" | "edit";

type WatermarkImageOption = {
  id: string;
  titleFa: string;
  originalName: string;
  url: string;
  width: number | null;
  height: number | null;
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "فعال" },
  { value: "DRAFT", label: "پیش‌نویس" },
  { value: "DISABLED", label: "غیرفعال" },
  { value: "ARCHIVED", label: "آرشیو" },
];

function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function normalizePriceValue(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d]/g, "")
    .replace(/^0+(?=\d)/, "");
}

function formatPriceValue(value: string) {
  const digits = normalizePriceValue(value);

  if (!digits) {
    return "";
  }

  return digits
    .replace(/\B(?=(\d{3})+(?!\d))/g, "٬")
    .replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit);
}

function normalizeSignedIntegerText(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .trim();
}

function parseSignedIntegerText(value: string) {
  const normalized = normalizeSignedIntegerText(value);

  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  const numeric = Number(normalized);

  return Number.isSafeInteger(numeric) ? numeric : null;
}

function slugifyForVariantKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function variantOptionSlug(slug: string, label: string, index: number) {
  return slugifyForVariantKey(slug || label) || `option-${index + 1}`;
}

function variantOptionKey(colorSlug: string, materialSlug: string, size: string) {
  return [colorSlug, materialSlug, slugifyForVariantKey(size) || size.trim().toLowerCase()]
    .join("|")
    .toLowerCase();
}

function availableStock(variant: ProductVariantRow) {
  return variant.inventoryUnits.filter((unit) => unit.status === "AVAILABLE").length;
}

function editFormFromProduct(product: ProductRow | null) {
  return {
    titleFa: product?.titleFa ?? "",
    slug: product?.slug ?? "",
    summaryFa: product?.summaryFa ?? "",
    descriptionFa: product?.descriptionFa ?? "",
    fitFa: product?.fitFa ?? "",
    careFa: product?.careFa ?? "",
    status: product?.status ?? "ACTIVE",
  };
}

function imageRowFromRecord(image: ProductImageRecord) {
  return {
    id: image.id,
    persistedId: image.id,
    url: image.url,
    originalUrl: image.originalUrl,
    altFa: image.altFa,
    vipImage: image.vipImage,
    isPrimary: image.isPrimary,
    showcasePublic: image.showcasePublic,
    showcasePremium: image.showcasePremium,
    variantId: image.variantId,
    variantKey: "",
    watermarkEnabled: image.watermarkEnabled,
    watermarkImageId: image.watermarkImageId,
    watermarkX: String(image.watermarkX),
    watermarkY: String(image.watermarkY),
    watermarkSize: String(image.watermarkSize || 120),
    watermarkOpacity: String(image.watermarkOpacity ?? 100),
    watermarkAppliedUrl: image.watermarkAppliedUrl,
  } satisfies ImageRow;
}

function imageRowsFromProduct(product: ProductRow | null) {
  return product?.images.map(imageRowFromRecord) ?? [];
}

function variantRowsFromProduct(product: ProductRow | null) {
  return product?.variants.map((variant) => ({ ...variant, stockToAdd: "" })) ?? [];
}

export function ProductManagement({
  initialProducts,
  initialCategories,
  initialTags,
  initialWatermarkImages = [],
  mode = "list",
  initialEditingProductId,
}: {
  initialProducts: ProductRow[];
  initialCategories: CategoryOption[];
  initialTags: TagOption[];
  initialWatermarkImages?: WatermarkImageOption[];
  mode?: ProductManagementMode;
  initialEditingProductId?: string;
}) {
  const initialEditingProduct =
    mode === "edit"
      ? (initialProducts.find((product) => product.id === initialEditingProductId) ?? null)
      : null;
  const [products, setProducts] = useState(initialProducts);
  const [categories] = useState(initialCategories);
  const [tags, setTags] = useState(initialTags);
  const [watermarkImages] = useState(initialWatermarkImages);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [imageRows, setImageRows] = useState<ImageRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingProductId, setEditingProductId] = useState(initialEditingProduct?.id ?? "");
  const [editSelectedCategoryId, setEditSelectedCategoryId] = useState(
    initialEditingProduct?.categoryId ?? "",
  );
  const [editSelectedTags, setEditSelectedTags] = useState<SelectedTag[]>(
    initialEditingProduct?.tags ?? [],
  );
  const [editTagQuery, setEditTagQuery] = useState("");
  const [editImageRows, setEditImageRows] = useState<ImageRow[]>(
    imageRowsFromProduct(initialEditingProduct),
  );
  const [editVariants, setEditVariants] = useState<VariantEditRow[]>(
    variantRowsFromProduct(initialEditingProduct),
  );
  const [editSaving, setEditSaving] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [watermarkingImageId, setWatermarkingImageId] = useState("");
  const [previewImage, setPreviewImage] = useState<ImageRow | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [colors, setColors] = useState<ColorOption[]>([
    { id: "color-red", label: "قرمز", slug: "red", hex: "#c0262d" },
    { id: "color-green", label: "سبز", slug: "green", hex: "#15803d" },
  ]);
  const [materials, setMaterials] = useState<TextOption[]>([
    { id: "material-leather", label: "چرم", slug: "leather" },
  ]);
  const [sizes, setSizes] = useState<SizeOption[]>([{ id: "size-m", value: "M" }]);
  const [form, setForm] = useState({
    titleFa: "",
    slug: "",
    summaryFa: "",
    descriptionFa: "",
    fitFa: "",
    careFa: "",
    publicPriceAmount: "",
    registeredPriceAmount: "",
    premiumPriceAmount: "",
    compareAtAmount: "",
    stockPerVariant: "10",
    status: "ACTIVE",
  });
  const [editForm, setEditForm] = useState(editFormFromProduct(initialEditingProduct));

  const editingProduct = products.find((product) => product.id === editingProductId) ?? null;
  const showCreate = mode === "create";
  const showList = mode === "list";
  const showEdit = mode === "edit";

  const variantPreview = useMemo(() => {
    const cleanColors = colors
      .map((color, index) => ({
        label: color.label.trim(),
        slug: variantOptionSlug(color.slug.trim(), color.label.trim(), index),
      }))
      .filter((color) => color.label);
    const cleanMaterials = materials
      .map((material, index) => ({
        label: material.label.trim(),
        slug: variantOptionSlug(material.slug.trim(), material.label.trim(), index),
      }))
      .filter((material) => material.label);
    const cleanSizes = sizes.map((size) => size.value.trim()).filter(Boolean);

    return cleanColors.flatMap((color) =>
      cleanMaterials.flatMap((material) =>
        cleanSizes.map((size) => ({
          id: variantOptionKey(color.slug, material.slug, size),
          label: `${color.label} / ${material.label} / ${size}`,
        })),
      ),
    );
  }, [colors, materials, sizes]);

  const tagSuggestions = getTagSuggestions(tagQuery, selectedTags);
  const editTagSuggestions = getTagSuggestions(editTagQuery, editSelectedTags);
  const filteredProducts = useMemo(() => {
    const query = productSearchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesName =
        !query ||
        product.titleFa.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query);
      const matchesCategory =
        !productCategoryFilter || product.categoryId === productCategoryFilter;

      return matchesName && matchesCategory;
    });
  }, [productCategoryFilter, productSearchQuery, products]);

  function setField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function setEditField(name: keyof typeof editForm, value: string) {
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  function getTagSuggestions(queryValue: string, selected: SelectedTag[]) {
    const query = queryValue.trim().toLowerCase();
    const selectedIds = new Set(selected.filter((tag) => !tag.isNew).map((tag) => tag.id));

    if (!query) {
      return tags.filter((tag) => !selectedIds.has(tag.id)).slice(0, 8);
    }

    return tags
      .filter((tag) => {
        if (selectedIds.has(tag.id)) {
          return false;
        }

        return tag.titleFa.toLowerCase().includes(query) || tag.slug.toLowerCase().includes(query);
      })
      .slice(0, 8);
  }

  function selectTagFor(
    tag: TagOption,
    setSelected: Dispatch<SetStateAction<SelectedTag[]>>,
    setQuery: Dispatch<SetStateAction<string>>,
  ) {
    setSelected((current) => {
      if (current.some((item) => item.id === tag.id && !item.isNew)) {
        return current;
      }

      return [...current, tag];
    });
    setQuery("");
  }

  async function createOrSelectTagFor(
    query: string,
    setQuery: Dispatch<SetStateAction<string>>,
    setSelected: Dispatch<SetStateAction<SelectedTag[]>>,
  ) {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return;
    }

    const existingTag = tags.find((tag) => tag.titleFa === cleanQuery || tag.slug === cleanQuery);

    if (existingTag) {
      selectTagFor(existingTag, setSelected, setQuery);
      return;
    }

    const response = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titleFa: cleanQuery }),
    });
    const result = await response.json();

    if (!result.ok) {
      alert(result.error?.message ?? "تگ ذخیره نشد.");
      return;
    }

    setTags((current) =>
      current.some((tag) => tag.id === result.data.tag.id)
        ? current
        : [...current, result.data.tag].sort((a, b) => a.titleFa.localeCompare(b.titleFa, "fa")),
    );
    selectTagFor(result.data.tag, setSelected, setQuery);
  }

  function removeSelectedTagFor(id: string, setSelected: Dispatch<SetStateAction<SelectedTag[]>>) {
    setSelected((current) => current.filter((tag) => tag.id !== id));
  }

  function addImageRow(row?: Partial<ImageRow>, target: UploadTarget = "create") {
    const setRows = target === "edit" ? setEditImageRows : setImageRows;

    setRows((current) => [
      ...current,
      {
        id: createId("image"),
        persistedId: row?.persistedId,
        url: row?.url ?? "",
        originalUrl: row?.originalUrl ?? "",
        altFa: row?.altFa ?? "",
        vipImage: row?.vipImage ?? false,
        isPrimary: row?.isPrimary ?? current.length === 0,
        showcasePublic: row?.showcasePublic ?? false,
        showcasePremium: row?.showcasePremium ?? false,
        variantId: row?.variantId ?? "",
        variantKey: row?.variantKey ?? "",
        watermarkEnabled: row?.watermarkEnabled ?? false,
        watermarkImageId: row?.watermarkImageId ?? "",
        watermarkX: row?.watermarkX ?? "0",
        watermarkY: row?.watermarkY ?? "0",
        watermarkSize: row?.watermarkSize ?? "120",
        watermarkOpacity: row?.watermarkOpacity ?? "100",
        watermarkAppliedUrl: row?.watermarkAppliedUrl ?? "",
      },
    ]);
  }

  function updateImageRow(id: string, patch: Partial<ImageRow>, target: UploadTarget = "create") {
    const setRows = target === "edit" ? setEditImageRows : setImageRows;

    setRows((current) =>
      current.map((image) => {
        if (image.id !== id) {
          return {
            ...image,
            ...(patch.isPrimary ? { isPrimary: false } : {}),
            ...(patch.showcasePublic ? { showcasePublic: false } : {}),
            ...(patch.showcasePremium ? { showcasePremium: false } : {}),
          };
        }

        return image.id === id ? { ...image, ...patch } : image;
      }),
    );
  }

  function moveImageRow(id: string, direction: -1 | 1, target: UploadTarget = "create") {
    const setRows = target === "edit" ? setEditImageRows : setImageRows;

    setRows((current) => {
      const index = current.findIndex((image) => image.id === id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const moved = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = moved;
      return next;
    });
  }

  function removeImageRow(id: string, target: UploadTarget = "create") {
    const setRows = target === "edit" ? setEditImageRows : setImageRows;

    setRows((current) => {
      const next = current.filter((image) => image.id !== id);

      if (next.length > 0 && !next.some((image) => image.isPrimary)) {
        return next.map((image, index) => (index === 0 ? { ...image, isPrimary: true } : image));
      }

      return next;
    });
  }

  function addColor() {
    setColors((current) => [
      ...current,
      { id: createId("color"), label: "", slug: "", hex: "#7c3aed" },
    ]);
  }

  function updateColor(id: string, patch: Partial<ColorOption>) {
    setColors((current) =>
      current.map((color) => (color.id === id ? { ...color, ...patch } : color)),
    );
  }

  function removeColor(id: string) {
    setColors((current) => current.filter((color) => color.id !== id));
  }

  function addMaterial() {
    setMaterials((current) => [...current, { id: createId("material"), label: "", slug: "" }]);
  }

  function updateMaterial(id: string, patch: Partial<TextOption>) {
    setMaterials((current) =>
      current.map((material) => (material.id === id ? { ...material, ...patch } : material)),
    );
  }

  function removeMaterial(id: string) {
    setMaterials((current) => current.filter((material) => material.id !== id));
  }

  function addSize() {
    setSizes((current) => [...current, { id: createId("size"), value: "" }]);
  }

  function updateSize(id: string, value: string) {
    setSizes((current) => current.map((size) => (size.id === id ? { ...size, value } : size)));
  }

  function removeSize(id: string) {
    setSizes((current) => current.filter((size) => size.id !== id));
  }

  async function uploadImages(files: FileList | null, target: UploadTarget = "create") {
    if (!files?.length) {
      return;
    }

    const setUploadingState = target === "edit" ? setEditUploading : setUploading;
    const setRows = target === "edit" ? setEditImageRows : setImageRows;

    setUploadingState(true);

    try {
      const body = new FormData();
      Array.from(files).forEach((file) => {
        body.append("files", file);
      });

      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body,
      });
      const result = await response.json();

      if (!result.ok) {
        alert(result.error?.message ?? "آپلود تصویر انجام نشد.");
        return;
      }

      setRows((current) => [
        ...current,
        ...result.data.files.map((file: { url: string; originalName: string }, index: number) => ({
          id: createId("image"),
          url: file.url,
          originalUrl: "",
          altFa: file.originalName,
          vipImage: false,
          isPrimary: current.length === 0 && index === 0,
          showcasePublic: false,
          showcasePremium: false,
          variantId: "",
          variantKey: "",
          watermarkEnabled: false,
          watermarkImageId: "",
          watermarkX: "0",
          watermarkY: "0",
          watermarkSize: "120",
          watermarkOpacity: "100",
          watermarkAppliedUrl: "",
        })),
      ]);
    } finally {
      setUploadingState(false);
    }
  }

  async function createProduct() {
    setSaving(true);

    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleFa: form.titleFa,
        slug: form.slug,
        summaryFa: form.summaryFa,
        descriptionFa: form.descriptionFa,
        fitFa: form.fitFa,
        careFa: form.careFa,
        categoryId: selectedCategoryId || undefined,
        tagIds: selectedTags.filter((tag) => !tag.isNew).map((tag) => tag.id),
        newTags: selectedTags.filter((tag) => tag.isNew).map((tag) => tag.titleFa),
        publicPriceAmount: form.publicPriceAmount,
        registeredPriceAmount: form.registeredPriceAmount || undefined,
        premiumPriceAmount: form.premiumPriceAmount || undefined,
        compareAtAmount: form.compareAtAmount || undefined,
        colors: colors
          .map((color) => ({
            label: color.label.trim(),
            slug: color.slug.trim(),
            hex: color.hex.trim(),
          }))
          .filter((color) => color.label),
        materials: materials
          .map((material) => ({
            label: material.label.trim(),
            slug: material.slug.trim(),
          }))
          .filter((material) => material.label),
        sizes: sizes.map((size) => size.value.trim()).filter(Boolean),
        stockPerVariant: Number(normalizePriceValue(form.stockPerVariant) || 0),
        images: imageRows
          .map((image, index) => ({
            url: image.url.trim(),
            altFa: image.altFa.trim(),
            vipImage: image.vipImage,
            isPrimary: image.isPrimary,
            showcasePublic: image.showcasePublic,
            showcasePremium: image.showcasePremium,
            sortOrder: index,
            variantKey: image.variantKey || undefined,
          }))
          .filter((image) => image.url),
        status: form.status,
      }),
    });
    const result = await response.json();
    setSaving(false);

    if (!result.ok) {
      alert(result.error?.message ?? "محصول ساخته نشد.");
      return;
    }

    if (mode === "create") {
      globalThis.location.assign(`/admin/products/${result.data.product.id}/edit`);
      return;
    }

    const productsResponse = await fetch("/api/admin/products");
    const productsResult = await productsResponse.json();
    if (productsResult.ok) {
      setProducts(productsResult.data.products);
    }
  }

  function startEditingProduct(product: ProductRow) {
    setEditingProductId(product.id);
    setEditForm({
      titleFa: product.titleFa,
      slug: product.slug,
      summaryFa: product.summaryFa,
      descriptionFa: product.descriptionFa,
      fitFa: product.fitFa,
      careFa: product.careFa,
      status: product.status,
    });
    setEditSelectedCategoryId(product.categoryId);
    setEditSelectedTags(product.tags);
    setEditTagQuery("");
    setEditImageRows(product.images.map(imageRowFromRecord));
    setEditVariants(product.variants.map((variant) => ({ ...variant, stockToAdd: "" })));

    requestAnimationFrame(() => {
      document.getElementById("product-edit-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function updateEditVariant(id: string, patch: Partial<VariantEditRow>) {
    setEditVariants((current) =>
      current.map((variant) => {
        if (patch.isDefault && variant.id !== id) {
          return { ...variant, isDefault: false };
        }

        return variant.id === id ? { ...variant, ...patch } : variant;
      }),
    );
  }

  async function saveProductEdits() {
    if (!editingProductId) {
      return;
    }

    setEditSaving(true);

    const response = await fetch(`/api/admin/products/${editingProductId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleFa: editForm.titleFa,
        slug: editForm.slug,
        summaryFa: editForm.summaryFa,
        descriptionFa: editForm.descriptionFa,
        fitFa: editForm.fitFa,
        careFa: editForm.careFa,
        status: editForm.status,
        categoryId: editSelectedCategoryId || null,
        tagIds: editSelectedTags.filter((tag) => !tag.isNew).map((tag) => tag.id),
        newTags: editSelectedTags.filter((tag) => tag.isNew).map((tag) => tag.titleFa),
        images: editImageRows
          .map((image, index) => ({
            id: image.persistedId,
            url: image.url.trim(),
            altFa: image.altFa.trim(),
            vipImage: image.vipImage,
            isPrimary: image.isPrimary,
            showcasePublic: image.showcasePublic,
            showcasePremium: image.showcasePremium,
            sortOrder: index,
            variantId: image.variantId || null,
          }))
          .filter((image) => image.url),
        variants: editVariants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          titleFa: variant.titleFa,
          colorNameFa: variant.colorNameFa,
          colorSlug: variant.colorSlug,
          colorHex: variant.colorHex || null,
          materialNameFa: variant.materialNameFa,
          materialSlug: variant.materialSlug,
          size: variant.size,
          publicPriceAmount: variant.publicPriceAmount,
          registeredPriceAmount: variant.registeredPriceAmount || null,
          premiumPriceAmount: variant.premiumPriceAmount || null,
          compareAtAmount: variant.compareAtAmount || null,
          isDefault: variant.isDefault,
          stockToAdd: Number(normalizePriceValue(variant.stockToAdd) || 0),
        })),
      }),
    });
    const result = await response.json();
    setEditSaving(false);

    if (!result.ok) {
      alert(result.error?.message ?? "محصول ذخیره نشد.");
      return;
    }

    const updatedProduct = result.data.product as ProductRow;
    setProducts((current) =>
      current.map((product) => (product.id === updatedProduct.id ? updatedProduct : product)),
    );
    startEditingProduct(updatedProduct);
  }

  function replaceEditedImage(updatedImage: ProductImageRecord) {
    setEditImageRows((current) =>
      current.map((image) =>
        image.persistedId === updatedImage.id ? imageRowFromRecord(updatedImage) : image,
      ),
    );
    setProducts((current) =>
      current.map((product) =>
        product.id === editingProductId
          ? {
              ...product,
              images: product.images.map((image) =>
                image.id === updatedImage.id ? updatedImage : image,
              ),
            }
          : product,
      ),
    );
    setPreviewImage((current) =>
      current?.persistedId === updatedImage.id ? imageRowFromRecord(updatedImage) : current,
    );
  }

  async function applyWatermark(image: ImageRow) {
    if (!image.persistedId) {
      alert("ابتدا تغییرات محصول را ذخیره کنید.");
      return;
    }

    if (!image.watermarkImageId) {
      alert("تصویر واترمارک را انتخاب کنید.");
      return;
    }

    const x = parseSignedIntegerText(image.watermarkX);
    const y = parseSignedIntegerText(image.watermarkY);
    const size = parseSignedIntegerText(image.watermarkSize);
    const opacity = parseSignedIntegerText(image.watermarkOpacity);

    if (x === null || y === null || size === null || opacity === null) {
      alert("X، Y، اندازه و شفافیت باید عدد صحیح باشند.");
      return;
    }

    if (size < 8) {
      alert("اندازه واترمارک باید حداقل ۸ باشد.");
      return;
    }

    if (opacity < 0 || opacity > 100) {
      alert("شفافیت باید بین ۰ تا ۱۰۰ باشد.");
      return;
    }

    setWatermarkingImageId(image.id);

    try {
      const response = await fetch(`/api/admin/product-images/${image.persistedId}/watermark`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          watermarkImageId: image.watermarkImageId,
          x,
          y,
          size,
          opacity,
        }),
      });
      const result = await response.json();

      if (!result.ok) {
        alert(result.error?.message ?? "واترمارک اعمال نشد.");
        return;
      }

      replaceEditedImage(result.data.image as ProductImageRecord);
    } finally {
      setWatermarkingImageId("");
    }
  }

  async function removeWatermark(image: ImageRow) {
    if (!image.persistedId) {
      updateImageRow(image.id, { watermarkEnabled: false }, "edit");
      return;
    }

    setWatermarkingImageId(image.id);

    try {
      const response = await fetch(`/api/admin/product-images/${image.persistedId}/watermark`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      const result = await response.json();

      if (!result.ok) {
        alert(result.error?.message ?? "واترمارک حذف نشد.");
        return;
      }

      replaceEditedImage(result.data.image as ProductImageRecord);
    } finally {
      setWatermarkingImageId("");
    }
  }

  async function updateStatus(product: ProductRow, status: string) {
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json();

    if (!result.ok) {
      alert(result.error?.message ?? "وضعیت ذخیره نشد.");
      return;
    }

    const updatedProduct = result.data.product as ProductRow;
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? updatedProduct : item)),
    );

    if (editingProductId === product.id) {
      startEditingProduct(updatedProduct);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      {showCreate ? (
        <section className="min-w-0 border border-zinc-200 bg-white p-4">
          <h2 className="text-lg font-black">افزودن محصول</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Input
              label="نام محصول"
              value={form.titleFa}
              onChange={(value) => setField("titleFa", value)}
            />
            <Input
              label="اسلاگ"
              value={form.slug}
              onChange={(value) => setField("slug", value)}
              dir="ltr"
            />
            <CategorySelect
              label="دسته‌بندی"
              categories={categories}
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
            />
            <StatusSelect
              label="وضعیت"
              value={form.status}
              onChange={(value) => setField("status", value)}
            />
            <TagPicker
              selectedTags={selectedTags}
              tagQuery={tagQuery}
              suggestions={tagSuggestions}
              onQueryChange={setTagQuery}
              onCreate={() => createOrSelectTagFor(tagQuery, setTagQuery, setSelectedTags)}
              onSelect={(tag) => selectTagFor(tag, setSelectedTags, setTagQuery)}
              onRemove={(id) => removeSelectedTagFor(id, setSelectedTags)}
            />
            <PriceInput
              label="قیمت عمومی"
              value={form.publicPriceAmount}
              onChange={(value) => setField("publicPriceAmount", value)}
            />
            <PriceInput
              label="قیمت کاربران"
              value={form.registeredPriceAmount}
              onChange={(value) => setField("registeredPriceAmount", value)}
            />
            <PriceInput
              label="قیمت پریمیوم"
              value={form.premiumPriceAmount}
              onChange={(value) => setField("premiumPriceAmount", value)}
            />
            <PriceInput
              label="قیمت قبل"
              value={form.compareAtAmount}
              onChange={(value) => setField("compareAtAmount", value)}
            />
            <Input
              label="موجودی هر تنوع"
              value={form.stockPerVariant}
              onChange={(value) => setField("stockPerVariant", value)}
              dir="ltr"
            />
            <Textarea
              label="خلاصه"
              value={form.summaryFa}
              onChange={(value) => setField("summaryFa", value)}
            />
            <Textarea
              label="توضیحات"
              value={form.descriptionFa}
              onChange={(value) => setField("descriptionFa", value)}
            />
            <Textarea
              label="فیت"
              value={form.fitFa}
              onChange={(value) => setField("fitFa", value)}
            />
            <Textarea
              label="نگهداری"
              value={form.careFa}
              onChange={(value) => setField("careFa", value)}
            />

            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">رنگ‌ها</h3>
                <Button type="button" size="sm" variant="outline" onClick={addColor}>
                  <Plus className="size-3.5" />
                  رنگ جدید
                </Button>
              </div>
              <div className="grid gap-3">
                {colors.map((color) => (
                  <div
                    key={color.id}
                    className="grid gap-3 border border-zinc-200 bg-zinc-50 p-3 md:grid-cols-[1fr_1fr_160px_auto]"
                  >
                    <Input
                      label="نام رنگ"
                      value={color.label}
                      onChange={(value) => updateColor(color.id, { label: value })}
                    />
                    <Input
                      label="اسلاگ رنگ"
                      value={color.slug}
                      onChange={(value) => updateColor(color.id, { slug: value })}
                      dir="ltr"
                    />
                    <label className="block min-w-0">
                      <span className="mb-2 block text-sm font-bold">کد رنگ</span>
                      <div className="flex h-11 min-w-0 items-center gap-2 border border-zinc-300 bg-white px-2">
                        <input
                          type="color"
                          value={color.hex}
                          onChange={(event) => updateColor(color.id, { hex: event.target.value })}
                          className="size-8 cursor-pointer border-0 bg-transparent p-0"
                          aria-label="انتخاب رنگ"
                        />
                        <input
                          value={color.hex}
                          onChange={(event) => updateColor(color.id, { hex: event.target.value })}
                          className="min-w-0 flex-1 bg-transparent text-left text-sm outline-none"
                          dir="ltr"
                        />
                      </div>
                    </label>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="icon-lg"
                        variant="outline"
                        onClick={() => removeColor(color.id)}
                        disabled={colors.length === 1}
                        aria-label="حذف رنگ"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">جنس‌ها</h3>
                <Button type="button" size="sm" variant="outline" onClick={addMaterial}>
                  <Plus className="size-3.5" />
                  جنس جدید
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className="grid gap-3 border border-zinc-200 bg-zinc-50 p-3 md:grid-cols-[1fr_1fr_auto]"
                  >
                    <Input
                      label="نام جنس"
                      value={material.label}
                      onChange={(value) => updateMaterial(material.id, { label: value })}
                    />
                    <Input
                      label="اسلاگ جنس"
                      value={material.slug}
                      onChange={(value) => updateMaterial(material.id, { slug: value })}
                      dir="ltr"
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="icon-lg"
                        variant="outline"
                        onClick={() => removeMaterial(material.id)}
                        disabled={materials.length === 1}
                        aria-label="حذف جنس"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">سایزها</h3>
                <Button type="button" size="sm" variant="outline" onClick={addSize}>
                  <Plus className="size-3.5" />
                  سایز جدید
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sizes.map((size) => (
                  <div key={size.id} className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      label="سایز"
                      value={size.value}
                      onChange={(value) => updateSize(size.id, value)}
                      dir="ltr"
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="icon-lg"
                        variant="outline"
                        onClick={() => removeSize(size.id)}
                        disabled={sizes.length === 1}
                        aria-label="حذف سایز"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ImageRowsEditor
              title="تصاویر محصول"
              rows={imageRows}
              variantOptions={variantPreview}
              assignmentField="variantKey"
              uploading={uploading}
              onUpload={(files) => uploadImages(files, "create")}
              onAdd={() => addImageRow(undefined, "create")}
              onUpdate={(id, patch) => updateImageRow(id, patch, "create")}
              onMove={(id, direction) => moveImageRow(id, direction, "create")}
              onRemove={(id) => removeImageRow(id, "create")}
              onOpenPreview={setPreviewImage}
            />
          </div>

          <div className="mt-4 border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm">
            <p className="mb-2 font-black">پیش‌نمایش تنوع‌ها</p>
            <div className="flex flex-wrap gap-2">
              {variantPreview.map((item) => (
                <span key={item.id} className="bg-white px-2 py-1 text-xs font-bold">
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <Button className="mt-4 h-11 px-6 font-black" onClick={createProduct} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            ساخت محصول
          </Button>
        </section>
      ) : null}

      {showEdit && editingProduct ? (
        <section id="product-edit-panel" className="min-w-0 border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <div className="min-w-0">
              <h2 className="text-lg font-black">ویرایش محصول</h2>
              <p className="mt-1 break-all text-xs text-zinc-500" dir="ltr">
                /products/{editingProduct.slug}
              </p>
            </div>
            <ActionLink href="/admin/products">
              <X className="size-3.5" />
              بازگشت
            </ActionLink>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Input
              label="نام محصول"
              value={editForm.titleFa}
              onChange={(value) => setEditField("titleFa", value)}
            />
            <Input
              label="اسلاگ"
              value={editForm.slug}
              onChange={(value) => setEditField("slug", value)}
              dir="ltr"
            />
            <CategorySelect
              label="دسته‌بندی"
              categories={categories}
              value={editSelectedCategoryId}
              onChange={setEditSelectedCategoryId}
            />
            <StatusSelect
              label="وضعیت"
              value={editForm.status}
              onChange={(value) => setEditField("status", value)}
            />
            <TagPicker
              selectedTags={editSelectedTags}
              tagQuery={editTagQuery}
              suggestions={editTagSuggestions}
              onQueryChange={setEditTagQuery}
              onCreate={() =>
                createOrSelectTagFor(editTagQuery, setEditTagQuery, setEditSelectedTags)
              }
              onSelect={(tag) => selectTagFor(tag, setEditSelectedTags, setEditTagQuery)}
              onRemove={(id) => removeSelectedTagFor(id, setEditSelectedTags)}
            />
            <Textarea
              label="خلاصه"
              value={editForm.summaryFa}
              onChange={(value) => setEditField("summaryFa", value)}
            />
            <Textarea
              label="توضیحات"
              value={editForm.descriptionFa}
              onChange={(value) => setEditField("descriptionFa", value)}
            />
            <Textarea
              label="فیت"
              value={editForm.fitFa}
              onChange={(value) => setEditField("fitFa", value)}
            />
            <Textarea
              label="نگهداری"
              value={editForm.careFa}
              onChange={(value) => setEditField("careFa", value)}
            />

            <ImageRowsEditor
              title="تصاویر محصول"
              rows={editImageRows}
              variantOptions={editVariants.map((variant) => ({
                id: variant.id,
                label: variant.titleFa,
              }))}
              assignmentField="variantId"
              uploading={editUploading}
              showWatermarkControls
              watermarkImages={watermarkImages}
              watermarkingImageId={watermarkingImageId}
              onUpload={(files) => uploadImages(files, "edit")}
              onAdd={() => addImageRow(undefined, "edit")}
              onUpdate={(id, patch) => updateImageRow(id, patch, "edit")}
              onMove={(id, direction) => moveImageRow(id, direction, "edit")}
              onRemove={(id) => removeImageRow(id, "edit")}
              onApplyWatermark={applyWatermark}
              onRemoveWatermark={removeWatermark}
              onOpenPreview={setPreviewImage}
            />

            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">تنوع‌ها</h3>
                <span className="text-xs font-bold text-zinc-500">{editVariants.length} تنوع</span>
              </div>
              <div className="grid gap-3">
                {editVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className="grid gap-3 border border-zinc-200 bg-zinc-50 p-3"
                  >
                    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_120px_auto]">
                      <Input
                        label="عنوان تنوع"
                        value={variant.titleFa}
                        onChange={(value) => updateEditVariant(variant.id, { titleFa: value })}
                      />
                      <Input
                        label="SKU"
                        value={variant.sku}
                        onChange={(value) => updateEditVariant(variant.id, { sku: value })}
                        dir="ltr"
                      />
                      <Input
                        label="سایز"
                        value={variant.size}
                        onChange={(value) => updateEditVariant(variant.id, { size: value })}
                        dir="ltr"
                      />
                      <Input
                        label="افزودن موجودی"
                        value={variant.stockToAdd}
                        onChange={(value) => updateEditVariant(variant.id, { stockToAdd: value })}
                        dir="ltr"
                      />
                      <label className="flex items-end gap-2 pb-2 text-sm font-bold">
                        <input
                          type="radio"
                          name="default-product-variant"
                          checked={variant.isDefault}
                          onChange={() => updateEditVariant(variant.id, { isDefault: true })}
                        />
                        پیش‌فرض
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <Input
                        label="نام رنگ"
                        value={variant.colorNameFa}
                        onChange={(value) => updateEditVariant(variant.id, { colorNameFa: value })}
                      />
                      <Input
                        label="اسلاگ رنگ"
                        value={variant.colorSlug}
                        onChange={(value) => updateEditVariant(variant.id, { colorSlug: value })}
                        dir="ltr"
                      />
                      <label className="block min-w-0">
                        <span className="mb-2 block text-sm font-bold">کد رنگ</span>
                        <div className="flex h-11 items-center gap-2 border border-zinc-300 bg-white px-2">
                          <input
                            type="color"
                            value={variant.colorHex || "#000000"}
                            onChange={(event) =>
                              updateEditVariant(variant.id, { colorHex: event.target.value })
                            }
                            className="size-8 cursor-pointer border-0 bg-transparent p-0"
                            aria-label="انتخاب رنگ"
                          />
                          <input
                            value={variant.colorHex}
                            onChange={(event) =>
                              updateEditVariant(variant.id, { colorHex: event.target.value })
                            }
                            className="min-w-0 flex-1 bg-transparent text-left text-sm outline-none"
                            dir="ltr"
                          />
                        </div>
                      </label>
                      <Input
                        label="نام جنس"
                        value={variant.materialNameFa}
                        onChange={(value) =>
                          updateEditVariant(variant.id, { materialNameFa: value })
                        }
                      />
                      <Input
                        label="اسلاگ جنس"
                        value={variant.materialSlug}
                        onChange={(value) => updateEditVariant(variant.id, { materialSlug: value })}
                        dir="ltr"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <PriceInput
                        label="قیمت عمومی"
                        value={variant.publicPriceAmount}
                        onChange={(value) =>
                          updateEditVariant(variant.id, { publicPriceAmount: value })
                        }
                      />
                      <PriceInput
                        label="قیمت کاربران"
                        value={variant.registeredPriceAmount}
                        onChange={(value) =>
                          updateEditVariant(variant.id, { registeredPriceAmount: value })
                        }
                      />
                      <PriceInput
                        label="قیمت پریمیوم"
                        value={variant.premiumPriceAmount}
                        onChange={(value) =>
                          updateEditVariant(variant.id, { premiumPriceAmount: value })
                        }
                      />
                      <PriceInput
                        label="قیمت قبل"
                        value={variant.compareAtAmount}
                        onChange={(value) =>
                          updateEditVariant(variant.id, { compareAtAmount: value })
                        }
                      />
                    </div>
                    <p className="text-xs font-bold text-zinc-500">
                      {availableStock(variant)} واحد موجود از {variant.inventoryUnits.length} واحد
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button
            className="mt-4 h-11 px-6 font-black"
            onClick={saveProductEdits}
            disabled={editSaving}
          >
            {editSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            ذخیره تغییرات
          </Button>
        </section>
      ) : null}

      {showList ? (
        <section className="min-w-0 overflow-hidden border border-zinc-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
            <div>
              <h2 className="text-lg font-black">محصولات</h2>
              <p className="mt-1 text-xs font-bold text-zinc-500">
                {filteredProducts.length.toLocaleString("fa-IR")} از{" "}
                {products.length.toLocaleString("fa-IR")} محصول
              </p>
            </div>
            <ActionLink href="/admin/products/new">
              <Plus className="size-3.5" />
              افزودن محصول
            </ActionLink>
          </div>
          <div className="grid min-w-0 gap-3 border-b border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[minmax(0,1fr)_280px]">
            <label className="block min-w-0">
              <span className="mb-2 flex items-center gap-1 text-sm font-bold">
                <Search className="size-3.5" />
                جستجوی نام محصول
              </span>
              <input
                value={productSearchQuery}
                onChange={(event) => setProductSearchQuery(event.target.value)}
                className="h-11 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
                placeholder="نام محصول یا اسلاگ"
              />
            </label>
            <CategorySelect
              label="فیلتر دسته‌بندی"
              categories={categories}
              value={productCategoryFilter}
              onChange={setProductCategoryFilter}
              emptyLabel="همه دسته‌ها"
            />
          </div>
          <div className="divide-y divide-zinc-100">
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-sm font-bold text-zinc-500">
                محصولی با این فیلترها پیدا نشد.
              </div>
            ) : null}
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="grid min-w-0 gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black">{product.titleFa}</h3>
                    <span className="bg-zinc-100 px-2 py-1 text-xs font-black">
                      {product.status}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-zinc-500" dir="ltr">
                    /products/{product.slug}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    {product.variants.length} تنوع،{" "}
                    {product.variants.reduce((sum, variant) => sum + availableStock(variant), 0)}{" "}
                    واحد موجود، {product.images.length} تصویر
                  </p>
                  <ProductImageStrip images={product.images} />
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <ActionLink href={`/admin/products/${product.id}/edit`}>
                    <Pencil className="size-3.5" />
                    ویرایش
                  </ActionLink>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(product, "ACTIVE")}
                  >
                    فعال
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(product, "DISABLED")}
                  >
                    غیرفعال
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(product, "DRAFT")}
                  >
                    پیش‌نویس
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {previewImage ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/80 p-3"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="grid max-h-[92dvh] w-full max-w-5xl gap-3 bg-white p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="min-w-0 truncate text-sm font-black">
                {previewImage.altFa || "پیش‌نمایش تصویر"}
              </h2>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => setPreviewImage(null)}
                aria-label="بستن پیش‌نمایش"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid max-h-[82dvh] min-h-0 place-items-center overflow-auto bg-zinc-100">
              {previewImage.url ? (
                <img
                  src={previewImage.url}
                  alt={previewImage.altFa || "پیش‌نمایش تصویر"}
                  className="max-h-[82dvh] max-w-full object-contain"
                />
              ) : (
                <div className="p-8 text-sm font-bold text-zinc-500">بدون تصویر</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProductImageStrip({ images }: { images: ProductImageRecord[] }) {
  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <p className="mb-2 text-xs font-black text-zinc-500">تصاویر محصول</p>
      {sortedImages.length === 0 ? (
        <div className="grid h-16 w-16 place-items-center border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400">
          <ImagePlus className="size-5" />
        </div>
      ) : (
        <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
          {sortedImages.map((image) => (
            <div key={image.id} className="shrink-0">
              <div className="relative h-20 w-16 overflow-hidden border border-zinc-200 bg-zinc-100">
                <img
                  src={image.url}
                  alt={image.altFa || "تصویر محصول"}
                  className="h-full w-full object-cover"
                />
                {image.isPrimary ? (
                  <span className="absolute right-1 top-1 bg-white/92 px-1.5 py-0.5 text-[10px] font-black text-zinc-950">
                    اصلی
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex max-w-16 flex-wrap gap-1">
                {image.vipImage ? (
                  <span className="bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
                    VIP
                  </span>
                ) : null}
                {image.showcasePublic ? (
                  <span className="bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">
                    خانه
                  </span>
                ) : null}
                {image.showcasePremium ? (
                  <span className="bg-purple-100 px-1.5 py-0.5 text-[10px] font-black text-purple-800">
                    خانه VIP
                  </span>
                ) : null}
                {image.variantId ? (
                  <span className="bg-zinc-100 px-1.5 py-0.5 text-[10px] font-black text-zinc-600">
                    تنوع
                  </span>
                ) : null}
                {image.watermarkEnabled ? (
                  <span className="bg-sky-100 px-1.5 py-0.5 text-[10px] font-black text-sky-800">
                    واترمارک
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      data-admin-action-link
      data-darkreader-ignore
      className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-zinc-300 bg-white px-2.5 text-[0.8rem] font-medium text-zinc-950 transition hover:bg-zinc-50 dark:border-zinc-300 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-50"
    >
      {children}
    </Link>
  );
}

function TagPicker({
  selectedTags,
  tagQuery,
  suggestions,
  onQueryChange,
  onCreate,
  onSelect,
  onRemove,
}: {
  selectedTags: SelectedTag[];
  tagQuery: string;
  suggestions: TagOption[];
  onQueryChange: (value: string) => void;
  onCreate: () => void;
  onSelect: (tag: TagOption) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="relative lg:col-span-2">
      <span className="mb-2 block text-sm font-bold">تگ‌ها</span>
      <div className="min-h-11 border border-zinc-300 bg-white px-2 py-2 focus-within:border-zinc-950">
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-2 bg-zinc-100 px-2 py-1 text-xs font-black"
            >
              {tag.titleFa}
              <button
                type="button"
                onClick={() => onRemove(tag.id)}
                className="text-zinc-500 hover:text-zinc-950"
                aria-label="حذف تگ"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagQuery}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCreate();
              }
            }}
            placeholder="جستجو یا ساخت تگ"
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <Button type="button" size="sm" variant="outline" onClick={onCreate}>
            افزودن
          </Button>
        </div>
      </div>
      {suggestions.length > 0 ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto border border-zinc-200 bg-white shadow-xl">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onSelect(tag)}
              className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-zinc-50"
            >
              <span className="font-bold">{tag.titleFa}</span>
              <span className="text-xs text-zinc-500" dir="ltr">
                {tag.slug}
                {tag.isVisible ? "" : " / hidden"}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ImageRowsEditor({
  title,
  rows,
  variantOptions,
  assignmentField,
  uploading,
  showWatermarkControls = false,
  watermarkImages = [],
  watermarkingImageId = "",
  onUpload,
  onAdd,
  onUpdate,
  onMove,
  onRemove,
  onApplyWatermark,
  onRemoveWatermark,
  onOpenPreview,
}: {
  title: string;
  rows: ImageRow[];
  variantOptions: VariantOption[];
  assignmentField: "variantId" | "variantKey";
  uploading: boolean;
  showWatermarkControls?: boolean;
  watermarkImages?: WatermarkImageOption[];
  watermarkingImageId?: string;
  onUpload: (files: FileList | null) => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<ImageRow>) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onApplyWatermark?: (image: ImageRow) => void;
  onRemoveWatermark?: (image: ImageRow) => void;
  onOpenPreview?: (image: ImageRow) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="min-w-0 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black">{title}</h3>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              onUpload(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
            <span>{uploading ? "آپلود" : "انتخاب فایل"}</span>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus className="size-3.5" />
            تصویر دستی
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
          هنوز تصویری انتخاب نشده است.
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          {rows.map((image, index) => (
            <div
              key={image.id}
              className="grid min-w-0 gap-3 border border-zinc-200 bg-zinc-50 p-3 lg:grid-cols-[92px_minmax(0,1.2fr)_minmax(0,0.9fr)_170px_190px_120px_auto_auto]"
            >
              <button
                type="button"
                className="group relative aspect-square overflow-hidden bg-white text-right"
                onClick={() => onOpenPreview?.(image)}
                disabled={!image.url}
                aria-label="پیش‌نمایش تصویر"
              >
                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.altFa || "تصویر محصول"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-zinc-400">تصویر</div>
                )}
                {image.url ? (
                  <span className="absolute inset-x-1 bottom-1 inline-flex items-center justify-center gap-1 bg-white/90 px-1.5 py-1 text-[10px] font-black text-zinc-950 opacity-0 transition group-hover:opacity-100">
                    <Eye className="size-3" />
                    پیش‌نمایش
                  </span>
                ) : null}
              </button>
              <Input
                label="آدرس تصویر"
                value={image.url}
                onChange={(value) => onUpdate(image.id, { url: value })}
                dir="ltr"
              />
              <Input
                label="متن جایگزین"
                value={image.altFa}
                onChange={(value) => onUpdate(image.id, { altFa: value })}
              />
              <VariantAssignmentSelect
                label="تنوع تصویر"
                value={image[assignmentField]}
                options={variantOptions}
                onChange={(value) => onUpdate(image.id, { [assignmentField]: value })}
              />
              <div className="grid content-end gap-2 text-sm font-bold">
                <span className="text-xs font-black text-zinc-500">بلاک خانه</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={image.showcasePublic}
                    onChange={(event) =>
                      onUpdate(image.id, { showcasePublic: event.target.checked })
                    }
                  />
                  عادی
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={image.showcasePremium}
                    onChange={(event) =>
                      onUpdate(image.id, { showcasePremium: event.target.checked })
                    }
                  />
                  پریمیوم
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={image.showcasePublic && image.showcasePremium}
                    onChange={(event) =>
                      onUpdate(image.id, {
                        showcasePublic: event.target.checked,
                        showcasePremium: event.target.checked,
                      })
                    }
                  />
                  هر دو
                </label>
              </div>
              <div className="grid content-end gap-2 text-sm font-bold">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${assignmentField}-primary-product-image`}
                    checked={image.isPrimary}
                    onChange={() => onUpdate(image.id, { isPrimary: true })}
                  />
                  تصویر اصلی
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={image.vipImage}
                    onChange={(event) => onUpdate(image.id, { vipImage: event.target.checked })}
                  />
                  VIP
                </label>
              </div>
              <div className="flex items-end gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  onClick={() => onMove(image.id, -1)}
                  disabled={index === 0}
                  aria-label="انتقال تصویر به بالا"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  onClick={() => onMove(image.id, 1)}
                  disabled={index === rows.length - 1}
                  aria-label="انتقال تصویر به پایین"
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="icon-lg"
                  variant="outline"
                  onClick={() => onRemove(image.id)}
                  aria-label="حذف تصویر"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {showWatermarkControls ? (
                <WatermarkControls
                  image={image}
                  watermarkImages={watermarkImages}
                  loading={watermarkingImageId === image.id}
                  onUpdate={(patch) => onUpdate(image.id, patch)}
                  onApply={() => onApplyWatermark?.(image)}
                  onRemove={() => onRemoveWatermark?.(image)}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WatermarkControls({
  image,
  watermarkImages,
  loading,
  onUpdate,
  onApply,
  onRemove,
}: {
  image: ImageRow;
  watermarkImages: WatermarkImageOption[];
  loading: boolean;
  onUpdate: (patch: Partial<ImageRow>) => void;
  onApply: () => void;
  onRemove: () => void;
}) {
  const canApply =
    Boolean(image.persistedId) && image.watermarkEnabled && Boolean(image.watermarkImageId);

  return (
    <div className="grid min-w-0 gap-3 border-t border-zinc-200 pt-3 lg:col-span-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm font-bold">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={image.watermarkEnabled}
              disabled={loading}
              onChange={(event) => {
                if (event.target.checked) {
                  onUpdate({ watermarkEnabled: true });
                  return;
                }

                onRemove();
              }}
            />
            واترمارک
          </label>
          {image.watermarkEnabled ? (
            <span className="bg-zinc-200 px-2 py-1 text-[11px] font-black text-zinc-700">PNG</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !canApply}
            onClick={onApply}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            اعمال
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !image.watermarkEnabled}
            onClick={onRemove}
          >
            <X className="size-3.5" />
            حذف
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_120px]">
        <label className="block min-w-0">
          <span className="mb-2 block text-sm font-bold">تصویر واترمارک</span>
          <select
            value={image.watermarkImageId}
            disabled={loading || !image.watermarkEnabled}
            onChange={(event) => onUpdate({ watermarkImageId: event.target.value })}
            className="h-11 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
          >
            <option value="">انتخاب تصویر</option>
            {watermarkImages.map((watermarkImage) => (
              <option key={watermarkImage.id} value={watermarkImage.id}>
                {watermarkImage.titleFa || watermarkImage.originalName}
                {watermarkImage.width && watermarkImage.height
                  ? ` (${watermarkImage.width}×${watermarkImage.height})`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <WatermarkTextInput
          label="X"
          value={image.watermarkX}
          disabled={loading || !image.watermarkEnabled}
          onChange={(value) => onUpdate({ watermarkX: value })}
        />
        <WatermarkTextInput
          label="Y"
          value={image.watermarkY}
          disabled={loading || !image.watermarkEnabled}
          onChange={(value) => onUpdate({ watermarkY: value })}
        />
        <WatermarkTextInput
          label="اندازه"
          value={image.watermarkSize}
          disabled={loading || !image.watermarkEnabled}
          onChange={(value) => onUpdate({ watermarkSize: value })}
        />
        <WatermarkTextInput
          label="شفافیت"
          value={image.watermarkOpacity}
          disabled={loading || !image.watermarkEnabled}
          onChange={(value) => onUpdate({ watermarkOpacity: value })}
        />
      </div>
    </div>
  );
}

function WatermarkTextInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 border border-zinc-300 bg-white px-3 text-left text-sm outline-none focus:border-zinc-950 disabled:bg-zinc-100"
        dir="ltr"
      />
    </label>
  );
}

function CategorySelect({
  label,
  categories,
  value,
  onChange,
  emptyLabel = "بدون دسته",
}: {
  label: string;
  categories: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
      >
        <option value="">{emptyLabel}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {"— ".repeat(category.depth)}
            {category.titleFa}
            {category.isVisible ? "" : " (مخفی)"}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function VariantAssignmentSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: VariantOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
      >
        <option value="">همه تنوع‌ها</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  dir = "rtl",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "rtl" | "ltr";
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
        dir={dir}
      />
    </label>
  );
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <div className="flex h-11 items-center border border-zinc-300 bg-white focus-within:border-zinc-950">
        <span className="grid h-full place-items-center border-l border-zinc-200 px-3 text-xs font-black text-zinc-500">
          تومان
        </span>
        <input
          value={formatPriceValue(value)}
          onChange={(event) => onChange(normalizePriceValue(event.target.value))}
          inputMode="numeric"
          placeholder="۰"
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent px-3 text-left text-sm font-black outline-none"
          dir="ltr"
        />
      </div>
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  dir = "rtl",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "rtl" | "ltr";
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full min-w-0 border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950"
        dir={dir}
      />
    </label>
  );
}
