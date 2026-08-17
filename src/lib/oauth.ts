import { createHash, randomBytes } from "node:crypto";

export const OAUTH_COOKIE = "kahal_oauth";
export const authorizationEndpoint = "https://api.planningcenteronline.com/oauth/authorize";
export const tokenEndpoint = "https://api.planningcenteronline.com/oauth/token";
export const userInfoEndpoint = "https://api.planningcenteronline.com/oauth/userinfo";

export type OAuthState = {
  state: string;
  nonce: string;
  verifier: string;
};

export type PlanningCenterProfile = {
  sub: string;
  name: string;
  email: string;
  organization_id: string | number;
  organization_name: string;
};

export function createOAuthState(): OAuthState & { challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return {
    state: randomBytes(24).toString("base64url"),
    nonce: randomBytes(24).toString("base64url"),
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

export function oauthConfig() {
  const clientId = process.env.PLANNING_CENTER_CLIENT_ID;
  const clientSecret = process.env.PLANNING_CENTER_CLIENT_SECRET;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!clientId || !clientSecret) {
    throw new Error("Planning Center OAuth is not configured");
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/auth/planning-center/callback`,
  };
}
