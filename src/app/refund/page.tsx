import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "رویه بازگشت وجه",
  description: "شرایط و رویه بازگشت وجه و تعویض کد در فروشگاه دیجیتال پیسکول.",
  alternates: { canonical: "/refund" },
};

const sections = [
  {
    title: "۱. اصل کلی",
    body: "محصولات پیسکول دیجیتال هستند (گیفت‌کارت، سی‌دی‌کی، دامنه و سرور) و پس از تحویل و نمایش کد، به‌دلیل ماهیت مصرف‌شدنی آن‌ها امکان بازگشت وجه به‌صورت عمومی وجود ندارد. استثناها در ادامه آمده است.",
  },
  {
    title: "۲. کد معیوب یا نامعتبر",
    body: "اگر کد دریافتی کار نکند یا قبلاً استفاده شده باشد، تا ۷۲ ساعت پس از خرید با ثبت تیکت پشتیبانی موضوع را بررسی می‌کنیم. در صورت تأیید، کد سالم جایگزین یا کل مبلغ بازگردانده می‌شود.",
  },
  {
    title: "۳. پرداخت ناموفق یا کسر دوگانه",
    body: "اگر مبلغ از حساب شما کسر شده ولی سفارش ثبت نشده، مبلغ به‌صورت خودکار طی حداکثر ۷۲ ساعت توسط درگاه بانکی بازمی‌گردد. در صورت عدم بازگشت، با پشتیبانی تماس بگیرید.",
  },
  {
    title: "۴. دامنه و سرور",
    body: "پس از ثبت دامنه نزد ثبت‌کننده یا فعال‌سازی سرور، هزینه قابل استرداد نیست؛ چون منابع نزد سرویس‌دهنده تخصیص داده شده است. پیش از تکمیل خرید، نام دامنه و مشخصات پلن را با دقت بررسی کنید.",
  },
  {
    title: "۵. روش بازگشت وجه",
    body: "مبلغ تأییدشده به انتخاب شما به کیف پول پیسکول (آنی) یا به کارت بانکی پرداخت‌کننده (طی ۳ تا ۷ روز کاری) بازگردانده می‌شود.",
  },
  {
    title: "۶. نحوه ثبت درخواست",
    body: "از بخش «پشتیبانی» در حساب کاربری یک تیکت با شماره سفارش ثبت کنید یا از صفحه تماس با ما اقدام کنید. درخواست‌ها در کوتاه‌ترین زمان بررسی می‌شوند.",
  },
];

export default function RefundPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 text-foreground sm:px-6" dir="rtl">
      <h1 className="text-4xl font-black">رویه بازگشت وجه</h1>
      <p className="mt-3 text-sm text-muted-foreground">آخرین به‌روزرسانی: خرداد ۱۴۰۵</p>

      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-black">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link
          href="/account/support"
          className="text-muted-foreground underline transition hover:text-foreground"
        >
          ثبت تیکت پشتیبانی
        </Link>
        <Link
          href="/terms"
          className="text-muted-foreground underline transition hover:text-foreground"
        >
          قوانین و مقررات
        </Link>
        <Link href="/" className="text-muted-foreground underline transition hover:text-foreground">
          بازگشت به خانه
        </Link>
      </div>
    </main>
  );
}
