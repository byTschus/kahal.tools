export async function wakePodcastWorker() {
  const authUrl = process.env.OPENSTACK_AUTH_URL?.replace(/\/$/, "");
  const username = process.env.OPENSTACK_USERNAME;
  const password = process.env.OPENSTACK_PASSWORD;
  const projectId = process.env.OPENSTACK_PROJECT_ID;
  const userDomain = process.env.OPENSTACK_USER_DOMAIN ?? "Default";
  const instanceId = process.env.OPENSTACK_INSTANCE_ID;
  const region = process.env.OPENSTACK_REGION;
  if (!authUrl || !username || !password || !projectId || !instanceId) return { configured: false };
  const response = await fetch(`${authUrl}/auth/tokens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auth: { identity: { methods: ["password"], password: { user: { name: username, domain: { name: userDomain }, password } } }, scope: { project: { id: projectId } } } }), cache: "no-store" });
  if (!response.ok) throw new Error(`Cloud-Worker konnte nicht authentifiziert werden (${response.status})`);
  const token = response.headers.get("x-subject-token");
  const catalog = (await response.json()) as { token?: { catalog?: Array<{ type: string; endpoints: Array<{ interface: string; region?: string; url: string }> }> } };
  const compute = catalog.token?.catalog?.find(service => service.type === "compute")?.endpoints.find(endpoint => endpoint.interface === "public" && (!region || endpoint.region === region));
  if (!token || !compute) throw new Error("Kein Compute-Endpunkt in der OpenStack-Antwort gefunden");
  const start = await fetch(`${compute.url.replace(/\/$/, "")}/servers/${encodeURIComponent(instanceId)}/action`, { method: "POST", headers: { "X-Auth-Token": token, "Content-Type": "application/json" }, body: JSON.stringify({ "os-start": null }), cache: "no-store" });
  if (!start.ok && start.status !== 409) throw new Error(`Cloud-Worker konnte nicht gestartet werden (${start.status})`);
  return { configured: true };
}
