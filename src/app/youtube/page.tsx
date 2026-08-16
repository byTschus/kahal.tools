import Link from "next/link";
import { requireApp } from "@/lib/auth";
import { database } from "@/lib/database";
import { youtubeAccessToken, youtubeFetch, type YouTubeAccountRow } from "@/lib/youtube";
import { formatInTimeZone } from "@/lib/date-time";
import { deleteBroadcast } from "@/app/youtube/manage-actions";
import { AppHeader } from "@/components/app-header";

export default async function YouTubePage() {
  const user = await requireApp("youtube");
  const [accounts] = await database.execute<YouTubeAccountRow[]>("SELECT * FROM youtube_accounts WHERE organization_id=? ORDER BY channel_title", [user.organizationId]);
  const broadcasts: Array<{ id: string; accountId: number; channel: string; title: string; start: string; status: string; thumbnail?: string }> = [];
  for (const account of accounts) {
    try {
      const token = await youtubeAccessToken(account);
      const result = await youtubeFetch(token, "/liveBroadcasts?part=id,snippet,status&broadcastStatus=all&maxResults=50") as { items?: Array<{ id: string; snippet: { title: string; scheduledStartTime: string; thumbnails?: { medium?: { url: string } } }; status: { lifeCycleStatus: string } }> };
      for (const item of result.items ?? []) broadcasts.push({ id: item.id, accountId: account.id, channel: account.channel_title, title: item.snippet.title, start: item.snippet.scheduledStartTime, status: item.status.lifeCycleStatus, thumbnail: item.snippet.thumbnails?.medium?.url });
    } catch (error) { console.error("YouTube broadcasts could not be loaded", error); }
  }
  broadcasts.sort((a,b)=>new Date(b.start).getTime()-new Date(a.start).getTime());
  return <><AppHeader user={user}/><main><div className="page-actions">{user.role === "admin" && <Link className="primary-button compact" href="/youtube/new">Livestream erstellen</Link>}</div><header className="hero compact-hero"><p className="eyebrow">{user.organizationName}</p><h1>Livestreams</h1><p className="intro">Alle geplanten, aktiven und abgeschlossenen YouTube-Übertragungen an einem Ort. Zeiten werden in {user.organizationTimeZone} angezeigt.</p></header><section className="broadcast-list">{broadcasts.length ? broadcasts.map(b=><article className="broadcast-row" key={`${b.accountId}-${b.id}`}>{b.thumbnail ? <a className="broadcast-thumbnail" style={{ backgroundImage: `url(${b.thumbnail})` }} href={`https://youtube.com/watch?v=${b.id}`} target="_blank" rel="noreferrer" aria-label={`${b.title} auf YouTube öffnen`}/> : <div className="thumbnail-placeholder"/>}<div className="broadcast-copy"><span className={`broadcast-status ${b.status}`}>{b.status}</span><h2>{b.title}</h2><p>{b.channel} · {formatInTimeZone(b.start, user.organizationTimeZone)}</p></div>{user.role === "admin" && <div className="broadcast-actions"><Link className="small-button" href={`/youtube/${b.id}/edit?accountId=${b.accountId}`}>Bearbeiten</Link><form action={deleteBroadcast}><input type="hidden" name="broadcastId" value={b.id}/><input type="hidden" name="accountId" value={b.accountId}/><button className="small-button danger">Löschen</button></form></div>}</article>) : <p className="empty-state">Noch keine Livestreams gefunden.</p>}</section></main></>;
}
