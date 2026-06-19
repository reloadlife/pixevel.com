import type { UserRole } from "@/db/schema";
import { listAdminUsers, toAdminUserRow } from "@/lib/admin/users";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

const VALID_ROLES: UserRole[] = ["CUSTOMER", "ADMIN"];

function parsePremium(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { searchParams } = new URL(request.url);

  const roleParam = searchParams.get("role");
  const role =
    roleParam && VALID_ROLES.includes(roleParam as UserRole) ? (roleParam as UserRole) : undefined;

  const q = searchParams.get("q")?.trim();
  const page = Number(searchParams.get("page")) || undefined;
  const pageSize = Number(searchParams.get("pageSize")) || undefined;

  const result = await listAdminUsers({
    q: q && q.length > 0 ? q : undefined,
    role,
    premium: parsePremium(searchParams.get("premium")),
    page,
    pageSize,
  });

  return apiOk({
    users: result.rows.map(toAdminUserRow),
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}
