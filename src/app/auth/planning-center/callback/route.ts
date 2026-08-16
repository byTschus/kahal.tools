import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { createSession } from "@/lib/auth";
import { withTransaction } from "@/lib/database";
import { organizationSlug } from "@/lib/organization";
import { encryptSecret } from "@/lib/encryption";
import {
  oauthConfig,
  OAUTH_COOKIE,
  type OAuthState,
  type PlanningCenterProfile,
  tokenEndpoint,
  userInfoEndpoint,
} from "@/lib/oauth";

type IdRow = RowDataPacket & { id: number };
type UserIdRow = IdRow & { role: "admin" | "user" };

function loginError(request: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const rawState = cookieStore.get(OAUTH_COOKIE)?.value;
  cookieStore.delete(OAUTH_COOKIE);

  if (!code || !returnedState || !rawState) return loginError(request, "invalid-callback");

  try {
    const oauth = JSON.parse(rawState) as OAuthState;
    if (oauth.state !== returnedState) return loginError(request, "invalid-state");
    const config = oauthConfig();
    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        code_verifier: oauth.verifier,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error("Token exchange failed");
    const tokens = (await tokenResponse.json()) as { access_token: string; refresh_token?: string };
    const profileResponse = await fetch(userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "User-Agent": process.env.PLANNING_CENTER_USER_AGENT ?? "kahal.tools",
      },
      cache: "no-store",
    });
    if (!profileResponse.ok) throw new Error("Profile request failed");
    const profile = (await profileResponse.json()) as PlanningCenterProfile;
    if (!profile.sub || !profile.organization_id || !profile.email) throw new Error("Incomplete profile");
    let organizationTimeZone = "UTC";
    const organizationResponse = await fetch("https://api.planningcenteronline.com/services/v2", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "User-Agent": process.env.PLANNING_CENTER_USER_AGENT ?? "kahal.tools",
      },
      cache: "no-store",
    });
    if (organizationResponse.ok) {
      const organizationPayload = await organizationResponse.json() as { data?: { attributes?: { time_zone?: string } } };
      const candidate = organizationPayload.data?.attributes?.time_zone;
      if (candidate) organizationTimeZone = candidate;
    }

    const userId = await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO organizations (planning_center_id, login_slug, name, time_zone) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), time_zone = VALUES(time_zone)`,
        [String(profile.organization_id), organizationSlug(profile.organization_name, profile.organization_id), profile.organization_name, organizationTimeZone],
      );
      const [organizationRows] = await connection.execute<IdRow[]>(
        "SELECT id FROM organizations WHERE planning_center_id = ? FOR UPDATE",
        [String(profile.organization_id)],
      );
      const organizationId = organizationRows[0].id;
      const [adminRows] = await connection.execute<IdRow[]>(
        "SELECT id FROM users WHERE organization_id = ? AND role = 'admin' LIMIT 1 FOR UPDATE",
        [organizationId],
      );
      const firstUser = adminRows.length === 0;
      await connection.execute(
        `INSERT INTO users
           (organization_id, planning_center_user_id, name, email, role, status, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE planning_center_user_id = VALUES(planning_center_user_id),
           name = VALUES(name), email = VALUES(email), last_login_at = NOW()`,
        [organizationId, profile.sub, profile.name, profile.email, firstUser ? "admin" : "user", firstUser ? "active" : "pending"],
      );
      const [userRows] = await connection.execute<UserIdRow[]>(
        "SELECT id, role FROM users WHERE planning_center_user_id = ?",
        [profile.sub],
      );
      if (tokens.refresh_token && userRows[0].role === "admin") {
        const refresh = encryptSecret(tokens.refresh_token);
        await connection.execute(
          `UPDATE organizations SET planning_center_refresh_token = ?, planning_center_refresh_iv = ?, planning_center_refresh_tag = ? WHERE id = ?`,
          [refresh.encrypted, refresh.iv, refresh.tag, organizationId],
        );
      }
      return userRows[0].id;
    });

    await createSession(userId);
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Planning Center login failed", error);
    return loginError(request, "oauth-failed");
  }
}
