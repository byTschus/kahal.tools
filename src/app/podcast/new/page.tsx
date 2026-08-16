import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { VideoTrimmer } from "@/components/video-trimmer";
import { queuePodcastJob } from "@/app/podcast/actions";
import { requireApp } from "@/lib/auth";
import { getPodcastSettings } from "@/lib/podcast";
import { youtubeAccessToken, youtubeFetch, type YouTubeAccountRow } from "@/lib/youtube";
import { database } from "@/lib/database";
import { formatInTimeZone } from "@/lib/date-time";

type Stream = { id: string; accountId: number; channel: string; title: string; description: string; start: string };

export default async function NewPodcastPage({ searchParams }: { searchParams: Promise<{ stream?: string }> }) {
  const user = await requireApp("podcast");
  const { stream: selected = "" } = await searchParams;
  const [selectedAccount, selectedVideo] = selected.split(":");
  const [accounts] = await database.execute<YouTubeAccountRow[]>("SELECT * FROM youtube_accounts WHERE organization_id=? ORDER BY channel_title", [user.organizationId]);
  const [existingJobs] = await database.execute<(import("mysql2").RowDataPacket & { youtube_video_id: string; status: string })[]>("SELECT youtube_video_id, status FROM podcast_jobs WHERE organization_id=? AND status<>'failed'", [user.organizationId]);
  const unavailableVideos = new Set(existingJobs.map(job => job.youtube_video_id));
  const streams: Stream[] = [];
  for (const account of accounts) {
    try {
      const token = await youtubeAccessToken(account);
      const result = await youtubeFetch(token, "/liveBroadcasts?part=id,snippet,status&broadcastStatus=completed&maxResults=50") as { items?: Array<{ id: string; snippet: { title: string; description?: string; actualStartTime?: string; scheduledStartTime?: string } }> };
      for (const item of result.items ?? []) streams.push({ id: item.id, accountId: account.id, channel: account.channel_title, title: item.snippet.title, description: item.snippet.description ?? "", start: item.snippet.actualStartTime ?? item.snippet.scheduledStartTime ?? "" });
    } catch (error) { console.error("Completed YouTube streams could not be loaded", error); }
  }
  streams.sort((a,b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  const chosen = streams.find(item => item.id === selectedVideo && item.accountId === Number(selectedAccount) && !unavailableVideos.has(item.id));
  const settings = await getPodcastSettings(user.organizationId);
  return <><AppHeader user={user}/><main className="admin-page"><div className="page-back"><Link href="/podcast">← Podcasts</Link></div><header className="admin-header"><div><p className="eyebrow">Podcast erstellen</p><h1>Predigt schneiden</h1></div></header>{!settings && <p className="alert">Die Podcast-Einstellungen fehlen. Ein Administrator muss sie unter <Link href="/admin/settings/podcast">Einstellungen → Podcast</Link> hinterlegen.</p>}<form method="get" className="selection-bar podcast-selection"><label>Abgeschlossener Livestream<select name="stream" required defaultValue={selected}><option value="">Stream auswählen…</option>{streams.map(item => <option key={`${item.accountId}-${item.id}`} disabled={unavailableVideos.has(item.id)} value={`${item.accountId}:${item.id}`}>{formatInTimeZone(item.start, user.organizationTimeZone)} · {item.title} · {item.channel}{unavailableVideos.has(item.id) ? " · bereits verarbeitet" : ""}</option>)}</select></label><button className="secondary-button">Stream laden</button></form>{chosen && <form action={queuePodcastJob} className="broadcast-form"><input type="hidden" name="videoId" value={chosen.id}/><input type="hidden" name="accountId" value={chosen.accountId}/><VideoTrimmer videoId={chosen.id}/><label>Folgentitel<input name="title" required defaultValue={chosen.title}/></label><label>Beschreibung<textarea name="description" rows={7} defaultValue={chosen.description}/></label><button className="primary-button" disabled={!settings}>Audioverarbeitung starten</button></form>}{!streams.length && <p className="empty-state">Keine abgeschlossenen Livestreams gefunden.</p>}</main></>;
}
