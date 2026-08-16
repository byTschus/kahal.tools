import type { RowDataPacket } from "mysql2";
import { savePlanningCenterCredentials } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/database";
import { redirect } from "next/navigation";

type OrganizationRow = RowDataPacket & {
  login_slug: string;
  planning_center_client_id: string | null;
  planning_center_user_agent: string | null;
};

export async function PlanningCenterSettingsContent() {
  const admin = await requireAdmin();
  const [rows] = await database.execute<OrganizationRow[]>(
    "SELECT login_slug, planning_center_client_id, planning_center_user_agent FROM organizations WHERE id = ?",
    [admin.organizationId],
  );
  const organization = rows[0];
  return (
    <section className="setup-card embedded">
        <p className="eyebrow">{admin.organizationName}</p>
        <h1>Planning Center verbinden</h1>
        <p className="intro">Hinterlege die Integrationsdaten deiner Gemeinde. Das Secret wird verschlüsselt gespeichert und später nicht mehr angezeigt.</p>
        <form action={savePlanningCenterCredentials} className="setup-form">
          <label>Client ID<input name="clientId" required defaultValue={organization.planning_center_client_id ?? ""}/></label>
          <label>Client Secret<input name="clientSecret" type="password" required autoComplete="new-password"/></label>
          <label>User-Agent / Kontakt<input name="userAgent" required placeholder="Meine Gemeinde (admin@example.org)" defaultValue={organization.planning_center_user_agent ?? ""}/></label>
          <button className="primary-button">Verbindung speichern</button>
        </form>
        <div className="organization-code"><span>Gemeinde-Kürzel für lokale Benutzer</span><strong>{organization.login_slug}</strong></div>
    </section>
  );
}

export default function PlanningCenterSetupPage() { redirect("/admin/settings/planning-center"); }
