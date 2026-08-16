import { database } from "@/lib/database";
import { getPodcastSettings } from "@/lib/podcast";
import { unauthorized, workerAuthorized } from "@/lib/worker-auth";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!workerAuthorized(request)) return unauthorized();
  const { jobId } = await params;
  const body = await request.json() as { filename?: string; bytes?: number; durationSeconds?: number; deleted?: boolean };
  const [rows] = await database.execute<(import("mysql2").RowDataPacket & { organization_id: number; operation: string })[]>("SELECT organization_id, operation FROM podcast_jobs WHERE id=?", [Number(jobId)]);
  const job = rows[0];
  if (!job) return Response.json({ error: "Invalid completion" }, { status: 400 });
  if (job.operation === "delete") {
    if (!body.deleted) return Response.json({ error: "Deletion not confirmed" }, { status: 400 });
    await database.execute("DELETE FROM podcast_jobs WHERE id=?", [Number(jobId)]);
    return Response.json({ ok: true, deleted: true });
  }
  if (!body.filename || !Number.isFinite(body.bytes)) return Response.json({ error: "Invalid completion" }, { status: 400 });
  const settings = await getPodcastSettings(job.organization_id);
  if (!settings) return Response.json({ error: "Settings missing" }, { status: 409 });
  const audioUrl = `${settings.public_base_url.replace(/\/$/, "")}/${encodeURIComponent(body.filename)}`;
  await database.execute("UPDATE podcast_jobs SET status='published', progress=100, audio_filename=?, audio_url=?, audio_bytes=?, duration_seconds=?, published_at=NOW(), lease_until=NULL, error_message=NULL WHERE id=?", [body.filename, audioUrl, Number(body.bytes), Math.max(1, Math.round(Number(body.durationSeconds ?? 1))), Number(jobId)]);
  return Response.json({ ok: true, audioUrl });
}
