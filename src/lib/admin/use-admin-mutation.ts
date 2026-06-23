import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useAdminMutation<TVars = void>(opts: {
  url: (vars: TVars) => string;
  method?: "POST" | "PATCH" | "DELETE" | "PUT";
  body?: (vars: TVars) => unknown;
  invalidate: string[];
  successMessage?: string;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const init: RequestInit = { method: opts.method ?? "POST" };
      if (opts.body) {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(opts.body(vars));
      } else if (opts.method !== "DELETE" && vars != null) {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(vars);
      }
      const res = await fetch(opts.url(vars), init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message ?? "عملیات انجام نشد.");
      }
      return json?.data ?? json;
    },
    onSuccess: () => {
      if (opts.successMessage) toast.success(opts.successMessage);
      for (const key of opts.invalidate) qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
