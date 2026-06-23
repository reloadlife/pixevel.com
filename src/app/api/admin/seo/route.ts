import { z } from "zod";
import {
  listSeoHub,
  patchSeo,
  SEO_SOURCE_KINDS,
  SeoHubError,
  type SeoSourceKind,
} from "@/lib/admin/seo";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { SITEMAP_CHANGEFREQS } from "@/lib/seo/static-pages";
import { parseBody } from "@/lib/validate";

function parseSource(value: string | null): SeoSourceKind | undefined {
  if (value && (SEO_SOURCE_KINDS as readonly string[]).includes(value)) {
    return value as SeoSourceKind;
  }
  return undefined;
}

function parseInt10(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const { searchParams } = new URL(request.url);
  const result = await listSeoHub({
    source: parseSource(searchParams.get("source")),
    search: searchParams.get("search") ?? undefined,
    page: parseInt10(searchParams.get("page")),
    pageSize: parseInt10(searchParams.get("pageSize")),
  });

  return apiOk(result);
}

// numeric-string in [0,1] or empty/null
const prioritySchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (v) => {
      if (v == null || v.trim() === "") return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 1;
    },
    { message: "اولویت نقشه سایت باید بین ۰ و ۱ باشد." },
  );

const changefreqSchema = z
  .string()
  .nullable()
  .optional()
  .refine((v) => v == null || v.trim() === "" || SITEMAP_CHANGEFREQS.includes(v as never), {
    message: "بازه به‌روزرسانی نقشه سایت نامعتبر است.",
  });

const PatchSchema = z.object({
  source: z.enum(SEO_SOURCE_KINDS as unknown as [SeoSourceKind, ...SeoSourceKind[]]),
  ref: z.string().min(1),
  fields: z.object({
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    ogImageUrl: z.string().nullable().optional(),
    noindex: z.boolean().optional(),
    labelFa: z.string().nullable().optional(),
    canonicalOverride: z.string().nullable().optional(),
    sitemapPriority: prioritySchema,
    sitemapChangefreq: changefreqSchema,
  }),
});

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);

  const parsed = await parseBody(request, PatchSchema);
  if (!parsed.ok) return parsed.response;

  const { source, ref, fields } = parsed.data;

  try {
    await patchSeo(source, ref, fields, admin.id);
  } catch (error) {
    if (error instanceof SeoHubError && error.code === "NOT_FOUND") {
      return apiError("NOT_FOUND", "صفحه موردنظر پیدا نشد.", 404);
    }
    return apiError("SEO_SAVE_FAILED", "ذخیره تنظیمات سئو ناموفق بود.", 500);
  }

  return apiOk({ ok: true });
}
