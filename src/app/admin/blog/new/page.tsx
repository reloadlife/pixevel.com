import { redirect } from "next/navigation";

import { BlogManagement } from "@/components/admin/blog-management";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminBlogNewPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/blog/new");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  return <BlogManagement initialPosts={[]} mode="create" />;
}
