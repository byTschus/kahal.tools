import type { RowDataPacket } from "mysql2";
import { database } from "@/lib/database";
import { decryptSecret, encryptSecret } from "@/lib/encryption";

type PcoTokenRow = RowDataPacket & { planning_center_refresh_token: string; planning_center_refresh_iv: string; planning_center_refresh_tag: string };
type JsonApiResource = { id: string; type: string; attributes: Record<string, unknown>; relationships?: Record<string, { data: { id: string; type: string } | null }> };
export type PcoCollection = { data: JsonApiResource[]; included?: JsonApiResource[] };

export function pcoSingle(response: PcoCollection) {
  const data = response.data as JsonApiResource[] | JsonApiResource;
  return Array.isArray(data) ? data[0] : data;
}

async function accessToken(organizationId: number) {
  const [rows] = await database.execute<PcoTokenRow[]>("SELECT planning_center_refresh_token, planning_center_refresh_iv, planning_center_refresh_tag FROM organizations WHERE id = ?", [organizationId]);
  const row = rows[0];
  if (!row?.planning_center_refresh_token) throw new Error("Planning Center Services ist nicht autorisiert");
  const response = await fetch("https://api.planningcenteronline.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "refresh_token", refresh_token: decryptSecret(row.planning_center_refresh_token, row.planning_center_refresh_iv, row.planning_center_refresh_tag), client_id: process.env.PLANNING_CENTER_CLIENT_ID, client_secret: process.env.PLANNING_CENTER_CLIENT_SECRET }), cache: "no-store" });
  if (!response.ok) throw new Error("Planning Center Token konnte nicht erneuert werden");
  const token = await response.json() as { access_token: string; refresh_token?: string };
  if (token.refresh_token) {
    const encrypted = encryptSecret(token.refresh_token);
    await database.execute("UPDATE organizations SET planning_center_refresh_token=?, planning_center_refresh_iv=?, planning_center_refresh_tag=? WHERE id=?", [encrypted.encrypted, encrypted.iv, encrypted.tag, organizationId]);
  }
  return token.access_token;
}

export async function pcoFetch(organizationId: number, path: string): Promise<PcoCollection> {
  const token = await accessToken(organizationId);
  const response = await fetch(`https://api.planningcenteronline.com/services/v2${path}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": process.env.PLANNING_CENTER_USER_AGENT ?? "kahal.tools" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Planning Center API: ${response.status}`);
  return response.json();
}

export async function syncPcoOrganization(organizationId: number) {
  const response = await pcoFetch(organizationId, "");
  const organization = pcoSingle(response);
  const timeZone = String(organization?.attributes.time_zone ?? "UTC");
  try {
    new Intl.DateTimeFormat("de-CH", { timeZone }).format();
  } catch {
    throw new Error(`Planning Center lieferte eine ungültige Zeitzone: ${timeZone}`);
  }
  const organizationName = organization?.attributes.name ? String(organization.attributes.name) : null;
  await database.execute("UPDATE organizations SET time_zone = ?, name = COALESCE(?, name) WHERE id = ?", [timeZone, organizationName, organizationId]);
  return timeZone;
}
