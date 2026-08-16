import { database } from "@/lib/database";
import { getPodcastSettings, xml } from "@/lib/podcast";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [organizations] = await database.execute<(import("mysql2").RowDataPacket & { id: number; name: string })[]>("SELECT id, name FROM organizations WHERE login_slug=?", [slug]);
  const organization = organizations[0];
  if (!organization) return new Response("Podcast not found", { status: 404 });
  const settings = await getPodcastSettings(organization.id);
  if (!settings) return new Response("Podcast not configured", { status: 404 });
  const [episodes] = await database.execute<(import("mysql2").RowDataPacket & { id: number; title: string; description: string | null; audio_url: string; audio_bytes: number; duration_seconds: number; published_at: Date })[]>("SELECT id, title, description, audio_url, audio_bytes, duration_seconds, published_at FROM podcast_jobs WHERE organization_id=? AND status='published' ORDER BY published_at DESC", [organization.id]);
  const feedUrl = new URL(request.url).toString();
  const items = episodes.map(episode => `<item><title>${xml(episode.title)}</title><description>${xml(episode.description)}</description><guid isPermaLink="false">kahal-${organization.id}-${episode.id}</guid><pubDate>${new Date(episode.published_at).toUTCString()}</pubDate><enclosure url="${xml(episode.audio_url)}" length="${episode.audio_bytes}" type="audio/mpeg"/><itunes:duration>${episode.duration_seconds}</itunes:duration><itunes:explicit>false</itunes:explicit></item>`).join("");
  const image = settings.podcast_image_url ? `<itunes:image href="${xml(settings.podcast_image_url)}"/><image><url>${xml(settings.podcast_image_url)}</url><title>${xml(settings.podcast_title)}</title><link>${xml(settings.public_base_url)}</link></image>` : "";
  const document = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(settings.podcast_title)}</title><link>${xml(settings.public_base_url)}</link><description>${xml(settings.podcast_description)}</description><language>${xml(settings.podcast_language)}</language><itunes:author>${xml(settings.podcast_author || organization.name)}</itunes:author><itunes:explicit>false</itunes:explicit>${image}<atom:link href="${xml(feedUrl)}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
  return new Response(document, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
