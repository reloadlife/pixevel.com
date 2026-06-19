import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
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
    <AdminShell user={user}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="کاربران" value={userCount} />
        <Stat title="محصولات" value={productCount} />
        <Stat title="سفارش‌ها" value={orderCount} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/products"
          className="border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
        >
          <h2 className="text-lg font-black">مدیریت محصولات</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-500">
            جستجو، فیلتر، ویرایش وضعیت و ورود به صفحه ویرایش محصول.
          </p>
        </Link>
        <Link
          href="/admin/products/new"
          className="border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
        >
          <h2 className="text-lg font-black">افزودن محصول</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-500">
            ساخت محصول، تولید تنوع‌ها و ایجاد موجودی دقیق.
          </p>
        </Link>
        <Link
          href="/admin/homepage"
          className="border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
        >
          <h2 className="text-lg font-black">بلاک‌های صفحه خانه</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-500">
            ساخت ویترین بزرگ و گالری‌های داینامیک یا دستی.
          </p>
        </Link>
        <Link
          href="/admin/watermarks"
          className="border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
        >
          <h2 className="text-lg font-black">تصاویر واترمارک</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-500">
            آپلود PNGهای واترمارک برای استفاده روی تصاویر محصول.
          </p>
        </Link>
        <Link
          href="/admin/categories"
          className="border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
        >
          <h2 className="text-lg font-black">مدیریت دسته‌ها</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-500">ساخت و ویرایش دسته‌های تو در تو.</p>
        </Link>
        <Link href="/admin/tags" className="border border-zinc-200 bg-white p-5 hover:bg-zinc-50">
          <h2 className="text-lg font-black">مدیریت تگ‌ها</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-500">
            ساخت، ویرایش و مخفی کردن تگ‌های محصول.
          </p>
        </Link>
        <Link href="/admin/users" className="border border-zinc-200 bg-white p-5 hover:bg-zinc-50">
          <h2 className="text-lg font-black">مدیریت کاربران</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-500">
            تغییر نقش ادمین و وضعیت پریمیوم کاربران.
          </p>
        </Link>
      </div>
    </AdminShell>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="border border-zinc-200 bg-white p-5">
      <p className="text-sm font-bold text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-black">{value.toLocaleString("fa-IR")}</p>
    </div>
  );
}
