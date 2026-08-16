import { database } from "@/lib/database";
import { unauthorized, workerAuthorized } from "@/lib/worker-auth";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!workerAuthorized(request)) return unauthorized();
  const { jobId } = await params;
  const body = await request.json() as { status?: string; progress?: number; error?: string };
  const allowed = ["processing", "uploading", "failed"];
  if (!body.status || !allowed.includes(body.status)) return Response.json({ error: "Invalid status" }, { status: 400 });
  await database.execute("UPDATE podcast_jobs SET status=?, progress=?, error_message=?, lease_until=DATE_ADD(NOW(), INTERVAL 2 HOUR) WHERE id=?", [body.status, Math.min(99, Math.max(0, Number(body.progress ?? 0))), body.error?.slice(0, 4000) ?? null, Number(jobId)]);
  return Response.json({ ok: true });
}
