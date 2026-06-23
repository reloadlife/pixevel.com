import type { Metadata } from "next";
import Link from "next/link";

import { resolveMetadata } from "@/lib/seo/resolve";

export function generateMetadata(): Promise<Metadata> {
  return resolveMetadata({ kind: "static", pathKey: "/faq" });
}

/**
 * Serializes JSON-LD for safe embedding inside a <script> tag. Escapes `<` so a
 * stray `</script>` inside any text cannot break out of the element.
 */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const faqs = [
  {
    q: "بعد از پرداخت چطور کد را دریافت می‌کنم؟",
    a: "بلافاصله پس از پرداخت موفق، کد محصول در صفحه سفارش و حساب کاربری شما نمایش داده می‌شود.",
  },
  {
    q: "اگر کد کار نکرد چه کنم؟",
    a: "با پشتیبانی تماس بگیرید. در صورت اثبات معیوب‌بودن کد، جایگزین یا وجه آن بازگردانده می‌شود.",
  },
  {
    q: "آیا برای خرید باید ثبت‌نام کنم؟",
    a: "می‌توانید بدون ورود محصولات را به سبد اضافه کنید، اما برای تکمیل خرید ورود با شماره تلفن و کد یک‌بارمصرف لازم است.",
  },
  {
    q: "روش‌های پرداخت چیست؟",
    a: "پرداخت از طریق درگاه‌های بانکی معتبر و به تومان انجام می‌شود.",
  },
  {
    q: "کاربران ویژه چه مزایایی دارند؟",
    a: "کاربران ویژه از قیمت‌های اختصاصی، حالت تیره و دسترسی به محتوای ویژه بهره‌مند می‌شوند.",
  },
];

export default function FaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 text-foreground sm:px-6" dir="rtl">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data is server-generated and escaped via jsonLd().
        dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd) }}
      />
      <h1 className="text-4xl font-black">سوالات متداول</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        پاسخ سوال‌های پرتکرار. اگر پاسخ خود را نیافتید، با پشتیبانی در تماس باشید.
      </p>

      <div className="mt-8 space-y-3">
        {faqs.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-border bg-muted/30 p-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-black text-foreground">
              {item.q}
              <span
                className="text-muted-foreground transition group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link
          href="/support"
          className="text-muted-foreground underline transition hover:text-foreground"
        >
          مرکز پشتیبانی
        </Link>
        <Link
          href="/contact"
          className="text-muted-foreground underline transition hover:text-foreground"
        >
          تماس با ما
        </Link>
      </div>
    </main>
  );
}
