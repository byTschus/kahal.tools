import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const YOUTUBE_OAUTH_COOKIE = "kahal_youtube_oauth";

export async function GET() {
  const admin = await requireAdmin();
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.redirect(new URL("/admin/settings/youtube?error=not-configured", process.env.APP_URL));
  const state = randomBytes(32).toString("base64url");
  (await cookies()).set(YOUTUBE_OAUTH_COOKIE, JSON.stringify({ state, organizationId: admin.organizationId }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: `${process.env.APP_URL}/auth/youtube/callback`, response_type: "code", scope: "https://www.googleapis.com/auth/youtube.force-ssl", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state }).toString();
  return NextResponse.redirect(url);
}
