import { redirect } from "next/navigation";

import { BlogManagement } from "@/components/admin/blog-management";
import { listAdminPosts, toAdminBlogRow } from "@/lib/admin/blog";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminBlogPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/blog");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const posts = await listAdminPosts();

  return <BlogManagement initialPosts={posts.map(toAdminBlogRow)} mode="list" />;
}
