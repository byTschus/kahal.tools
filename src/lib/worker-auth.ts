import { timingSafeEqual } from "node:crypto";

export function workerAuthorized(request: Request) {
  const configured = process.env.WORKER_API_SECRET ?? "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || configured.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(configured), Buffer.from(supplied));
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
