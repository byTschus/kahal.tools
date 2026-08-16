import type { RowDataPacket } from "mysql2";
import { database } from "@/lib/database";
import { decryptSecret, encryptSecret } from "@/lib/encryption";

export type YouTubeAccountRow = RowDataPacket & { id: number; organization_id: number; channel_id: string; channel_title: string; refresh_token: string; refresh_token_iv: string; refresh_token_tag: string; reusable_stream_id: string | null };

export async function youtubeAccessToken(account: YouTubeAccountRow) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", refresh_token: decryptSecret(account.refresh_token, account.refresh_token_iv, account.refresh_token_tag), grant_type: "refresh_token" }), cache: "no-store" });
  if (!response.ok) throw new Error("YouTube-Zugriff konnte nicht erneuert werden");
  return ((await response.json()) as { access_token: string }).access_token;
}

export async function youtubeFetch(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://www.googleapis.com/youtube/v3${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...init?.headers }, cache: "no-store" });
  if (!response.ok) throw new Error(`YouTube API ${response.status}: ${await response.text()}`);
  if (response.status === 204 || response.headers.get("content-length") === "0") return {};
  return response.json();
}

export async function getYouTubeAccount(organizationId: number, accountId: number) {
  const [rows] = await database.execute<YouTubeAccountRow[]>("SELECT * FROM youtube_accounts WHERE id=? AND organization_id=?", [accountId, organizationId]);
  if (!rows[0]) throw new Error("YouTube-Kanal nicht gefunden");
  return rows[0];
}

export { encryptSecret };
