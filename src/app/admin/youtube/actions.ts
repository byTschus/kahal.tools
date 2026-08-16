"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/database";

export async function saveYouTubeSettings(formData: FormData) {
  const admin = await requireAdmin();
  const serviceType = String(formData.get("serviceType") ?? "");
  const [serviceTypeId, ...nameParts] = serviceType.split("|");
  const titleTemplate = String(formData.get("titleTemplate") ?? "").trim();
  const descriptionTemplate = String(formData.get("descriptionTemplate") ?? "");
  const startItemTitle = String(formData.get("startItemTitle") ?? "") || null;
  const privacyStatus = String(formData.get("privacyStatus") ?? "unlisted");
  if (!serviceTypeId || !titleTemplate || !["private", "unlisted", "public"].includes(privacyStatus)) return;
  await database.execute(`INSERT INTO youtube_settings (organization_id, service_type_id, service_type_name, title_template, description_template, start_item_title, privacy_status) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE service_type_id=VALUES(service_type_id), service_type_name=VALUES(service_type_name), title_template=VALUES(title_template), description_template=VALUES(description_template), start_item_title=VALUES(start_item_title), privacy_status=VALUES(privacy_status)`, [admin.organizationId, serviceTypeId, nameParts.join("|"), titleTemplate, descriptionTemplate, startItemTitle, privacyStatus]);
  revalidatePath("/admin/settings/youtube");
}

export async function removeYouTubeAccount(formData: FormData) {
  const admin = await requireAdmin();
  await database.execute("DELETE FROM youtube_accounts WHERE id=? AND organization_id=?", [Number(formData.get("accountId")), admin.organizationId]);
  revalidatePath("/admin/settings/youtube");
}
