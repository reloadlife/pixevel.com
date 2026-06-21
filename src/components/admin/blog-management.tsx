"use client";

import { ImagePlus, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type BlogStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type BlogRow = {
  id: string;
  slug: string;
  titleFa: string;
  excerptFa: string;
  bodyFa: string;
  coverImageUrl: string;
  status: BlogStatus;
  tags: string[];
  authorName: string | null;
  publishedAt: string | null;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  noindex: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type BlogForm = {
  titleFa: string;
  slug: string;
  excerptFa: string;
  bodyFa: string;
  coverImageUrl: string;
  status: BlogStatus;
  tags: string;
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  noindex: boolean;
};

const EMPTY_FORM: BlogForm = {
  titleFa: "",
  slug: "",
  excerptFa: "",
  bodyFa: "",
  coverImageUrl: "",
  status: "DRAFT",
  tags: "",
  publishedAt: "",
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: "",
  noindex: false,
};

const STATUS_META: Record<
  BlogStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  DRAFT: { label: "پیش‌نویس", variant: "outline" },
  PUBLISHED: { label: "منتشر شده", variant: "default" },
  ARCHIVED: { label: "بایگانی", variant: "secondary" },
};

const FA_DATE = new Intl.DateTimeFormat("fa-IR", { dateStyle: "short" });

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : FA_DATE.format(date);
}

