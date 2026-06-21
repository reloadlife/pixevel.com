"use client";

import { ChevronLeft, ChevronRight, PackageOpen, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatToman } from "@/lib/format";
import type { AccountOrdersPage, OrderStatusFilter } from "@/lib/orders/account-orders";
import { orderStatusMeta, paymentStatusMeta, toneClass } from "@/lib/status-labels";
import { cn } from "@/lib/utils";

const STATUS_TABS: { value: OrderStatusFilter | "ALL"; label: string }[] = [
  { value: "ALL", label: "همه" },
  { value: "PENDING", label: "در انتظار" },
  { value: "PAID", label: "پرداخت شده" },
  { value: "PROCESSING", label: "در حال پردازش" },
  { value: "SHIPPED", label: "ارسال شده" },
  { value: "DELIVERED", label: "تحویل شده" },
  { value: "CANCELLED", label: "لغو شده" },
  { value: "REFUNDED", label: "مسترد شده" },
];

function faDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function OrdersList({ initial }: { initial: AccountOrdersPage }) {
  const [data, setData] = useState<AccountOrdersPage>(initial);
  const [status, setStatus] = useState<OrderStatusFilter | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const firstRender = useRef(true);

  const load = useCallback(
    async (nextStatus: OrderStatusFilter | "ALL", nextSearch: string, nextPage: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      if (nextStatus !== "ALL") {
        params.set("status", nextStatus);
      }
      if (nextSearch.trim()) {
        params.set("q", nextSearch.trim());
      }
      try {
        const res = await fetch(`/api/account/orders?${params.toString()}`);
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          setData(json.data as AccountOrdersPage);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounced reload whenever status / search / page changes (skip first mount).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      load(status, search, page);
    }, 300);
    return () => clearTimeout(handle);
  }, [status, search, page, load]);

  function changeStatus(next: OrderStatusFilter | "ALL") {
    setStatus(next);
    setPage(1);
  }

  function changeSearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  const hasResults = data.items.length > 0;
  const filtersActive = status !== "ALL" || search.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          placeholder="جستجو بر اساس شماره سفارش"
          dir="ltr"
          className="pr-9 text-right"
          inputMode="search"
        />
      </div>

      {/* Status tabs */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => changeStatus(tab.value)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : hasResults ? (
        <ul className="space-y-3">
          {data.items.map((order) => {
            const orderTone = orderStatusMeta(order.status);
            const payTone = paymentStatusMeta(order.paymentStatus);
            return (
              <li key={order.id}>
                <Link href={`/account/orders/${order.id}`} className="block">
                  <Card className="p-4 transition-colors hover:border-foreground/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-black" dir="ltr">
                          {order.orderNumber}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {faDate(order.createdAt)} · {order.itemCount} قلم
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("border-0", toneClass(orderTone.tone))}>
                          {orderTone.label}
                        </Badge>
                        <Badge className={cn("border-0", toneClass(payTone.tone))}>
                          {payTone.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">مبلغ کل</span>
                      <span className="font-black">{formatToman(order.totalAmount)}</span>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <PackageOpen className="size-7" />
          </div>
          <div>
            <p className="font-black">
              {filtersActive ? "سفارشی با این فیلترها پیدا نشد" : "هنوز سفارشی ثبت نکرده‌اید"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "فیلترها را تغییر دهید یا جستجو را پاک کنید."
                : "محصولات فروشگاه را ببینید و اولین خرید خود را انجام دهید."}
            </p>
          </div>
          {filtersActive ? (
            <Button
              variant="outline"
              onClick={() => {
                setStatus("ALL");
                setSearch("");
                setPage(1);
              }}
            >
              پاک‌کردن فیلترها
            </Button>
          ) : (
            <Link href="/" className={buttonVariants()}>
              شروع خرید
            </Link>
          )}
        </Card>
      )}

      {/* Pagination */}
      {hasResults && data.totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRight className="size-4" />
            قبلی
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحه {data.page.toLocaleString("fa-IR")} از {data.totalPages.toLocaleString("fa-IR")}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages || loading}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          >
            بعدی
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
