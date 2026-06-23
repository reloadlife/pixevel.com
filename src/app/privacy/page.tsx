import type { Metadata } from "next";
import Link from "next/link";

import { resolveMetadata } from "@/lib/seo/resolve";

export function generateMetadata(): Promise<Metadata> {
  return resolveMetadata({ kind: "static", pathKey: "/privacy" });
}

const sections = [
  {
    title: "اطلاعاتی که جمع‌آوری می‌کنیم",
    body: "برای تکمیل خرید، شماره تلفن شما را جهت ورود با کد یک‌بارمصرف و اطلاعات سفارش را ذخیره می‌کنیم. ایمیل تنها در صورت عضویت در خبرنامه نگهداری می‌شود.",
  },
  {
    title: "استفاده از اطلاعات",
    body: "از اطلاعات شما برای پردازش سفارش، تحویل کد، پشتیبانی و اطلاع‌رسانی استفاده می‌کنیم. اطلاعات شما فروخته نمی‌شود.",
  },
  {
    title: "کوکی‌ها",
    body: "کوکی‌های ضروری برای کارکرد سبد خرید و حساب کاربری لازم هستند. کوکی‌های اختیاری تنها با رضایت شما فعال می‌شوند و به‌صورت پیش‌فرض غیرفعال‌اند.",
  },
  {
    title: "امنیت",
    body: "پرداخت‌ها از طریق درگاه‌های بانکی امن انجام می‌شود و ما اطلاعات کارت بانکی شما را ذخیره نمی‌کنیم.",
  },
  {
    title: "حقوق شما",
    body: "می‌توانید برای مشاهده، اصلاح یا حذف اطلاعات حساب خود با پشتیبانی تماس بگیرید.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 text-foreground sm:px-6" dir="rtl">
      <h1 className="text-4xl font-black">حریم خصوصی</h1>
      <p className="mt-3 text-sm text-muted-foreground">آخرین به‌روزرسانی: خرداد ۱۴۰۵</p>

      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-base font-black text-foreground">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link
          href="/terms"
          className="text-muted-foreground underline transition hover:text-foreground"
        >
          قوانین و مقررات
        </Link>
        <Link
          href="/contact"
          className="text-muted-foreground underline transition hover:text-foreground"
        >
          تماس با ما
        </Link>
        <Link href="/" className="text-muted-foreground underline transition hover:text-foreground">
          بازگشت به خانه
        </Link>
      </div>
    </main>
  );
}
