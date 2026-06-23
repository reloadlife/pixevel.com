import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { getUserTier, variantPrice } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { decimalToNumber } from "@/lib/format";
import { resolveMetadata } from "@/lib/seo/resolve";
import { PlanCard, type ServerPlanView } from "./plan-card";

export function generateMetadata(): Promise<Metadata> {
  return resolveMetadata({ kind: "static", pathKey: "/servers" });
}

type VariantMetadata = {
  cpu?: number;
  ram?: number;
  diskGb?: number;
  periodMonths?: number;
};

function readMetadata(value: unknown): VariantMetadata {
  return value && typeof value === "object" ? (value as VariantMetadata) : {};
}

async function getServerPlans(user: { isPremium: boolean } | null): Promise<ServerPlanView[]> {
  noStore();

  const tier = getUserTier(user);

  const products = await getDb().query.products.findMany({
    where: (product, { and, eq, ne }) =>
      and(eq(product.fulfillmentType, "SERVER"), ne(product.status, "ARCHIVED")),
    with: {
      variants: {
        with: {
          inventoryUnits: {
            where: (unit, { eq }) => eq(unit.status, "AVAILABLE"),
            columns: { id: true },
          },
        },
        orderBy: (variant, { asc }) => [asc(variant.createdAt)],
      },
    },
    orderBy: (product, { asc }) => [asc(product.createdAt)],
  });

  return products.map((product) => {
    // Specs are identical across periods of a plan; read them from the first variant.
    const firstMeta = readMetadata(product.variants[0]?.metadata);

    const periods = product.variants
      .map((variant) => {
        const meta = readMetadata(variant.metadata);
        return {
          variantId: variant.id,
          periodMonths: meta.periodMonths ?? 1,
          label: variant.titleFa,
          price: variantPrice(variant, tier),
          compareAtAmount: decimalToNumber(variant.compareAtAmount),
          available:
            product.status === "ACTIVE" &&
            (product.inventoryPolicy === "INFINITE" || variant.inventoryUnits.length > 0),
        };
      })
      .sort((a, b) => a.periodMonths - b.periodMonths);

    return {
      slug: product.slug,
      titleFa: product.titleFa,
      summaryFa: product.summaryFa,
      status: product.status,
      cpu: firstMeta.cpu ?? null,
      ram: firstMeta.ram ?? null,
      diskGb: firstMeta.diskGb ?? null,
      periods,
    } satisfies ServerPlanView;
  });
}

export default async function ServersPage() {
  const user = await getCurrentUser();
  const plans = await getServerPlans(user);

  return (
    <main className="bg-background px-4 pb-16 pt-4 text-foreground sm:px-8 lg:px-14" dir="rtl">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Cloud
        </p>
        <h1 className="mt-3 text-4xl font-black">سرور ابری و VPS</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          سرورهای مجازی پرقدرت با دیسک NVMe، تحویل سریع و آپ‌تایم بالا. پلن دلخواه را انتخاب کنید،
          دوره را مشخص کنید و به سبد خرید اضافه کنید — درست مثل هر محصول دیگر.
        </p>
      </header>

      {plans.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[40dvh] place-items-center rounded-3xl border border-dashed border-border text-center">
          <div>
            <h2 className="text-2xl font-black">هنوز پلنی ثبت نشده</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              برای افزودن پلن‌های نمونه، اسکریپت <code dir="ltr">seed-servers</code> را اجرا کنید.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
