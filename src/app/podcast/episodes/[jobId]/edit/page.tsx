import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { updatePodcast } from "@/app/podcast/actions";
import { requireApp } from "@/lib/auth";
import { database } from "@/lib/database";

export default async function EditPodcastPage({ params }: { params: Promise<{ jobId: string }> }) {
  const user = await requireApp("podcast");
  const { jobId } = await params;
  const [rows] = await database.execute<(import("mysql2").RowDataPacket & { id: number; title: string; description: string | null; audio_url: string | null })[]>("SELECT id, title, description, audio_url FROM podcast_jobs WHERE id=? AND organization_id=? AND status='published' AND operation='publish'", [Number(jobId), user.organizationId]);
  const podcast = rows[0];
  if (!podcast) return <><AppHeader user={user}/><main><p className="alert">Podcast wurde nicht gefunden.</p></main></>;
  return <><AppHeader user={user}/><main className="admin-page"><div className="page-back"><Link href="/podcast">← Podcasts</Link></div><header className="admin-header"><div><p className="eyebrow">Podcast</p><h1>Folge bearbeiten</h1></div></header><form action={updatePodcast} className="broadcast-form"><input type="hidden" name="jobId" value={podcast.id}/>{podcast.audio_url && <audio className="podcast-audio edit-audio" controls src={podcast.audio_url}/>}<label>Titel<input name="title" required defaultValue={podcast.title}/></label><label>Beschreibung<textarea name="description" rows={10} defaultValue={podcast.description ?? ""}/></label><button className="primary-button">Änderungen speichern</button></form></main></>;
}
