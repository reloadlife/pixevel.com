"use client";

import { useState } from "react";
import { toast } from "sonner";

import { SettingsManagement } from "@/components/admin/settings-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SettingRow = {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  hint?: string;
  value: string;
  isSet: boolean;
  source: "db" | "env" | "default" | "unset";
  choices?: string[];
};

export function CommsSettings({ settings }: { settings: SettingRow[] }) {
  return (
    <div className="grid gap-6">
      <TestSmsForm />
      <SettingsManagement initialSettings={settings} />
    </div>
  );
}

function TestSmsForm() {
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("پیام تست پیکسوِل");
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const res = await fetch("/api/admin/comms/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, text }),
      });
      const payload = await res.json();
      if (payload.ok) {
        toast.success(`وضعیت: ${payload.data.status} — ${payload.data.message}`);
      } else {
        toast.error(payload.error?.message ?? "ارسال ناموفق بود.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <h3 className="mb-3 text-sm font-black text-gold">ارسال پیامک تست</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxxx"
          dir="ltr"
          className="h-9 max-w-44"
        />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="متن پیام"
          className="h-9 flex-1 min-w-48"
        />
        <Button type="button" size="sm" onClick={send} disabled={sending || !phone || !text}>
          ارسال
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        از ارائه‌دهنده فعال پیامک ارسال می‌شود و در گزارش‌ها با نوع «تست» ثبت می‌شود.
      </p>
    </div>
  );
}
