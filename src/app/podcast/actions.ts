"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApp } from "@/lib/auth";
import { database } from "@/lib/database";
import { getPodcastSettings } from "@/lib/podcast";
import { getYouTubeAccount, youtubeAccessToken, youtubeFetch } from "@/lib/youtube";
import { wakePodcastWorker } from "@/lib/worker-wake";

export async function queuePodcastJob(formData: FormData) {
  const user = await requireApp("podcast");
  const videoId = String(formData.get("videoId") ?? "");
  const accountId = Number(formData.get("accountId"));
  const title = String(formData.get("title") ?? "").trim().slice(0, 255);
  const description = String(formData.get("description") ?? "").slice(0, 10000);
  const start = Number(formData.get("startSecondsOverride"));
  const end = Number(formData.get("endSecondsOverride"));
  if (!videoId || !accountId || !title || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error("Start- und Endpunkt sind ungültig");
  if (!(await getPodcastSettings(user.organizationId))) throw new Error("Bitte zuerst die Podcast- und FTP-Einstellungen speichern");
  const account = await getYouTubeAccount(user.organizationId, accountId);
  const token = await youtubeAccessToken(account);
  const result = await youtubeFetch(token, `/liveBroadcasts?part=status&id=${encodeURIComponent(videoId)}`) as { items?: Array<{ status?: { lifeCycleStatus?: string } }> };
  if (result.items?.[0]?.status?.lifeCycleStatus !== "complete") throw new Error("Nur abgeschlossene Livestreams können als Podcast verarbeitet werden");
  await database.execute(`INSERT INTO podcast_jobs (organization_id, youtube_account_id, youtube_video_id, title, description, start_seconds, end_seconds, operation, status, progress, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'publish', 'queued', 0, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), start_seconds=VALUES(start_seconds), end_seconds=VALUES(end_seconds), operation='publish', status='queued', progress=0, worker_id=NULL, lease_until=NULL, audio_filename=NULL, audio_url=NULL, audio_bytes=NULL, duration_seconds=NULL, error_message=NULL, published_at=NULL`, [user.organizationId, account.id, videoId, title, description, start, end, user.id]);
  try { await wakePodcastWorker(); } catch (error) {
    await database.execute("UPDATE podcast_jobs SET error_message=? WHERE organization_id=? AND youtube_video_id=?", [error instanceof Error ? `Worker-Start: ${error.message}` : "Worker konnte nicht gestartet werden", user.organizationId, videoId]);
  }
  redirect("/podcast?queued=1");
}

export async function updatePodcast(formData: FormData) {
  const user = await requireApp("podcast");
  const jobId = Number(formData.get("jobId"));
  const title = String(formData.get("title") ?? "").trim().slice(0, 255);
  const description = String(formData.get("description") ?? "").slice(0, 10000);
  if (!Number.isSafeInteger(jobId) || !title) throw new Error("Ungültige Podcast-Daten");
  await database.execute("UPDATE podcast_jobs SET title=?, description=? WHERE id=? AND organization_id=? AND status='published'", [title, description, jobId, user.organizationId]);
  revalidatePath("/podcast");
  redirect("/podcast?updated=1");
}

export async function deletePodcast(formData: FormData) {
  const user = await requireApp("podcast");
  const jobId = Number(formData.get("jobId"));
  if (!Number.isSafeInteger(jobId)) return;
  const [rows] = await database.execute<(import("mysql2").RowDataPacket & { audio_filename: string | null })[]>("SELECT audio_filename FROM podcast_jobs WHERE id=? AND organization_id=?", [jobId, user.organizationId]);
  if (!rows[0]) return;
  if (!rows[0].audio_filename) {
    await database.execute("DELETE FROM podcast_jobs WHERE id=? AND organization_id=?", [jobId, user.organizationId]);
    revalidatePath("/podcast");
    return;
  }
  await database.execute("UPDATE podcast_jobs SET operation='delete', status='queued', progress=0, error_message=NULL, worker_id=NULL, lease_until=NULL WHERE id=? AND organization_id=?", [jobId, user.organizationId]);
  try { await wakePodcastWorker(); } catch (error) {
    await database.execute("UPDATE podcast_jobs SET error_message=? WHERE id=?", [error instanceof Error ? `Worker-Start: ${error.message}` : "Worker konnte nicht gestartet werden", jobId]);
  }
  revalidatePath("/podcast");
}
