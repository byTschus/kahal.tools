export function organizationSlug(name: string, externalId: string | number) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "gemeinde";
  return `${base}-${String(externalId).slice(-8)}`;
}
