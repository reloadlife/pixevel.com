"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type AdminUser = {
  id: string;
  phone: string | null;
  fullName: string | null;
  role: "CUSTOMER" | "ADMIN";
  isPremium: boolean;
  createdAt: string | Date;
};

export function UserManagement({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function updateUser(user: AdminUser, patch: Partial<AdminUser>) {
    setSavingId(user.id);
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const result = await response.json();
    setSavingId(null);

    if (!result.ok) {
      alert(result.error?.message ?? "ذخیره کاربر انجام نشد.");
      return;
    }

    setUsers((current) =>
      current.map((item) => (item.id === user.id ? { ...item, ...result.data.user } : item)),
    );
  }

  return (
    <div className="border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 p-4">
        <h2 className="text-lg font-black">مدیریت کاربران</h2>
        <p className="mt-1 text-sm text-zinc-500">
          هر کاربر می‌تواند ادمین، پریمیوم، هر دو یا هیچ‌کدام باشد.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50 text-right text-xs font-black text-zinc-500">
            <tr>
              <th className="p-3">شماره</th>
              <th className="p-3">نام</th>
              <th className="p-3">نقش</th>
              <th className="p-3">پریمیوم</th>
              <th className="p-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-zinc-100">
                <td className="p-3 font-mono text-xs" dir="ltr">
                  {user.phone}
                </td>
                <td className="p-3">{user.fullName ?? "-"}</td>
                <td className="p-3">
                  <span className="bg-zinc-100 px-2 py-1 text-xs font-black">
                    {user.role === "ADMIN" ? "ادمین" : "مشتری"}
                  </span>
                </td>
                <td className="p-3">{user.isPremium ? "بله" : "خیر"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingId === user.id}
                      onClick={() =>
                        updateUser(user, {
                          role: user.role === "ADMIN" ? "CUSTOMER" : "ADMIN",
                        })
                      }
                    >
                      {savingId === user.id ? <Loader2 className="size-3 animate-spin" /> : null}
                      تغییر ادمین
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingId === user.id}
                      onClick={() => updateUser(user, { isPremium: !user.isPremium })}
                    >
                      تغییر پریمیوم
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
