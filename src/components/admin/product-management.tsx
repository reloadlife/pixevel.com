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
import { DateField, MoneyField, NumberField, SwitchRow } from "@/components/admin/kit/form-fields";
import { Button } from "@/components/ui/button";
import { formatToman } from "@/lib/format";
import { optionsKeyFromPairs, optionValueKey } from "@/lib/variant-options";

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
  optionValueId: string;
  watermarkEnabled: boolean;
  watermarkImageId: string;
  watermarkX: number;
  watermarkY: number;
  watermarkSize: number;
  watermarkOpacity: number;
  watermarkAppliedUrl: string;
};

type OptionValueRow = {
  id: string;
  valueFa: string;
  slug: string;
  hex: string;
  swatchImageUrl: string;
  position: number;
};

type ProductOptionRow = {
  id: string;
  nameFa: string;
  slug: string;
  inputKind: OptionInputKind;
  position: number;
  values: OptionValueRow[];
};

type VariantOptionValueLink = {
  optionId: string;
  optionSlug: string;
  optionNameFa: string;
  optionValueId: string;
  valueSlug: string;
  valueFa: string;
};

type SubscriptionPlanShape = {
  intervalUnit: string;
  intervalCount: number;
  trialDays: number;
  termCount: number | null;
  gracePeriodDays: number;
  autoRenewDefault: boolean;
};

type ProductVariantRow = {
  id: string;
  sku: string;
  titleFa: string;
  optionsKey: string;
  optionValues: VariantOptionValueLink[];
  publicPriceAmount: string;
  registeredPriceAmount: string;
  premiumPriceAmount: string;
  compareAtAmount: string;
  salePriceAmount: string;
  saleStartsAt: string;
  saleEndsAt: string;
  isDefault: boolean;
  subscriptionPlan: SubscriptionPlanShape | null;
  inventoryUnits: Array<{ id: string; status: string }>;
};

type ProductRelationEntry = {
  id: string;
  kind: string;
  position: number;
  relatedProduct: {
    id: string;
    slug: string;
    titleFa: string;
    status: string;
    imageUrl: string | null;
  };
};

type ProductRow = {
  id: string;
  slug: string;
  titleFa: string;
  summaryFa: string;
  descriptionFa: string;
  fitFa: string;
  careFa: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  noindex: boolean;
  baseCurrency: string;
  status: string;
  fulfillmentType: string;
  inventoryPolicy: string;
  isSubscription: boolean;
  taxExempt: boolean;
  weightGram: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  categoryId: string;
  tagIds: string[];
  tags: TagOption[];
  options: ProductOptionRow[];
  images: ProductImageRecord[];
  variants: ProductVariantRow[];
};

type OptionInputKind = "SELECT" | "SWATCH" | "PILL";

const FULFILLMENT_OPTIONS = [
  { value: "DIGITAL", label: "دیجیتال" },
  { value: "PHYSICAL", label: "فیزیکی" },
  { value: "DOMAIN", label: "دامنه" },
  { value: "SERVER", label: "سرور" },
  { value: "SERVICE", label: "خدمات" },
];

const INVENTORY_POLICY_OPTIONS = [
  { value: "TRACKED", label: "موجودی دقیق" },
  { value: "INFINITE", label: "نامحدود" },
];

const INPUT_KIND_OPTIONS: { value: OptionInputKind; label: string }[] = [
  { value: "SELECT", label: "انتخابی" },
  { value: "SWATCH", label: "سواچ" },
  { value: "PILL", label: "دکمه‌ای" },
];

const INTERVAL_UNIT_OPTIONS = [
  { value: "DAY", label: "روز" },
  { value: "WEEK", label: "هفته" },
  { value: "MONTH", label: "ماه" },
  { value: "YEAR", label: "سال" },
];

const CURRENCY_OPTIONS = [
  { value: "IRT", label: "تومان (بدون تبدیل)" },
  { value: "USD", label: "دلار آمریکا (USD)" },
  { value: "EUR", label: "یورو (EUR)" },
];

type SelectedTag = TagOption & {
  isNew?: boolean;
};

// In-builder option model. `slug` is optional — the server slugifies nameFa/valueFa
// when omitted, but we mirror the same composition client-side for live keys.
type BuilderOptionValue = {
  id: string;
  valueFa: string;
  slug: string;
  hex: string;
  swatchImageUrl: string;
};

type BuilderOption = {
  id: string;
  nameFa: string;
  slug: string;
  inputKind: OptionInputKind;
  values: BuilderOptionValue[];
};

// Per-variant override fields keyed by optionsKey, feeding variantOverridesByKey.
type VariantOverrideState = {
  publicPriceAmount: string;
  registeredPriceAmount: string;
  premiumPriceAmount: string;
  compareAtAmount: string;
  salePriceAmount: string;
  saleStartsAt: string;
  saleEndsAt: string;
  stockToAdd: string;
  stockCodes: string;
};

type SubscriptionPlanState = {
  intervalUnit: string;
  intervalCount: string;
  trialDays: string;
  termCount: string;
  gracePeriodDays: string;
  autoRenewDefault: boolean;
};

// Generated variant preview row (cartesian product of option values).
type PreviewVariant = {
  optionsKey: string;
  titleFa: string;
  pairs: Array<{ optionSlug: string; valueSlug: string }>;
};

// Edit-mode variant row carries the persisted id plus stock-add inputs.
type VariantEditRow = ProductVariantRow & {
  stockToAdd: string;
  stockCodes: string;
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
  // Association in create mode: either a generated variant (optionsKey) or a
  // single option value ("optionSlug:valueSlug"). In edit mode we map to ids.
  variantKey: string;
  optionValueKey: string;
  optionValueId: string;
  watermarkEnabled: boolean;
  watermarkImageId: string;
  watermarkX: string;
  watermarkY: string;
  watermarkSize: string;
  watermarkOpacity: string;
  watermarkAppliedUrl: string;
};

