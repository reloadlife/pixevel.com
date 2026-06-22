import Link from "next/link";

const SECTIONS = [
  {
    href: "/admin/communications/logs",
    title: "همه پیام‌ها",
    desc: "ارسال و دریافت همه کانال‌ها، با فیلتر و جزئیات کامل هر پیام.",
  },
  {
    href: "/admin/communications/calls",
    title: "تماس‌ها",
    desc: "تماس‌های صوتی کد یکبارمصرف و وضعیت تحویل‌شان.",
  },
  {
    href: "/admin/communications/callbacks",
    title: "کال‌بک‌ها",
    desc: "وب‌هوک‌های دریافتی ارائه‌دهنده‌ها — وضعیت تحویل و پیام‌های ورودی.",
  },
  {
    href: "/admin/communications/settings",
    title: "تنظیمات و توکن‌ها",
    desc: "ارائه‌دهنده فعال، کلیدها و رمزها، و آدرس‌های وب‌هوک.",
  },
];

export default function CommunicationsOverviewPage() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" dir="rtl">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="rounded-2xl border border-border p-4 transition hover:border-gold/50"
        >
          <p className="font-black">{s.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
        </Link>
      ))}
    </div>
  );
}
