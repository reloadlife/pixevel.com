import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "درباره ما",
  description:
    "پیسکول، فروشگاه تخصصی محصولات دیجیتال: گیفت کارت، سی‌دی‌کی بازی و سرویس‌های آنلاین با تحویل آنی.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 text-foreground sm:px-6" dir="rtl">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
        Pixevel
      </p>
      <h1 className="mt-3 text-4xl font-black">درباره پیسکول</h1>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <p>
          پیسکول یک فروشگاه آنلاین تخصصی برای خرید محصولات دیجیتال است. هدف ما این است که خرید گیفت
          کارت، سی‌دی‌کی بازی و سرویس‌های آنلاین را ساده، سریع و مطمئن کنیم.
        </p>
        <p>
          تمام محصولات دیجیتال پس از پرداخت موفق به‌صورت آنی تحویل داده می‌شوند. تیم پشتیبانی ما در
          تمام مراحل خرید کنار شماست تا تجربه‌ای روان و بی‌دردسر داشته باشید.
        </p>
        <p>
          ما به شفافیت قیمت، اصالت کالا و امنیت پرداخت اهمیت می‌دهیم و تلاش می‌کنیم همیشه بهترین قیمت
          را برای محصولات دیجیتال ارائه دهیم.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { title: "تحویل آنی", body: "کد محصول بلافاصله پس از پرداخت در دسترس شماست." },
          { title: "اصالت کالا", body: "کدها از منابع معتبر و رسمی تهیه می‌شوند." },
          { title: "پرداخت امن", body: "تراکنش‌ها از طریق درگاه‌های بانکی معتبر انجام می‌شود." },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-border bg-muted/30 p-4">
            <h2 className="text-sm font-black text-foreground">{item.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link
          href="/products"
          className="rounded-lg bg-gold px-4 py-2 font-black text-background transition hover:bg-gold-strong"
        >
          مشاهده محصولات
        </Link>
        <Link
          href="/contact"
          className="rounded-lg border border-border px-4 py-2 font-bold transition hover:bg-muted"
        >
          تماس با ما
        </Link>
      </div>
    </main>
  );
}
