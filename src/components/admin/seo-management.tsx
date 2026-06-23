"use client";

import { Check, ExternalLink, Minus, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  AdminPage,
  type ColumnDef,
  DataTable,
  NumberField,
  SelectField,
  SheetForm,
  SwitchRow,
  TextareaField,
  TextField,
  useAdminForm,
} from "@/components/admin/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminListResponse } from "@/lib/admin/list-response";
import type { SeoHubRow, SeoSourceKind } from "@/lib/admin/seo";
import { useAdminList } from "@/lib/admin/use-admin-list";
import { useAdminMutation } from "@/lib/admin/use-admin-mutation";
import { toFaNumber } from "@/lib/format";
import type { SeoGlobalDefaults } from "@/lib/seo/defaults";
import { SITEMAP_CHANGEFREQS } from "@/lib/seo/static-pages";
import { cn } from "@/lib/utils";

// ─── Labels ─────────────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<SeoSourceKind, string> = {
  static: "صفحه ثابت",
  product: "محصول",
  category: "دسته",
  blog: "بلاگ",
};

const CHANGEFREQ_OPTIONS = SITEMAP_CHANGEFREQS.map((value) => ({ value, label: value }));

// ─── Boolean indicator chip ─────────────────────────────────────────────────────

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
      <Check className="size-3" />
    </span>
  ) : (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Minus className="size-3" />
    </span>
  );
}

// ─── Edit sheet ──────────────────────────────────────────────────────────────────

type SeoFormValues = {
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  noindex: boolean;
  // static-only
  canonicalOverride: string;
  sitemapPriority: string;
  sitemapChangefreq: string;
};

const EMPTY_FORM: SeoFormValues = {
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: "",
  noindex: false,
  canonicalOverride: "",
  sitemapPriority: "",
  sitemapChangefreq: "",
};

