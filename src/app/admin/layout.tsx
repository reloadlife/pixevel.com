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
      <SidebarProvider dir="rtl">
        <AdminSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
            <SidebarTrigger />
            <span className="text-sm font-medium">پنل مدیریت</span>
          </header>
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
