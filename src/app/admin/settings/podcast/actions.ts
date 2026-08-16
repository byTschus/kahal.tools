"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/database";
import { encryptSecret } from "@/lib/encryption";

export async function savePodcastSettings(formData: FormData) {
  const admin = await requireAdmin();
  const title = String(formData.get("podcastTitle") ?? "").trim();
  const host = String(formData.get("ftpHost") ?? "").trim();
  const username = String(formData.get("ftpUsername") ?? "").trim();
  const password = String(formData.get("ftpPassword") ?? "");
  const publicBaseUrl = String(formData.get("publicBaseUrl") ?? "").trim().replace(/\/$/, "");
  const port = Math.min(65535, Math.max(1, Number(formData.get("ftpPort") ?? 21)));
  if (!title || !host || !username || !publicBaseUrl || !/^https:\/\//i.test(publicBaseUrl)) throw new Error("Podcasttitel, FTP-Zugang und eine öffentliche HTTPS-Adresse sind erforderlich");
  const [existing] = await database.execute<(import("mysql2").RowDataPacket & { ftp_password: string })[]>("SELECT ftp_password FROM podcast_settings WHERE organization_id=?", [admin.organizationId]);
  if (!password && !existing[0]) throw new Error("Das FTP-Passwort ist erforderlich");
  const encrypted = password ? encryptSecret(password) : null;
  await database.execute(`INSERT INTO podcast_settings (organization_id, podcast_title, podcast_description, podcast_author, podcast_language, podcast_image_url, ftp_host, ftp_port, ftp_secure, ftp_username, ftp_password, ftp_password_iv, ftp_password_tag, ftp_directory, public_base_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE podcast_title=VALUES(podcast_title), podcast_description=VALUES(podcast_description), podcast_author=VALUES(podcast_author), podcast_language=VALUES(podcast_language), podcast_image_url=VALUES(podcast_image_url), ftp_host=VALUES(ftp_host), ftp_port=VALUES(ftp_port), ftp_secure=VALUES(ftp_secure), ftp_username=VALUES(ftp_username), ftp_password=IF(VALUES(ftp_password)='',ftp_password,VALUES(ftp_password)), ftp_password_iv=IF(VALUES(ftp_password)='',ftp_password_iv,VALUES(ftp_password_iv)), ftp_password_tag=IF(VALUES(ftp_password)='',ftp_password_tag,VALUES(ftp_password_tag)), ftp_directory=VALUES(ftp_directory), public_base_url=VALUES(public_base_url)`, [admin.organizationId, title, String(formData.get("podcastDescription") ?? ""), String(formData.get("podcastAuthor") ?? ""), String(formData.get("podcastLanguage") ?? "de-CH"), String(formData.get("podcastImageUrl") ?? ""), host, port, formData.get("ftpSecure") === "on" ? 1 : 0, username, encrypted?.encrypted ?? "", encrypted?.iv ?? "", encrypted?.tag ?? "", String(formData.get("ftpDirectory") ?? "/") || "/", publicBaseUrl]);
  revalidatePath("/admin/settings/podcast");
}
