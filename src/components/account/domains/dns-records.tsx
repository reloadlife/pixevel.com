"use client";

import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DnsRecordType, DomainDnsRecord } from "@/db/schema";
import { DNS_RECORD_TYPES } from "@/lib/domains/dns";
import { cn } from "@/lib/utils";

/** A type needs an explicit priority value only for MX/SRV. */
function needsPriority(type: DnsRecordType): boolean {
  return type === "MX" || type === "SRV";
}

type FormState = {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: string;
  priority: string;
};

const EMPTY_FORM: FormState = {
  type: "A",
  name: "@",
  value: "",
  ttl: "3600",
  priority: "",
};

/** Builds the JSON body the dns endpoints expect from a form state. */
function toBody(form: FormState) {
  const body: {
    type: DnsRecordType;
    name: string;
    value: string;
    ttl: number;
    priority?: number;
  } = {
    type: form.type,
    name: form.name.trim() || "@",
    value: form.value.trim(),
    ttl: Number(form.ttl) || 3600,
  };
  if (needsPriority(form.type)) {
    body.priority = Number(form.priority);
  }
  return body;
}

const selectClass =
  "h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm text-foreground outline-none transition-[color,box-shadow] duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50";

export function DnsRecords({
  domainId,
  records,
}: {
  domainId: string;
  records: DomainDnsRecord[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function onSaved(registrarPushed: boolean, message: string) {
    if (registrarPushed === false) {
      toast.success(message, { description: "ثبت محلی انجام شد (اتصال به ثبت‌کننده برقرار نیست)." });
    } else {
      toast.success(message);
    }
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black">رکوردهای DNS</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">رکوردهای دامنه خود را مدیریت کنید.</p>
        </div>
        {!adding ? (
          <Button type="button" size="sm" onClick={() => setAdding(true)} className="gap-1.5">
            <Plus className="size-3.5" aria-hidden />
            رکورد جدید
          </Button>
        ) : null}
      </div>

      {adding ? (
        <DnsRecordForm
          submitLabel="افزودن رکورد"
          initial={EMPTY_FORM}
          onCancel={() => setAdding(false)}
          onSubmit={async (form) => {
            const res = await fetch(`/api/account/domains/${domainId}/dns`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(toBody(form)),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) {
              toast.error(json?.error?.message ?? "افزودن رکورد ممکن نشد.");
              return false;
            }
            setAdding(false);
            onSaved(json.data?.registrarPushed, "رکورد افزوده شد.");
            return true;
          }}
        />
      ) : null}

      {records.length === 0 && !adding ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">هنوز رکورد DNS ندارید.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 gap-1.5"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-3.5" aria-hidden />
            اولین رکورد را اضافه کنید
          </Button>
        </div>
      ) : null}

      {records.length > 0 ? (
        <div className="divide-y overflow-hidden rounded-2xl ring-1 ring-foreground/5">
          {records.map((record) =>
            editingId === record.id ? (
              <div key={record.id} className="bg-muted/20 p-3">
                <DnsRecordForm
                  submitLabel="ذخیره"
                  initial={{
                    type: record.type,
                    name: record.name,
                    value: record.value,
                    ttl: String(record.ttl),
                    priority: record.priority != null ? String(record.priority) : "",
                  }}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (form) => {
                    const res = await fetch(`/api/account/domains/${domainId}/dns/${record.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(toBody(form)),
                    });
                    const json = await res.json().catch(() => null);
                    if (!res.ok || !json?.ok) {
                      toast.error(json?.error?.message ?? "ویرایش رکورد ممکن نشد.");
                      return false;
                    }
                    setEditingId(null);
                    onSaved(json.data?.registrarPushed, "رکورد به‌روزرسانی شد.");
                    return true;
                  }}
                />
              </div>
            ) : (
              <DnsRecordRow
                key={record.id}
                domainId={domainId}
                record={record}
                onEdit={() => setEditingId(record.id)}
                onDeleted={(registrarPushed) => onSaved(registrarPushed, "رکورد حذف شد.")}
              />
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}

function DnsRecordRow({
  domainId,
  record,
  onEdit,
  onDeleted,
}: {
  domainId: string;
  record: DomainDnsRecord;
  onEdit: () => void;
  onDeleted: (registrarPushed: boolean) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!window.confirm(`رکورد ${record.type} با نام «${record.name}» حذف شود؟`)) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/account/domains/${domainId}/dns/${record.id}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => null);
    setDeleting(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message ?? "حذف رکورد ممکن نشد.");
      return;
    }
    onDeleted(json.data?.registrarPushed);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="inline-flex w-14 shrink-0 items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-black">
        {record.type}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold" dir="ltr">
          {record.name}
        </p>
        <p className="truncate text-xs text-muted-foreground" dir="ltr">
          {record.value}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <span>TTL {record.ttl}</span>
        {record.priority != null ? <span>اولویت {record.priority}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onEdit}
          aria-label="ویرایش رکورد"
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={remove}
          disabled={deleting}
          aria-label="حذف رکورد"
          className="text-destructive hover:text-destructive"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-3.5" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}

function DnsRecordForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormState;
  submitLabel: string;
  onSubmit: (form: FormState) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [pending, setPending] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    await onSubmit(form);
    setPending(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dns-type">نوع</Label>
          <select
            id="dns-type"
            value={form.type}
            onChange={(e) => set("type", e.target.value as DnsRecordType)}
            className={selectClass}
            dir="ltr"
          >
            {DNS_RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dns-name">نام میزبان (host)</Label>
          <Input
            id="dns-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="@ یا www"
            dir="ltr"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dns-value">مقدار</Label>
        <Input
          id="dns-value"
          value={form.value}
          onChange={(e) => set("value", e.target.value)}
          placeholder="مقدار رکورد"
          dir="ltr"
        />
      </div>

      <div className={cn("grid gap-3", needsPriority(form.type) ? "sm:grid-cols-2" : "")}>
        <div className="space-y-1.5">
          <Label htmlFor="dns-ttl">TTL (ثانیه)</Label>
          <Input
            id="dns-ttl"
            type="number"
            min={60}
            max={86400}
            value={form.ttl}
            onChange={(e) => set("ttl", e.target.value)}
            dir="ltr"
          />
        </div>
        {needsPriority(form.type) ? (
          <div className="space-y-1.5">
            <Label htmlFor="dns-priority">اولویت</Label>
            <Input
              id="dns-priority"
              type="number"
              min={0}
              max={65535}
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              placeholder="مثلاً ۱۰"
              dir="ltr"
            />
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {pending ? "در حال ذخیره…" : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="gap-1.5">
          <X className="size-3.5" aria-hidden />
          انصراف
        </Button>
      </div>
    </form>
  );
}
