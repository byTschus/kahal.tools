"use server";

import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/database";
import { pcoFetch, pcoSingle } from "@/lib/planning-center";
import { getYouTubeAccount, youtubeAccessToken, youtubeFetch, type YouTubeAccountRow } from "@/lib/youtube";
import { dateKeyInTimeZone, zonedDateTimeToUtc } from "@/lib/date-time";

type Settings = RowDataPacket & { service_type_id: string; title_template: string; description_template: string; start_item_title: string | null; privacy_status: string };

export async function createYouTubeBroadcast(formData: FormData) {
  const admin = await requireAdmin();
  const accountId = Number(formData.get("accountId"));
  const planId = String(formData.get("planId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 100);
  const description = String(formData.get("description") ?? "").slice(0, 5000);
  if (!accountId || !planId || !title) throw new Error("Kanal, Plan und Titel sind erforderlich");
  const [settingsRows] = await database.execute<Settings[]>("SELECT * FROM youtube_settings WHERE organization_id=?", [admin.organizationId]);
  const settings = settingsRows[0];
  if (!settings?.service_type_id) throw new Error("YouTube-Einstellungen fehlen");

  const [plan, planTimes, items] = await Promise.all([
    pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${planId}`),
    pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${planId}/plan_times?per_page=100`),
    pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${planId}/items?per_page=100`),
  ]);
  const planResource = pcoSingle(plan);
  if (!planResource) throw new Error("Der ausgewählte Planning-Center-Plan wurde nicht gefunden");
  let scheduledStart = String(planTimes.data.find(time => time.attributes.time_type === "service")?.attributes.starts_at ?? planResource.attributes.sort_date ?? "");
  if (settings.start_item_title) {
    const startItem = items.data.find(item => item.attributes.title === settings.start_item_title);
    if (startItem) {
      const itemTimes = await pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${planId}/items/${startItem.id}/item_times?per_page=100`);
      scheduledStart = String(itemTimes.data[0]?.attributes.starts_at ?? scheduledStart);
    }
  }
  let scheduledDate = new Date(scheduledStart);
  if (Number.isNaN(scheduledDate.getTime())) throw new Error("Keine gültige Startzeit im Planning-Center-Plan gefunden");

  const [organizationRows] = await database.execute<(RowDataPacket & { time_zone: string })[]>("SELECT time_zone FROM organizations WHERE id=?", [admin.organizationId]);
  const timeZone = organizationRows[0]?.time_zone ?? "UTC";
  const changedStart = String(formData.get("scheduledStart") ?? "");
  if (changedStart) scheduledDate = zonedDateTimeToUtc(changedStart, timeZone);
  const targetDate = dateKeyInTimeZone(scheduledDate, timeZone);
  const [connectedAccounts] = await database.execute<YouTubeAccountRow[]>("SELECT * FROM youtube_accounts WHERE organization_id=?", [admin.organizationId]);
  for (const connectedAccount of connectedAccounts) {
    const existingToken = await youtubeAccessToken(connectedAccount);
    const existing = await youtubeFetch(existingToken, "/liveBroadcasts?part=snippet&broadcastStatus=all&maxResults=50") as { items?: Array<{ snippet: { scheduledStartTime?: string; actualStartTime?: string } }> };
    if ((existing.items ?? []).some(item => {
      const streamTime = item.snippet.scheduledStartTime ?? item.snippet.actualStartTime;
      return streamTime ? dateKeyInTimeZone(streamTime, timeZone) === targetDate : false;
    })) throw new Error(`Für den ${targetDate} existiert bereits ein YouTube-Stream`);
  }

  const account = await getYouTubeAccount(admin.organizationId, accountId);
  const token = await youtubeAccessToken(account);
  const broadcast = await youtubeFetch(token, "/liveBroadcasts?part=snippet,status,contentDetails", { method: "POST", body: JSON.stringify({ snippet: { title, description, scheduledStartTime: scheduledDate.toISOString() }, status: { privacyStatus: settings.privacy_status, selfDeclaredMadeForKids: false }, contentDetails: { enableAutoStart: true, enableAutoStop: true, recordFromStart: true, enableDvr: true } }) }) as { id: string };

  let streamId = account.reusable_stream_id;
  if (!streamId) {
    const stream = await youtubeFetch(token, "/liveStreams?part=snippet,cdn,contentDetails", { method: "POST", body: JSON.stringify({ snippet: { title: `${account.channel_title} – kahal.tools` }, cdn: { ingestionType: "rtmp", resolution: "variable", frameRate: "variable" }, contentDetails: { isReusable: true } }) }) as { id: string };
    streamId = stream.id;
    await database.execute("UPDATE youtube_accounts SET reusable_stream_id=? WHERE id=?", [streamId, account.id]);
  }
  await youtubeFetch(token, `/liveBroadcasts/bind?id=${encodeURIComponent(broadcast.id)}&streamId=${encodeURIComponent(streamId)}&part=id,contentDetails`, { method: "POST" });

  let playlistId = String(formData.get("playlistId") ?? "") || null;
  const newPlaylist = String(formData.get("newPlaylist") ?? "").trim();
  if (newPlaylist) {
    const playlist = await youtubeFetch(token, "/playlists?part=snippet,status", { method: "POST", body: JSON.stringify({ snippet: { title: newPlaylist }, status: { privacyStatus: settings.privacy_status } }) }) as { id: string };
    playlistId = playlist.id;
  }
  if (playlistId) await youtubeFetch(token, "/playlistItems?part=snippet", { method: "POST", body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: "youtube#video", videoId: broadcast.id } } }) });

  const thumbnail = formData.get("thumbnail");
  if (thumbnail instanceof File && thumbnail.size > 0) {
    if (thumbnail.size > 2 * 1024 * 1024) throw new Error("Das Thumbnail darf maximal 2 MB groß sein");
    const response = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(broadcast.id)}&uploadType=media`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": thumbnail.type || "image/jpeg" }, body: Buffer.from(await thumbnail.arrayBuffer()) });
    if (!response.ok) throw new Error(`Thumbnail-Upload fehlgeschlagen: ${response.status}`);
  }

  await database.execute("INSERT INTO youtube_broadcasts (organization_id, youtube_account_id, planning_center_plan_id, youtube_broadcast_id, title, scheduled_start_at, playlist_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [admin.organizationId, account.id, planId, broadcast.id, title, scheduledDate, playlistId, admin.id]);
  redirect(`/youtube?created=${encodeURIComponent(broadcast.id)}`);
}
