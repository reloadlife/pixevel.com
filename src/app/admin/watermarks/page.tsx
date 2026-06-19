import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { WatermarkImageManagement } from "@/components/admin/watermark-image-management";
import {
  listAdminWatermarkImages,
  toAdminWatermarkImageRow,
} from "@/lib/admin/watermark-images";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminWatermarksPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/admin/watermarks");
  }

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  const images = await listAdminWatermarkImages();

  return (
    <AdminShell user={user}>
      <WatermarkImageManagement initialImages={images.map(toAdminWatermarkImageRow)} />
    </AdminShell>
  );
}
