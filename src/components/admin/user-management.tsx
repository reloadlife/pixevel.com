"use client";

import { Check, Crown, Loader2, Pencil, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { formatToman, toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = "CUSTOMER" | "ADMIN";

type AdminUser = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  role: UserRole;
  isPremium: boolean;
  premiumAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type DetailOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
};

type DetailPayment = {
  id: string;
  status: string;
  provider: string | null;
  reference: string | null;
  amount: string;
  currency: string;
  orderId: string | null;
  paidAt: string | null;
  createdAt: string;
};

type UserDetail = {
  user: AdminUser & {
    defaultAddressLine: string | null;
    defaultCity: string | null;
    defaultProvince: string | null;
    defaultPostalCode: string | null;
  };
  stats: {
    paidOrderCount: number;
    lifetimeSpent: string;
    paidPaymentCount: number;
    paidPaymentAmount: string;
  };
  recentOrders: DetailOrder[];
  payments: DetailPayment[];
};

// ─── Status labels ──────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

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
      className={cn(
        "inline-block rounded px-2 py-0.5 text-xs font-bold",
        colors[value] ?? "bg-zinc-100 text-zinc-600",
      )}
    >
      {map[value] ?? value}
    </span>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function UserManagement({
  initialUsers,
  initialPagination,
}: {
  initialUsers: AdminUser[];
  initialPagination: Pagination;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters (committed query state).
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | UserRole>("");
  const [premiumFilter, setPremiumFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);

  const firstRender = useRef(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (premiumFilter) params.set("premium", premiumFilter);
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "بارگذاری کاربران انجام نشد.");
        return;
      }
      setUsers(json.data.users);
      setPagination(json.data.pagination);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, premiumFilter, page]);

  // Debounced refetch when filters/page change (skip the very first render —
  // initial data comes server-rendered).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(fetchUsers, 300);
    return () => clearTimeout(handle);
  }, [fetchUsers]);

  // Reset to page 1 whenever a filter changes.
  function onFilterChange(fn: () => void) {
    fn();
    setPage(1);
  }

  async function patchUser(user: AdminUser, patch: Partial<AdminUser>, successMsg: string) {
    setSavingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ذخیره کاربر انجام نشد.");
        return;
      }
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, ...json.data.user } : item)),
      );
      toast.success(successMsg);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setEditValue(user.fullName ?? "");
  }

  async function commitEdit(user: AdminUser) {
    const next = editValue.trim();
    setEditingId(null);
    if ((user.fullName ?? "") === next) return;
    await patchUser(user, { fullName: next || null }, "نام کاربر ذخیره شد.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black">مدیریت کاربران</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {toFaNumber(pagination.total)} کاربر · صفحه {toFaNumber(pagination.page)} از{" "}
            {toFaNumber(pagination.totalPages)}
          </p>
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-zinc-400" />}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="w-full border border-zinc-200 bg-white py-1.5 pr-8 pl-3 text-sm outline-none focus:border-zinc-400"
            placeholder="جستجوی نام، تلفن یا ایمیل..."
            value={search}
            onChange={(e) => onFilterChange(() => setSearch(e.target.value))}
          />
        </div>
        <select
          className="border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
          value={roleFilter}
          onChange={(e) => onFilterChange(() => setRoleFilter(e.target.value as "" | UserRole))}
        >
          <option value="">همه نقش‌ها</option>
          <option value="CUSTOMER">مشتری</option>
          <option value="ADMIN">ادمین</option>
        </select>
        <select
          className="border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
          value={premiumFilter}
          onChange={(e) =>
            onFilterChange(() => setPremiumFilter(e.target.value as "" | "true" | "false"))
          }
        >
          <option value="">همه کاربران</option>
          <option value="true">فقط پریمیوم</option>
          <option value="false">غیر پریمیوم</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-right text-xs font-bold text-zinc-500">
              <th className="px-3 py-2">نام</th>
              <th className="px-3 py-2">تلفن</th>
              <th className="px-3 py-2">ایمیل</th>
              <th className="px-3 py-2">نقش</th>
              <th className="px-3 py-2">پریمیوم</th>
              <th className="px-3 py-2">آخرین ورود</th>
              <th className="px-3 py-2">سفارش‌ها</th>
              <th className="px-3 py-2">مجموع خرید</th>
              <th className="px-3 py-2">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-400" colSpan={9}>
                  کاربری یافت نشد.
                </td>
              </tr>
            )}
            {users.map((user) => {
              const busy = savingId === user.id;
              return (
                <tr
                  key={user.id}
                  className={cn(
                    "cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50",
                    selectedId === user.id && "bg-zinc-50",
                  )}
                  onClick={() => setSelectedId(user.id)}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {editingId === user.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={(el) => el?.focus()}
                          className="w-32 border border-zinc-300 px-1.5 py-1 text-sm outline-none focus:border-zinc-500"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(user);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => commitEdit(user)}
                          aria-label="ذخیره"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="text-zinc-400 hover:text-zinc-600"
                          onClick={() => setEditingId(null)}
                          aria-label="انصراف"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="group flex items-center gap-1.5 text-right font-medium"
                        onClick={() => startEdit(user)}
                      >
                        {user.fullName ?? <span className="text-zinc-400">بدون نام</span>}
                        <Pencil className="size-3 text-zinc-300 group-hover:text-zinc-500" />
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                    {user.phone ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500" dir="ltr">
                    {user.email ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold",
                        user.role === "ADMIN"
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600",
                      )}
                    >
                      {user.role === "ADMIN" && <ShieldCheck className="size-3" />}
                      {user.role === "ADMIN" ? "ادمین" : "مشتری"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {user.isPremium ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        <Crown className="size-3" />
                        {formatDate(user.premiumAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {formatDate(user.lastLoginAt)}
                  </td>
                  <td className="px-3 py-2">{toFaNumber(user.orderCount)}</td>
                  <td className="px-3 py-2 font-medium">{formatToman(user.totalSpent)}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          patchUser(
                            user,
                            { role: user.role === "ADMIN" ? "CUSTOMER" : "ADMIN" },
                            "نقش کاربر تغییر کرد.",
                          )
                        }
                        className="flex items-center gap-1 border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50"
                      >
                        {busy && <Loader2 className="size-3 animate-spin" />}
                        {user.role === "ADMIN" ? "حذف ادمین" : "ادمین کن"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          patchUser(
                            user,
                            { isPremium: !user.isPremium },
                            user.isPremium ? "پریمیوم لغو شد." : "پریمیوم فعال شد.",
                          )
                        }
                        className={cn(
                          "flex items-center gap-1 border px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50",
                          user.isPremium
                            ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100",
                        )}
                      >
                        <Crown className="size-3" />
                        {user.isPremium ? "لغو پریمیوم" : "پریمیوم"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="border border-zinc-200 bg-white px-3 py-1.5 text-sm font-bold disabled:opacity-40"
          >
            قبلی
          </button>
          <span className="text-xs text-zinc-500">
            صفحه {toFaNumber(pagination.page)} از {toFaNumber(pagination.totalPages)}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="border border-zinc-200 bg-white px-3 py-1.5 text-sm font-bold disabled:opacity-40"
          >
            بعدی
          </button>
        </div>
      )}

      {selectedId && <UserDetailDrawer userId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// ─── Detail drawer ──────────────────────────────────────────────────────────────

function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/admin/users/${userId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json.ok) {
          setDetail(json.data);
        } else {
          toast.error(json.error?.message ?? "بارگذاری کاربر انجام نشد.");
          onClose();
        }
      })
      .catch(() => {
        if (active) {
          toast.error("خطا در ارتباط با سرور.");
          onClose();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <aside className="relative ml-0 h-full w-full max-w-md overflow-y-auto border-l border-zinc-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <h3 className="text-sm font-black">جزئیات کاربر</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700"
            aria-label="بستن"
          >
            <X className="size-5" />
          </button>
        </div>

        {loading || !detail ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {/* Identity */}
            <div className="border border-zinc-200 p-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-black">{detail.user.fullName ?? "بدون نام"}</span>
                {detail.user.role === "ADMIN" && (
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs font-bold text-white">
                    <ShieldCheck className="size-3" />
                    ادمین
                  </span>
                )}
                {detail.user.isPremium && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">
                    <Crown className="size-3" />
                    پریمیوم
                  </span>
                )}
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <DetailRow label="تلفن" value={detail.user.phone ?? "—"} dir="ltr" />
                <DetailRow label="ایمیل" value={detail.user.email ?? "—"} dir="ltr" />
                <DetailRow label="عضویت" value={formatDate(detail.user.createdAt)} />
                <DetailRow label="آخرین ورود" value={formatDateTime(detail.user.lastLoginAt)} />
                {detail.user.isPremium && (
                  <DetailRow label="پریمیوم از" value={formatDate(detail.user.premiumAt)} />
                )}
                {detail.user.defaultAddressLine && (
                  <DetailRow
                    label="آدرس"
                    value={[
                      detail.user.defaultProvince,
                      detail.user.defaultCity,
                      detail.user.defaultAddressLine,
                      detail.user.defaultPostalCode,
                    ]
                      .filter(Boolean)
                      .join("، ")}
                  />
                )}
              </dl>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <Stat label="سفارش پرداخت‌شده" value={toFaNumber(detail.stats.paidOrderCount)} />
              <Stat label="مجموع خرید" value={formatToman(detail.stats.lifetimeSpent)} />
              <Stat label="پرداخت موفق" value={toFaNumber(detail.stats.paidPaymentCount)} />
              <Stat label="جمع پرداخت‌ها" value={formatToman(detail.stats.paidPaymentAmount)} />
            </div>

            {/* Recent orders */}
            <div>
              <h4 className="mb-2 text-xs font-black text-zinc-500">سفارش‌های اخیر</h4>
              {detail.recentOrders.length === 0 ? (
                <p className="text-sm text-zinc-400">سفارشی ثبت نشده.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between gap-2 border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold" dir="ltr">
                          {order.orderNumber}
                        </div>
                        <div className="text-xs text-zinc-400">{formatDate(order.createdAt)}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-medium">{formatToman(order.totalAmount)}</span>
                        <StatusBadge
                          value={order.status}
                          map={ORDER_STATUS_LABEL}
                          colors={ORDER_STATUS_COLOR}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Payment history */}
            <div>
              <h4 className="mb-2 text-xs font-black text-zinc-500">پرداخت‌های اخیر</h4>
              {detail.payments.length === 0 ? (
                <p className="text-sm text-zinc-400">پرداختی ثبت نشده.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-2 border border-zinc-200 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{formatToman(payment.amount)}</div>
                        <div className="text-xs text-zinc-400">
                          {formatDate(payment.paidAt ?? payment.createdAt)}
                          {payment.provider ? ` · ${payment.provider}` : ""}
                        </div>
                      </div>
                      <StatusBadge
                        value={payment.status}
                        map={PAYMENT_STATUS_LABEL}
                        colors={PAYMENT_STATUS_COLOR}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function DetailRow({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-20 shrink-0 text-xs text-zinc-500">{label}</dt>
      <dd className="flex-1 break-words" dir={dir}>
        {value}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 p-2.5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 font-bold">{value}</p>
    </div>
  );
}
