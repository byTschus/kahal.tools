export const AVAILABLE_APPS = [
  { key: "youtube", name: "YouTube", href: "/youtube", colorClass: "youtube-dot" },
  { key: "podcast", name: "Podcast", href: "/podcast", colorClass: "podcast-dot" },
] as const;

export type AppKey = (typeof AVAILABLE_APPS)[number]["key"];
