"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/database";
import { zonedDateTimeToUtc } from "@/lib/date-time";
import { getYouTubeAccount, youtubeAccessToken, youtubeFetch } from "@/lib/youtube";

export async function updateBroadcast(formData: FormData) {
  const admin = await requireAdmin();
  const accountId = Number(formData.get("accountId"));
  const broadcastId = String(formData.get("broadcastId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 100);
  const description = String(formData.get("description") ?? "").slice(0, 5000);
  const privacyStatus = String(formData.get("privacyStatus") ?? "unlisted");
  const scheduledStart = String(formData.get("scheduledStart") ?? "");
  if (!broadcastId || !title || !["private", "unlisted", "public"].includes(privacyStatus)) throw new Error("Ungültige Broadcast-Daten");
  const account = await getYouTubeAccount(admin.organizationId, accountId);
  const token = await youtubeAccessToken(account);
  const scheduledStartTime = zonedDateTimeToUtc(scheduledStart, admin.organizationTimeZone).toISOString();
  await youtubeFetch(token, "/liveBroadcasts?part=snippet,status", { method: "PUT", body: JSON.stringify({ id: broadcastId, snippet: { title, description, scheduledStartTime }, status: { privacyStatus, selfDeclaredMadeForKids: false } }) });
  await database.execute("UPDATE youtube_broadcasts SET title=?, scheduled_start_at=? WHERE youtube_broadcast_id=? AND organization_id=?", [title, new Date(scheduledStartTime), broadcastId, admin.organizationId]);
  redirect("/youtube?updated=1");
}

export async function deleteBroadcast(formData: FormData) {
  const admin = await requireAdmin();
  const accountId = Number(formData.get("accountId"));
  const broadcastId = String(formData.get("broadcastId") ?? "");
  if (!broadcastId) return;
  const account = await getYouTubeAccount(admin.organizationId, accountId);
  const token = await youtubeAccessToken(account);
  await youtubeFetch(token, `/liveBroadcasts?id=${encodeURIComponent(broadcastId)}`, { method: "DELETE" });
  await database.execute("DELETE FROM youtube_broadcasts WHERE youtube_broadcast_id=? AND organization_id=?", [broadcastId, admin.organizationId]);
  revalidatePath("/youtube");
}
