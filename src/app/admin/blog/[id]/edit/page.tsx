import { notFound, redirect } from "next/navigation";

import { BlogManagement } from "@/components/admin/blog-management";
import { getAdminPost, toAdminBlogRow } from "@/lib/admin/blog";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/blog");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const { id } = await params;
  const post = await getAdminPost(id);

  if (!post) {
    notFound();
  }

  return <BlogManagement initialPosts={[toAdminBlogRow(post)]} mode="edit" />;
}
