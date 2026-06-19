import { Suspense } from "react";

import { AuthPanel } from "@/components/auth/auth-panel";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();

  return (
    <main className="grid min-h-[70dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        {user ? (
          <div className="border border-border bg-card p-6 text-center">
            <h1 className="text-2xl font-black">شما وارد شده‌اید</h1>
            <p className="mt-2 text-sm text-muted-foreground" dir="ltr">
              {user.phone}
            </p>
          </div>
        ) : (
          <Suspense fallback={null}>
            <AuthPanel />
          </Suspense>
        )}
      </div>
    </main>
  );
}
