"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ImageIcon,
  LayoutGrid,
  Loader2,
  PackagePlus,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type HomeBlockRow = {
  id: string;
  titleFa: string;
  subtitleFa: string | null;
  type:
    | "SHOWCASE"
    | "SHOWCASE_RANDOM"
    | "SHOWCASE_HERO"
    | "SHOWCASE_HERO_NO_PRODUCT_INFO"
    | "LEFT_TO_RIGHT_GALLERY"
    | "FULLSCREEN_HORIZONTAL_GALLERY";
  source: "MANUAL" | "DYNAMIC";
  isActive: boolean;
  sortOrder: number;
  sortKey: string;
  maxItems: number;
  category: { id: string; slug: string; titleFa: string } | null;
  tag: { id: string; slug: string; titleFa: string } | null;
  items: Array<{
    id: string;
    product: {
      id: string;
      slug: string;
      titleFa: string;
      status: string;
    };
  }>;
};

type ProductOption = {
  id: string;
  slug: string;
  titleFa: string;
  status: string;
  imageUrl: string | null;
  categoryTitleFa: string | null;
};

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

function blockTypeLabel(type: HomeBlockRow["type"]) {
  if (type === "SHOWCASE") {
    return "نمایش بزرگ";
  }

  if (type === "SHOWCASE_RANDOM") {
    return "نمایش بزرگ تصادفی";
  }

  if (type === "SHOWCASE_HERO") {
    return "هیروی نمایشی";
  }

  if (type === "SHOWCASE_HERO_NO_PRODUCT_INFO") {
    return "هیروی تصویری";
  }

  if (type === "FULLSCREEN_HORIZONTAL_GALLERY") {
    return "گالری تمام‌صفحه";
  }

  return "گالری افقی";
}

function createEmptyForm() {
  return {
    titleFa: "",
    subtitleFa: "",
    type: "LEFT_TO_RIGHT_GALLERY",
    source: "MANUAL",
    categoryId: "",
    tagId: "",
    sortKey: "newest",
    sortOrder: "0",
    maxItems: "12",
  };
}

