import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { requireAdmin } from "@/lib/auth";
import { dateTimeLocalInTimeZone } from "@/lib/date-time";
import { getYouTubeAccount, youtubeAccessToken, youtubeFetch } from "@/lib/youtube";
import { updateBroadcast } from "@/app/youtube/manage-actions";

export default async function EditBroadcastPage({ params, searchParams }: { params: Promise<{ broadcastId: string }>; searchParams: Promise<{ accountId?: string }> }) {
  const admin = await requireAdmin();
  const { broadcastId } = await params;
  const { accountId } = await searchParams;
  const account = await getYouTubeAccount(admin.organizationId, Number(accountId));
  const token = await youtubeAccessToken(account);
  const response = await youtubeFetch(token, `/liveBroadcasts?part=snippet,status&id=${encodeURIComponent(broadcastId)}`) as { items?: Array<{ id: string; snippet: { title: string; description?: string; scheduledStartTime: string }; status: { privacyStatus: string } }> };
  const broadcast = response.items?.[0];
  if (!broadcast) return <><AppHeader user={admin}/><main className="admin-page"><p className="alert">Der Livestream wurde auf diesem Kanal nicht gefunden.</p></main></>;
  return <><AppHeader user={admin}/><main className="admin-page"><div className="page-back"><Link href="/youtube">← Livestreams</Link></div><header className="admin-header"><div><p className="eyebrow">{account.channel_title}</p><h1>Livestream bearbeiten</h1></div></header><form action={updateBroadcast} className="broadcast-form"><input type="hidden" name="broadcastId" value={broadcast.id}/><input type="hidden" name="accountId" value={account.id}/><label>Titel<input name="title" required maxLength={100} defaultValue={broadcast.snippet.title}/></label><label>Beschreibung<textarea name="description" rows={10} defaultValue={broadcast.snippet.description ?? ""}/></label><div className="form-grid"><label>Startzeit ({admin.organizationTimeZone})<input name="scheduledStart" type="datetime-local" required defaultValue={dateTimeLocalInTimeZone(broadcast.snippet.scheduledStartTime, admin.organizationTimeZone)}/></label><label>Sichtbarkeit<select name="privacyStatus" defaultValue={broadcast.status.privacyStatus}><option value="private">Privat</option><option value="unlisted">Nicht gelistet</option><option value="public">Öffentlich</option></select></label></div><button className="primary-button">Änderungen auf YouTube speichern</button></form></main></>;
}
