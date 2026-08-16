import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export default async function AccessStatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status === "active") redirect("/");
  const rejected = user.status === "rejected";
  return (
    <><AppHeader user={user}/><main className="status-page">
      <section className="status-card">
        <span className={`status-icon ${rejected ? "rejected" : ""}`}>{rejected ? "×" : "…"}</span>
        <p className="eyebrow">{user.organizationName}</p>
        <h1>{rejected ? "Zugang abgelehnt" : "Freigabe ausstehend"}</h1>
        <p>{rejected ? "Ein Administrator deiner Gemeinde hat deine Registrierung abgelehnt." : "Deine Registrierung war erfolgreich. Ein Administrator deiner Gemeinde muss deinen Zugang noch freigeben."}</p>
        <form action="/auth/logout" method="post"><button className="text-button">Abmelden</button></form>
      </section>
    </main></>
  );
}
