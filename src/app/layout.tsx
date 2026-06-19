import type { Metadata } from "next";
import { Geist_Mono, Vazirmatn } from "next/font/google";

import { CartProvider } from "@/components/shop/cart-provider";
import { SiteChrome } from "@/components/shop/site-chrome";
import { getCurrentUser } from "@/lib/auth";

import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "پیسکول | گیفت کارت و محصولات دیجیتال",
  description: "خرید آنی گیفت کارت اسپاتیفای، اپل، استیم و سرویس‌های دیجیتال از پیسکول.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const isPremium = Boolean(user?.isPremium);

  return (
    <html
      lang="fa"
      dir="rtl"
      data-premium={isPremium ? "true" : "false"}
      className={`${isPremium ? "dark" : ""} ${vazirmatn.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <CartProvider>
          <SiteChrome user={user} />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
