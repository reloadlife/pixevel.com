import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";

import {
  NewsletterManagement,
  type NewsletterSubscriber,
} from "@/components/admin/newsletter-management";
import { newsletterSubscribers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export default async function AdminNewsletterPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/newsletter");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const rows = await getDb()
    .select()
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.createdAt))
    .limit(1000);

  const initialSubscribers: NewsletterSubscriber[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    isActive: row.isActive,
    unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return <NewsletterManagement initialSubscribers={initialSubscribers} />;
}
