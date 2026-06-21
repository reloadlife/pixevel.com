"use client";

import { Eye, EyeOff, Loader2, Plus, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type CategoryOption = {
  id: string;
  slug: string;
  titleFa: string;
  parentId: string | null;
  isVisible: boolean;
  sortOrder: number;
  depth: number;
  pathFa: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
};

type TagOption = {
  id: string;
  slug: string;
  titleFa: string;
  isVisible: boolean;
};

export function CategoryManagement({ initialCategories }: { initialCategories: CategoryOption[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    titleFa: "",
    slug: "",
    parentId: "",
    sortOrder: "0",
    seoTitle: "",
    seoDescription: "",
    ogImageUrl: "",
    noindex: false,
  });

  function updateCategoryLocal(id: string, patch: Partial<CategoryOption>) {
    setCategories((current) =>
      current.map((category) => (category.id === id ? { ...category, ...patch } : category)),
    );
  }

  async function refreshCategories() {
    const response = await fetch("/api/admin/categories");
    const result = await response.json();

    if (result.ok) {
      setCategories(result.data.categories);
    }
  }

  async function patchCategory(category: CategoryOption, patch: Partial<CategoryOption>) {
    const response = await fetch(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleFa: patch.titleFa ?? category.titleFa,
        slug: patch.slug ?? category.slug,
        parentId: patch.parentId !== undefined ? patch.parentId : category.parentId,
        sortOrder: patch.sortOrder ?? category.sortOrder,
        isVisible: patch.isVisible ?? category.isVisible,
        seoTitle: patch.seoTitle !== undefined ? patch.seoTitle : category.seoTitle,
        seoDescription:
          patch.seoDescription !== undefined ? patch.seoDescription : category.seoDescription,
        ogImageUrl: patch.ogImageUrl !== undefined ? patch.ogImageUrl : category.ogImageUrl,
        noindex: patch.noindex ?? category.noindex,
      }),
    });
    const result = await response.json();

    if (!result.ok) {
      alert(result.error?.message ?? "دسته ذخیره نشد.");
      await refreshCategories();
      return;
    }

    await refreshCategories();
  }

  async function createCategory() {
    setSavingCategory(true);
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...categoryForm,
        parentId: categoryForm.parentId || null,
        sortOrder: Number(categoryForm.sortOrder || 0),
      }),
    });
    const result = await response.json();
    setSavingCategory(false);

    if (!result.ok) {
      alert(result.error?.message ?? "دسته ذخیره نشد.");
      return;
    }

    setCategoryForm({
      titleFa: "",
      slug: "",
      parentId: "",
      sortOrder: "0",
      seoTitle: "",
      seoDescription: "",
      ogImageUrl: "",
      noindex: false,
    });
    await refreshCategories();
  }

  return (
    <div className="grid gap-6">
      <section className="border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-black">دسته‌بندی‌ها</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            label="نام دسته"
            value={categoryForm.titleFa}
            onChange={(value) => setCategoryForm((current) => ({ ...current, titleFa: value }))}
          />
          <Input
            label="اسلاگ"
            value={categoryForm.slug}
            onChange={(value) => setCategoryForm((current) => ({ ...current, slug: value }))}
            dir="ltr"
          />
          <label className="block">
            <span className="mb-2 block text-sm font-bold">دسته والد</span>
            <select
              value={categoryForm.parentId}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, parentId: event.target.value }))
              }
              className="h-11 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
            >
              <option value="">بدون والد</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {"— ".repeat(category.depth)}
                  {category.titleFa}
                  {category.isVisible ? "" : " (مخفی)"}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="ترتیب"
            value={categoryForm.sortOrder}
            onChange={(value) => setCategoryForm((current) => ({ ...current, sortOrder: value }))}
            dir="ltr"
          />
        </div>

        {/* SEO overrides — optional; fall back to name/description when empty. */}
        <fieldset className="mt-4 border border-zinc-200 bg-zinc-50 p-4">
          <legend className="px-2 text-sm font-black">سئو</legend>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <Input
              label="عنوان سئو (title)"
              value={categoryForm.seoTitle}
              onChange={(value) => setCategoryForm((current) => ({ ...current, seoTitle: value }))}
            />
            <Input
              label="تصویر OG (URL)"
              value={categoryForm.ogImageUrl}
              onChange={(value) =>
                setCategoryForm((current) => ({ ...current, ogImageUrl: value }))
              }
              dir="ltr"
            />
            <div className="md:col-span-2">
              <Textarea
                label="توضیحات سئو (meta description)"
                value={categoryForm.seoDescription}
                onChange={(value) =>
                  setCategoryForm((current) => ({ ...current, seoDescription: value }))
                }
              />
            </div>
            <Checkbox
              label="عدم نمایه‌سازی در موتورهای جستجو (noindex)"
              checked={categoryForm.noindex}
              onChange={(checked) =>
                setCategoryForm((current) => ({ ...current, noindex: checked }))
              }
            />
          </div>
        </fieldset>

        <Button
          className="mt-4 h-10 px-5 font-black"
          onClick={createCategory}
          disabled={savingCategory}
        >
          {savingCategory ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          ساخت دسته
        </Button>

        <div className="mt-6 divide-y divide-zinc-100 border border-zinc-200">
          {categories.map((category) => (
            <div key={category.id} className="grid gap-3 p-3 text-sm">
              <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_90px_auto]">
                <Input
                  label="نام"
                  value={category.titleFa}
                  onChange={(value) => updateCategoryLocal(category.id, { titleFa: value })}
                />
                <Input
                  label="اسلاگ"
                  value={category.slug}
                  onChange={(value) => updateCategoryLocal(category.id, { slug: value })}
                  dir="ltr"
                />
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">والد</span>
                  <select
                    value={category.parentId ?? ""}
                    onChange={(event) =>
                      updateCategoryLocal(category.id, { parentId: event.target.value || null })
                    }
                    className="h-11 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
                  >
                    <option value="">بدون والد</option>
                    {categories
                      .filter((item) => item.id !== category.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {"— ".repeat(item.depth)}
                          {item.titleFa}
                          {item.isVisible ? "" : " (مخفی)"}
                        </option>
                      ))}
                  </select>
                </label>
                <Input
                  label="ترتیب"
                  value={String(category.sortOrder)}
                  onChange={(value) =>
                    updateCategoryLocal(category.id, { sortOrder: Number(value || 0) })
                  }
                  dir="ltr"
                />
                <div className="flex flex-wrap items-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => patchCategory(category, {})}
                  >
                    <Save className="size-3.5" />
                    ذخیره
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      updateCategoryLocal(category.id, { isVisible: !category.isVisible });
                      patchCategory(category, { isVisible: !category.isVisible });
                    }}
                  >
                    {category.isVisible ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                    {category.isVisible ? "مخفی" : "نمایش"}
                  </Button>
                </div>
              </div>

              {/* SEO overrides — collapsed by default to keep the table dense. */}
              <details className="border border-zinc-200 bg-zinc-50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-black">سئو</summary>
                <div className="grid gap-4 p-3 md:grid-cols-2">
                  <Input
                    label="عنوان سئو (title)"
                    value={category.seoTitle ?? ""}
                    onChange={(value) =>
                      updateCategoryLocal(category.id, { seoTitle: value || null })
                    }
                  />
                  <Input
                    label="تصویر OG (URL)"
                    value={category.ogImageUrl ?? ""}
                    onChange={(value) =>
                      updateCategoryLocal(category.id, { ogImageUrl: value || null })
                    }
                    dir="ltr"
                  />
                  <div className="md:col-span-2">
                    <Textarea
                      label="توضیحات سئو (meta description)"
                      value={category.seoDescription ?? ""}
                      onChange={(value) =>
                        updateCategoryLocal(category.id, { seoDescription: value || null })
                      }
                    />
                  </div>
                  <Checkbox
                    label="عدم نمایه‌سازی در موتورهای جستجو (noindex)"
                    checked={category.noindex}
                    onChange={(checked) => {
                      updateCategoryLocal(category.id, { noindex: checked });
                      patchCategory(category, { noindex: checked });
                    }}
                  />
                  <div className="flex items-end md:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        patchCategory(category, {
                          seoTitle: category.seoTitle,
                          seoDescription: category.seoDescription,
                          ogImageUrl: category.ogImageUrl,
                        })
                      }
                    >
                      <Save className="size-3.5" />
                      ذخیره سئو
                    </Button>
                  </div>
                </div>
              </details>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function TagManagement({ initialTags }: { initialTags: TagOption[] }) {
  const [tags, setTags] = useState(initialTags);
  const [savingTag, setSavingTag] = useState(false);
  const [tagForm, setTagForm] = useState({
    titleFa: "",
    slug: "",
  });

  function updateTagLocal(id: string, patch: Partial<TagOption>) {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  }

  async function refreshTags() {
    const response = await fetch("/api/admin/tags");
    const result = await response.json();

    if (result.ok) {
      setTags(result.data.tags);
    }
  }

  async function patchTag(tag: TagOption, patch: Partial<TagOption>) {
    const response = await fetch(`/api/admin/tags/${tag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleFa: patch.titleFa ?? tag.titleFa,
        slug: patch.slug ?? tag.slug,
        isVisible: patch.isVisible ?? tag.isVisible,
      }),
    });
    const result = await response.json();

    if (!result.ok) {
      alert(result.error?.message ?? "تگ ذخیره نشد.");
      await refreshTags();
      return;
    }

    await refreshTags();
  }

  async function createTag() {
    setSavingTag(true);
    const response = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tagForm),
    });
    const result = await response.json();
    setSavingTag(false);

    if (!result.ok) {
      alert(result.error?.message ?? "تگ ذخیره نشد.");
      return;
    }

    setTagForm({ titleFa: "", slug: "" });
    await refreshTags();
  }

  return (
    <div className="grid gap-6">
      <section className="border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-black">تگ‌ها</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            label="نام تگ"
            value={tagForm.titleFa}
            onChange={(value) => setTagForm((current) => ({ ...current, titleFa: value }))}
          />
          <Input
            label="اسلاگ"
            value={tagForm.slug}
            onChange={(value) => setTagForm((current) => ({ ...current, slug: value }))}
            dir="ltr"
          />
        </div>
        <Button className="mt-4 h-10 px-5 font-black" onClick={createTag} disabled={savingTag}>
          {savingTag ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          ساخت تگ
        </Button>

        <div className="mt-6 grid gap-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="grid gap-3 border border-zinc-200 bg-zinc-50 p-3 text-sm xl:grid-cols-[1.2fr_1fr_auto]"
            >
              <Input
                label="نام"
                value={tag.titleFa}
                onChange={(value) => updateTagLocal(tag.id, { titleFa: value })}
              />
              <Input
                label="اسلاگ"
                value={tag.slug}
                onChange={(value) => updateTagLocal(tag.id, { slug: value })}
                dir="ltr"
              />
              <div className="flex flex-wrap items-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => patchTag(tag, {})}>
                  <Save className="size-3.5" />
                  ذخیره
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    updateTagLocal(tag.id, { isVisible: !tag.isVisible });
                    patchTag(tag, { isVisible: !tag.isVisible });
                  }}
                >
                  {tag.isVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  {tag.isVisible ? "مخفی" : "نمایش"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
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
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950"
        dir={dir}
      />
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 self-end">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 border-zinc-300 accent-zinc-950"
      />
      <span className="text-sm font-bold">{label}</span>
    </label>
  );
}
