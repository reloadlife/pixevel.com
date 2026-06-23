import { redirect } from "next/navigation";
import { type CurrentUser, getCurrentUser } from "@/lib/auth";

export async function requireAdmin(redirectTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  if (user.role !== "ADMIN") redirect("/admin");
  return user;
}
