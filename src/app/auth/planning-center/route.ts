import { NextResponse } from "next/server";
import { authorizationEndpoint, createOAuthState, oauthConfig, OAUTH_COOKIE } from "@/lib/oauth";

export async function GET() {
  try {
    const config = oauthConfig();
    const oauth = createOAuthState();
    const url = new URL(authorizationEndpoint);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid services");
    url.searchParams.set("state", oauth.state);
    url.searchParams.set("nonce", oauth.nonce);
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("code_challenge", oauth.challenge);
    url.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(url);
    response.cookies.set(OAUTH_COOKIE, JSON.stringify(oauth), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=not-configured", process.env.APP_URL ?? "http://localhost:3000"));
  }
}
