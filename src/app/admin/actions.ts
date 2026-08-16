"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/database";
import { encryptSecret } from "@/lib/encryption";
import type { ResultSetHeader } from "mysql2";
import { AVAILABLE_APPS, type AppKey } from "@/lib/apps";

export async function createLocalUser(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2 || !email.includes("@") || password.length < 12) return;
  const passwordHash = await hash(password, 12);
  const [result] = await database.execute<ResultSetHeader>(
    `INSERT INTO users (organization_id, planning_center_user_id, name, email, password_hash, role, status)
     VALUES (?, NULL, ?, ?, ?, 'user', 'active')`,
    [admin.organizationId, name, email, passwordHash],
  );
  const requestedApps = formData.getAll("apps").map(String).filter((key): key is AppKey => AVAILABLE_APPS.some(app => app.key === key));
  for (const appKey of requestedApps) await database.execute("INSERT IGNORE INTO user_app_access (user_id, app_key) VALUES (?, ?)", [result.insertId, appKey]);
  revalidatePath("/admin/settings/users");
}

export async function savePlanningCenterCredentials(formData: FormData) {
  const admin = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();
  const userAgent = String(formData.get("userAgent") ?? "").trim();
  if (!clientId || !clientSecret || !userAgent) return;
  const secret = encryptSecret(clientSecret);
  await database.execute(
    `UPDATE organizations SET planning_center_client_id = ?, planning_center_client_secret = ?,
      planning_center_secret_iv = ?, planning_center_secret_tag = ?, planning_center_user_agent = ?
      WHERE id = ?`,
    [clientId, secret.encrypted, secret.iv, secret.tag, userAgent, admin.organizationId],
  );
  redirect("/");
}

export async function updateUserStatus(formData: FormData) {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const status = formData.get("status");
  if (!Number.isSafeInteger(userId) || !["active", "rejected"].includes(String(status))) return;
  await database.execute(
    "UPDATE users SET status = ? WHERE id = ? AND organization_id = ? AND role = 'user'",
    [status, userId, admin.organizationId],
  );
  await database.execute(
    "DELETE sessions FROM sessions JOIN users ON users.id = sessions.user_id WHERE users.id = ? AND users.organization_id = ? AND users.status <> 'active'",
    [userId, admin.organizationId],
  );
  revalidatePath("/admin/settings/users");
}

export async function deleteUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!Number.isSafeInteger(userId) || userId === admin.id) return;
  await database.execute(
    "DELETE FROM users WHERE id = ? AND organization_id = ? AND role = 'user'",
    [userId, admin.organizationId],
  );
  revalidatePath("/admin/settings/users");
}

export async function updateUserApps(formData: FormData) {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!Number.isSafeInteger(userId) || userId === admin.id) return;
  const [users] = await database.execute<ResultSetHeader>("DELETE user_app_access FROM user_app_access JOIN users ON users.id=user_app_access.user_id WHERE users.id=? AND users.organization_id=? AND users.role='user'", [userId, admin.organizationId]);
  void users;
  const requestedApps = formData.getAll("apps").map(String).filter((key): key is AppKey => AVAILABLE_APPS.some(app => app.key === key));
  for (const appKey of requestedApps) await database.execute("INSERT IGNORE INTO user_app_access (user_id, app_key) SELECT id, ? FROM users WHERE id=? AND organization_id=? AND role='user'", [appKey, userId, admin.organizationId]);
  revalidatePath("/admin/settings/users");
}

export async function leaveAdmin() {
  redirect("/");
}
