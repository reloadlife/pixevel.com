"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusChip } from "@/components/admin/kit";
import { formatToman } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

type RefundItem = {
  id: string;
  orderItemId: string | null;
  quantity: number;
  amount: string;
  restock: boolean;
};

type RefundRow = {
  id: string;
  amount: string;
  currency: string;
  reason: string | null;
  status: string;
  processedAt: string | null;
  createdAt: string;
  gatewayRef: string | null;
  items: RefundItem[];
  createdBy: { id: string; fullName: string | null; phone: string | null } | null;
  payment: { id: string; provider: string | null; amount: string } | null;
};

type OrderItem = {
  id: string;
  titleFa: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
};

interface Props {
  orderId: string;
  orderItems: OrderItem[];
  initialRefunds: RefundRow[];
  onRefunded?: () => void;
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

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderRefundPanel({ orderId, orderItems, initialRefunds, onRefunded }: Props) {
  const [rows, setRows] = useState<RefundRow[]>(initialRefunds);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state.
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [lineItems, setLineItems] = useState<
    Record<string, { checked: boolean; quantity: string; amount: string; restock: boolean }>
  >(
    Object.fromEntries(
      orderItems.map((item) => [
        item.id,
        {
          checked: false,
          quantity: String(item.quantity),
          amount: item.totalPrice,
          restock: false,
        },
      ]),
    ),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("مبلغ استرداد باید عدد مثبت باشد.");
      return;
    }

    setSubmitting(true);
    try {
      const checkedItems = orderItems
        .filter((item) => lineItems[item.id]?.checked)
        .map((item) => ({
          orderItemId: item.id,
          quantity: Number(lineItems[item.id].quantity) || 1,
          amount: lineItems[item.id].amount || item.totalPrice,
          restock: lineItems[item.id].restock,
        }));

      const res = await fetch(`/api/admin/orders/${orderId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason: reason || undefined,
          items: checkedItems.length > 0 ? checkedItems : undefined,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ایجاد استرداد ناموفق بود.");
        return;
      }

      toast.success("استرداد ثبت شد.");
      setRows(json.data.rows ?? []);
      setShowForm(false);
      setAmount("");
      setReason("");
      onRefunded?.();
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
          <RotateCcw className="h-4 w-4" />
          استردادها
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold hover:bg-zinc-50"
          >
            + استرداد جدید
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 space-y-3 border border-zinc-100 bg-zinc-50 p-3"
        >
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="refund-amount" className="mb-1 block text-xs font-bold text-zinc-600">
                مبلغ استرداد (تومان)
              </label>
              <input
                id="refund-amount"
                type="number"
                min="1"
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
                placeholder="۱۰۰۰۰۰"
                dir="ltr"
              />
            </div>
            <div className="flex-[2] min-w-[200px]">
              <label htmlFor="refund-reason" className="mb-1 block text-xs font-bold text-zinc-600">
                دلیل (اختیاری)
              </label>
              <input
                id="refund-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
                placeholder="مثلاً: مشکل کالا، درخواست مشتری..."
              />
            </div>
          </div>

          {/* Per-line items */}
          {orderItems.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold text-zinc-600">قلم‌های استرداد (اختیاری)</p>
              <div className="space-y-1.5">
                {orderItems.map((item) => {
                  const state = lineItems[item.id];
                  if (!state) return null;
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-wrap items-center gap-2 rounded border p-2 text-xs ${
                        state.checked
                          ? "border-zinc-300 bg-white"
                          : "border-zinc-100 bg-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={`ri-${item.id}`}
                        checked={state.checked}
                        onChange={(e) =>
                          setLineItems((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], checked: e.target.checked },
                          }))
                        }
                      />
                      <label htmlFor={`ri-${item.id}`} className="flex-1 cursor-pointer">
                        <span className="font-medium">{item.titleFa}</span>
                        <span className="ml-1 text-zinc-400" dir="ltr">
                          ({item.sku})
                        </span>
                      </label>
                      {state.checked && (
                        <>
                          <label className="flex items-center gap-1 text-zinc-500">
                            تعداد:
                            <input
                              type="number"
                              min="1"
                              max={item.quantity}
                              value={state.quantity}
                              onChange={(e) =>
                                setLineItems((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], quantity: e.target.value },
                                }))
                              }
                              className="w-14 border border-zinc-200 bg-white px-1 py-0.5 text-xs outline-none"
                              dir="ltr"
                            />
                          </label>
                          <label className="flex items-center gap-1 text-zinc-500">
                            مبلغ:
                            <input
                              type="number"
                              min="0"
                              value={state.amount}
                              onChange={(e) =>
                                setLineItems((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], amount: e.target.value },
                                }))
                              }
                              className="w-24 border border-zinc-200 bg-white px-1 py-0.5 text-xs outline-none"
                              dir="ltr"
                            />
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={state.restock}
                              onChange={(e) =>
                                setLineItems((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], restock: e.target.checked },
                                }))
                              }
                            />
                            بازگشت موجودی
                          </label>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold hover:bg-zinc-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {submitting ? "در حال ثبت..." : "ثبت استرداد"}
            </button>
          </div>
        </form>
      )}

      {/* History */}
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-400">استردادی ثبت نشده.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((refund) => (
            <div
              key={refund.id}
              className="flex flex-wrap items-start justify-between gap-2 border border-zinc-100 p-3 text-xs"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <StatusChip kind="refund" value={refund.status} />
                  <span className="font-bold">{formatToman(refund.amount)}</span>
                  {refund.reason && <span className="text-zinc-500">— {refund.reason}</span>}
                </div>
                {refund.gatewayRef && (
                  <div className="text-zinc-400" dir="ltr">
                    شناسه درگاه: {refund.gatewayRef}
                  </div>
                )}
                <div className="text-zinc-400">
                  {refund.createdBy?.fullName ?? refund.createdBy?.phone ?? "سیستم"} ·{" "}
                  {formatDate(refund.createdAt)}
                </div>
              </div>
              {refund.items.length > 0 && (
                <div className="text-zinc-400">
                  {refund.items.length} قلم
                  {refund.items.some((i) => i.restock) ? " (با بازگشت موجودی)" : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
