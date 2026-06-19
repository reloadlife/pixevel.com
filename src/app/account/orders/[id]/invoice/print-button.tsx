"use client";

// Small client island: triggers the browser print dialog (which also offers
// "Save as PDF"). Hidden from the printed output via the `print:hidden` class.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/80 print:hidden"
    >
      چاپ / ذخیره PDF
    </button>
  );
}
