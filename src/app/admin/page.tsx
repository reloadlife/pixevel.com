import {
  HomeIcon,
  ImageIcon,
  LayoutGridIcon,
  PackageIcon,
  PlusIcon,
  ShoppingBagIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { orders as ordersTable, products as productsTable, users as usersTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  if (user.role !== "ADMIN") {
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-50 px-4">
        <div className="border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-black">دسترسی مجاز نیست</h1>
          <p className="mt-2 text-muted-foreground">این بخش فقط برای ادمین‌هاست.</p>
        </div>
      </main>
    );
  }

  const db = getDb();
  const [userCount, productCount, orderCount] = await Promise.all([
    db.$count(usersTable),
    db.$count(productsTable),
    db.$count(ordersTable),
  ]);

  return (
    <div dir="rtl">
      {/* آمار کلی */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="کاربران"
          value={userCount}
          icon={UsersIcon}
          description="تعداد کل کاربران ثبت‌نام‌شده"
        />
        <StatCard
          title="محصولات"
          value={productCount}
          icon={PackageIcon}
          description="تعداد کل محصولات تعریف‌شده"
        />
        <StatCard
          title="سفارش‌ها"
          value={orderCount}
          icon={ShoppingBagIcon}
          description="تعداد کل سفارش‌های ثبت‌شده"
        />
      </div>

      {/* دسترسی سریع */}
      <h2 className="mt-8 mb-4 text-base font-semibold text-foreground/70">دسترسی سریع</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/admin/products"
          icon={PackageIcon}
          title="محصولات"
          description="جستجو، فیلتر و ویرایش محصولات"
        />
        <QuickLink
          href="/admin/products/new"
          icon={PlusIcon}
          title="افزودن محصول"
          description="ساخت محصول جدید با تنوع و موجودی"
        />
        <QuickLink
          href="/admin/orders"
          icon={ShoppingBagIcon}
          title="سفارش‌ها"
          description="مشاهده و مدیریت سفارش‌های مشتریان"
        />
        <QuickLink
          href="/admin/users"
          icon={UsersIcon}
          title="کاربران"
          description="تغییر نقش و وضعیت پریمیوم کاربران"
        />
        <QuickLink
          href="/admin/categories"
          icon={LayoutGridIcon}
          title="دسته‌ها"
          description="ساخت و ویرایش دسته‌های تو در تو"
        />
        <QuickLink
          href="/admin/tags"
          icon={TagIcon}
          title="تگ‌ها"
          description="ساخت، ویرایش و مخفی کردن تگ‌های محصول"
        />
        <QuickLink
          href="/admin/homepage"
          icon={HomeIcon}
          title="صفحه خانه"
          description="ساخت ویترین‌ها و گالری‌های داینامیک"
        />
        <QuickLink
          href="/admin/watermarks"
          icon={ImageIcon}
          title="واترمارک‌ها"
          description="آپلود PNG واترمارک برای تصاویر محصول"
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-black tabular-nums">{value.toLocaleString("fa-IR")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
