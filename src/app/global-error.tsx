"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. It replaces the root layout when active, so it must
 * render its own <html>/<body> and cannot depend on global CSS or providers.
 * Styling is inlined to stay self-contained. Persian + RTL to match the app.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0b0b10",
          color: "#f5f5f5",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <title>خطا | پیسکول</title>
          <p style={{ fontSize: "2.5rem", fontWeight: 900, color: "#d9b15e", margin: 0 }}>خطا</p>
          <h1 style={{ marginTop: "1rem", fontSize: "1.5rem", fontWeight: 800 }}>مشکلی پیش آمد</h1>
          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", lineHeight: 1.7, opacity: 0.8 }}>
            متأسفیم، خطایی غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.5rem",
              border: "none",
              borderRadius: "0.5rem",
              background: "#d9b15e",
              color: "#0b0b10",
              fontWeight: 900,
              fontSize: "0.875rem",
              padding: "0.625rem 1.25rem",
              cursor: "pointer",
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
