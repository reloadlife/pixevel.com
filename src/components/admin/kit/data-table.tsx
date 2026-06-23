"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronsUpDown, ChevronUp, Loader2 } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import type { AdminPagination } from "@/lib/admin/list-response";
import { toFaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type { ColumnDef };

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  loading?: boolean;
  empty?: React.ReactNode;
  pagination?: AdminPagination;
  onPageChange?: (page: number) => void;
  rowActions?: (row: TData) => React.ReactNode;
  /** Controlled sort state; omit to let the table manage it internally. */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /** Virtualize rows when count exceeds this threshold. Default: 50. */
  virtualizeOver?: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  if (direction === "asc") return <ChevronUp className="ms-1 inline size-3.5 shrink-0" />;
  if (direction === "desc") return <ChevronDown className="ms-1 inline size-3.5 shrink-0" />;
  return <ChevronsUpDown className="ms-1 inline size-3.5 shrink-0 opacity-40" />;
}

function PaginationFooter({
  pagination,
  onPageChange,
}: {
  pagination: AdminPagination;
  onPageChange?: (page: number) => void;
}) {
  const { page, pageSize, total, totalPages } = pagination;
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <span>
        نمایش {toFaNumber(start)}–{toFaNumber(end)} از {toFaNumber(total)} مورد
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || !onPageChange}
          onClick={() => onPageChange?.(page - 1)}
          className="rounded-md border border-border px-3 py-1 text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        >
          قبلی
        </button>
        <span className="text-xs">
          صفحه {toFaNumber(page)} از {toFaNumber(totalPages)}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || !onPageChange}
          onClick={() => onPageChange?.(page + 1)}
          className="rounded-md border border-border px-3 py-1 text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        >
          بعدی
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Virtualized rows renderer
// ──────────────────────────────────────────────────────────────────────────

function VirtualRows<TData>({
  table,
  hasActions,
  rowActions,
}: {
  table: ReturnType<typeof useReactTable<TData>>;
  hasActions: boolean;
  rowActions?: (row: TData) => React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div ref={scrollRef} className="max-h-[600px] overflow-auto">
      <div style={{ height: `${totalSize}px`, position: "relative" }}>
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={row.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                width: "100%",
              }}
              className="flex border-b border-border"
            >
              {row.getVisibleCells().map((cell) => {
                const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
                return (
                  <div
                    key={cell.id}
                    className={cn(
                      "flex-1 truncate px-4 py-3 text-sm text-start",
                      align === "center" && "text-center",
                      align === "end" && "text-end",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                );
              })}
              {hasActions && (
                <div className="shrink-0 px-4 py-3 text-start">{rowActions?.(row.original)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Normal rows renderer
// ──────────────────────────────────────────────────────────────────────────

function NormalRows<TData>({
  table,
  hasActions,
  rowActions,
}: {
  table: ReturnType<typeof useReactTable<TData>>;
  hasActions: boolean;
  rowActions?: (row: TData) => React.ReactNode;
}) {
  return (
    <div className="divide-y divide-border">
      {table.getRowModel().rows.map((row) => (
        <div key={row.id} className="flex">
          {row.getVisibleCells().map((cell) => {
            const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
            return (
              <div
                key={cell.id}
                className={cn(
                  "flex-1 truncate px-4 py-3 text-sm text-start",
                  align === "center" && "text-center",
                  align === "end" && "text-end",
                )}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            );
          })}
          {hasActions && (
            <div className="shrink-0 px-4 py-3 text-start">{rowActions?.(row.original)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main DataTable component
// ──────────────────────────────────────────────────────────────────────────

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  empty,
  pagination,
  onPageChange,
  rowActions,
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  virtualizeOver = 50,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const sorting = controlledSorting ?? internalSorting;
  const onSortingChange = controlledOnSortingChange ?? setInternalSorting;
  const hasActions = Boolean(rowActions);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Server-driven pagination — do NOT use getPaginationRowModel
    manualPagination: true,
    pageCount: pagination?.totalPages ?? -1,
  });

  const shouldVirtualize = data.length > virtualizeOver;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          در حال بارگذاری…
        </div>
      ) : data.length === 0 ? (
        /* Empty */
        <div className="p-10 text-center text-sm text-muted-foreground">
          {empty ?? "موردی برای نمایش وجود ندارد."}
        </div>
      ) : (
        /* Table */
        <div>
          {/* Header */}
          <div className="border-b border-border bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <div key={headerGroup.id} className="flex">
                {headerGroup.headers.map((header) => {
                  const align = (header.column.columnDef.meta as { align?: string } | undefined)
                    ?.align;
                  const canSort = header.column.getCanSort();
                  return (
                    <div
                      key={header.id}
                      className={cn(
                        "flex-1 px-4 py-3 text-xs font-semibold text-muted-foreground text-start uppercase tracking-wide",
                        align === "center" && "text-center",
                        align === "end" && "text-end",
                        canSort && "cursor-pointer select-none hover:text-foreground",
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      onKeyDown={
                        canSort
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                header.column.getToggleSortingHandler()?.(e);
                              }
                            }
                          : undefined
                      }
                      role={canSort ? "button" : undefined}
                      tabIndex={canSort ? 0 : undefined}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && <SortIcon direction={header.column.getIsSorted()} />}
                    </div>
                  );
                })}
                {/* Spacer for actions column */}
                {hasActions && <div className="shrink-0 px-4 py-3" />}
              </div>
            ))}
          </div>

          {/* Rows */}
          {shouldVirtualize ? (
            <VirtualRows table={table} hasActions={hasActions} rowActions={rowActions} />
          ) : (
            <NormalRows table={table} hasActions={hasActions} rowActions={rowActions} />
          )}
        </div>
      )}

      {/* Pagination footer */}
      {pagination && !loading && (
        <PaginationFooter pagination={pagination} onPageChange={onPageChange} />
      )}
    </div>
  );
}
