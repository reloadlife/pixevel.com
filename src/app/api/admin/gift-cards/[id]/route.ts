import { z } from "zod";

import { giftCardErrorResponse } from "@/app/api/admin/gift-cards/route";
import { setGiftCardStatus, toAdminGiftCardOption } from "@/lib/admin/gift-cards";
import { apiError, apiOk } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

const PatchSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return apiError("UNAUTHORIZED", "دسترسی مجاز نیست.", 401);
  }

  const { id } = await params;

  const parsed = await parseBody(request, PatchSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const card = await setGiftCardStatus(id, parsed.data.status);
    return apiOk({ giftCard: toAdminGiftCardOption(card) });
  } catch (error) {
    return giftCardErrorResponse(error);
  }
}
