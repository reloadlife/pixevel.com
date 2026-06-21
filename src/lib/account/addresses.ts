import { and, asc, desc, eq } from "drizzle-orm";

import { userAddresses } from "@/db/schema";
import { getDb } from "@/lib/db";
import { isValidIranPhone, normalizeIranPhone } from "@/lib/phone";

export type UserAddress = typeof userAddresses.$inferSelect;

/** Raw shape accepted from the client when creating/updating an address. */
export type AddressInput = {
  titleFa?: string | null;
  fullName?: string | null;
  phone?: string | null;
  province?: string | null;
  city?: string | null;
  addressLine?: string | null;
  postalCode?: string | null;
  isDefault?: boolean;
};

/** Cleaned + validated address fields ready to persist. */
type AddressValues = {
  titleFa: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
};

export class AddressError extends Error {
  constructor(
    public code: string,
    public messageFa: string,
  ) {
    super(code);
    this.name = "AddressError";
  }
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Validates and normalizes the user-supplied address fields. Throws
 * AddressError with a Persian message when a required field is missing or a
 * value (phone / postal code) is malformed.
 */
function parseAddress(input: AddressInput): AddressValues {
  const titleFa = clean(input.titleFa);
  const fullName = clean(input.fullName);
  const phoneRaw = clean(input.phone);
  const province = clean(input.province);
  const city = clean(input.city);
  const addressLine = clean(input.addressLine);
  const postalCode = clean(input.postalCode).replace(/[^\d]/g, "");

  if (!titleFa) {
    throw new AddressError("TITLE_REQUIRED", "عنوان نشانی الزامی است.");
  }
  if (!fullName) {
    throw new AddressError("NAME_REQUIRED", "نام گیرنده الزامی است.");
  }
  if (!phoneRaw) {
    throw new AddressError("PHONE_REQUIRED", "شماره تماس گیرنده الزامی است.");
  }

  const phone = normalizeIranPhone(phoneRaw);
  if (!isValidIranPhone(phone)) {
    throw new AddressError("PHONE_INVALID", "شماره موبایل معتبر نیست.");
  }

  if (!province) {
    throw new AddressError("PROVINCE_REQUIRED", "استان الزامی است.");
  }
  if (!city) {
    throw new AddressError("CITY_REQUIRED", "شهر الزامی است.");
  }
  if (!addressLine) {
    throw new AddressError("ADDRESS_REQUIRED", "نشانی الزامی است.");
  }
  if (postalCode && postalCode.length !== 10) {
    throw new AddressError("POSTAL_INVALID", "کد پستی باید ۱۰ رقم باشد.");
  }

  return { titleFa, fullName, phone, province, city, addressLine, postalCode };
}

/** Lists a user's addresses, default first then newest. */
export async function listAddresses(userId: string): Promise<UserAddress[]> {
  return getDb().query.userAddresses.findMany({
    where: (a, { eq: eqOp }) => eqOp(a.userId, userId),
    orderBy: [desc(userAddresses.isDefault), desc(userAddresses.createdAt)],
  });
}

/**
 * Creates a new address for the user. The first address a user creates — or any
 * address flagged isDefault — becomes the default; all others are unset within a
 * transaction so exactly one default exists.
 */
export async function createAddress(userId: string, input: AddressInput): Promise<UserAddress> {
  const values = parseAddress(input);
  const db = getDb();

  return db.transaction(async (tx) => {
    const existing = await tx.query.userAddresses.findMany({
      where: (a, { eq: eqOp }) => eqOp(a.userId, userId),
      columns: { id: true },
    });
    const makeDefault = input.isDefault === true || existing.length === 0;

    if (makeDefault) {
      await tx
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, userId));
    }

    const [row] = await tx
      .insert(userAddresses)
      .values({ userId, ...values, isDefault: makeDefault })
      .returning();
    return row;
  });
}

/** Loads a single address owned by the user, or null if not found / not theirs. */
export async function getAddress(userId: string, addressId: string): Promise<UserAddress | null> {
  const row = await getDb().query.userAddresses.findFirst({
    where: (a, { and: andOp, eq: eqOp }) => andOp(eqOp(a.id, addressId), eqOp(a.userId, userId)),
  });
  return row ?? null;
}

/**
 * Updates an existing address. Validates ownership first. When isDefault is set
 * true, unsets the default flag on the user's other addresses in a transaction.
 */
export async function updateAddress(
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<UserAddress> {
  const owned = await getAddress(userId, addressId);
  if (!owned) {
    throw new AddressError("NOT_FOUND", "نشانی یافت نشد.");
  }

  const values = parseAddress(input);
  const db = getDb();

  return db.transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, userId));
    }

    const [row] = await tx
      .update(userAddresses)
      .set({
        ...values,
        ...(input.isDefault === true ? { isDefault: true } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)))
      .returning();
    return row;
  });
}

/**
 * Marks one address as the default and unsets the flag on every other address
 * belonging to the user, atomically.
 */
export async function setDefaultAddress(userId: string, addressId: string): Promise<UserAddress> {
  const owned = await getAddress(userId, addressId);
  if (!owned) {
    throw new AddressError("NOT_FOUND", "نشانی یافت نشد.");
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    await tx
      .update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.userId, userId));

    const [row] = await tx
      .update(userAddresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)))
      .returning();
    return row;
  });
}

/**
 * Deletes a user's address. If the deleted address was the default, the most
 * recently created remaining address is promoted to default — all in one tx.
 */
export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const owned = await getAddress(userId, addressId);
  if (!owned) {
    throw new AddressError("NOT_FOUND", "نشانی یافت نشد.");
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .delete(userAddresses)
      .where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)));

    if (owned.isDefault) {
      const next = await tx.query.userAddresses.findFirst({
        where: (a, { eq: eqOp }) => eqOp(a.userId, userId),
        orderBy: [asc(userAddresses.createdAt)],
        columns: { id: true },
      });
      if (next) {
        await tx
          .update(userAddresses)
          .set({ isDefault: true })
          .where(eq(userAddresses.id, next.id));
      }
    }
  });
}
