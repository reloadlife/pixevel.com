"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Package,
  RotateCcw,
  Search,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatToman } from "@/lib/format";

// ─── Types ───────────────────────────────────────────────────────────────────

type LatestPayment = {
  status: string;
  amount: string;
  receiptUrl: string | null;
  paidAt: Date | string | null;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  currency: string;
  customerName: string | null;
  customerPhone: string | null;
  itemCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  latestPayment: LatestPayment | null;
};

type InventoryUnit = {
  id: string;
  code: string;
  status: string;
  variantId: string;
  soldAt: Date | string | null;
  variant: {
    id: string;
    sku: string;
    titleFa: string;
  } | null;
};

type OrderItem = {
  id: string;
  titleFa: string;
  sku: string;
  colorNameFa: string;
  materialNameFa: string;
  size: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  variantId: string | null;
  variant: {
    id: string;
    sku: string;
    titleFa: string;
    colorNameFa: string;
    materialNameFa: string;
    size: string;
  } | null;
};

type Payment = {
  id: string;
  status: string;
  provider: string | null;
  reference: string | null;
  receiptUrl: string | null;
  amount: string;
  currency: string;
  paidAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  subtotalAmount: string;
  shippingAmount: string;
  discountAmount: string;
  totalAmount: string;
  customerName: string | null;
  customerPhone: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    phone: string | null;
    fullName: string | null;
    isPremium: boolean;
  } | null;
  payments: Payment[];
  items: OrderItem[];
  inventoryUnits: InventoryUnit[];
};

// ─── Status labels ────────────────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "در انتظار",
  PAID: "پرداخت شده",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  REFUNDED: "مسترد شده",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: "پرداخت نشده",
  AUTHORIZED: "تأیید شده",
  PAID: "پرداخت شده",
  FAILED: "ناموفق",
  REFUNDED: "مسترد شده",
};

const INVENTORY_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "موجود",
  RESERVED: "رزرو شده",
  SOLD: "فروخته شده",
  DAMAGED: "معیوب",
};

