import { database } from "@/lib/database";
import { getPodcastSettings, podcastFtpPassword } from "@/lib/podcast";
import { unauthorized, workerAuthorized } from "@/lib/worker-auth";

export async function POST(request: Request) {
  if (!workerAuthorized(request)) return unauthorized();
  const { workerId = "infomaniak-worker" } = await request.json().catch(() => ({})) as { workerId?: string };
  for (let attempt = 0; attempt < 5; attempt++) {
    const [rows] = await database.execute<(import("mysql2").RowDataPacket & { id: number; organization_id: number; youtube_video_id: string; title: string; start_seconds: string; end_seconds: string; operation: "publish" | "delete"; audio_filename: string | null })[]>("SELECT id, organization_id, youtube_video_id, title, start_seconds, end_seconds, operation, audio_filename FROM podcast_jobs WHERE status='queued' OR (status='processing' AND lease_until<NOW()) ORDER BY created_at LIMIT 1");
    const job = rows[0];
    if (!job) return new Response(null, { status: 204 });
    const [result] = await database.execute<import("mysql2").ResultSetHeader>("UPDATE podcast_jobs SET status='processing', progress=2, worker_id=?, lease_until=DATE_ADD(NOW(), INTERVAL 2 HOUR), error_message=NULL WHERE id=? AND (status='queued' OR (status='processing' AND lease_until<NOW()))", [String(workerId).slice(0, 100), job.id]);
    if (!result.affectedRows) continue;
    const settings = await getPodcastSettings(job.organization_id);
    if (!settings) {
      await database.execute("UPDATE podcast_jobs SET status='failed', error_message='Podcast-Einstellungen fehlen' WHERE id=?", [job.id]);
      continue;
    }
    return Response.json({ id: job.id, operation: job.operation, filename: job.audio_filename, youtubeUrl: `https://www.youtube.com/watch?v=${job.youtube_video_id}`, title: job.title, startSeconds: Number(job.start_seconds), endSeconds: Number(job.end_seconds), ftp: { host: settings.ftp_host, port: settings.ftp_port, secure: Boolean(settings.ftp_secure), username: settings.ftp_username, password: podcastFtpPassword(settings), directory: settings.ftp_directory } });
  }
  return Response.json({ error: "Could not claim job" }, { status: 409 });
}
