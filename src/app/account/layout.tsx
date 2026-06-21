import { AccountNav } from "@/components/account/account-nav";

/**
 * Shared chrome for the entire `/account` area.
 * - Mobile: nav renders as a horizontal pill bar above the page content.
 * - `lg:` and up: a two-column grid with a sticky sidebar on the right (RTL).
 *
 * Feature pages render their own `<main>` with their own padding, so this
 * layout intentionally keeps the content cell padding-free to avoid double
 * padding. The global root layout already provides header / footer / bottom-tabs.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-8 lg:grid lg:grid-cols-[260px_1fr] lg:gap-8 lg:px-14 lg:pt-8">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AccountNav />
        </aside>
        <div className="min-w-0 pt-4 lg:pt-0">{children}</div>
      </div>
    </div>
  );
}
