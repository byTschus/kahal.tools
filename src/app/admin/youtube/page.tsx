import type { RowDataPacket } from "mysql2";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/database";
import { pcoFetch, pcoSingle, syncPcoOrganization } from "@/lib/planning-center";
import { removeYouTubeAccount, saveYouTubeSettings } from "./actions";
import { TitleTemplateBuilder, type TemplateField } from "@/components/title-template-builder";
import { redirect } from "next/navigation";

type Settings = RowDataPacket & { service_type_id: string | null; title_template: string; description_template: string | null; start_item_title: string | null; privacy_status: string };
type Account = RowDataPacket & { id: number; channel_title: string; channel_id: string };

function exampleValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export async function YouTubeSettingsContent({ searchParams }: { searchParams: Promise<{ examplePlanId?: string }> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const [settingsResult, accountsResult] = await Promise.all([
    database.execute<Settings[]>("SELECT * FROM youtube_settings WHERE organization_id=?", [admin.organizationId]),
    database.execute<Account[]>("SELECT id, channel_title, channel_id FROM youtube_accounts WHERE organization_id=? ORDER BY channel_title", [admin.organizationId]),
  ]);
  const settings = settingsResult[0][0];
  const accounts = accountsResult[0];
  let serviceTypes: Awaited<ReturnType<typeof pcoFetch>>["data"] = [];
  let items: Awaited<ReturnType<typeof pcoFetch>>["data"] = [];
  let plans: Awaited<ReturnType<typeof pcoFetch>>["data"] = [];
  let templateFields: TemplateField[] = [
    { token: "{organization.name}", label: "Name der Gemeinde", example: admin.organizationName, group: "Organisation" },
  ];
  let examplePlanId = params.examplePlanId;
  let pcoError: string | null = null;
  try {
    await syncPcoOrganization(admin.organizationId);
    serviceTypes = (await pcoFetch(admin.organizationId, "/service_types?per_page=100&order=name")).data;
    if (settings?.service_type_id) {
      plans = (await pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans?order=-sort_date&per_page=100`)).data;
      examplePlanId = examplePlanId && plans.some(plan => plan.id === examplePlanId) ? examplePlanId : plans[0]?.id;
      if (examplePlanId) {
        const [planResponse, teamResponse, itemResponse] = await Promise.all([
          pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${examplePlanId}`),
          pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${examplePlanId}/team_members?per_page=100`),
          pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${examplePlanId}/items?per_page=100`),
        ]);
        const plan = pcoSingle(planResponse);
        items = itemResponse.data;
        if (plan) {
          templateFields = [
            { token: "{plan.id}", label: "Plan-ID", example: plan.id, group: "Plan" },
            { token: "{plan.type}", label: "Ressourcentyp", example: plan.type, group: "Plan" },
            ...Object.entries(plan.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ token: `{plan.${name}}`, label: name, example: exampleValue(value), group: "Plan" as const })),
            ...Array.from(new Set(teamResponse.data.map(member => String(member.attributes.team_position_name ?? "")).filter(Boolean))).sort().map(position => ({ token: `{team.${position}}`, label: `Person(en) in Position ${position}`, example: teamResponse.data.filter(member => member.attributes.team_position_name === position).map(member => String(member.attributes.name ?? member.attributes.person_name ?? "")).filter(Boolean).join(", ") || "—", group: "Team" as const })),
            ...templateFields,
          ];
        }
      }
    }
  } catch (error) { pcoError = error instanceof Error ? error.message : "Planning-Center-Daten konnten nicht geladen werden"; }
  return <>
    <header className="admin-header"><div><p className="eyebrow">Einstellungen · {admin.organizationName}</p><h1>YouTube</h1></div><a className="primary-button compact" href="/auth/youtube">YouTube-Kanal verbinden</a></header>
    <section className="settings-section"><h2>Verbundene Kanäle</h2><div className="channel-list">{accounts.length ? accounts.map(account => <article className="channel-row" key={account.id}><div><strong>{account.channel_title}</strong><span>{account.channel_id}</span></div><form action={removeYouTubeAccount}><input type="hidden" name="accountId" value={account.id}/><button className="small-button danger">Entfernen</button></form></article>) : <p className="empty-state">Noch kein YouTube-Kanal verbunden.</p>}</div></section>
    <section className="settings-section"><h2>Planning-Center-Vorlage</h2>{pcoError ? <div className="alert"><strong>Planning Center konnte nicht geladen werden.</strong><br/>{pcoError.includes("Token") || pcoError.includes("autorisiert") ? <>Die Services-Autorisierung muss erneuert werden. <a href="/auth/planning-center">Jetzt verbinden</a></> : pcoError}</div> : <>
      {settings?.service_type_id && plans.length > 0 && <form method="get" className="example-plan-selector"><label>Beispielplan für Attribute<select name="examplePlanId" defaultValue={examplePlanId}>{plans.map(plan => <option key={plan.id} value={plan.id}>{String(plan.attributes.title || plan.attributes.dates || plan.id)}</option>)}</select></label><button className="secondary-button">Beispiele laden</button></form>}
      <form className="settings-form" action={saveYouTubeSettings}>
      <label>Service Type<select name="serviceType" required defaultValue={settings ? `${settings.service_type_id}|${serviceTypes.find(x=>x.id===settings.service_type_id)?.attributes.name ?? ""}` : ""}><option value="" disabled>Auswählen…</option>{serviceTypes.map(type=><option key={type.id} value={`${type.id}|${String(type.attributes.name ?? "")}`}>{String(type.attributes.name ?? type.id)}</option>)}</select></label>
      <TitleTemplateBuilder initialTemplate={settings?.title_template ?? "{plan.title} | {team.Verkündigung} | {organization.name}"} fields={templateFields}/>
      <label>Beschreibungsvorlage<textarea name="descriptionTemplate" rows={7} defaultValue={settings?.description_template ?? ""}/></label>
      <label>Start-Item<select name="startItemTitle" defaultValue={settings?.start_item_title ?? ""}><option value="">Erste Service-Zeit des Plans</option>{items.map(item=><option key={item.id} value={String(item.attributes.title)}>{String(item.attributes.title)}</option>)}</select></label>
      <label>Sichtbarkeit<select name="privacyStatus" defaultValue={settings?.privacy_status ?? "unlisted"}><option value="private">Privat</option><option value="unlisted">Nicht gelistet</option><option value="public">Öffentlich</option></select></label>
      <button className="primary-button">Einstellungen speichern</button>
    </form></>}</section>
  </>;
}

export default function YouTubeSettingsPage() { redirect("/admin/settings/youtube"); }
