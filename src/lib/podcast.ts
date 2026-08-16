import type { RowDataPacket } from "mysql2";
import { database } from "@/lib/database";
import { decryptSecret } from "@/lib/encryption";

export type PodcastSettings = RowDataPacket & { organization_id: number; podcast_title: string; podcast_description: string | null; podcast_author: string | null; podcast_language: string; podcast_image_url: string | null; ftp_host: string; ftp_port: number; ftp_secure: number; ftp_username: string; ftp_password: string; ftp_password_iv: string; ftp_password_tag: string; ftp_directory: string; public_base_url: string };

export async function getPodcastSettings(organizationId: number) {
  const [rows] = await database.execute<PodcastSettings[]>("SELECT * FROM podcast_settings WHERE organization_id=?", [organizationId]);
  return rows[0] ?? null;
}

export function podcastFtpPassword(settings: PodcastSettings) {
  return decryptSecret(settings.ftp_password, settings.ftp_password_iv, settings.ftp_password_tag);
}

export function xml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
