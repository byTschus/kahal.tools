import type { RowDataPacket } from "mysql2";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/database";
import { pcoFetch, pcoSingle, syncPcoOrganization } from "@/lib/planning-center";
import { getYouTubeAccount, youtubeAccessToken, youtubeFetch, type YouTubeAccountRow } from "@/lib/youtube";
import { renderTemplate } from "@/lib/youtube-template";
import { dateKeyInTimeZone, dateTimeLocalInTimeZone } from "@/lib/date-time";
import { createYouTubeBroadcast } from "../actions";
import { AppHeader } from "@/components/app-header";

type Settings = RowDataPacket & { service_type_id: string; title_template: string; description_template: string; start_item_title: string | null };

export default async function NewBroadcastPage({ searchParams }: { searchParams: Promise<{ planId?: string; accountId?: string }> }) {
  const admin = await requireAdmin();
  const organizationTimeZone = await syncPcoOrganization(admin.organizationId);
  const params = await searchParams;
  const [settingsResult, accountsResult] = await Promise.all([database.execute<Settings[]>("SELECT * FROM youtube_settings WHERE organization_id=?", [admin.organizationId]), database.execute<YouTubeAccountRow[]>("SELECT * FROM youtube_accounts WHERE organization_id=? ORDER BY channel_title", [admin.organizationId])]);
  const settings = settingsResult[0][0];
  const accounts = accountsResult[0];
  if (!settings?.service_type_id || !accounts.length) return <><AppHeader user={admin}/><main className="admin-page"><p className="alert">Bitte zuerst YouTube und Planning Center in den <Link href="/admin/settings/youtube">YouTube-Einstellungen</Link> konfigurieren.</p></main></>;
  const plans = await pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans?filter=future&order=sort_date&per_page=100`);
  const occupiedDates = new Set<string>();
  for (const connectedAccount of accounts) {
    try {
      const accountToken = await youtubeAccessToken(connectedAccount);
      const result = await youtubeFetch(accountToken, "/liveBroadcasts?part=snippet&broadcastStatus=all&maxResults=50") as { items?: Array<{ snippet: { scheduledStartTime?: string; actualStartTime?: string } }> };
      for (const item of result.items ?? []) {
        const streamTime = item.snippet.scheduledStartTime ?? item.snippet.actualStartTime;
        if (streamTime) occupiedDates.add(dateKeyInTimeZone(streamTime, organizationTimeZone));
      }
    } catch (error) {
      console.error(`YouTube-Abgleich für ${connectedAccount.channel_id} fehlgeschlagen`, error);
    }
  }
  const decoratedPlans = plans.data.map(plan => {
    const dateKey = dateKeyInTimeZone(String(plan.attributes.sort_date ?? ""), organizationTimeZone);
    return { plan, dateKey, occupied: occupiedDates.has(dateKey) };
  });
  const orderedPlans = [...decoratedPlans.filter(entry => !entry.occupied), ...decoratedPlans.filter(entry => entry.occupied)];
  const selectedPlanId = orderedPlans.find(entry => entry.plan.id === params.planId && !entry.occupied)?.plan.id ?? orderedPlans.find(entry => !entry.occupied)?.plan.id;
  const selectedAccountId = Number(params.accountId) || accounts[0].id;
  let title = "", description = settings.description_template ?? "", start = "", team: Awaited<ReturnType<typeof pcoFetch>>["data"] = [];
  if (selectedPlanId) {
    const [planResponse, teamResponse, timesResponse] = await Promise.all([pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${selectedPlanId}`), pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${selectedPlanId}/team_members?per_page=100`), pcoFetch(admin.organizationId, `/service_types/${settings.service_type_id}/plans/${selectedPlanId}/plan_times?per_page=100`)]);
    team = teamResponse.data;
    const plan = pcoSingle(planResponse);
    if (!plan) throw new Error("Der ausgewählte Planning-Center-Plan wurde nicht gefunden");
    title = renderTemplate(settings.title_template, plan, admin.organizationName, team).slice(0, 100);
    description = renderTemplate(description, plan, admin.organizationName, team);
    start = String(timesResponse.data.find(t => t.attributes.time_type === "service")?.attributes.starts_at ?? plan.attributes.sort_date ?? "");
  }
  const ytAccount = await getYouTubeAccount(admin.organizationId, selectedAccountId);
  const token = await youtubeAccessToken(ytAccount);
  const playlists = await youtubeFetch(token, "/playlists?part=id,snippet&mine=true&maxResults=50") as { items?: Array<{ id: string; snippet: { title: string } }> };
  return <><AppHeader user={admin}/><main className="admin-page"><div className="page-back"><Link href="/youtube">← Livestreams</Link></div><header className="admin-header"><div><p className="eyebrow">YouTube Studio</p><h1>Livestream planen</h1></div></header>
    <form method="get" className="selection-bar"><label>Planning-Center-Plan<select name="planId" defaultValue={selectedPlanId}>{orderedPlans.map(({ plan, dateKey, occupied }) => <option value={plan.id} key={plan.id} disabled={occupied}>{dateKey}: {String(plan.attributes.title || plan.attributes.dates || plan.id)}{occupied ? " – Stream vorhanden" : ""}</option>)}</select><small>Belegte Plans sind deaktiviert und stehen am Ende.</small></label><label>YouTube-Kanal<select name="accountId" defaultValue={selectedAccountId}>{accounts.map(a=><option value={a.id} key={a.id}>{a.channel_title}</option>)}</select></label><button className="secondary-button" disabled={!selectedPlanId}>Daten übernehmen</button></form>
    {selectedPlanId ? <form action={createYouTubeBroadcast} className="broadcast-form"><input type="hidden" name="planId" value={selectedPlanId}/><input type="hidden" name="accountId" value={selectedAccountId}/><label>Titel<input name="title" required maxLength={100} defaultValue={title}/><small>Automatisch aus der gespeicherten Vorlage erzeugt und frei bearbeitbar.</small></label><label>Beschreibung<textarea name="description" rows={10} defaultValue={description}/></label><label>Geplanter Beginn ({organizationTimeZone})<input name="scheduledStart" type="datetime-local" required defaultValue={start ? dateTimeLocalInTimeZone(start, organizationTimeZone) : ""}/><small>Datum und Uhrzeit werden aus Planning Center übernommen, können hier aber geändert werden.</small></label><div className="form-grid"><label>Bestehende Playlist<select name="playlistId"><option value="">Keine Playlist</option>{playlists.items?.map(p=><option value={p.id} key={p.id}>{p.snippet.title}</option>)}</select></label><label>Oder neue Playlist<input name="newPlaylist" placeholder="Name der neuen Playlist"/></label></div><label>Thumbnail<input name="thumbnail" type="file" accept="image/jpeg,image/png"/><small>JPG oder PNG, maximal 2 MB.</small></label><button className="primary-button">Auf YouTube planen</button></form> : <p className="alert">Für alle zukünftigen Planning-Center-Plans existiert bereits ein YouTube-Stream.</p>}
  </main></>;
}
