"use client";

import { useState } from "react";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mr-2 rounded border border-border px-2 py-0.5 text-xs font-medium transition-colors hover:bg-muted"
    >
      {copied ? "کپی شد ✓" : "کپی"}
    </button>
  );
}
