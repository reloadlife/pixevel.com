import { getDb } from "@/lib/db";

export async function listOrderEvents(orderId: string) {
  const db = getDb();
  return db.query.orderEvents.findMany({
    where: (e, { eq: eqFn }) => eqFn(e.orderId, orderId),
    with: {
      author: {
        columns: { id: true, fullName: true, phone: true },
      },
    },
    orderBy: (e, { asc }) => [asc(e.createdAt)],
  });
}

export type AdminOrderEvent = Awaited<ReturnType<typeof listOrderEvents>>[number];
