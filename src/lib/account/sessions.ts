import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { sessions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { hashToken, SESSION_COOKIE } from "@/lib/session";

export type SessionRow = typeof sessions.$inferSelect;

/** A session enriched with whether it belongs to the current request. */
export type ActiveSession = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
};

export class SessionError extends Error {
  constructor(
    public code: string,
    public messageFa: string,
  ) {
    super(code);
    this.name = "SessionError";
  }
}

/** Reads the current request's session token hash, or null when absent. */
export async function getCurrentTokenHash(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/**
 * Lists a user's non-expired sessions, newest first, flagging the one that
 * matches the current request's cookie so the UI can mark it as "this device".
 */
export async function listActiveSessions(userId: string): Promise<ActiveSession[]> {
  const currentHash = await getCurrentTokenHash();

  const rows = await getDb().query.sessions.findMany({
    where: (s, { and: andOp, eq: eqOp, gt: gtOp }) =>
      andOp(eqOp(s.userId, userId), gtOp(s.expiresAt, new Date())),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  return rows.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    expiresAt: s.expiresAt,
    isCurrent: currentHash != null && s.tokenHash === currentHash,
  }));
}

/**
 * Revokes a single session owned by the user. Returns whether the revoked
 * session was the current request's session (so the caller can clear the
 * cookie and log the user out). Throws SessionError when the session is not
 * found or not owned by the user.
 */
export async function revokeSession(
  userId: string,
  sessionId: string,
): Promise<{ wasCurrent: boolean }> {
  const db = getDb();

  const target = await db.query.sessions.findFirst({
    where: (s, { and: andOp, eq: eqOp }) => andOp(eqOp(s.id, sessionId), eqOp(s.userId, userId)),
  });

  if (!target) {
    throw new SessionError("NOT_FOUND", "نشست یافت نشد.");
  }

  const currentHash = await getCurrentTokenHash();
  const wasCurrent = currentHash != null && target.tokenHash === currentHash;

  await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  return { wasCurrent };
}
