import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { type AdminListResponse, normalizeListResponse } from "./list-response";

export function buildAdminListUrl(
  resource: string,
  filters: Record<string, string | number | undefined | null> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api/admin/${resource}${qs ? `?${qs}` : ""}`;
}

export function useAdminList<Row>(
  resource: string,
  filters: Record<string, string | number | undefined | null> = {},
  opts: { initialData?: AdminListResponse<Row>; rowsKey?: string; enabled?: boolean } = {},
): UseQueryResult<AdminListResponse<Row>> {
  return useQuery({
    queryKey: [resource, filters],
    enabled: opts.enabled ?? true,
    initialData: opts.initialData,
    queryFn: async () => {
      const res = await fetch(buildAdminListUrl(resource, filters));
      const json = await res.json();
      const payload = json?.ok ? json.data : json;
      return normalizeListResponse<Row>(payload, { rowsKey: opts.rowsKey });
    },
  });
}