// Generic assignment option for the image editor (value carries variantKey or id).
type AssignmentOption = {
  id: string;
  label: string;
  group?: string;
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

// Mirror the server slugify so live optionsKeys match what createAdminProduct stores.
function slugifyForKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^؀-ۿa-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function availableStock(variant: ProductVariantRow) {
  return variant.inventoryUnits.filter((unit) => unit.status === "AVAILABLE").length;
}

// Parse a "one code per line" textarea into a trimmed, blank-free string array.
function parseCodes(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function emptyOverride(): VariantOverrideState {
  return {
    publicPriceAmount: "",
    registeredPriceAmount: "",
    premiumPriceAmount: "",
    compareAtAmount: "",
    salePriceAmount: "",
    saleStartsAt: "",
    saleEndsAt: "",
    stockToAdd: "",
    stockCodes: "",
  };
}

function defaultSubscriptionPlan(): SubscriptionPlanState {
  return {
    intervalUnit: "MONTH",
    intervalCount: "1",
    trialDays: "0",
    termCount: "",
    gracePeriodDays: "3",
    autoRenewDefault: true,
  };
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
    fulfillmentType: product?.fulfillmentType ?? "DIGITAL",
    inventoryPolicy: product?.inventoryPolicy ?? "TRACKED",
    isSubscription: product?.isSubscription ?? false,
    seoTitle: product?.seoTitle ?? "",
    seoDescription: product?.seoDescription ?? "",
    ogImageUrl: product?.ogImageUrl ?? "",
    noindex: product?.noindex ?? false,
    baseCurrency: product?.baseCurrency ?? "IRT",
    taxExempt: product?.taxExempt ?? false,
    weightGram: product?.weightGram != null ? String(product.weightGram) : "",
    lengthMm: product?.lengthMm != null ? String(product.lengthMm) : "",
    widthMm: product?.widthMm != null ? String(product.widthMm) : "",
    heightMm: product?.heightMm != null ? String(product.heightMm) : "",
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
    optionValueKey: "",
    optionValueId: image.optionValueId,
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
  return product?.variants.map((variant) => ({ ...variant, stockToAdd: "", stockCodes: "" })) ?? [];
}

// Hydrate the shared option-builder state from a persisted product's options.
function builderOptionsFromProduct(product: ProductRow | null): BuilderOption[] {
  return (
    product?.options.map((option) => ({
      id: createId("option"),
      nameFa: option.nameFa,
      slug: option.slug,
      inputKind: option.inputKind,
      values: option.values.map((value) => ({
        id: createId("value"),
        valueFa: value.valueFa,
        slug: value.slug,
        hex: value.hex || "#7c3aed",
        swatchImageUrl: value.swatchImageUrl,
      })),
    })) ?? []
  );
}

// optionsKey of a product's default variant (falls back to the first variant).
function defaultVariantKeyOf(product: ProductRow | null): string {
  const variants = product?.variants ?? [];
  return (variants.find((variant) => variant.isDefault) ?? variants[0])?.optionsKey ?? "";
}

// Seed the per-variant override editor from a product's existing variants so
// edit mode preserves current prices/stock and round-trips them on save.
function overridesFromProduct(product: ProductRow | null): Record<string, VariantOverrideState> {
  const seed: Record<string, VariantOverrideState> = {};
  for (const variant of product?.variants ?? []) {
    seed[variant.optionsKey] = {
      publicPriceAmount: variant.publicPriceAmount,
      registeredPriceAmount: variant.registeredPriceAmount,
      premiumPriceAmount: variant.premiumPriceAmount,
      compareAtAmount: variant.compareAtAmount,
      salePriceAmount: variant.salePriceAmount ?? "",
      saleStartsAt: variant.saleStartsAt ?? "",
      saleEndsAt: variant.saleEndsAt ?? "",
      stockToAdd: "",
      stockCodes: "",
    };
  }
  return seed;
}

function subscriptionStateFromPlan(plan: SubscriptionPlanShape | null | undefined) {
  if (!plan) {
    return defaultSubscriptionPlan();
  }

  return {
    intervalUnit: plan.intervalUnit,
    intervalCount: String(plan.intervalCount ?? 1),
    trialDays: String(plan.trialDays ?? 0),
    termCount: plan.termCount == null ? "" : String(plan.termCount),
    gracePeriodDays: String(plan.gracePeriodDays ?? 3),
    autoRenewDefault: plan.autoRenewDefault ?? true,
  } satisfies SubscriptionPlanState;
}

// Build the API subscriptionPlan payload from the panel state.
function subscriptionPlanPayload(state: SubscriptionPlanState) {
  const termCount = state.termCount.trim() ? Number(normalizePriceValue(state.termCount)) : null;

  return {
    intervalUnit: state.intervalUnit,
    intervalCount: Number(normalizePriceValue(state.intervalCount) || 1),
    trialDays: Number(normalizePriceValue(state.trialDays) || 0),
    termCount: termCount && termCount > 0 ? termCount : null,
    gracePeriodDays: Number(normalizePriceValue(state.gracePeriodDays) || 0),
    autoRenewDefault: state.autoRenewDefault,
  };
}

export function ProductManagement({
  initialProducts,
  initialCategories,
  initialTags,
  initialWatermarkImages = [],
  mode = "list",
  initialEditingProductId,
  usdRate,
  eurRate,
}: {
  initialProducts: ProductRow[];
  initialCategories: CategoryOption[];
  initialTags: TagOption[];
  initialWatermarkImages?: WatermarkImageOption[];
  mode?: ProductManagementMode;
  initialEditingProductId?: string;
  // Live FX rates (Toman per unit) so the editor can preview the Toman value of
  // USD/EUR-authored prices. Fall back to module defaults if unset upstream.
  usdRate?: number;
  eurRate?: number;
}) {
  const initialEditingProduct =
    mode === "edit"
      ? (initialProducts.find((product) => product.id === initialEditingProductId) ?? null)
      : null;
  // Toman value of one unit of the given base currency (undefined for IRT / unknown).
  const rateForCurrency = (baseCurrency: string): number | undefined =>
    baseCurrency === "USD" ? usdRate : baseCurrency === "EUR" ? eurRate : undefined;
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

  // ── Shared option builder + per-variant overrides (create AND edit) ──────────
  const [options, setOptions] = useState<BuilderOption[]>(() =>
    builderOptionsFromProduct(initialEditingProduct),
  );
  const [overrides, setOverrides] = useState<Record<string, VariantOverrideState>>(() =>
    overridesFromProduct(initialEditingProduct),
  );
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanState>(
    defaultSubscriptionPlan(),
  );
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
    fulfillmentType: "DIGITAL",
    inventoryPolicy: "TRACKED",
    isSubscription: false,
    baseCurrency: "IRT",
    seoTitle: "",
    seoDescription: "",
    ogImageUrl: "",
    noindex: false,
  });
  const [editForm, setEditForm] = useState(editFormFromProduct(initialEditingProduct));
  // optionsKey of the variant chosen as default (edit reconcile path).
  const [editDefaultKey, setEditDefaultKey] = useState(() =>
    defaultVariantKeyOf(initialEditingProduct),
  );
  // Edit-mode subscription panel applied to every variant on save.
  const [editSubscriptionPlan, setEditSubscriptionPlan] = useState<SubscriptionPlanState>(
    subscriptionStateFromPlan(initialEditingProduct?.variants[0]?.subscriptionPlan ?? null),
  );

  // Relations state: keyed by kind, value is the current set of related product entries.
  const [editRelations, setEditRelations] = useState<ProductRelationEntry[]>([]);
  const [relationsLoaded, setRelationsLoaded] = useState(false);
  const [relationsSaving, setRelationsSaving] = useState<string>("");
  // Product picker for relations: search query + results.
  const [relationPickerQuery, setRelationPickerQuery] = useState("");
  const [relationPickerResults, setRelationPickerResults] = useState<
    Array<{ id: string; titleFa: string; slug: string; status: string }>
  >([]);
  const [relationPickerKind, setRelationPickerKind] = useState<string>("RELATED");

  const editingProduct = products.find((product) => product.id === editingProductId) ?? null;
  const showCreate = mode === "create";
  const showList = mode === "list";
  const showEdit = mode === "edit";

  // Normalized, deduped option groups with live slugs (mirrors server normalize).
  const normalizedOptions = useMemo(() => {
    const usedOptionSlugs = new Set<string>();

    return options
      .map((option, optionIndex) => {
        const nameFa = option.nameFa.trim();
        if (!nameFa) return null;

        let slug = slugifyForKey(option.slug || nameFa) || `option-${optionIndex + 1}`;
        while (usedOptionSlugs.has(slug)) slug = `${slug}-${optionIndex + 1}`;
        usedOptionSlugs.add(slug);

        const usedValueSlugs = new Set<string>();
        const values = option.values
          .map((value, valueIndex) => {
            const valueFa = value.valueFa.trim();
            if (!valueFa) return null;
            let valueSlug = slugifyForKey(value.slug || valueFa) || `value-${valueIndex + 1}`;
            while (usedValueSlugs.has(valueSlug)) valueSlug = `${valueSlug}-${valueIndex + 1}`;
            usedValueSlugs.add(valueSlug);
            return { valueFa, slug: valueSlug };
          })
          .filter((value): value is { valueFa: string; slug: string } => value != null);

        if (values.length === 0) return null;

        return { nameFa, slug, values };
      })
      .filter(
        (
          option,
        ): option is {
          nameFa: string;
          slug: string;
          values: { valueFa: string; slug: string }[];
        } => option != null,
      );
  }, [options]);

  // Live cartesian product → one preview variant per combination (key = optionsKey).
  const variantPreview = useMemo<PreviewVariant[]>(() => {
    if (normalizedOptions.length === 0) {
      return [{ optionsKey: "", titleFa: form.titleFa.trim() || "تنوع پیش‌فرض", pairs: [] }];
    }

    const combos = normalizedOptions.reduce<
      Array<Array<{ optionSlug: string; valueSlug: string; valueFa: string }>>
    >(
      (acc, option) =>
        acc.flatMap((combo) =>
          option.values.map((value) => [
            ...combo,
            { optionSlug: option.slug, valueSlug: value.slug, valueFa: value.valueFa },
          ]),
        ),
      [[]],
    );

    return combos.map((combo) => {
      const pairs = combo.map((item) => ({
        optionSlug: item.optionSlug,
        valueSlug: item.valueSlug,
      }));
      const titleFa = combo.map((item) => item.valueFa).join(" / ") || form.titleFa.trim();
      return { optionsKey: optionsKeyFromPairs(pairs), titleFa, pairs };
    });
  }, [normalizedOptions, form.titleFa]);

  // Image-assignment options for create mode: every generated variant + every
  // single option value (key "optionSlug:valueSlug").
  const createAssignmentOptions = useMemo<AssignmentOption[]>(() => {
    const variantOptions = variantPreview
      .filter((variant) => variant.optionsKey)
      .map((variant) => ({
        id: `variant:${variant.optionsKey}`,
        label: variant.titleFa,
        group: "تنوع کامل",
      }));

    const valueOptions = normalizedOptions.flatMap((option) =>
      option.values.map((value) => ({
        id: `value:${optionValueKey(option.slug, value.slug)}`,
        label: `${option.nameFa}: ${value.valueFa}`,
        group: "مقدار",
      })),
    );

    return [...variantOptions, ...valueOptions];
  }, [variantPreview, normalizedOptions]);

  // Edit-mode image assignment: persisted variant ids + persisted option-value ids.
  const editAssignmentOptions = useMemo<AssignmentOption[]>(() => {
    const variantOptions = editVariants.map((variant) => ({
      id: `variant:${variant.id}`,
      label: variant.titleFa,
      group: "تنوع کامل",
    }));

    const seen = new Set<string>();
    const valueOptions: AssignmentOption[] = [];
    for (const variant of editVariants) {
      for (const link of variant.optionValues) {
        if (seen.has(link.optionValueId)) continue;
        seen.add(link.optionValueId);
        valueOptions.push({
          id: `value:${link.optionValueId}`,
          label: `${link.optionNameFa}: ${link.valueFa}`,
          group: "مقدار",
        });
      }
    }

    return [...variantOptions, ...valueOptions];
  }, [editVariants]);

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
        optionValueKey: row?.optionValueKey ?? "",
        optionValueId: row?.optionValueId ?? "",
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

  // ── Option builder mutations (create mode) ──────────────────────────────────
  function addOption() {
    setOptions((current) => [
      ...current,
      {
        id: createId("option"),
        nameFa: "",
        slug: "",
        inputKind: "PILL",
        values: [
          { id: createId("value"), valueFa: "", slug: "", hex: "#7c3aed", swatchImageUrl: "" },
        ],
      },
    ]);
  }

  function updateOption(id: string, patch: Partial<BuilderOption>) {
    setOptions((current) =>
      current.map((option) => (option.id === id ? { ...option, ...patch } : option)),
    );
  }

  function removeOption(id: string) {
    setOptions((current) => current.filter((option) => option.id !== id));
  }

  function addOptionValue(optionId: string) {
    setOptions((current) =>
      current.map((option) =>
        option.id === optionId
          ? {
              ...option,
              values: [
                ...option.values,
                {
                  id: createId("value"),
                  valueFa: "",
                  slug: "",
                  hex: "#7c3aed",
                  swatchImageUrl: "",
                },
              ],
            }
          : option,
      ),
    );
  }

  function updateOptionValue(
    optionId: string,
    valueId: string,
    patch: Partial<BuilderOptionValue>,
  ) {
    setOptions((current) =>
      current.map((option) =>
        option.id === optionId
          ? {
              ...option,
              values: option.values.map((value) =>
                value.id === valueId ? { ...value, ...patch } : value,
              ),
            }
          : option,
      ),
    );
  }

  function removeOptionValue(optionId: string, valueId: string) {
    setOptions((current) =>
      current.map((option) =>
        option.id === optionId
          ? { ...option, values: option.values.filter((value) => value.id !== valueId) }
          : option,
      ),
    );
  }

  function updateOverride(optionsKey: string, patch: Partial<VariantOverrideState>) {
    setOverrides((current) => ({
      ...current,
      [optionsKey]: { ...(current[optionsKey] ?? emptyOverride()), ...patch },
    }));
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
          optionValueKey: "",
          optionValueId: "",
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

  // Translate an image row's assignment selection into the API image shape.
  function createImagePayload(image: ImageRow, index: number) {
    return {
      url: image.url.trim(),
      altFa: image.altFa.trim(),
      vipImage: image.vipImage,
      isPrimary: image.isPrimary,
      showcasePublic: image.showcasePublic,
      showcasePremium: image.showcasePremium,
      sortOrder: index,
      variantKey: image.variantKey || undefined,
      optionValueKey: image.optionValueKey || undefined,
    };
  }

  async function createProduct() {
    setSaving(true);

    const tracked = form.inventoryPolicy === "TRACKED";

    // Only forward overrides with at least one meaningful field set.
    const variantOverridesByKey: Record<string, Record<string, unknown>> = {};
    for (const variant of variantPreview) {
      const override = overrides[variant.optionsKey];
      if (!override) continue;
      const codes =
        tracked && form.fulfillmentType === "DIGITAL" ? parseCodes(override.stockCodes) : [];
      const entry: Record<string, unknown> = {};
      if (override.publicPriceAmount) entry.publicPriceAmount = override.publicPriceAmount;
      if (override.registeredPriceAmount)
        entry.registeredPriceAmount = override.registeredPriceAmount;
      if (override.premiumPriceAmount) entry.premiumPriceAmount = override.premiumPriceAmount;
      if (override.compareAtAmount) entry.compareAtAmount = override.compareAtAmount;
      if (tracked && codes.length > 0) entry.stockCodes = codes;
      if (tracked && override.stockToAdd) {
        entry.stockToAdd = Number(normalizePriceValue(override.stockToAdd) || 0);
      }
      if (Object.keys(entry).length > 0) {
        variantOverridesByKey[variant.optionsKey] = entry;
      }
    }

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
        options: options
          .map((option) => ({
            nameFa: option.nameFa.trim(),
            slug: option.slug.trim() || undefined,
            inputKind: option.inputKind,
            values: option.values
              .map((value) => ({
                valueFa: value.valueFa.trim(),
                slug: value.slug.trim() || undefined,
                hex: option.inputKind === "SWATCH" ? value.hex.trim() || null : null,
                swatchImageUrl: value.swatchImageUrl.trim() || null,
              }))
              .filter((value) => value.valueFa),
          }))
          .filter((option) => option.nameFa && option.values.length > 0),
        stockPerVariant: Number(normalizePriceValue(form.stockPerVariant) || 0),
        inventoryPolicy: form.inventoryPolicy,
        isSubscription: form.isSubscription,
        subscriptionPlan: form.isSubscription
          ? subscriptionPlanPayload(subscriptionPlan)
          : undefined,
        variantOverridesByKey,
        fulfillmentType: form.fulfillmentType,
        images: imageRows.map(createImagePayload).filter((image) => image.url),
        status: form.status,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        ogImageUrl: form.ogImageUrl || undefined,
        noindex: form.noindex,
        baseCurrency: form.baseCurrency,
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
    setEditForm(editFormFromProduct(product));
    setEditSelectedCategoryId(product.categoryId);
    setEditSelectedTags(product.tags);
    setEditTagQuery("");
    setEditImageRows(product.images.map(imageRowFromRecord));
    setEditVariants(
      product.variants.map((variant) => ({ ...variant, stockToAdd: "", stockCodes: "" })),
    );
    setOptions(builderOptionsFromProduct(product));
    setOverrides(overridesFromProduct(product));
    setEditDefaultKey(defaultVariantKeyOf(product));
    setEditSubscriptionPlan(
      subscriptionStateFromPlan(product.variants[0]?.subscriptionPlan ?? null),
    );
    setEditRelations([]);
    setRelationsLoaded(false);
    setRelationPickerQuery("");
    setRelationPickerResults([]);

    requestAnimationFrame(() => {
      document.getElementById("product-edit-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function saveProductEdits() {
    if (!editingProductId) {
      return;
    }

    setEditSaving(true);

    const tracked = editForm.inventoryPolicy === "TRACKED";
    const planPayload = editForm.isSubscription
      ? subscriptionPlanPayload(editSubscriptionPlan)
      : null;

    // Build per-variant overrides keyed by optionsKey from the builder-derived
    // matrix: every variant carries its edited prices (so existing prices are
    // preserved on reconcile), plus stock additions and the default flag.
    const previewKeys = new Set(variantPreview.map((variant) => variant.optionsKey));
    const defaultKey = previewKeys.has(editDefaultKey)
      ? editDefaultKey
      : variantPreview[0]?.optionsKey;
    const variantOverridesByKey: Record<string, Record<string, unknown>> = {};
    for (const variant of variantPreview) {
      const override = overrides[variant.optionsKey] ?? emptyOverride();
      const codes =
        tracked && editForm.fulfillmentType === "DIGITAL" ? parseCodes(override.stockCodes) : [];
      const entry: Record<string, unknown> = { isDefault: variant.optionsKey === defaultKey };
      if (override.publicPriceAmount) entry.publicPriceAmount = override.publicPriceAmount;
      entry.registeredPriceAmount = override.registeredPriceAmount || null;
      entry.premiumPriceAmount = override.premiumPriceAmount || null;
      entry.compareAtAmount = override.compareAtAmount || null;
      entry.salePriceAmount = override.salePriceAmount || null;
      entry.saleStartsAt = override.saleStartsAt || null;
      entry.saleEndsAt = override.saleEndsAt || null;
      if (tracked && codes.length > 0) entry.stockCodes = codes;
      if (tracked && override.stockToAdd) {
        entry.stockToAdd = Number(normalizePriceValue(override.stockToAdd) || 0);
      }
      variantOverridesByKey[variant.optionsKey] = entry;
    }

    const optionsPayload = options
      .map((option) => ({
        nameFa: option.nameFa.trim(),
        slug: option.slug.trim() || undefined,
        inputKind: option.inputKind,
        values: option.values
          .map((value) => ({
            valueFa: value.valueFa.trim(),
            slug: value.slug.trim() || undefined,
            hex: option.inputKind === "SWATCH" ? value.hex.trim() || null : null,
            swatchImageUrl: value.swatchImageUrl.trim() || null,
          }))
          .filter((value) => value.valueFa),
      }))
      .filter((option) => option.nameFa && option.values.length > 0);

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
        seoTitle: editForm.seoTitle || null,
        seoDescription: editForm.seoDescription || null,
        ogImageUrl: editForm.ogImageUrl || null,
        noindex: editForm.noindex,
        baseCurrency: editForm.baseCurrency,
        status: editForm.status,
        fulfillmentType: editForm.fulfillmentType,
        inventoryPolicy: editForm.inventoryPolicy,
        isSubscription: editForm.isSubscription,
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
            optionValueId: image.optionValueId || null,
          }))
          .filter((image) => image.url),
        // Reconcile the variant set against the edited option structure.
        options: optionsPayload,
        variantOverridesByKey,
        stockPerVariant: Number(normalizePriceValue(form.stockPerVariant) || 0),
        // Subscription plan is product-level in the UI; applied to every variant.
        subscriptionPlan: editForm.isSubscription ? planPayload : null,
        // Physical attributes
        taxExempt: editForm.taxExempt,
        weightGram: editForm.weightGram ? Number(editForm.weightGram) || null : null,
        lengthMm: editForm.lengthMm ? Number(editForm.lengthMm) || null : null,
        widthMm: editForm.widthMm ? Number(editForm.widthMm) || null : null,
        heightMm: editForm.heightMm ? Number(editForm.heightMm) || null : null,
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

  // ── Relations helpers ────────────────────────────────────────────────────────

  async function loadRelations(productId: string) {
    const response = await fetch(`/api/admin/products/${productId}/relations`);
    const result = await response.json();
    if (result.ok) {
      setEditRelations(result.data.relations as ProductRelationEntry[]);
      setRelationsLoaded(true);
    }
  }

  async function saveRelationsForKind(kind: string) {
    if (!editingProductId) return;
    setRelationsSaving(kind);
    const relatedIds = editRelations
      .filter((r) => r.kind === kind)
      .sort((a, b) => a.position - b.position)
      .map((r) => r.relatedProduct.id);
    try {
      const response = await fetch(`/api/admin/products/${editingProductId}/relations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, relatedIds }),
      });
      const result = await response.json();
      if (!result.ok) {
        alert(result.error?.message ?? "روابط ذخیره نشد.");
        return;
      }
      setEditRelations(result.data.relations as ProductRelationEntry[]);
    } finally {
      setRelationsSaving("");
    }
  }

  function addRelationEntry(
    kind: string,
    product: { id: string; titleFa: string; slug: string; status: string },
  ) {
    setEditRelations((current) => {
      if (current.some((r) => r.relatedProduct.id === product.id && r.kind === kind)) {
        return current;
      }
      const position = current.filter((r) => r.kind === kind).length;
      return [
        ...current,
        {
          id: `new-${Date.now()}`,
          kind,
          position,
          relatedProduct: {
            id: product.id,
            slug: product.slug,
            titleFa: product.titleFa,
            status: product.status,
            imageUrl: null,
          },
        },
      ];
    });
    setRelationPickerQuery("");
    setRelationPickerResults([]);
  }

  function removeRelationEntry(kind: string, relatedProductId: string) {
    setEditRelations((current) =>
      current
        .filter((r) => !(r.kind === kind && r.relatedProduct.id === relatedProductId))
        .map((r, i) => (r.kind === kind ? { ...r, position: i } : r)),
    );
  }

  async function searchRelationProducts(query: string) {
    setRelationPickerQuery(query);
    if (!query.trim()) {
      setRelationPickerResults([]);
      return;
    }
    // Search from local products list first (already loaded).
    const q = query.trim().toLowerCase();
    const results = products
      .filter(
        (p) =>
          p.id !== editingProductId &&
          (p.titleFa.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)),
      )
      .slice(0, 8)
      .map((p) => ({ id: p.id, titleFa: p.titleFa, slug: p.slug, status: p.status }));
    setRelationPickerResults(results);
  }

  function renderRelationsPanel() {
    const kinds = [
      { value: "RELATED", label: "مرتبط" },
      { value: "UPSELL", label: "آپ‌سل (گران‌تر)" },
      { value: "CROSS_SELL", label: "کراس‌سل (مکمل)" },
    ];

    return (
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black">محصولات مرتبط</h3>
            <p className="mt-1 text-xs text-zinc-500">
              روابط محصول را تنظیم و هر بخش را جداگانه ذخیره کنید.
            </p>
          </div>
          {!relationsLoaded ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => loadRelations(editingProductId)}
            >
              بارگذاری روابط
            </Button>
          ) : null}
        </div>

        {relationsLoaded ? (
          <div className="grid gap-4">
            {kinds.map((kind) => {
              const kindEntries = editRelations.filter((r) => r.kind === kind.value);
              return (
                <div key={kind.value} className="border border-zinc-200 bg-zinc-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-black">{kind.label}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={relationsSaving === kind.value}
                      onClick={() => saveRelationsForKind(kind.value)}
                    >
                      {relationsSaving === kind.value ? "ذخیره..." : "ذخیره"}
                    </Button>
                  </div>
                  <div className="mb-2 grid gap-1">
                    {kindEntries.length === 0 ? (
                      <p className="text-xs text-zinc-400">هنوز محصولی اضافه نشده.</p>
                    ) : (
                      kindEntries.map((entry) => (
                        <div
                          key={entry.relatedProduct.id}
                          className="flex items-center justify-between gap-2 border border-zinc-200 bg-white px-2 py-1.5"
                        >
                          <span className="text-sm font-bold">{entry.relatedProduct.titleFa}</span>
                          <button
                            type="button"
                            className="text-xs text-zinc-400 hover:text-destructive"
                            onClick={() => removeRelationEntry(kind.value, entry.relatedProduct.id)}
                            aria-label="حذف"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Product picker for this kind */}
                  <div className="relative">
                    <input
                      value={relationPickerKind === kind.value ? relationPickerQuery : ""}
                      onChange={(e) => {
                        setRelationPickerKind(kind.value);
                        searchRelationProducts(e.target.value);
                      }}
                      onFocus={() => setRelationPickerKind(kind.value)}
                      placeholder="جستجوی محصول برای افزودن..."
                      className="h-8 w-full min-w-0 border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-zinc-950"
                      dir="rtl"
                    />
                    {relationPickerKind === kind.value && relationPickerResults.length > 0 ? (
                      <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto border border-zinc-200 bg-white shadow-xl">
                        {relationPickerResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addRelationEntry(kind.value, p)}
                            className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-zinc-50"
                          >
                            <span className="font-bold">{p.titleFa}</span>
                            <span className="text-xs text-zinc-400" dir="ltr">
                              {p.slug}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  // Shared generic option builder — add/remove options + values. Used by both
  // the create and edit panels so the variant set is editable everywhere.
  function renderOptionBuilder() {
    return (
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black">ویژگی‌ها و تنوع‌ها</h3>
            <p className="mt-1 text-xs text-zinc-500">
              هر ویژگی یک بُعد است (مثلاً منطقه، مدت، رنگ). بدون ویژگی، یک تنوع پیش‌فرض ساخته می‌شود.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addOption}>
            <Plus className="size-3.5" />
            ویژگی جدید
          </Button>
        </div>
        <div className="grid gap-4">
          {options.map((option) => (
            <div key={option.id} className="grid gap-3 border border-zinc-200 bg-zinc-50 p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
                <Input
                  label="نام ویژگی"
                  value={option.nameFa}
                  onChange={(value) => updateOption(option.id, { nameFa: value })}
                />
                <Input
                  label="اسلاگ ویژگی"
                  value={option.slug}
                  onChange={(value) => updateOption(option.id, { slug: value })}
                  dir="ltr"
                />
                <SimpleSelect
                  label="نوع نمایش"
                  value={option.inputKind}
                  options={INPUT_KIND_OPTIONS}
                  onChange={(value) =>
                    updateOption(option.id, { inputKind: value as OptionInputKind })
                  }
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    size="icon-lg"
                    variant="outline"
                    onClick={() => removeOption(option.id)}
                    aria-label="حذف ویژگی"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-500">مقادیر</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addOptionValue(option.id)}
                  >
                    <Plus className="size-3.5" />
                    مقدار
                  </Button>
                </div>
                {option.values.map((value) => (
                  <div
                    key={value.id}
                    className={`grid gap-2 border border-zinc-200 bg-white p-2 ${
                      option.inputKind === "SWATCH"
                        ? "md:grid-cols-[1fr_1fr_150px_1fr_auto]"
                        : "md:grid-cols-[1fr_1fr_1fr_auto]"
                    }`}
                  >
                    <Input
                      label="مقدار"
                      value={value.valueFa}
                      onChange={(next) => updateOptionValue(option.id, value.id, { valueFa: next })}
                    />
                    <Input
                      label="اسلاگ"
                      value={value.slug}
                      onChange={(next) => updateOptionValue(option.id, value.id, { slug: next })}
                      dir="ltr"
                    />
                    {option.inputKind === "SWATCH" ? (
                      <label className="block min-w-0">
                        <span className="mb-2 block text-sm font-bold">کد رنگ</span>
                        <div className="flex h-11 min-w-0 items-center gap-2 border border-zinc-300 bg-white px-2">
                          <input
                            type="color"
                            value={value.hex || "#000000"}
                            onChange={(event) =>
                              updateOptionValue(option.id, value.id, {
                                hex: event.target.value,
                              })
                            }
                            className="size-8 cursor-pointer border-0 bg-transparent p-0"
                            aria-label="انتخاب رنگ"
                          />
                          <input
                            value={value.hex}
                            onChange={(event) =>
                              updateOptionValue(option.id, value.id, {
                                hex: event.target.value,
                              })
                            }
                            className="min-w-0 flex-1 bg-transparent text-left text-sm outline-none"
                            dir="ltr"
                          />
                        </div>
                      </label>
                    ) : null}
                    <Input
                      label="تصویر سواچ (URL)"
                      value={value.swatchImageUrl}
                      onChange={(next) =>
                        updateOptionValue(option.id, value.id, { swatchImageUrl: next })
                      }
                      dir="ltr"
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="icon-lg"
                        variant="outline"
                        onClick={() => removeOptionValue(option.id, value.id)}
                        disabled={option.values.length === 1}
                        aria-label="حذف مقدار"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {options.length === 0 ? (
            <p className="border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-500">
              هنوز ویژگی‌ای اضافه نشده — محصول با یک تنوع پیش‌فرض ساخته می‌شود.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  // Shared live variant matrix (cartesian preview) with per-variant price/stock
  // overrides. `inventoryPolicy`/`fulfillmentType` come from the active form so
  // edit and create both drive off the builder-derived matrix keyed by optionsKey.
  // In edit mode `showDefault` renders a default selector + current-stock summary.
  function renderVariantMatrix(
    inventoryPolicy: string,
    fulfillmentType: string,
    baseCurrency: string,
    options?: { showDefault?: boolean },
  ) {
    const tracked = inventoryPolicy === "TRACKED";
    const showDefault = options?.showDefault ?? false;
    const currency = (baseCurrency as "IRT" | "USD" | "EUR") ?? "IRT";
    const rateToman = rateForCurrency(baseCurrency);
    // Persisted variants keyed by optionsKey for current-stock display in edit.
    const persistedByKey = new Map(editVariants.map((variant) => [variant.optionsKey, variant]));

    return (
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black">پیش‌نمایش تنوع‌ها</h3>
          <span className="text-xs font-bold text-zinc-500">{variantPreview.length} تنوع</span>
        </div>
        <div className="grid gap-3">
          {variantPreview.map((variant) => {
            const override = overrides[variant.optionsKey] ?? emptyOverride();
            const persisted = persistedByKey.get(variant.optionsKey);

            return (
              <div
                key={variant.optionsKey || "default"}
                className="grid gap-3 border border-zinc-200 bg-zinc-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-black">{variant.titleFa}</span>
                  <div className="flex items-center gap-3">
                    {showDefault ? (
                      <label className="flex items-center gap-2 text-xs font-bold">
                        <input
                          type="radio"
                          name="default-product-variant"
                          checked={editDefaultKey === variant.optionsKey}
                          onChange={() => setEditDefaultKey(variant.optionsKey)}
                        />
                        پیش‌فرض
                      </label>
                    ) : null}
                    <span className="font-mono text-[10px] text-zinc-400" dir="ltr">
                      {variant.optionsKey || "default"}
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <PriceInput
                    label="قیمت عمومی"
                    value={override.publicPriceAmount}
                    currency={currency}
                    rateToman={rateToman}
                    onChange={(value) =>
                      updateOverride(variant.optionsKey, { publicPriceAmount: value })
                    }
                  />
                  <PriceInput
                    label="قیمت کاربران (اختیاری)"
                    value={override.registeredPriceAmount}
                    currency={currency}
                    rateToman={rateToman}
                    onChange={(value) =>
                      updateOverride(variant.optionsKey, { registeredPriceAmount: value })
                    }
                  />
                  <PriceInput
                    label="قیمت پریمیوم (اختیاری)"
                    value={override.premiumPriceAmount}
                    currency={currency}
                    rateToman={rateToman}
                    onChange={(value) =>
                      updateOverride(variant.optionsKey, { premiumPriceAmount: value })
                    }
                  />
                  <PriceInput
                    label="قیمت قبل (اختیاری)"
                    value={override.compareAtAmount}
                    currency={currency}
                    rateToman={rateToman}
                    onChange={(value) =>
                      updateOverride(variant.optionsKey, { compareAtAmount: value })
                    }
                  />
                  <MoneyField
                    id={`sale-price-${variant.optionsKey || "default"}`}
                    label="قیمت حراج (اختیاری)"
                    value={override.salePriceAmount}
                    currency={currency as "IRT" | "USD" | "EUR"}
                    rateToman={rateToman}
                    onChange={(value) =>
                      updateOverride(variant.optionsKey, { salePriceAmount: value })
                    }
                  />
                  <DateField
                    id={`sale-starts-${variant.optionsKey || "default"}`}
                    label="شروع حراج"
                    value={override.saleStartsAt}
                    onChange={(value) =>
                      updateOverride(variant.optionsKey, { saleStartsAt: value })
                    }
                  />
                  <DateField
                    id={`sale-ends-${variant.optionsKey || "default"}`}
                    label="پایان حراج"
                    value={override.saleEndsAt}
                    onChange={(value) => updateOverride(variant.optionsKey, { saleEndsAt: value })}
                  />
                  {tracked ? (
                    <Input
                      label="افزودن موجودی (اختیاری)"
                      value={override.stockToAdd}
                      onChange={(value) =>
                        updateOverride(variant.optionsKey, { stockToAdd: value })
                      }
                      dir="ltr"
                    />
                  ) : null}
                </div>
                {tracked && fulfillmentType === "DIGITAL" ? (
                  <Textarea
                    label="کدها، هر خط یک کد (در صورت ورود، جایگزین تعداد می‌شود)"
                    value={override.stockCodes}
                    onChange={(value) => updateOverride(variant.optionsKey, { stockCodes: value })}
                    dir="ltr"
                  />
                ) : null}
                {showDefault && persisted ? (
                  <p className="text-xs font-bold text-zinc-500">
                    {inventoryPolicy === "INFINITE"
                      ? "موجودی نامحدود"
                      : `${availableStock(persisted)} واحد موجود از ${persisted.inventoryUnits.length} واحد`}
                  </p>
                ) : null}
                {showDefault && !persisted ? (
                  <p className="text-xs font-bold text-emerald-600">
                    تنوع جدید — پس از ذخیره ساخته می‌شود.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
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
            <FulfillmentSelect
              label="نوع تحویل"
              value={form.fulfillmentType}
              onChange={(value) => setField("fulfillmentType", value)}
            />
            <SimpleSelect
              label="سیاست موجودی"
              value={form.inventoryPolicy}
              options={INVENTORY_POLICY_OPTIONS}
              onChange={(value) => setField("inventoryPolicy", value)}
            />
            <div className="block min-w-0">
              <CurrencySelect
                label="ارز قیمت‌گذاری"
                value={form.baseCurrency}
                onChange={(value) => setField("baseCurrency", value)}
              />
              <CurrencyHint
                baseCurrency={form.baseCurrency}
                rateToman={rateForCurrency(form.baseCurrency)}
              />
            </div>
            <label className="flex items-end gap-2 pb-3 text-sm font-bold">
              <input
                type="checkbox"
                className="size-4"
                checked={form.isSubscription}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isSubscription: event.target.checked }))
                }
              />
              محصول اشتراکی (دوره‌ای)
            </label>
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
              currency={form.baseCurrency as "IRT" | "USD" | "EUR"}
              rateToman={rateForCurrency(form.baseCurrency)}
              onChange={(value) => setField("publicPriceAmount", value)}
            />
            <PriceInput
              label="قیمت کاربران"
              value={form.registeredPriceAmount}
              currency={form.baseCurrency as "IRT" | "USD" | "EUR"}
              rateToman={rateForCurrency(form.baseCurrency)}
              onChange={(value) => setField("registeredPriceAmount", value)}
            />
            <PriceInput
              label="قیمت پریمیوم"
              value={form.premiumPriceAmount}
              currency={form.baseCurrency as "IRT" | "USD" | "EUR"}
              rateToman={rateForCurrency(form.baseCurrency)}
              onChange={(value) => setField("premiumPriceAmount", value)}
            />
            <PriceInput
              label="قیمت قبل"
              value={form.compareAtAmount}
              currency={form.baseCurrency as "IRT" | "USD" | "EUR"}
              rateToman={rateForCurrency(form.baseCurrency)}
              onChange={(value) => setField("compareAtAmount", value)}
            />
            {form.inventoryPolicy === "TRACKED" ? (
              <Input
                label="موجودی هر تنوع (تعداد)"
                value={form.stockPerVariant}
                onChange={(value) => setField("stockPerVariant", value)}
                dir="ltr"
              />
            ) : null}
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

            {form.isSubscription ? (
              <div className="lg:col-span-2">
                <SubscriptionPanel value={subscriptionPlan} onChange={setSubscriptionPlan} />
              </div>
            ) : null}

            {/* SEO overrides — optional; fall back to title/summary/image when empty. */}
            <div className="lg:col-span-2">
              <fieldset className="border border-border bg-muted/30 p-4">
                <legend className="px-2 text-sm font-black">سئو</legend>
                <div className="mt-2 grid gap-4 md:grid-cols-2">
                  <Input
                    label="عنوان سئو (title)"
                    value={form.seoTitle}
                    onChange={(value) => setField("seoTitle", value)}
                  />
                  <Input
                    label="تصویر OG (URL)"
                    value={form.ogImageUrl}
                    onChange={(value) => setField("ogImageUrl", value)}
                    dir="ltr"
                  />
                  <div className="md:col-span-2">
                    <Textarea
                      label="توضیحات سئو (meta description)"
                      value={form.seoDescription}
                      onChange={(value) => setField("seoDescription", value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold md:col-span-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={form.noindex}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, noindex: event.target.checked }))
                      }
                    />
                    عدم نمایه‌سازی در موتورهای جستجو (noindex)
                  </label>
                </div>
              </fieldset>
            </div>

            {renderOptionBuilder()}

            {renderVariantMatrix(form.inventoryPolicy, form.fulfillmentType, form.baseCurrency)}

            <ImageRowsEditor
              title="تصاویر محصول"
              rows={imageRows}
              assignmentOptions={createAssignmentOptions}
              assignmentValueOf={(image) =>
                image.variantKey
                  ? `variant:${image.variantKey}`
                  : image.optionValueKey
                    ? `value:${image.optionValueKey}`
                    : ""
              }
              onAssign={(id, raw) => {
                const [kind, ref] = raw ? raw.split(/:(.*)/) : ["", ""];
                updateImageRow(
                  id,
                  {
                    variantKey: kind === "variant" ? ref : "",
                    optionValueKey: kind === "value" ? ref : "",
                  },
                  "create",
                );
              }}
              uploading={uploading}
              onUpload={(files) => uploadImages(files, "create")}
              onAdd={() => addImageRow(undefined, "create")}
              onUpdate={(id, patch) => updateImageRow(id, patch, "create")}
              onMove={(id, direction) => moveImageRow(id, direction, "create")}
              onRemove={(id) => removeImageRow(id, "create")}
              onOpenPreview={setPreviewImage}
            />
          </div>

          {form.inventoryPolicy === "INFINITE" ? (
            <div className="mt-4 border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm">
              <p className="mb-1 font-black">موجودی نامحدود</p>
              <p className="text-xs text-zinc-500">
                برای این محصول واحد موجودی ساخته نمی‌شود و همیشه قابل خرید است.
              </p>
            </div>
          ) : null}

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
            <FulfillmentSelect
              label="نوع تحویل"
              value={editForm.fulfillmentType}
              onChange={(value) => setEditField("fulfillmentType", value)}
            />
            <SimpleSelect
              label="سیاست موجودی"
              value={editForm.inventoryPolicy}
              options={INVENTORY_POLICY_OPTIONS}
              onChange={(value) => setEditField("inventoryPolicy", value)}
            />
            <div className="block min-w-0">
              <CurrencySelect
                label="ارز قیمت‌گذاری"
                value={editForm.baseCurrency}
                onChange={(value) => setEditField("baseCurrency", value)}
              />
              <CurrencyHint
                baseCurrency={editForm.baseCurrency}
                rateToman={rateForCurrency(editForm.baseCurrency)}
              />
            </div>
            <label className="flex items-end gap-2 pb-3 text-sm font-bold">
              <input
                type="checkbox"
                className="size-4"
                checked={editForm.isSubscription}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, isSubscription: event.target.checked }))
                }
              />
              محصول اشتراکی (دوره‌ای)
            </label>
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

            {editForm.isSubscription ? (
              <div className="lg:col-span-2">
                <SubscriptionPanel
                  value={editSubscriptionPlan}
                  onChange={setEditSubscriptionPlan}
                />
              </div>
            ) : null}

            {/* Physical attributes + tax */}
            <div className="lg:col-span-2">
              <fieldset className="border border-border bg-muted/30 p-4">
                <legend className="px-2 text-sm font-black">ابعاد فیزیکی و مالیات</legend>
                <div className="mt-2 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <NumberField
                    id="edit-weight-gram"
                    label="وزن (گرم)"
                    value={editForm.weightGram}
                    onChange={(value) => setEditForm((c) => ({ ...c, weightGram: value }))}
                    placeholder="مثلاً ۵۰۰"
                    min={0}
                  />
                  <NumberField
                    id="edit-length-mm"
                    label="طول (میلی‌متر)"
                    value={editForm.lengthMm}
                    onChange={(value) => setEditForm((c) => ({ ...c, lengthMm: value }))}
                    placeholder="مثلاً ۳۰۰"
                    min={0}
                  />
                  <NumberField
                    id="edit-width-mm"
                    label="عرض (میلی‌متر)"
                    value={editForm.widthMm}
                    onChange={(value) => setEditForm((c) => ({ ...c, widthMm: value }))}
                    placeholder="مثلاً ۲۰۰"
                    min={0}
                  />
                  <NumberField
                    id="edit-height-mm"
                    label="ارتفاع (میلی‌متر)"
                    value={editForm.heightMm}
                    onChange={(value) => setEditForm((c) => ({ ...c, heightMm: value }))}
                    placeholder="مثلاً ۱۰۰"
                    min={0}
                  />
                  <div className="md:col-span-2 lg:col-span-4">
                    <SwitchRow
                      id="edit-tax-exempt"
                      label="معاف از مالیات"
                      checked={editForm.taxExempt}
                      onChange={(checked) => setEditForm((c) => ({ ...c, taxExempt: checked }))}
                      hint="این محصول از محاسبه مالیات بر ارزش افزوده (VAT) مستثنی است."
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            {/* SEO overrides — optional; fall back to title/summary/image when empty. */}
            <div className="lg:col-span-2">
              <fieldset className="border border-border bg-muted/30 p-4">
                <legend className="px-2 text-sm font-black">سئو</legend>
                <div className="mt-2 grid gap-4 md:grid-cols-2">
                  <Input
                    label="عنوان سئو (title)"
                    value={editForm.seoTitle}
                    onChange={(value) => setEditField("seoTitle", value)}
                  />
                  <Input
                    label="تصویر OG (URL)"
                    value={editForm.ogImageUrl}
                    onChange={(value) => setEditField("ogImageUrl", value)}
                    dir="ltr"
                  />
                  <div className="md:col-span-2">
                    <Textarea
                      label="توضیحات سئو (meta description)"
                      value={editForm.seoDescription}
                      onChange={(value) => setEditField("seoDescription", value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold md:col-span-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={editForm.noindex}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, noindex: event.target.checked }))
                      }
                    />
                    عدم نمایه‌سازی در موتورهای جستجو (noindex)
                  </label>
                </div>
              </fieldset>
            </div>

            <ImageRowsEditor
              title="تصاویر محصول"
              rows={editImageRows}
              assignmentOptions={editAssignmentOptions}
              assignmentValueOf={(image) =>
                image.variantId
                  ? `variant:${image.variantId}`
                  : image.optionValueId
                    ? `value:${image.optionValueId}`
                    : ""
              }
              onAssign={(id, raw) => {
                const [kind, ref] = raw ? raw.split(/:(.*)/) : ["", ""];
                updateImageRow(
                  id,
                  {
                    variantId: kind === "variant" ? ref : "",
                    optionValueId: kind === "value" ? ref : "",
                  },
                  "edit",
                );
              }}
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

            {renderOptionBuilder()}

            {renderVariantMatrix(
              editForm.inventoryPolicy,
              editForm.fulfillmentType,
              editForm.baseCurrency,
              { showDefault: true },
            )}

            {renderRelationsPanel()}
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
                    {product.isSubscription ? (
                      <span className="bg-indigo-100 px-2 py-1 text-xs font-black text-indigo-800">
                        اشتراکی
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 break-all text-xs text-zinc-500" dir="ltr">
                    /products/{product.slug}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    {product.variants.length} تنوع،{" "}
                    {product.inventoryPolicy === "INFINITE"
                      ? "موجودی نامحدود"
                      : `${product.variants.reduce((sum, variant) => sum + availableStock(variant), 0)} واحد موجود`}
                    ، {product.images.length} تصویر
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

function SubscriptionPanel({
  value,
  onChange,
}: {
  value: SubscriptionPlanState;
  onChange: Dispatch<SetStateAction<SubscriptionPlanState>>;
}) {
  function set(patch: Partial<SubscriptionPlanState>) {
    onChange((current) => ({ ...current, ...patch }));
  }

  return (
    <fieldset className="border border-indigo-200 bg-indigo-50/40 p-4">
      <legend className="px-2 text-sm font-black">تنظیمات اشتراک</legend>
      <p className="mb-3 px-2 text-xs text-zinc-500">
        این تنظیمات روی همهٔ تنوع‌های محصول اعمال می‌شود.
      </p>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <SimpleSelect
          label="واحد دوره"
          value={value.intervalUnit}
          options={INTERVAL_UNIT_OPTIONS}
          onChange={(next) => set({ intervalUnit: next })}
        />
        <Input
          label="هر چند واحد"
          value={value.intervalCount}
          onChange={(next) => set({ intervalCount: next })}
          dir="ltr"
        />
        <Input
          label="روزهای آزمایشی"
          value={value.trialDays}
          onChange={(next) => set({ trialDays: next })}
          dir="ltr"
        />
        <Input
          label="تعداد دوره‌ها (خالی=نامحدود)"
          value={value.termCount}
          onChange={(next) => set({ termCount: next })}
          dir="ltr"
        />
        <Input
          label="مهلت پرداخت (روز)"
          value={value.gracePeriodDays}
          onChange={(next) => set({ gracePeriodDays: next })}
          dir="ltr"
        />
        <label className="flex items-end gap-2 pb-3 text-sm font-bold">
          <input
            type="checkbox"
            className="size-4"
            checked={value.autoRenewDefault}
            onChange={(event) => set({ autoRenewDefault: event.target.checked })}
          />
          تمدید خودکار
        </label>
      </div>
    </fieldset>
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
                {image.optionValueId ? (
                  <span className="bg-zinc-100 px-1.5 py-0.5 text-[10px] font-black text-zinc-600">
                    مقدار
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
  assignmentOptions,
  assignmentValueOf,
  onAssign,
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
  assignmentOptions: AssignmentOption[];
  assignmentValueOf: (image: ImageRow) => string;
  onAssign: (id: string, rawValue: string) => void;
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
              className="grid min-w-0 gap-3 border border-zinc-200 bg-zinc-50 p-3 lg:grid-cols-[92px_minmax(0,1.2fr)_minmax(0,0.9fr)_210px_190px_120px_auto_auto]"
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
              <ImageAssignmentSelect
                label="اتصال تصویر"
                value={assignmentValueOf(image)}
                options={assignmentOptions}
                onChange={(value) => onAssign(image.id, value)}
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
                    name="primary-product-image"
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
  return <SimpleSelect label={label} value={value} options={STATUS_OPTIONS} onChange={onChange} />;
}

function FulfillmentSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SimpleSelect label={label} value={value} options={FULFILLMENT_OPTIONS} onChange={onChange} />
  );
}

function CurrencySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SimpleSelect label={label} value={value} options={CURRENCY_OPTIONS} onChange={onChange} />
  );
}

// Muted note under the currency selector: clarifies that USD/EUR prices are
// converted to Toman at the live rate before being shown to customers.
function CurrencyHint({ baseCurrency, rateToman }: { baseCurrency: string; rateToman?: number }) {
  if (baseCurrency !== "USD" && baseCurrency !== "EUR") {
    return null;
  }

  const currencyLabel = baseCurrency === "USD" ? "دلار" : "یورو";
  const rateNote = rateToman ? ` (هر واحد ≈ ${formatToman(rateToman)})` : "";

  return (
    <p className="mt-2 text-xs font-bold text-zinc-500">
      {`قیمت‌ها به ${currencyLabel} وارد می‌شوند و با نرخ روز${rateNote} به تومان تبدیل و به مشتری نمایش داده می‌شوند.`}
    </p>
  );
}

function SimpleSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
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
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ImageAssignmentSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: AssignmentOption[];
  onChange: (value: string) => void;
}) {
  const variantOptions = options.filter((option) => option.group === "تنوع کامل");
  const valueOptions = options.filter((option) => option.group === "مقدار");

  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
      >
        <option value="">همه تنوع‌ها</option>
        {variantOptions.length > 0 ? (
          <optgroup label="تنوع کامل">
            {variantOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ) : null}
        {valueOptions.length > 0 ? (
          <optgroup label="بر اساس یک مقدار">
            {valueOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ) : null}
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

const CURRENCY_ADORNMENT: Record<"IRT" | "USD" | "EUR", string> = {
  IRT: "تومان",
  USD: "$",
  EUR: "€",
};

function PriceInput({
  label,
  value,
  onChange,
  currency = "IRT",
  rateToman,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency?: "IRT" | "USD" | "EUR";
  // Toman value of one unit of `currency`. Irrelevant for IRT.
  rateToman?: number;
}) {
  const numericValue = Number(normalizePriceValue(value));
  const showConversion = currency !== "IRT" && rateToman && numericValue > 0;

  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <div className="flex h-11 items-center border border-zinc-300 bg-white focus-within:border-zinc-950">
        <span className="grid h-full place-items-center border-l border-zinc-200 px-3 text-xs font-black text-zinc-500">
          {CURRENCY_ADORNMENT[currency]}
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
      {showConversion ? (
        <span className="mt-1 block text-xs font-bold text-zinc-500" dir="rtl">
          ≈ {formatToman(numericValue * rateToman)}
        </span>
      ) : null}
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
