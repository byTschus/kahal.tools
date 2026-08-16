import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";
import { encryptSecret } from "@/lib/encryption";
import { YOUTUBE_OAUTH_COOKIE } from "@/app/auth/youtube/route";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const store = await cookies();
  const raw = store.get(YOUTUBE_OAUTH_COOKIE)?.value;
  store.delete(YOUTUBE_OAUTH_COOKIE);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!raw || !code || !state) return NextResponse.redirect(new URL("/admin/settings/youtube?error=oauth", request.url));
  try {
    const saved = JSON.parse(raw) as { state: string; organizationId: number };
    if (saved.state !== state) throw new Error("Invalid OAuth state");
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "admin" || admin.status !== "active" || admin.organizationId !== saved.organizationId) throw new Error("Admin session required");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: `${process.env.APP_URL}/auth/youtube/callback`, grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const tokens = await tokenResponse.json() as { access_token: string; refresh_token?: string };
    if (!tokens.refresh_token) throw new Error("Google returned no refresh token");
    const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!channelResponse.ok) throw new Error("Channel lookup failed");
    const channels = await channelResponse.json() as { items: Array<{ id: string; snippet: { title: string } }> };
    const channel = channels.items[0];
    if (!channel) throw new Error("No YouTube channel found");
    const refresh = encryptSecret(tokens.refresh_token);
    await database.execute(`INSERT INTO youtube_accounts (organization_id, channel_id, channel_title, refresh_token, refresh_token_iv, refresh_token_tag) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE organization_id=VALUES(organization_id), channel_title=VALUES(channel_title), refresh_token=VALUES(refresh_token), refresh_token_iv=VALUES(refresh_token_iv), refresh_token_tag=VALUES(refresh_token_tag)`, [saved.organizationId, channel.id, channel.snippet.title, refresh.encrypted, refresh.iv, refresh.tag]);
    return NextResponse.redirect(new URL("/admin/settings/youtube?connected=1", request.url));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/admin/settings/youtube?error=oauth", request.url));
  }
}
