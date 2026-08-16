import { IntegrationCard } from "@/components/integration-card";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import { redirect } from "next/navigation";
import { database } from "@/lib/database";
import { AppHeader } from "@/components/app-header";

const integrations = [
  { name: "YouTube", description: "Videos, Livestreams und Kanalstatistiken zusammenführen." },
  { name: "Planning Center", description: "Teams, Pläne und Gottesdienste übersichtlich verbinden." },
  { name: "Podcast", description: "Episoden und Reichweite verschiedener Feeds bündeln." },
  { name: "Besucherzähler", description: "Besucherzahlen erfassen und Entwicklungen sichtbar machen." },
  { name: "ChurchTools", description: "Optionale Anbindung für Kalender, Gruppen und Ressourcen." },
];

export default async function Home() {
  const user = await requireUser();
  if (user.role === "admin") {
    const [rows] = await database.execute<(RowDataPacket & { configured: number })[]>(
      "SELECT planning_center_client_id IS NOT NULL AS configured FROM organizations WHERE id = ?",
      [user.organizationId],
    );
    if (!rows[0]?.configured) redirect("/admin/settings/planning-center");
  }
  return (
    <><AppHeader user={user}/><main>
      <header className="hero">
        <p className="eyebrow">Gemeinde-Dashboard</p>
        <h1>Alles Wichtige.<br />An einem Ort.</h1>
        <p className="intro">
          kahal.tools verbindet die Services, Daten und Kennzahlen deiner Gemeinde in einer klaren Oberfläche.
        </p>
      </header>

      <section aria-labelledby="integrations-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Integrationen</p>
            <h2 id="integrations-heading">Das Fundament steht.</h2>
          </div>
          <span className="count">{integrations.length} geplant</span>
        </div>
        <div className="integration-grid">
          {integrations.filter(integration => integration.name !== "YouTube" || user.apps.includes("youtube")).map((integration) => integration.name === "YouTube" ? <Link className="card-link" href="/youtube" key={integration.name}><IntegrationCard {...integration} status="Bereit"/></Link> : <IntegrationCard key={integration.name} {...integration} />)}
        </div>
      </section>
    </main></>
  );
}
