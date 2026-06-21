import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "پشتیبانی",
  description: "مرکز پشتیبانی پیسکول؛ راهنمای خرید، رفع مشکل کد و راه‌های ارتباط با تیم پشتیبانی.",
  alternates: { canonical: "/support" },
};

const topics = [
  {
    title: "پیگیری سفارش",
    body: "وضعیت سفارش و کدهای خریداری‌شده را در حساب کاربری خود ببینید.",
    href: "/account",
    cta: "حساب کاربری",
  },
  {
    title: "مشکل در دریافت کد",
    body: "اگر کد را دریافت نکردید یا کار نمی‌کند، از طریق تماس با ما پیگیری کنید.",
    href: "/contact",
    cta: "تماس با ما",
  },
  {
    title: "سوالات رایج",
    body: "پاسخ پرتکرارترین پرسش‌ها درباره خرید و تحویل را اینجا بخوانید.",
    href: "/faq",
    cta: "سوالات متداول",
  },
];

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 text-foreground sm:px-6" dir="rtl">
      <h1 className="text-4xl font-black">مرکز پشتیبانی</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        ما برای کمک به شما اینجاییم. یکی از موضوع‌های زیر را انتخاب کنید یا مستقیماً با تیم پشتیبانی
        تماس بگیرید.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {topics.map((topic) => (
          <div
            key={topic.title}
            className="flex flex-col rounded-xl border border-border bg-muted/30 p-4"
          >
            <h2 className="text-sm font-black text-foreground">{topic.title}</h2>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
              {topic.body}
            </p>
            <Link
              href={topic.href}
              className="mt-4 text-xs font-bold text-gold transition hover:text-gold-strong"
            >
              {topic.cta} ←
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-border bg-muted/30 p-5">
        <h2 className="text-sm font-black text-foreground">ساعات پاسخ‌گویی</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          همه‌روزه از ساعت ۹ تا ۲۱. پیام‌های خارج از این بازه در اولین فرصت پاسخ داده می‌شوند.
        </p>
      </div>
    </main>
  );
}
