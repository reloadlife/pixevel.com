"use client";

import {
  Award,
  ChevronDown,
  Coins,
  Crown,
  Loader2,
  Minus,
  Plus,
  Search,
  Wallet as WalletIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatToman, toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types (mirror the API serialisers) ───────────────────────────────────────

type BalanceUser = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  isPremium: boolean;
  createdAt: string;
  walletBalance: string;
  walletCurrency: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
  tierLabel: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type WalletTxn = {
  id: string;
  direction: "CREDIT" | "DEBIT";
  reason: string;
  reasonLabel: string;
  amount: string;
  balanceAfter: string;
  note: string | null;
  createdAt: string;
};

type LoyaltyTxn = {
  id: string;
  points: number;
  reason: string;
  note: string | null;
  createdAt: string;
};

type Ledger = {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    fullName: string | null;
    isPremium: boolean;
    createdAt: string;
  };
  wallet: { balance: string; currency: string };
  loyalty: {
    pointsBalance: number;
    lifetimePoints: number;
    tier: string;
    tierLabel: string;
  };
  walletTransactions: WalletTxn[];
  loyaltyTransactions: LoyaltyTxn[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Main component ─────────────────────────────────────────────────────────────

export function BalanceManagement({
  initialUsers,
  initialPagination,
}: {
  initialUsers: BalanceUser[];
  initialPagination: Pagination;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const firstRender = useRef(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/admin/balances?${params.toString()}`);
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
  }, [search, page]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(fetchUsers, 300);
    return () => clearTimeout(handle);
  }, [fetchUsers]);

  // Replace a single user's summary in the table (after an adjustment refresh).
  const onUserUpdated = useCallback((ledger: Ledger) => {
    setUsers((current) =>
      current.map((item) =>
        item.id === ledger.user.id
          ? {
              ...item,
              walletBalance: ledger.wallet.balance,
              walletCurrency: ledger.wallet.currency,
              pointsBalance: ledger.loyalty.pointsBalance,
              lifetimePoints: ledger.loyalty.lifetimePoints,
              tier: ledger.loyalty.tier,
              tierLabel: ledger.loyalty.tierLabel,
            }
          : item,
      ),
    );
  }, []);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black">کیف پول و امتیاز</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {toFaNumber(pagination.total)} کاربر · صفحه {toFaNumber(pagination.page)} از{" "}
            {toFaNumber(pagination.totalPages)}
          </p>
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full rounded-2xl border border-border bg-background py-2 pr-8 pl-3 text-sm outline-none focus:border-ring"
          placeholder="جستجوی نام، تلفن یا ایمیل..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr className="[&>th]:p-3 [&>th]:text-start [&>th]:font-bold">
              <th>کاربر</th>
              <th>موجودی کیف پول</th>
              <th>امتیاز</th>
              <th>سطح</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={5}>
                  کاربری یافت نشد.
                </td>
              </tr>
            )}
            {users.map((user) => {
              const expanded = expandedId === user.id;
              return (
                <BalanceRow
                  key={user.id}
                  user={user}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : user.id)}
                  onUserUpdated={onUserUpdated}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            قبلی
          </Button>
          <span className="text-xs text-muted-foreground">
            صفحه {toFaNumber(pagination.page)} از {toFaNumber(pagination.totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Table row (collapsible into a detail panel) ───────────────────────────────

function BalanceRow({
  user,
  expanded,
  onToggle,
  onUserUpdated,
}: {
  user: BalanceUser;
  expanded: boolean;
  onToggle: () => void;
  onUserUpdated: (ledger: Ledger) => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "cursor-pointer border-t border-border/60 hover:bg-muted/40",
          expanded && "bg-muted/40",
        )}
        onClick={onToggle}
      >
        <td className="p-3">
          <div className="flex items-center gap-1.5 font-medium">
            {user.fullName ?? <span className="text-muted-foreground">بدون نام</span>}
            {user.isPremium && <Crown className="size-3.5 text-amber-500" />}
          </div>
          <div className="font-mono text-xs text-muted-foreground" dir="ltr">
            {user.phone ?? user.email ?? "—"}
          </div>
        </td>
        <td className="p-3 font-medium">{formatToman(user.walletBalance)}</td>
        <td className="p-3">
          <span className="inline-flex items-center gap-1">
            <Coins className="size-3.5 text-muted-foreground" />
            {toFaNumber(user.pointsBalance)}
          </span>
        </td>
        <td className="p-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
            <Award className="size-3" />
            {user.tierLabel}
          </span>
        </td>
        <td className="p-3 text-muted-foreground">
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border/60 bg-muted/20">
          <td colSpan={5} className="p-3 md:p-4">
            <BalanceDetail userId={user.id} onUserUpdated={onUserUpdated} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Expanded detail: ledger + two adjust forms ────────────────────────────────

function BalanceDetail({
  userId,
  onUserUpdated,
}: {
  userId: string;
  onUserUpdated: (ledger: Ledger) => void;
}) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLedger = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/balances/${userId}`);
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "بارگذاری اطلاعات انجام نشد.");
        return;
      }
      setLedger(json.data);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    loadLedger();
  }, [loadLedger]);

  // After a successful adjustment the API returns the fresh ledger.
  const applyLedger = useCallback(
    (next: Ledger) => {
      setLedger(next);
      onUserUpdated(next);
    },
    [onUserUpdated],
  );

  if (loading || !ledger) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Adjust forms */}
      <div className="grid gap-3 md:grid-cols-2">
        <WalletAdjustForm userId={userId} balance={ledger.wallet.balance} onApplied={applyLedger} />
        <LoyaltyAdjustForm
          userId={userId}
          points={ledger.loyalty.pointsBalance}
          onApplied={applyLedger}
        />
      </div>

      {/* Ledgers */}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-black text-muted-foreground">گردش کیف پول</h4>
          {ledger.walletTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">تراکنشی ثبت نشده.</p>
          ) : (
            <div className="space-y-1.5">
              {ledger.walletTransactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span
                        className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-xs font-bold",
                          txn.direction === "CREDIT"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800",
                        )}
                      >
                        {txn.direction === "CREDIT" ? "افزایش" : "کاهش"}
                      </span>
                      {formatToman(txn.amount)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {txn.reasonLabel}
                      {txn.note ? ` · ${txn.note}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <div className="text-xs text-muted-foreground">
                      {formatToman(txn.balanceAfter)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(txn.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-xs font-black text-muted-foreground">گردش امتیاز</h4>
          {ledger.loyaltyTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">تراکنشی ثبت نشده.</p>
          ) : (
            <div className="space-y-1.5">
              {ledger.loyaltyTransactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div
                      className={cn(
                        "font-medium",
                        txn.points >= 0 ? "text-green-700" : "text-red-700",
                      )}
                    >
                      {txn.points >= 0 ? "+" : ""}
                      {toFaNumber(txn.points)} امتیاز
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {txn.note ?? txn.reason}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(txn.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Wallet adjust form ────────────────────────────────────────────────────────

function WalletAdjustForm({
  userId,
  balance,
  onApplied,
}: {
  userId: string;
  balance: string;
  onApplied: (ledger: Ledger) => void;
}) {
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      toast.error("مبلغ باید عددی بزرگ‌تر از صفر باشد.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/balances/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "wallet",
          direction,
          amount: value,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "اعمال تغییر انجام نشد.");
        return;
      }
      onApplied(json.data);
      setAmount("");
      setNote("");
      toast.success(direction === "CREDIT" ? "کیف پول شارژ شد." : "از کیف پول کسر شد.");
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-black">
        <WalletIcon className="size-4 text-muted-foreground" />
        اصلاح کیف پول
        <span className="ms-auto text-xs font-medium text-muted-foreground">
          {formatToman(balance)}
        </span>
      </div>
      <div className="flex gap-1.5">
        <Button
          variant={direction === "CREDIT" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setDirection("CREDIT")}
        >
          <Plus className="size-3.5" />
          افزایش
        </Button>
        <Button
          variant={direction === "DEBIT" ? "destructive" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setDirection("DEBIT")}
        >
          <Minus className="size-3.5" />
          کاهش
        </Button>
      </div>
      <input
        type="number"
        min={1}
        inputMode="numeric"
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        placeholder="مبلغ (تومان)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        placeholder="یادداشت (اختیاری)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button className="mt-2 w-full font-black" disabled={saving} onClick={submit}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        ثبت تغییر
      </Button>
    </div>
  );
}

// ─── Loyalty adjust form ───────────────────────────────────────────────────────

function LoyaltyAdjustForm({
  userId,
  points,
  onApplied,
}: {
  userId: string;
  points: number;
  onApplied: (ledger: Ledger) => void;
}) {
  const [sign, setSign] = useState<"add" | "sub">("add");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const magnitude = Number(value);
    if (!Number.isInteger(magnitude) || magnitude <= 0) {
      toast.error("تعداد امتیاز باید عددی بزرگ‌تر از صفر باشد.");
      return;
    }
    const signed = sign === "add" ? magnitude : -magnitude;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/balances/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "loyalty",
          points: signed,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "اعمال تغییر انجام نشد.");
        return;
      }
      onApplied(json.data);
      setValue("");
      setNote("");
      toast.success(sign === "add" ? "امتیاز افزوده شد." : "امتیاز کسر شد.");
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-black">
        <Coins className="size-4 text-muted-foreground" />
        اصلاح امتیاز
        <span className="ms-auto text-xs font-medium text-muted-foreground">
          {toFaNumber(points)} امتیاز
        </span>
      </div>
      <div className="flex gap-1.5">
        <Button
          variant={sign === "add" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setSign("add")}
        >
          <Plus className="size-3.5" />
          افزودن
        </Button>
        <Button
          variant={sign === "sub" ? "destructive" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setSign("sub")}
        >
          <Minus className="size-3.5" />
          کسر
        </Button>
      </div>
      <input
        type="number"
        min={1}
        inputMode="numeric"
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        placeholder="تعداد امتیاز"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <input
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        placeholder="یادداشت (اختیاری)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button className="mt-2 w-full font-black" disabled={saving} onClick={submit}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        ثبت تغییر
      </Button>
    </div>
  );
}
