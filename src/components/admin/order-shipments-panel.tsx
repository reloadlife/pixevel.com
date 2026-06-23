"use client";

import { Pencil, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusChip } from "@/components/admin/kit";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShipmentStatus = "PENDING" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "RETURNED" | "CANCELLED";

type ShipmentRow = {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  costAmount: string;
  currency: string;
  noteFa: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  method: { id: string; titleFa: string; code: string } | null;
};

interface Props {
  orderId: string;
  initialShipments: ShipmentRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FA_DATETIME = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : FA_DATETIME.format(d);
}

const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "PENDING",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "در انتظار",
  SHIPPED: "ارسال‌شده",
  IN_TRANSIT: "در مسیر",
  DELIVERED: "تحویل‌شده",
  RETURNED: "مرجوعی",
  CANCELLED: "لغوشده",
};

type ShipmentFormValues = {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  status: ShipmentStatus;
  costAmount: string;
  noteFa: string;
};

const EMPTY_FORM: ShipmentFormValues = {
  carrier: "",
  trackingNumber: "",
  trackingUrl: "",
  status: "PENDING",
  costAmount: "0",
  noteFa: "",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ShipmentForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  isEdit,
}: {
  initial: ShipmentFormValues;
  onSubmit: (values: ShipmentFormValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  isEdit: boolean;
}) {
  const [values, setValues] = useState<ShipmentFormValues>(initial);

  function field(key: keyof ShipmentFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(values);
      }}
      className="space-y-3 border border-zinc-100 bg-zinc-50 p-3"
    >
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="ship-carrier" className="mb-1 block text-xs font-bold text-zinc-600">
            پیک / شرکت حمل
          </label>
          <input
            id="ship-carrier"
            type="text"
            value={values.carrier}
            onChange={field("carrier")}
            className="w-full border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
            placeholder="مثلاً: پست، تیپاکس..."
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="ship-tracking" className="mb-1 block text-xs font-bold text-zinc-600">
            کد رهگیری
          </label>
          <input
            id="ship-tracking"
            type="text"
            value={values.trackingNumber}
            onChange={field("trackingNumber")}
            className="w-full border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
            placeholder="کد رهگیری"
            dir="ltr"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="ship-status" className="mb-1 block text-xs font-bold text-zinc-600">
            وضعیت
          </label>
          <select
            id="ship-status"
            value={values.status}
            onChange={field("status")}
            className="w-full border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
          >
            {SHIPMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex-[2] min-w-[200px]">
          <label htmlFor="ship-url" className="mb-1 block text-xs font-bold text-zinc-600">
            لینک رهگیری (اختیاری)
          </label>
          <input
            id="ship-url"
            type="url"
            value={values.trackingUrl}
            onChange={field("trackingUrl")}
            className="w-full border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
            placeholder="https://..."
            dir="ltr"
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label htmlFor="ship-cost" className="mb-1 block text-xs font-bold text-zinc-600">
            هزینه ارسال (تومان)
          </label>
          <input
            id="ship-cost"
            type="number"
            min="0"
            step="1"
            value={values.costAmount}
            onChange={field("costAmount")}
            className="w-full border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
            dir="ltr"
          />
        </div>
      </div>
      <div>
        <label htmlFor="ship-note" className="mb-1 block text-xs font-bold text-zinc-600">
          یادداشت (اختیاری)
        </label>
        <textarea
          id="ship-note"
          rows={2}
          value={values.noteFa}
          onChange={field("noteFa")}
          className="w-full border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400 resize-none"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold hover:bg-zinc-50"
        >
          انصراف
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="border border-zinc-800 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {submitting ? "در حال ذخیره..." : isEdit ? "به‌روزرسانی" : "ثبت مرسوله"}
        </button>
      </div>
    </form>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function OrderShipmentsPanel({ orderId, initialShipments }: Props) {
  const [rows, setRows] = useState<ShipmentRow[]>(initialShipments);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(values: ShipmentFormValues) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: values.carrier || null,
          trackingNumber: values.trackingNumber || null,
          trackingUrl: values.trackingUrl || null,
          status: values.status,
          costAmount: values.costAmount || "0",
          noteFa: values.noteFa || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ثبت مرسوله ناموفق بود.");
        return;
      }
      toast.success("مرسوله ثبت شد.");
      setRows(json.data.rows ?? []);
      setShowCreateForm(false);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id: string, values: ShipmentFormValues) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/shipments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: values.carrier || null,
          trackingNumber: values.trackingNumber || null,
          trackingUrl: values.trackingUrl || null,
          status: values.status,
          costAmount: values.costAmount || "0",
          noteFa: values.noteFa || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "به‌روزرسانی ناموفق بود.");
        return;
      }

      // Refetch shipments.
      const listRes = await fetch(`/api/admin/orders/${orderId}/shipments`);
      const listJson = await listRes.json();
      if (listJson.ok) setRows(listJson.data.rows ?? []);

      toast.success("مرسوله به‌روز شد.");
      setEditingId(null);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-black">
          <Truck className="h-4 w-4" />
          مرسوله‌ها
        </h3>
        {!showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1 border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold hover:bg-zinc-50"
          >
            + مرسوله جدید
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="mb-4">
          <ShipmentForm
            initial={EMPTY_FORM}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
            submitting={submitting}
            isEdit={false}
          />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-400">مرسوله‌ای ثبت نشده.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((shipment) => (
            <div key={shipment.id} className="border border-zinc-100 p-3">
              {editingId === shipment.id ? (
                <ShipmentForm
                  initial={{
                    carrier: shipment.carrier ?? "",
                    trackingNumber: shipment.trackingNumber ?? "",
                    trackingUrl: shipment.trackingUrl ?? "",
                    status: shipment.status as ShipmentStatus,
                    costAmount: shipment.costAmount ?? "0",
                    noteFa: shipment.noteFa ?? "",
                  }}
                  onSubmit={(values) => handleUpdate(shipment.id, values)}
                  onCancel={() => setEditingId(null)}
                  submitting={submitting}
                  isEdit={true}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <StatusChip kind="shipment" value={shipment.status} />
                      {shipment.carrier && <span className="font-medium">{shipment.carrier}</span>}
                    </div>
                    {shipment.trackingNumber && (
                      <div className="text-zinc-500" dir="ltr">
                        رهگیری: {shipment.trackingNumber}
                        {shipment.trackingUrl && (
                          <a
                            href={shipment.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mr-1 text-blue-600 hover:underline"
                          >
                            [لینک]
                          </a>
                        )}
                      </div>
                    )}
                    {shipment.method && (
                      <div className="text-zinc-400">{shipment.method.titleFa}</div>
                    )}
                    {shipment.noteFa && <div className="text-zinc-500">{shipment.noteFa}</div>}
                    <div className="text-zinc-400">
                      {shipment.shippedAt
                        ? `ارسال: ${formatDate(shipment.shippedAt)}`
                        : `ثبت: ${formatDate(shipment.createdAt)}`}
                      {shipment.deliveredAt ? ` · تحویل: ${formatDate(shipment.deliveredAt)}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(shipment.id)}
                    className="flex items-center gap-1 border border-zinc-200 px-2 py-1 hover:bg-zinc-50"
                    aria-label="ویرایش مرسوله"
                  >
                    <Pencil className="h-3 w-3" />
                    ویرایش
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
