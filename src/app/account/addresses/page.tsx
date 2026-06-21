import { redirect } from "next/navigation";
import { listAddresses } from "@/lib/account/addresses";
import { getCurrentUser } from "@/lib/auth";
import { AddressBook, type AddressView } from "./address-form";

export const metadata = {
  title: "دفترچه نشانی‌ها | پیکسول",
};

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/account/addresses");
  }

  const rows = await listAddresses(user.id);
  const addresses: AddressView[] = rows.map((a) => ({
    id: a.id,
    titleFa: a.titleFa,
    fullName: a.fullName,
    phone: a.phone,
    province: a.province,
    city: a.city,
    addressLine: a.addressLine,
    postalCode: a.postalCode,
    isDefault: a.isDefault,
  }));

  return (
    <main className="px-4 pt-4 text-foreground sm:px-0" dir="rtl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Pixevel Account
        </p>
        <h1 className="mt-3 text-3xl font-black">دفترچه نشانی‌ها</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          نشانی‌های خود را برای تحویل سفارش‌های فیزیکی مدیریت کنید.
        </p>
      </header>

      <AddressBook addresses={addresses} />
    </main>
  );
}
