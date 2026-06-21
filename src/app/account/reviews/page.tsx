import { Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listMyReviews } from "@/lib/account/reviews";
import { getCurrentUser } from "@/lib/auth";
import { toFaNumber } from "@/lib/format";
import { ReviewRow } from "./review-row";

export const metadata = {
  title: "دیدگاه‌های من",
};

export default async function MyReviewsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/reviews");
  }

  const reviews = await listMyReviews(user.id);

  return (
    <main className="text-foreground" dir="rtl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">دیدگاه‌های من</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          دیدگاه‌هایی که برای محصولات ثبت کرده‌اید را اینجا ویرایش یا حذف کنید.
          {reviews.length > 0 ? ` (${toFaNumber(reviews.length)} دیدگاه)` : null}
        </p>
      </header>

      {reviews.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-gold/15 text-gold">
            <Star className="size-7" />
          </div>
          <div>
            <p className="text-lg font-black">هنوز دیدگاهی ثبت نکرده‌اید</p>
            <p className="mt-1 text-sm text-muted-foreground">
              پس از خرید، تجربه‌ی خود را با دیگران به اشتراک بگذارید.
            </p>
          </div>
          <Link href="/products" className={buttonVariants()}>
            مشاهده محصولات
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </div>
      )}
    </main>
  );
}
