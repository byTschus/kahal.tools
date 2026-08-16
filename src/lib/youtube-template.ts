type Resource = { attributes?: Record<string, unknown> };

export function renderTemplate(template: string, plan: Resource, organizationName: string, teamMembers: Resource[]) {
  const planAttributes = plan?.attributes ?? {};
  return template.replace(/\{([^}]+)\}/g, (_, token: string) => {
    if (token === "organization.name") return organizationName;
    if (token === "plan.id") return String((plan as { id?: string }).id ?? "");
    if (token === "plan.type") return String((plan as { type?: string }).type ?? "");
    if (token.startsWith("plan.")) return String(planAttributes[token.slice(5)] ?? "");
    if (token.startsWith("team.")) {
      const position = token.slice(5).toLowerCase();
      return teamMembers.filter(member => String(member.attributes?.team_position_name ?? "").toLowerCase() === position).map(member => String(member.attributes?.name ?? member.attributes?.person_name ?? "")).filter(Boolean).join(", ");
    }
    return "";
  }).replace(/\s+\|\s+\|/g, " | ").trim();
}
