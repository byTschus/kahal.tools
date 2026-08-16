import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { database } from "@/lib/database";
import { AVAILABLE_APPS, type AppKey } from "@/lib/apps";

export const SESSION_COOKIE = "kahal_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: number;
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
  organizationTimeZone: string;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "pending" | "active" | "rejected";
  apps: AppKey[];
};

type AuthUserRow = RowDataPacket & {
  id: number;
  organization_id: number;
  organization_name: string;
  organization_slug: string;
  organization_time_zone: string;
  name: string;
  email: string;
  role: AuthUser["role"];
  status: AuthUser["status"];
  app_keys: string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await database.execute(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, hashToken(token), expiresAt],
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await database.execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [rows] = await database.execute<AuthUserRow[]>(
    `SELECT users.id, users.organization_id, organizations.name AS organization_name,
            organizations.login_slug AS organization_slug,
            organizations.time_zone AS organization_time_zone,
            users.name, users.email, users.role, users.status
            ,(SELECT GROUP_CONCAT(user_app_access.app_key) FROM user_app_access WHERE user_app_access.user_id = users.id) AS app_keys
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       JOIN organizations ON organizations.id = users.organization_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > NOW()
      LIMIT 1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  const assignedApps = (row.app_keys ?? "").split(",").filter((key): key is AppKey => AVAILABLE_APPS.some(app => app.key === key));
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    organizationTimeZone: row.organization_time_zone,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    apps: row.role === "admin" ? AVAILABLE_APPS.map(app => app.key) : assignedApps,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/access-status");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function requireApp(appKey: AppKey) {
  const user = await requireUser();
  if (user.role !== "admin" && !user.apps.includes(appKey)) redirect("/?error=no-app-access");
  return user;
}
