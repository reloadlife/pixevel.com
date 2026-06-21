import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "قوانین و مقررات",
  description: "قوانین و مقررات استفاده از فروشگاه دیجیتال پیسکول.",
  alternates: { canonical: "/terms" },
};

const sections = [
  {
    title: "۱. پذیرش قوانین",
    body: "با ثبت سفارش در پیسکول، استفاده از خدمات این فروشگاه به‌منزله پذیرش کامل قوانین و مقررات حاضر است.",
  },
  {
    title: "۲. ماهیت محصولات",
    body: "محصولات ارائه‌شده دیجیتال هستند (گیفت کارت، سی‌دی‌کی و سرویس‌های آنلاین) و پس از پرداخت موفق به‌صورت آنی تحویل داده می‌شوند.",
  },
  {
    title: "۳. قیمت و پرداخت",
    body: "قیمت‌ها به تومان نمایش داده می‌شوند و پرداخت از طریق درگاه‌های بانکی معتبر انجام می‌شود. ممکن است قیمت برای کاربران مهمان، عضو و ویژه متفاوت باشد.",
  },
  {
    title: "۴. بازگشت و استرداد",
    body: "به دلیل ماهیت دیجیتال محصولات، پس از تحویل و مشاهده کد، امکان بازگشت وجه وجود ندارد مگر در صورت اثبات معیوب‌بودن کد توسط تیم پشتیبانی.",
  },
  {
    title: "۵. مسئولیت کاربر",
    body: "مسئولیت نگهداری از اطلاعات حساب کاربری و کدهای خریداری‌شده بر عهده کاربر است. کدها را در اختیار دیگران قرار ندهید.",
  },
  {
    title: "۶. تغییر قوانین",
    body: "پیسکول این حق را دارد که قوانین را در هر زمان به‌روزرسانی کند. نسخه جاری همواره در همین صفحه در دسترس است.",
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 text-foreground sm:px-6" dir="rtl">
      <h1 className="text-4xl font-black">قوانین و مقررات</h1>
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
          href="/privacy"
          className="text-muted-foreground underline transition hover:text-foreground"
        >
          حریم خصوصی
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
