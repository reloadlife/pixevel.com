export interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminListResponse<Row> {
  rows: Row[];
  pagination: AdminPagination;
  counts?: Record<string, number>;
}

export function normalizeListResponse<Row>(
  raw: unknown,
  opts: { rowsKey?: string } = {},
): AdminListResponse<Row> {
  const obj = (raw ?? {}) as Record<string, unknown>;
  let rows: Row[] = [];
  if (opts.rowsKey && Array.isArray(obj[opts.rowsKey])) {
    rows = obj[opts.rowsKey] as Row[];
  } else if (Array.isArray(obj.rows)) {
    rows = obj.rows as Row[];
  } else {
    const firstArray = Object.values(obj).find((v) => Array.isArray(v));
    rows = (firstArray as Row[]) ?? [];
  }

  const p = (obj.pagination ?? {}) as Partial<AdminPagination>;
  const total = typeof p.total === "number" ? p.total : rows.length;
  const pageSize =
    typeof p.pageSize === "number" && p.pageSize > 0 ? p.pageSize : rows.length || 20;
  const pagination: AdminPagination = {
    page: typeof p.page === "number" ? p.page : 1,
    pageSize,
    total,
    totalPages:
      typeof p.totalPages === "number" ? p.totalPages : Math.max(1, Math.ceil(total / pageSize)),
  };

  const counts = (obj.counts as Record<string, number> | undefined) ?? undefined;
  return { rows, pagination, counts };
}
