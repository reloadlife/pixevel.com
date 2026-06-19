import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "پیسکول | گیفت کارت و محصولات دیجیتال",
    short_name: "پیسکول",
    description: "خرید آنی گیفت کارت، سی‌دی‌کی بازی و سرویس‌های دیجیتال از پیسکول.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "fa",
    background_color: "#0b0b10",
    theme_color: "#0b0b10",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
