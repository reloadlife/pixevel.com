"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * No-op contact form. There is no message endpoint yet, so submitting simply
 * acknowledges with a toast and clears the fields. Wire this to an API later
 * without changing the page's server-rendered shell.
 */
export function ContactForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      toast.error("متن پیام را وارد کنید.");
      return;
    }
    toast.success("پیام شما دریافت شد. به‌زودی پاسخ می‌دهیم.");
    setName("");
    setMessage("");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" dir="rtl">
      <div>
        <label htmlFor="contact-name" className="mb-1 block text-sm font-bold">
          نام
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          placeholder="نام شما"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="mb-1 block text-sm font-bold">
          پیام
        </label>
        <textarea
          id="contact-message"
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          placeholder="چطور می‌توانیم کمکتان کنیم؟"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-gold px-5 py-2 text-sm font-black text-background transition hover:bg-gold-strong"
      >
        ارسال پیام
      </button>
    </form>
  );
}