function SeoSheet({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SeoHubRow | undefined;
}) {
  const isStatic = row?.source === "static";

  const mutation = useAdminMutation<SeoFormValues>({
    url: () => "/api/admin/seo",
    method: "PATCH",
    body: (v) => ({
      source: row?.source,
      ref: row?.ref,
      fields: {
        seoTitle: v.seoTitle.trim() || null,
        seoDescription: v.seoDescription.trim() || null,
        ogImageUrl: v.ogImageUrl.trim() || null,
        noindex: v.noindex,
        ...(isStatic
          ? {
              canonicalOverride: v.canonicalOverride.trim() || null,
              sitemapPriority: v.sitemapPriority.trim() || null,
              sitemapChangefreq: v.sitemapChangefreq.trim() || null,
            }
          : {}),
      },
    }),
    invalidate: ["seo"],
    successMessage: "تنظیمات سئو ذخیره شد.",
  });

  const form = useAdminForm<SeoFormValues>({
    defaultValues: EMPTY_FORM,
    mutation,
    onSuccess: () => onOpenChange(false),
  });

  return (
    <SheetForm
      open={open}
      onOpenChange={onOpenChange}
      title={row ? `ویرایش سئو — ${row.label}` : "ویرایش سئو"}
      form={form}
    >
      {row ? (
        <p className="text-xs text-muted-foreground text-right" dir="ltr">
          {row.path}
        </p>
      ) : null}

      <form.Field name="seoTitle">
        {(field) => (
          <TextField
            id="seoTitle"
            label="عنوان سئو"
            value={field.state.value}
            onChange={field.handleChange}
            hint="در صورت خالی بودن، عنوان پیش‌فرض صفحه استفاده می‌شود."
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="seoDescription">
        {(field) => (
          <TextareaField
            id="seoDescription"
            label="توضیحات سئو"
            value={field.state.value}
            onChange={field.handleChange}
            rows={3}
            hint="در صورت خالی بودن، توضیحات پیش‌فرض استفاده می‌شود."
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="ogImageUrl">
        {(field) => (
          <TextField
            id="ogImageUrl"
            label="تصویر اشتراک‌گذاری (OG Image URL)"
            value={field.state.value}
            onChange={field.handleChange}
            placeholder="https://…"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="noindex">
        {(field) => (
          <SwitchRow
            id="noindex"
            label="عدم نمایه‌سازی (noindex)"
            hint="این صفحه از نتایج موتورهای جستجو و نقشه سایت حذف می‌شود."
            checked={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </form.Field>

      {isStatic ? (
        <>
          <form.Field name="canonicalOverride">
            {(field) => (
              <TextField
                id="canonicalOverride"
                label="کنونیکال سفارشی"
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="/about"
                hint="در صورت خالی بودن، از مسیر صفحه ساخته می‌شود."
                error={field.state.meta.errors[0] as string | undefined}
              />
            )}
          </form.Field>

          <form.Field name="sitemapPriority">
            {(field) => (
              <NumberField
                id="sitemapPriority"
                label="اولویت نقشه سایت (۰ تا ۱)"
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                max={1}
                step={0.1}
                placeholder="پیش‌فرض"
                error={field.state.meta.errors[0] as string | undefined}
              />
            )}
          </form.Field>

          <form.Field name="sitemapChangefreq">
            {(field) => (
              <SelectField
                id="sitemapChangefreq"
                label="بازه به‌روزرسانی نقشه سایت"
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="پیش‌فرض"
                options={CHANGEFREQ_OPTIONS}
                error={field.state.meta.errors[0] as string | undefined}
              />
            )}
          </form.Field>
        </>
      ) : null}
    </SheetForm>
  );
}

// ─── Pages tab ───────────────────────────────────────────────────────────────────

function PagesTab({ initialData }: { initialData: AdminListResponse<SeoHubRow> }) {
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<SeoSourceKind | "">("");
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<SeoHubRow | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);

  const result = useAdminList<SeoHubRow>(
    "seo",
    { page, source: source || undefined, search: search || undefined },
    { initialData },
  );

  const rows = result.data?.rows ?? [];

  function openEdit(row: SeoHubRow) {
    setEditRow(row);
    setSheetOpen(true);
  }

  const columns: ColumnDef<SeoHubRow>[] = [
    {
      id: "label",
      header: "صفحه",
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="space-y-0.5">
            <div className="font-medium">{row.label}</div>
            <div className="text-xs text-muted-foreground" dir="ltr">
              {row.path}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "source",
      header: "نوع",
      meta: { align: "center" },
      cell: (info) => (
        <span className="text-xs text-muted-foreground">
          {SOURCE_LABEL[info.getValue<SeoSourceKind>()]}
        </span>
      ),
    },
    {
      id: "hasTitle",
      header: "عنوان",
      meta: { align: "center" },
      cell: (info) => <YesNo value={info.row.original.hasTitle} />,
    },
    {
      id: "hasDescription",
      header: "توضیحات",
      meta: { align: "center" },
      cell: (info) => <YesNo value={info.row.original.hasDescription} />,
    },
    {
      id: "noindex",
      header: "نمایه",
      meta: { align: "center" },
      cell: (info) =>
        info.row.original.noindex ? (
          <span className="text-xs font-medium text-destructive">noindex</span>
        ) : (
          <span className="text-xs text-muted-foreground">index</span>
        ),
    },
    {
      id: "inSitemap",
      header: "نقشه سایت",
      meta: { align: "center" },
      cell: (info) => <YesNo value={info.row.original.inSitemap} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="جستجوی عنوان یا مسیر…"
          dir="rtl"
          className="max-w-xs text-right"
        />
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value as SeoSourceKind | "");
            setPage(1);
          }}
          dir="rtl"
          className="h-9 rounded-2xl border border-transparent bg-input/50 px-2.5 text-sm text-right outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <option value="">همه منابع</option>
          <option value="static">صفحات ثابت</option>
          <option value="product">محصولات</option>
          <option value="category">دسته‌ها</option>
          <option value="blog">بلاگ</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={result.isLoading}
        pagination={result.data?.pagination}
        onPageChange={setPage}
        empty="صفحه‌ای یافت نشد."
        rowActions={(row) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="ویرایش"
              onClick={() => openEdit(row)}
              className="inline-flex size-8 items-center justify-center rounded-xl text-foreground/70 transition hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
            {row.editHref ? (
              <Link
                href={row.editHref}
                aria-label="ویرایش موجودیت"
                className="inline-flex size-8 items-center justify-center rounded-xl text-foreground/70 transition hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </Link>
            ) : null}
          </div>
        )}
      />

      <SeoSheet
        key={editRow ? `${editRow.source}:${editRow.ref}` : "new"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        row={editRow}
      />
    </div>
  );
}

// ─── Defaults tab ────────────────────────────────────────────────────────────────

type DefaultsFormValues = {
  titleTemplate: string;
  defaultDescription: string;
  defaultOgImageUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  defaultPriority: string;
  defaultChangefreq: string;
};

function defaultsToForm(d: SeoGlobalDefaults): DefaultsFormValues {
  return {
    titleTemplate: d.titleTemplate,
    defaultDescription: d.defaultDescription,
    defaultOgImageUrl: d.defaultOgImageUrl,
    robotsIndex: d.robotsDefault.index,
    robotsFollow: d.robotsDefault.follow,
    defaultPriority: String(d.sitemap.defaultPriority),
    defaultChangefreq: d.sitemap.defaultChangefreq,
  };
}

function DefaultsTab({ defaults }: { defaults: SeoGlobalDefaults }) {
  const mutation = useAdminMutation<DefaultsFormValues>({
    url: () => "/api/admin/seo/defaults",
    method: "PUT",
    body: (v) => ({
      titleTemplate: v.titleTemplate,
      defaultDescription: v.defaultDescription,
      defaultOgImageUrl: v.defaultOgImageUrl,
      robotsDefault: { index: v.robotsIndex, follow: v.robotsFollow },
      sitemap: {
        defaultPriority: Number(v.defaultPriority),
        defaultChangefreq: v.defaultChangefreq,
      },
    }),
    invalidate: ["seo-defaults"],
    successMessage: "تنظیمات پیش‌فرض سئو ذخیره شد.",
  });

  const form = useAdminForm<DefaultsFormValues>({
    defaultValues: defaultsToForm(defaults),
    mutation,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="max-w-2xl space-y-4"
    >
      <form.Field name="titleTemplate">
        {(field) => (
          <TextField
            id="titleTemplate"
            label="قالب عنوان"
            value={field.state.value}
            onChange={field.handleChange}
            hint="از %s برای عنوان صفحه استفاده کنید، مثل «%s | پیسکول»."
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="defaultDescription">
        {(field) => (
          <TextareaField
            id="defaultDescription"
            label="توضیحات پیش‌فرض"
            value={field.state.value}
            onChange={field.handleChange}
            rows={3}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="defaultOgImageUrl">
        {(field) => (
          <TextField
            id="defaultOgImageUrl"
            label="تصویر پیش‌فرض اشتراک‌گذاری (OG Image)"
            value={field.state.value}
            onChange={field.handleChange}
            placeholder="https://…"
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="robotsIndex">
        {(field) => (
          <SwitchRow
            id="robotsIndex"
            label="نمایه‌سازی پیش‌فرض (index)"
            hint="اگر غیرفعال شود، کل سایت به‌صورت پیش‌فرض noindex می‌شود."
            checked={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </form.Field>

      <form.Field name="robotsFollow">
        {(field) => (
          <SwitchRow
            id="robotsFollow"
            label="دنبال‌کردن لینک‌ها پیش‌فرض (follow)"
            checked={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </form.Field>

      <form.Field name="defaultPriority">
        {(field) => (
          <NumberField
            id="defaultPriority"
            label="اولویت پیش‌فرض نقشه سایت (۰ تا ۱)"
            value={field.state.value}
            onChange={field.handleChange}
            min={0}
            max={1}
            step={0.1}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <form.Field name="defaultChangefreq">
        {(field) => (
          <SelectField
            id="defaultChangefreq"
            label="بازه پیش‌فرض به‌روزرسانی نقشه سایت"
            value={field.state.value}
            onChange={field.handleChange}
            options={CHANGEFREQ_OPTIONS}
            error={field.state.meta.errors[0] as string | undefined}
          />
        )}
      </form.Field>

      <Button type="submit" disabled={form.state.isSubmitting}>
        {form.state.isSubmitting ? "در حال ذخیره…" : "ذخیره پیش‌فرض‌ها"}
      </Button>
    </form>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

// ─── SeoManagement ───────────────────────────────────────────────────────────────

export function SeoManagement({
  initialData,
  defaults,
  totalPages,
}: {
  initialData: AdminListResponse<SeoHubRow>;
  defaults: SeoGlobalDefaults;
  totalPages: number;
}) {
  const [tab, setTab] = useState<"pages" | "defaults">("pages");

  return (
    <AdminPage title="سئو" subtitle={`${toFaNumber(totalPages)} صفحه قابل نمایه‌سازی`}>
      <div className="flex gap-2" dir="rtl">
        <TabButton active={tab === "pages"} onClick={() => setTab("pages")}>
          صفحات
        </TabButton>
        <TabButton active={tab === "defaults"} onClick={() => setTab("defaults")}>
          پیش‌فرض‌های کلی
        </TabButton>
      </div>

      {tab === "pages" ? (
        <PagesTab initialData={initialData} />
      ) : (
        <DefaultsTab defaults={defaults} />
      )}
    </AdminPage>
  );
}