export function HomeBlockManagement({
  initialBlocks,
  initialProducts,
  initialCategories,
  initialTags,
}: {
  initialBlocks: HomeBlockRow[];
  initialProducts: ProductOption[];
  initialCategories: CategoryOption[];
  initialTags: TagOption[];
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [saving, setSaving] = useState(false);
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [form, setForm] = useState(createEmptyForm);

  const productsById = useMemo(
    () => new Map(initialProducts.map((product) => [product.id, product])),
    [initialProducts]
  );

  const selectedProducts = useMemo(
    () =>
      selectedProductIds
        .map((id) => productsById.get(id))
        .filter((product): product is ProductOption => Boolean(product)),
    [productsById, selectedProductIds]
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    if (!query) {
      return initialProducts.slice(0, 60);
    }

    return initialProducts
      .filter((product) =>
        [product.titleFa, product.slug, product.status, product.categoryTitleFa ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 80);
  }, [initialProducts, productSearch]);

  function setField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleSelectedProduct(productId: string) {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  }

  function removeSelectedProduct(productId: string) {
    setSelectedProductIds((current) => current.filter((id) => id !== productId));
  }

  function resetForm() {
    setForm(createEmptyForm());
    setSelectedProductIds([]);
    setEditingBlockId(null);
    setProductSearch("");
  }

  function startEditing(block: HomeBlockRow) {
    setEditingBlockId(block.id);
    setForm({
      titleFa: block.titleFa,
      subtitleFa: block.subtitleFa ?? "",
      type: block.type,
      source: block.source,
      categoryId: block.category?.id ?? "",
      tagId: block.tag?.id ?? "",
      sortKey: block.sortKey,
      sortOrder: String(block.sortOrder),
      maxItems: String(block.maxItems),
    });
    setSelectedProductIds(block.source === "MANUAL" ? block.items.map((item) => item.product.id) : []);
    setPickerOpen(false);
    document.getElementById("home-block-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function refreshBlocks() {
    const response = await fetch("/api/admin/home-blocks");
    const result = await response.json();

    if (result.ok) {
      setBlocks(result.data.blocks);
    }
  }

  async function saveBlock() {
    setSaving(true);

    try {
      const response = await fetch(
        editingBlockId ? `/api/admin/home-blocks/${editingBlockId}` : "/api/admin/home-blocks",
        {
          method: editingBlockId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            sortOrder: Number(form.sortOrder || 0),
            maxItems: Number(form.maxItems || 12),
            categoryId: form.source === "DYNAMIC" ? form.categoryId || null : null,
            tagId: form.source === "DYNAMIC" ? form.tagId || null : null,
            productIds: form.source === "MANUAL" ? selectedProductIds : [],
          }),
        }
      );
      const result = await response.json();

      if (!result.ok) {
        alert(result.error?.message ?? "بلاک ذخیره نشد.");
        return;
      }

      resetForm();
      await refreshBlocks();
    } catch {
      alert("بلاک ذخیره نشد.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBlock(block: HomeBlockRow) {
    setBusyBlockId(block.id);

    try {
      const response = await fetch(`/api/admin/home-blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !block.isActive }),
      });
      const result = await response.json();

      if (!result.ok) {
        alert(result.error?.message ?? "وضعیت بلاک ذخیره نشد.");
        return;
      }

      setBlocks((current) =>
        current.map((item) => (item.id === block.id ? result.data.block : item))
      );
    } catch {
      alert("وضعیت بلاک ذخیره نشد.");
    } finally {
      setBusyBlockId(null);
    }
  }

  async function deleteBlock(block: HomeBlockRow) {
    if (!confirm(`بلاک «${block.titleFa}» حذف شود؟`)) {
      return;
    }

    setBusyBlockId(block.id);

    try {
      const response = await fetch(`/api/admin/home-blocks/${block.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!result.ok) {
        alert(result.error?.message ?? "بلاک حذف نشد.");
        return;
      }

      setBlocks((current) => current.filter((item) => item.id !== block.id));

      if (editingBlockId === block.id) {
        resetForm();
      }
    } catch {
      alert("بلاک حذف نشد.");
    } finally {
      setBusyBlockId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <section id="home-block-form" className="border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black">
            {editingBlockId ? "ویرایش بلاک صفحه خانه" : "بلاک جدید صفحه خانه"}
          </h2>
          {editingBlockId ? (
            <Button type="button" size="sm" variant="outline" onClick={resetForm}>
              <X className="size-3.5" />
              لغو ویرایش
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Input label="عنوان" value={form.titleFa} onChange={(value) => setField("titleFa", value)} />
          <Input label="زیرعنوان" value={form.subtitleFa} onChange={(value) => setField("subtitleFa", value)} />
          <Select label="نوع نمایش" value={form.type} onChange={(value) => setField("type", value)}>
            <option value="LEFT_TO_RIGHT_GALLERY">گالری افقی</option>
            <option value="SHOWCASE">نمایش بزرگ</option>
            <option value="SHOWCASE_RANDOM">نمایش بزرگ تصادفی</option>
            <option value="SHOWCASE_HERO">هیروی نمایشی</option>
            <option value="SHOWCASE_HERO_NO_PRODUCT_INFO">هیروی تصویری بدون اطلاعات محصول</option>
            <option value="FULLSCREEN_HORIZONTAL_GALLERY">گالری تمام‌صفحه افقی</option>
          </Select>
          <Select label="منبع محصولات" value={form.source} onChange={(value) => setField("source", value)}>
            <option value="MANUAL">دستی</option>
            <option value="DYNAMIC">داینامیک</option>
          </Select>

          {form.source === "MANUAL" ? (
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="block text-sm font-bold">محصولات دستی</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                  <PackagePlus className="size-3.5" />
                  انتخاب محصول
                </Button>
              </div>
              {selectedProducts.length === 0 ? (
                <div className="border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
                  محصولی انتخاب نشده است.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedProducts.map((product) => (
                    <span
                      key={product.id}
                      className="inline-flex items-center gap-2 border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-black"
                    >
                      {product.titleFa}
                      <button
                        type="button"
                        onClick={() => removeSelectedProduct(product.id)}
                        className="text-zinc-500 transition hover:text-zinc-950"
                        aria-label="حذف محصول"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <Select label="دسته‌بندی" value={form.categoryId} onChange={(value) => setField("categoryId", value)}>
                <option value="">همه دسته‌ها</option>
                {initialCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {"— ".repeat(category.depth)}
                    {category.titleFa}
                    {category.isVisible ? "" : " (مخفی)"}
                  </option>
                ))}
              </Select>
              <Select label="تگ" value={form.tagId} onChange={(value) => setField("tagId", value)}>
                <option value="">همه تگ‌ها</option>
                {initialTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.titleFa}
                    {tag.isVisible ? "" : " (مخفی)"}
                  </option>
                ))}
              </Select>
            </>
          )}

          <Select label="مرتب‌سازی" value={form.sortKey} onChange={(value) => setField("sortKey", value)}>
            <option value="newest">جدیدترین</option>
            <option value="price_asc">ارزان‌ترین</option>
            <option value="price_desc">گران‌ترین</option>
            <option value="stock_desc">موجودی بیشتر</option>
          </Select>
          <Input label="ترتیب نمایش" value={form.sortOrder} onChange={(value) => setField("sortOrder", value)} dir="ltr" />
          <Input label="حداکثر آیتم" value={form.maxItems} onChange={(value) => setField("maxItems", value)} dir="ltr" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button className="h-11 px-6 font-black" onClick={saveBlock} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : editingBlockId ? (
              <Check className="size-4" />
            ) : (
              <LayoutGrid className="size-4" />
            )}
            {editingBlockId ? "ذخیره تغییرات" : "ساخت بلاک"}
          </Button>
        </div>
      </section>

      <section className="border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-4">
          <h2 className="text-lg font-black">بلاک‌های صفحه خانه</h2>
        </div>
        <div className="divide-y divide-zinc-100">
          {blocks.length === 0 ? (
            <div className="p-6 text-sm font-bold text-zinc-500">بلاکی ثبت نشده است.</div>
          ) : null}
          {blocks.map((block) => (
            <div key={block.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black">{block.titleFa}</h3>
                  <span className="bg-zinc-100 px-2 py-1 text-xs font-black">
                    {blockTypeLabel(block.type)}
                  </span>
                  <span className="bg-zinc-100 px-2 py-1 text-xs font-black">
                    {block.source === "MANUAL" ? "دستی" : "داینامیک"}
                  </span>
                  <span className="bg-zinc-100 px-2 py-1 text-xs font-black">
                    {block.isActive ? "فعال" : "غیرفعال"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  ترتیب {block.sortOrder.toLocaleString("fa-IR")}، حداکثر{" "}
                  {block.maxItems.toLocaleString("fa-IR")} آیتم
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {block.source === "MANUAL"
                    ? `${block.items.length.toLocaleString("fa-IR")} محصول دستی`
                    : [block.category?.titleFa, block.tag?.titleFa, block.sortKey].filter(Boolean).join(" / ")}
                </p>
                {block.source === "MANUAL" && block.items.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {block.items.map((item) => (
                      <span key={item.id} className="bg-zinc-50 px-2 py-1 text-xs font-bold text-zinc-700">
                        {item.product.titleFa}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleBlock(block)}
                  disabled={busyBlockId === block.id}
                >
                  {block.isActive ? "غیرفعال" : "فعال"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEditing(block)}
                  disabled={busyBlockId === block.id}
                >
                  <Pencil className="size-3.5" />
                  ویرایش
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteBlock(block)}
                  disabled={busyBlockId === block.id}
                >
                  <Trash2 className="size-3.5" />
                  حذف
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {pickerOpen ? (
        <ProductPickerModal
          products={filteredProducts}
          selectedIds={selectedProductIds}
          search={productSearch}
          onSearch={setProductSearch}
          onClose={() => setPickerOpen(false)}
          onToggle={toggleSelectedProduct}
        />
      ) : null}
    </div>
  );
}

function ProductPickerModal({
  products,
  selectedIds,
  search,
  onSearch,
  onClose,
  onToggle,
}: {
  products: ProductOption[];
  selectedIds: string[];
  search: string;
  onSearch: (value: string) => void;
  onClose: () => void;
  onToggle: (productId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/55 p-3 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="انتخاب محصول"
        className="grid max-h-[86dvh] w-full max-w-4xl grid-rows-[auto_auto_1fr_auto] overflow-hidden border border-zinc-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4">
          <div>
            <h3 className="text-lg font-black">انتخاب محصول برای بلاک</h3>
            <p className="mt-1 text-xs font-bold text-zinc-500">
              {selectedIds.length.toLocaleString("fa-IR")} محصول انتخاب شده
            </p>
          </div>
          <Button type="button" size="icon-lg" variant="outline" onClick={onClose} aria-label="بستن">
            <X className="size-4" />
          </Button>
        </div>

        <div className="border-b border-zinc-100 p-4">
          <label className="flex h-11 items-center gap-2 border border-zinc-300 bg-zinc-50 px-3 focus-within:border-zinc-950 focus-within:bg-white">
            <Search className="size-4 text-zinc-500" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="جستجوی نام، اسلاگ یا دسته"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>

        <div className="grid gap-2 overflow-auto p-3 sm:grid-cols-2">
          {products.length === 0 ? (
            <div className="col-span-full border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm font-bold text-zinc-500">
              محصولی پیدا نشد.
            </div>
          ) : (
            products.map((product) => {
              const selected = selectedIds.includes(product.id);

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onToggle(product.id)}
                  className="grid grid-cols-[72px_1fr_auto] gap-3 border border-zinc-200 bg-white p-2 text-right transition hover:border-zinc-950 hover:bg-zinc-50"
                >
                  <div className="aspect-square overflow-hidden bg-zinc-100">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.titleFa} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-zinc-400">
                        <ImageIcon className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 self-center">
                    <p className="truncate font-black">{product.titleFa}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500" dir="ltr">
                      /products/{product.slug}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="bg-zinc-100 px-2 py-1 text-[11px] font-black text-zinc-600">
                        {product.status}
                      </span>
                      {product.categoryTitleFa ? (
                        <span className="bg-zinc-100 px-2 py-1 text-[11px] font-black text-zinc-600">
                          {product.categoryTitleFa}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={
                      selected
                        ? "grid size-7 place-items-center self-center bg-zinc-950 text-white"
                        : "grid size-7 place-items-center self-center border border-zinc-300 text-transparent"
                    }
                  >
                    <Check className="size-4" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            انجام شد
          </Button>
        </div>
      </div>
    </div>
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
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
        dir={dir}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
      >
        {children}
      </select>
    </label>
  );
}
