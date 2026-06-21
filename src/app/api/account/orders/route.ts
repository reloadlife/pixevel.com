import { apiError, apiOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { isOrderStatusFilter, listAccountOrders } from "@/lib/orders/account-orders";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("AUTH_REQUIRED", "ابتدا وارد شوید.", 401);
  }

  const { searchParams } = new URL(request.url);

  const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const statusParam = searchParams.get("status");
  const status = isOrderStatusFilter(statusParam) ? statusParam : null;

  const search = searchParams.get("q");

  const result = await listAccountOrders({ userId: user.id, page, status, search });

  return apiOk(result);
}
