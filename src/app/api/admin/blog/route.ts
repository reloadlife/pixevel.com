import {
  BlogError,
  type BlogPostInput,
  createBlogPost,
  listAdminPosts,
  toAdminBlogRow,
} from "@/lib/admin/blog";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

/** Maps a thrown BlogError (or unknown) to the standard API error envelope. */
export function blogErrorResponse(error: unknown) {
  if (error instanceof BlogError) {
    switch (error.code) {
      case "TITLE_REQUIRED":
        return apiError("TITLE_REQUIRED", "عنوان مطلب الزامی است.");
      case "BODY_REQUIRED":
        return apiError("BODY_REQUIRED", "متن مطلب الزامی است.");
      case "INVALID_STATUS":
        return apiError("INVALID_STATUS", "وضعیت مطلب معتبر نیست.");
      case "INVALID_TAGS":
        return apiError("INVALID_TAGS", "برچسب‌ها معتبر نیستند.");
      case "INVALID_DATE":
        return apiError("INVALID_DATE", "تاریخ معتبر نیست.");
      case "SLUG_TAKEN":
        return apiError("SLUG_TAKEN", "این نامک قبلاً استفاده شده است.");
      case "NOT_FOUND":
        return apiError("NOT_FOUND", "مطلب پیدا نشد.", 404);
      default:
        return apiError("BLOG_SAVE_FAILED", "مطلب ذخیره نشد.", 500);
    }
  }

  return apiError("BLOG_SAVE_FAILED", "مطلب ذخیره نشد.", 500);
}

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const posts = await listAdminPosts();

  return apiOk({ posts: posts.map(toAdminBlogRow) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const body = await readJson<BlogPostInput>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const post = await createBlogPost(body, admin.id);
    return apiOk({ post: toAdminBlogRow(post) }, { status: 201 });
  } catch (error) {
    return blogErrorResponse(error);
  }
}
