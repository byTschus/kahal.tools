import { redirect } from "next/navigation";

export default async function PodcastCutPage({ params, searchParams }: { params: Promise<{ broadcastId: string }>; searchParams: Promise<{ accountId?: string }> }) {
  const { broadcastId } = await params;
  const { accountId } = await searchParams;
  redirect(`/podcast/new?stream=${encodeURIComponent(`${accountId ?? ""}:${broadcastId}`)}`);
}