const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-zinc-100 text-zinc-600",
  REFUNDED: "bg-red-100 text-red-800",
};

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  UNPAID: "bg-yellow-100 text-yellow-800",
  AUTHORIZED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-orange-100 text-orange-800",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({
  value,
  map,
  colors,
}: {
  value: string;
  map: Record<string, string>;
  colors: Record<string, string>;
}) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${colors[value] ?? "bg-zinc-100 text-zinc-600"}`}
    >
      {map[value] ?? value}
    </span>
  );
}

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// ─── Order list ───────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  "",
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;
const PAYMENT_STATUSES = ["", "UNPAID", "AUTHORIZED", "PAID", "FAILED", "REFUNDED"] as const;

function OrderList({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const filtered = initialOrders.filter((order) => {
    if (statusFilter && order.status !== statusFilter) return false;
    if (paymentFilter && order.paymentStatus !== paymentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        (order.customerName ?? "").toLowerCase().includes(q) ||
        (order.customerPhone ?? "").includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-black">سفارش‌ها</h2>
        <span className="text-xs text-zinc-500">{filtered.length} سفارش</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            className="w-full border border-zinc-200 bg-white py-1.5 pr-8 pl-3 text-sm outline-none focus:border-zinc-400"
            placeholder="شماره، نام یا تلفن..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">همه وضعیت‌ها</option>
          {ORDER_STATUSES.slice(1).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
        <select
          className="border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
        >
          <option value="">همه پرداخت‌ها</option>
          {PAYMENT_STATUSES.slice(1).map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-right text-xs font-bold text-zinc-500">
              <th className="px-3 py-2">شماره سفارش</th>
              <th className="px-3 py-2">مشتری</th>
              <th className="px-3 py-2">مبلغ</th>
              <th className="px-3 py-2">وضعیت سفارش</th>
              <th className="px-3 py-2">وضعیت پرداخت</th>
              <th className="px-3 py-2">تاریخ</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-400" colSpan={7}>
                  سفارشی یافت نشد.
                </td>
              </tr>
            )}
            {filtered.map((order) => (
              <tr
                key={order.id}
                className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
              >
                <td className="px-3 py-2 font-mono text-xs font-bold" dir="ltr">
                  {order.orderNumber}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{order.customerName ?? "—"}</div>
                  <div className="text-xs text-zinc-400" dir="ltr">
                    {order.customerPhone ?? "—"}
                  </div>
                </td>
                <td className="px-3 py-2 font-medium">{formatToman(order.totalAmount)}</td>
                <td className="px-3 py-2">
                  <StatusBadge
                    value={order.status}
                    map={ORDER_STATUS_LABEL}
                    colors={ORDER_STATUS_COLOR}
                  />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    value={order.paymentStatus}
                    map={PAYMENT_STATUS_LABEL}
                    colors={PAYMENT_STATUS_COLOR}
                  />
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">{formatDate(order.createdAt)}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    مشاهده
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Order detail ─────────────────────────────────────────────────────────────

function OrderDetail({ initialOrder }: { initialOrder: OrderDetail }) {
  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doAction(action: string, extra?: Record<string, string>) {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });

      const json = await res.json();

      if (!json.ok) {
        setError(json.error?.message ?? "خطای ناشناخته");
      } else {
        setOrder(json.data.order);
      }
    } catch {
      setError("خطا در ارتباط با سرور.");
    } finally {
      setLoading(null);
    }
  }

  function ActionButton({
    action,
    label,
    icon,
    variant = "outline",
    extra,
  }: {
    action: string;
    label: string;
    icon: React.ReactNode;
    variant?: "outline" | "destructive";
    extra?: Record<string, string>;
  }) {
    const isLoading = loading === action;
    return (
      <button
        type="button"
        disabled={loading !== null}
        onClick={() => doAction(action, extra)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-colors disabled:opacity-50 ${
          variant === "destructive"
            ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100"
        }`}
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
        {label}
      </button>
    );
  }

  const latestPayment = order.payments[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/orders"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          سفارش‌ها
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="font-mono text-xs font-bold" dir="ltr">
          {order.orderNumber}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 border border-zinc-200 bg-white p-4 sm:grid-cols-4">
        <div>
          <p className="mb-0.5 text-xs text-zinc-500">وضعیت سفارش</p>
          <StatusBadge value={order.status} map={ORDER_STATUS_LABEL} colors={ORDER_STATUS_COLOR} />
        </div>
        <div>
          <p className="mb-0.5 text-xs text-zinc-500">وضعیت پرداخت</p>
          <StatusBadge
            value={order.paymentStatus}
            map={PAYMENT_STATUS_LABEL}
            colors={PAYMENT_STATUS_COLOR}
          />
        </div>
        <div>
          <p className="mb-0.5 text-xs text-zinc-500">مبلغ کل</p>
          <p className="font-bold">{formatToman(order.totalAmount)}</p>
        </div>
        <div>
          <p className="mb-0.5 text-xs text-zinc-500">تاریخ ثبت</p>
          <p className="text-sm">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 border border-zinc-200 bg-white p-3">
        <ActionButton
          action="confirm"
          label="تأیید پرداخت"
          icon={<CheckCircle className="h-3.5 w-3.5" />}
        />
        <ActionButton action="ship" label="ارسال شد" icon={<Truck className="h-3.5 w-3.5" />} />
        <ActionButton
          action="deliver"
          label="تحویل داده شد"
          icon={<Package className="h-3.5 w-3.5" />}
        />
        <ActionButton
          action="cancel"
          label="لغو سفارش"
          icon={<XCircle className="h-3.5 w-3.5" />}
          variant="destructive"
        />
        <ActionButton
          action="refund"
          label="استرداد"
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          variant="destructive"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Customer info */}
        <div className="border border-zinc-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-black">اطلاعات مشتری</h3>
          <dl className="space-y-1.5 text-sm">
            <Row label="نام" value={order.customerName ?? order.user?.fullName ?? "—"} />
            <Row label="تلفن" value={order.customerPhone ?? order.user?.phone ?? "—"} dir="ltr" />
            <Row label="آدرس" value={order.addressLine ?? "—"} />
            <Row label="شهر" value={order.city ?? "—"} />
            <Row label="استان" value={order.province ?? "—"} />
            <Row label="کد پستی" value={order.postalCode ?? "—"} />
          </dl>
        </div>

        {/* Payment info */}
        <div className="border border-zinc-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-black">پرداخت</h3>
          {latestPayment ? (
            <dl className="space-y-1.5 text-sm">
              <Row label="وضعیت">
                <StatusBadge
                  value={latestPayment.status}
                  map={PAYMENT_STATUS_LABEL}
                  colors={PAYMENT_STATUS_COLOR}
                />
              </Row>
              <Row label="مبلغ" value={formatToman(latestPayment.amount)} />
              <Row label="تاریخ پرداخت" value={formatDate(latestPayment.paidAt)} />
              <Row label="مرجع" value={latestPayment.reference ?? "—"} dir="ltr" />
              {latestPayment.receiptUrl && (
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-500">تصویر رسید</p>
                  <a
                    href={latestPayment.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={latestPayment.receiptUrl}
                      alt="تصویر رسید"
                      className="max-h-48 border border-zinc-200 object-contain"
                    />
                  </a>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-zinc-400">پرداختی ثبت نشده.</p>
          )}
        </div>
      </div>

      {/* Order items */}
      <div className="border border-zinc-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-black">اقلام سفارش</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs font-bold text-zinc-500">
                <th className="py-2 pr-0">محصول</th>
                <th className="py-2 px-3">رنگ / جنس / سایز</th>
                <th className="py-2 px-3">تعداد</th>
                <th className="py-2 px-3">قیمت واحد</th>
                <th className="py-2 px-3">جمع</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-50">
                  <td className="py-2 pr-0">
                    <div className="font-medium">{item.titleFa}</div>
                    <div className="text-xs text-zinc-400" dir="ltr">
                      {item.sku}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-xs text-zinc-600">
                    {item.colorNameFa} / {item.materialNameFa} / {item.size}
                  </td>
                  <td className="py-2 px-3">{item.quantity}</td>
                  <td className="py-2 px-3">{formatToman(item.unitPrice)}</td>
                  <td className="py-2 px-3 font-bold">{formatToman(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 font-bold">
                <td className="py-2 pr-0 text-xs text-zinc-500" colSpan={4}>
                  جمع کل
                </td>
                <td className="py-2 px-3">{formatToman(order.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Inventory units */}
      {order.inventoryUnits.length > 0 && (
        <div className="border border-zinc-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-black">واحدهای موجودی تخصیص‌یافته</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-right text-xs font-bold text-zinc-500">
                  <th className="py-2 pr-0">کد</th>
                  <th className="py-2 px-3">تنوع</th>
                  <th className="py-2 px-3">وضعیت</th>
                  <th className="py-2 px-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {order.inventoryUnits.map((unit) => (
                  <tr key={unit.id} className="border-b border-zinc-50">
                    <td className="py-2 pr-0 font-mono text-xs" dir="ltr">
                      {unit.code}
                    </td>
                    <td className="py-2 px-3 text-xs text-zinc-600">
                      {unit.variant?.titleFa ?? unit.variantId}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${
                          unit.status === "SOLD"
                            ? "bg-green-100 text-green-800"
                            : unit.status === "DAMAGED"
                              ? "bg-red-100 text-red-800"
                              : unit.status === "RESERVED"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {INVENTORY_STATUS_LABEL[unit.status] ?? unit.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {unit.status !== "DAMAGED" && (
                        <button
                          type="button"
                          disabled={loading !== null}
                          onClick={() => doAction("damage_unit", { unitId: unit.id })}
                          className="flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {loading === "damage_unit" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          معیوب
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  dir,
  children,
}: {
  label: string;
  value?: string;
  dir?: "ltr" | "rtl";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-24 shrink-0 text-xs text-zinc-500">{label}</dt>
      <dd className="flex-1" dir={dir}>
        {children ?? value ?? "—"}
      </dd>
    </div>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────

type OrderManagementProps =
  | { mode: "list"; initialOrders: OrderRow[]; initialOrder?: never }
  | { mode: "detail"; initialOrder: OrderDetail; initialOrders?: never };

export function OrderManagement(props: OrderManagementProps) {
  if (props.mode === "detail" && props.initialOrder) {
    return <OrderDetail initialOrder={props.initialOrder} />;
  }

  return <OrderList initialOrders={props.initialOrders ?? []} />;
}
