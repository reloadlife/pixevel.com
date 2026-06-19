import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";

import { users } from "@/db/schema";
import { ProfileError, updateProfile } from "@/lib/account";
import { withRollback } from "../../test/db";

async function seedUser(tx: any, email?: string) {
  const [u] = await tx
    .insert(users)
    .values({ phone: `0912${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`, email })
    .returning({ id: users.id });
  return u.id as string;
}

test("updateProfile saves name + default address", async () => {
  await withRollback(async (tx) => {
    const id = await seedUser(tx);
    const updated = await updateProfile(
      id,
      { fullName: "علی رضایی", defaultCity: "تهران", defaultPostalCode: "1234567890" },
      tx,
    );
    expect(updated.fullName).toBe("علی رضایی");
    expect(updated.defaultCity).toBe("تهران");
    expect(updated.defaultPostalCode).toBe("1234567890");
  });
});

test("updateProfile rejects an email already taken by another user", async () => {
  await withRollback(async (tx) => {
    const takenEmail = `taken-${randomUUID()}@x.com`;
    await seedUser(tx, takenEmail);
    const other = await seedUser(tx);
    await expect(updateProfile(other, { email: takenEmail }, tx)).rejects.toMatchObject({
      code: "EMAIL_TAKEN",
    });
  });
});

test("updateProfile rejects a malformed email", async () => {
  await withRollback(async (tx) => {
    const id = await seedUser(tx);
    await expect(updateProfile(id, { email: "not-an-email" }, tx)).rejects.toBeInstanceOf(
      ProfileError,
    );
  });
});

test("updateProfile lets a user keep their own email", async () => {
  await withRollback(async (tx) => {
    const email = `mine-${randomUUID()}@x.com`;
    const id = await seedUser(tx, email);
    const updated = await updateProfile(id, { email, fullName: "خودم" }, tx);
    expect(updated.email).toBe(email);
    expect(updated.fullName).toBe("خودم");
  });
});
