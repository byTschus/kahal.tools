import { YouTubeSettingsContent } from "@/app/admin/youtube/page";
export default function YouTubeSettingsPage({ searchParams }: { searchParams: Promise<{ examplePlanId?: string }> }) { return <YouTubeSettingsContent searchParams={searchParams}/>; }
