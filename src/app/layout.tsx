import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { Toaster } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { CartProvider } from "@/components/shop/cart-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth";
import { listCategories } from "@/lib/catalog";
import { cn } from "@/lib/utils";

import "./globals.css";

// Persian-first: Vazirmatn is the base sans (covers Arabic + Latin).
const vazirmatn = Vazirmatn({
  variable: "--font-sans",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixevel.com";
const siteName = "پیسکول";
const siteDescription = "خرید آنی گیفت کارت اسپاتیفای، اپل، استیم و سرویس‌های دیجیتال از پیسکول.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "پیسکول | گیفت کارت و محصولات دیجیتال",
    template: "%s | پیسکول",
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName,
    title: "پیسکول | گیفت کارت و محصولات دیجیتال",
    description: siteDescription,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "پیسکول | گیفت کارت و محصولات دیجیتال",
    description: siteDescription,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, categories] = await Promise.all([getCurrentUser(), listCategories()]);
  const isPremium = Boolean(user?.isPremium);

  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      data-premium={isPremium ? "true" : "false"}
      className={cn("antialiased", vazirmatn.variable)}
    >
      <body className="min-h-dvh overflow-x-clip bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CartProvider>
            <AppShell user={user} categories={categories}>
              {children}
            </AppShell>
          </CartProvider>
          <Toaster position="top-center" dir="rtl" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
