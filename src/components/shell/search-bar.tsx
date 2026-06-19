import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Storefront search — submits to /products?q=… (the catalog handles the query).
 * Plain GET form so it works without JS and is SEO/Android-friendly.
 */
export function SearchBar({
  defaultValue,
  className,
}: {
  defaultValue?: string;
  className?: string;
}) {
  return (
    <form action="/products" role="search" className={cn("relative w-full", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
      />
      <Input
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="جستجو در پیسکول…"
        aria-label="جستجوی محصول"
        className="ps-9"
      />
    </form>
  );
}
