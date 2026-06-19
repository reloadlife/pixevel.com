import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (user?.role !== "ADMIN") {
    redirect("/login?redirect=/admin");
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div dir="rtl" className="flex min-h-svh w-full">
          <SidebarInset>
            <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
              <SidebarTrigger />
              <span className="text-sm font-medium text-foreground/80">پنل مدیریت</span>
            </header>
            <div className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</div>
          </SidebarInset>
          <AdminSidebar />
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