/** ISO timestamp → value for a `datetime-local` input (local time, no seconds). */
function toLocalInput(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** `datetime-local` value → ISO string (or null when empty). */
function fromLocalInput(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Mirror of the server slugify — keeps the editable slug preview honest (FA + latin). */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^؀-ۿa-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formFromRow(row: BlogRow): BlogForm {
  return {
    titleFa: row.titleFa,
    slug: row.slug,
    excerptFa: row.excerptFa,
    bodyFa: row.bodyFa,
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    tags: row.tags.join("، "),
    publishedAt: toLocalInput(row.publishedAt),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogImageUrl: row.ogImageUrl,
    noindex: row.noindex,
  };
}

function formToPayload(form: BlogForm) {
  return {
    titleFa: form.titleFa.trim(),
    slug: form.slug.trim(),
    excerptFa: form.excerptFa.trim() || null,
    bodyFa: form.bodyFa,
    coverImageUrl: form.coverImageUrl.trim() || null,
    status: form.status,
    tags: form.tags
      .split(/[,،\n]/)
      .map((t) => t.trim())
      .filter(Boolean),
    publishedAt: fromLocalInput(form.publishedAt),
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    ogImageUrl: form.ogImageUrl.trim() || null,
    noindex: form.noindex,
  };
}

type Mode = "list" | "create" | "edit";

export function BlogManagement({
  initialPosts,
  mode = "list",
}: {
  initialPosts: BlogRow[];
  mode?: Mode;
}) {
  const router = useRouter();
  const [posts] = useState(initialPosts);

  // Form modes (create/edit) render the editor directly off the single seed row.
  if (mode === "create" || mode === "edit") {
    const seed = mode === "edit" ? initialPosts[0] : undefined;
    return (
      <BlogEditor
        mode={mode}
        postId={seed?.id ?? null}
        initialForm={seed ? formFromRow(seed) : EMPTY_FORM}
        slugTouchedInitially={Boolean(seed)}
      />
    );
  }

  // List mode.
  async function removePost(post: BlogRow) {
    if (!window.confirm(`حذف مطلب «${post.titleFa}»؟ این عمل قابل بازگشت نیست.`)) {
      return;
    }
    const response = await fetch(`/api/admin/blog/${post.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!result.ok) {
      toast.error(result.error?.message ?? "مطلب حذف نشد.");
      return;
    }
    toast.success("مطلب حذف شد.");
    router.refresh();
  }

  return (
    <div className="grid gap-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black">بلاگ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {toFaNumber(posts.length)} مطلب ثبت‌شده
          </p>
        </div>
        <Button
          nativeButton={false}
          className="font-black"
          render={
            <Link href="/admin/blog/new">
              <Plus className="size-4" />
              مطلب جدید
            </Link>
          }
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="[&>th]:p-3 [&>th]:text-start [&>th]:font-bold">
                <th>عنوان</th>
                <th>نامک</th>
                <th>وضعیت</th>
                <th>تاریخ انتشار</th>
                <th>برچسب‌ها</th>
                <th className="text-end">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    هنوز مطلبی ثبت نشده است.
                  </td>
                </tr>
              ) : (
                posts.map((post) => {
                  const status = STATUS_META[post.status];
                  return (
                    <tr key={post.id} className="[&>td]:p-3 [&>td]:align-top">
                      <td className="font-bold">{post.titleFa}</td>
                      <td className="text-muted-foreground">
                        <span className="font-mono text-xs" dir="ltr">
                          {post.slug}
                        </span>
                      </td>
                      <td>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {formatDate(post.publishedAt)}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {post.tags.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            post.tags.slice(0, 4).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            nativeButton={false}
                            size="sm"
                            variant="outline"
                            render={
                              <Link href={`/admin/blog/${post.id}/edit`}>
                                <Pencil className="size-3.5" />
                                ویرایش
                              </Link>
                            }
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => removePost(post)}
                          >
                            <Trash2 className="size-3.5" />
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BlogEditor({
  mode,
  postId,
  initialForm,
  slugTouchedInitially,
}: {
  mode: "create" | "edit";
  postId: string | null;
  initialForm: BlogForm;
  slugTouchedInitially: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<BlogForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Once an operator hand-edits the slug, stop auto-deriving it from the title.
  const slugTouched = useRef(slugTouchedInitially);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof BlogForm>(key: K, value: BlogForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onTitleChange(value: string) {
    setForm((prev) => ({
      ...prev,
      titleFa: value,
      slug: slugTouched.current ? prev.slug : slugify(value),
    }));
  }

  function onSlugChange(value: string) {
    slugTouched.current = true;
    set("slug", value);
  }

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const data = new FormData();
      data.append("files", file);
      const response = await fetch("/api/admin/uploads", { method: "POST", body: data });
      const result = await response.json();
      if (!result.ok) {
        toast.error(result.error?.message ?? "آپلود تصویر ناموفق بود.");
        return;
      }
      const url = result.data?.files?.[0]?.url as string | undefined;
      if (url) {
        set("coverImageUrl", url);
        toast.success("تصویر کاور آپلود شد.");
      }
    } catch {
      toast.error("آپلود تصویر ناموفق بود.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function save() {
    if (!form.titleFa.trim()) {
      toast.error("عنوان مطلب الزامی است.");
      return;
    }
    if (!form.bodyFa.trim()) {
      toast.error("متن مطلب الزامی است.");
      return;
    }

    setSaving(true);
    const url = mode === "edit" && postId ? `/api/admin/blog/${postId}` : "/api/admin/blog";
    const method = mode === "edit" ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    const result = await response.json();
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error?.message ?? "مطلب ذخیره نشد.");
      return;
    }

    toast.success(mode === "edit" ? "مطلب به‌روزرسانی شد." : "مطلب ساخته شد.");
    router.push("/admin/blog");
    router.refresh();
  }

  return (
    <div className="grid gap-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black">{mode === "edit" ? "ویرایش مطلب" : "مطلب جدید"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            متن مطلب با مارک‌داون یا HTML امن (نوشته‌شده توسط مدیر) رندر می‌شود.
          </p>
        </div>
        <Button
          nativeButton={false}
          variant="ghost"
          render={
            <Link href="/admin/blog">
              <X className="size-4" />
              بازگشت
            </Link>
          }
        />
      </div>

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-4 lg:grid-cols-2">
        <Field label="عنوان مطلب" className="lg:col-span-2">
          <input
            value={form.titleFa}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="عنوان جذاب مطلب"
            className={fieldClass}
          />
        </Field>

        <Field label="نامک (slug)" hint="خودکار از عنوان ساخته می‌شود">
          <input
            value={form.slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="my-post-slug"
            dir="ltr"
            className={cn(fieldClass, "font-mono")}
          />
        </Field>

        <Field label="وضعیت">
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as BlogStatus)}
            className={fieldClass}
          >
            <option value="DRAFT">پیش‌نویس</option>
            <option value="PUBLISHED">منتشر شده</option>
            <option value="ARCHIVED">بایگانی</option>
          </select>
        </Field>

        <Field label="خلاصه" hint="اختیاری" className="lg:col-span-2">
          <textarea
            value={form.excerptFa}
            onChange={(e) => set("excerptFa", e.target.value)}
            placeholder="یک خلاصه کوتاه برای فهرست و RSS"
            rows={2}
            className={cn(fieldClass, "h-auto resize-y py-2 leading-relaxed")}
          />
        </Field>

        <Field label="متن مطلب (مارک‌داون / HTML)" className="lg:col-span-2">
          <textarea
            value={form.bodyFa}
            onChange={(e) => set("bodyFa", e.target.value)}
            placeholder="متن کامل مطلب…"
            rows={16}
            dir="rtl"
            className={cn(fieldClass, "h-auto resize-y py-3 font-mono text-[13px] leading-relaxed")}
          />
        </Field>

        {/* Cover image */}
        <Field label="تصویر کاور" hint="اختیاری" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            {form.coverImageUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.coverImageUrl}
                  alt="کاور"
                  className="size-24 rounded-xl border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => set("coverImageUrl", "")}
                  className="absolute -top-2 -left-2 grid size-6 place-items-center rounded-full bg-destructive text-destructive-foreground"
                  aria-label="حذف تصویر"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <div className="grid size-24 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
                <ImagePlus className="size-6" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                آپلود تصویر
              </Button>
              <input
                value={form.coverImageUrl}
                onChange={(e) => set("coverImageUrl", e.target.value)}
                placeholder="یا آدرس تصویر را وارد کنید"
                dir="ltr"
                className={cn(fieldClass, "min-w-[260px]")}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void uploadCover(file);
                }
              }}
            />
          </div>
        </Field>

        <Field label="برچسب‌ها" hint="با ویرگول جدا کنید">
          <input
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="گیفت‌کارت، آموزش، اخبار"
            className={fieldClass}
          />
        </Field>

        <Field label="تاریخ انتشار" hint="در انتشار خودکار «اکنون» می‌شود">
          <input
            type="datetime-local"
            value={form.publishedAt}
            onChange={(e) => set("publishedAt", e.target.value)}
            dir="ltr"
            className={fieldClass}
          />
        </Field>
      </section>

      {/* ── SEO section ──────────────────────────────────────────── */}
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-4 lg:grid-cols-2">
        <h2 className="text-base font-black lg:col-span-2">تنظیمات سئو</h2>

        <Field label="عنوان سئو" hint="اختیاری">
          <input
            value={form.seoTitle}
            onChange={(e) => set("seoTitle", e.target.value)}
            placeholder="در صورت خالی‌بودن، عنوان مطلب استفاده می‌شود"
            className={fieldClass}
          />
        </Field>

        <Field label="آدرس تصویر OG" hint="اختیاری">
          <input
            value={form.ogImageUrl}
            onChange={(e) => set("ogImageUrl", e.target.value)}
            placeholder="در صورت خالی‌بودن، تصویر کاور استفاده می‌شود"
            dir="ltr"
            className={fieldClass}
          />
        </Field>

        <Field label="توضیحات سئو" hint="اختیاری" className="lg:col-span-2">
          <textarea
            value={form.seoDescription}
            onChange={(e) => set("seoDescription", e.target.value)}
            placeholder="توضیح کوتاه برای موتورهای جستجو"
            rows={2}
            className={cn(fieldClass, "h-auto resize-y py-2 leading-relaxed")}
          />
        </Field>

        <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold lg:col-span-2">
          <input
            type="checkbox"
            checked={form.noindex}
            onChange={(e) => set("noindex", e.target.checked)}
            className="size-4 accent-primary"
          />
          عدم نمایه‌سازی (noindex)
        </label>
      </section>

      <div className="flex gap-2">
        <Button className="font-black" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {mode === "edit" ? "ذخیره تغییرات" : "ساخت مطلب"}
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/admin/blog">انصراف</Link>}
        />
      </div>
    </div>
  );
}

const fieldClass =
  "h-10 w-full rounded-2xl border border-border bg-input/50 px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
        {label}
        {hint && <span className="text-xs font-normal text-muted-foreground">({hint})</span>}
      </span>
      {children}
    </div>
  );
}
