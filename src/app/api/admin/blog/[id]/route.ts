import { blogErrorResponse } from "@/app/api/admin/blog/route";
import {
  type BlogPostPatchInput,
  deleteBlogPost,
  toAdminBlogRow,
  updateBlogPost,
} from "@/lib/admin/blog";
import { apiError, apiOk, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;
  const body = await readJson<BlogPostPatchInput>(request);

  if (!body) {
    return apiError("INVALID_BODY", "درخواست معتبر نیست.");
  }

  try {
    const post = await updateBlogPost(id, body);
    return apiOk({ post: toAdminBlogRow(post) });
  } catch (error) {
    return blogErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await context.params;

  try {
    await deleteBlogPost(id);
    return apiOk({ deleted: true });
  } catch (error) {
    return blogErrorResponse(error);
  }
}
