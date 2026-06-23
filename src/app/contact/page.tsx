import type { Metadata } from "next";
import Link from "next/link";

import { resolveMetadata } from "@/lib/seo/resolve";

import { ContactForm } from "./contact-form";

export function generateMetadata(): Promise<Metadata> {
  return resolveMetadata({ kind: "static", pathKey: "/contact" });
}

const channels = [
  { label: "تلفن پشتیبانی", value: "۰۲۱-۰۰۰۰۰۰۰۰", href: "tel:+982100000000" },
  { label: "ایمیل", value: "support@pixevel.com", href: "mailto:support@pixevel.com" },
  { label: "تلگرام", value: "@pixevel", href: "https://t.me/pixevel" },
];

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 text-foreground sm:px-6" dir="rtl">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
        Pixevel
      </p>
      <h1 className="mt-3 text-4xl font-black">تماس با ما</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        سوال یا درخواستی دارید؟ از راه‌های زیر با ما در ارتباط باشید یا فرم را پر کنید.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {channels.map((channel) => (
          <a
            key={channel.label}
            href={channel.href}
            className="rounded-xl border border-border bg-muted/30 p-4 transition hover:border-foreground"
            dir="ltr"
          >
            <span className="block text-right text-xs font-bold text-muted-foreground" dir="rtl">
              {channel.label}
            </span>
            <span className="mt-1 block text-sm font-black text-foreground">{channel.value}</span>
          </a>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-black">ارسال پیام</h2>
        <ContactForm />
      </section>

      <div className="mt-10 text-sm">
        <Link
          href="/faq"
          className="text-muted-foreground underline transition hover:text-foreground"
        >
          شاید پاسخ سوال شما در سوالات متداول باشد →
        </Link>
      </div>
    </main>
  );
}
