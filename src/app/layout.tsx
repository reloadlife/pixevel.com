import type { Metadata } from "next";
import { Geist_Mono, Vazirmatn } from "next/font/google";

import { AppShell } from "@/components/shell/app-shell";
import { CartProvider } from "@/components/shop/cart-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

import "./globals.css";

// Persian-first: Vazirmatn is the base sans (covers Arabic + Latin).
const vazirmatn = Vazirmatn({
  variable: "--font-sans",
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
      suppressHydrationWarning
      data-premium={isPremium ? "true" : "false"}
      className={cn("h-full antialiased", vazirmatn.variable, geistMono.variable)}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CartProvider>
            <AppShell user={user}>{children}</AppShell>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
