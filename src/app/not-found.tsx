import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="mx-auto grid min-h-[70dvh] w-full max-w-2xl place-items-center px-4 py-16 text-center text-foreground sm:px-6"
      dir="rtl"
    >
      <div>
        <p className="text-7xl font-black tracking-tight text-gold sm:text-8xl">۴۰۴</p>
        <h1 className="mt-4 text-2xl font-black">صفحه پیدا نشد</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          آدرسی که دنبال آن بودید وجود ندارد یا جابه‌جا شده است. می‌توانید به خانه برگردید یا در
          محصولات جستجو کنید.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href="/"
            className="rounded-lg bg-gold px-5 py-2.5 font-black text-background transition hover:bg-gold-strong"
          >
            بازگشت به خانه
          </Link>
          <Link
            href="/products"
            className="rounded-lg border border-border px-5 py-2.5 font-bold transition hover:bg-muted"
          >
            جستجوی محصولات
          </Link>
        </div>
      </div>
    </main>
  );
}
