import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

const errorMessages: Record<string, string> = {
  "not-configured": "Der Planning-Center-Login ist noch nicht konfiguriert.",
  "invalid-callback": "Die Anmeldung wurde nicht vollständig abgeschlossen.",
  "invalid-state": "Die Anmeldung konnte aus Sicherheitsgründen nicht bestätigt werden.",
  "oauth-failed": "Planning Center konnte die Anmeldung nicht abschließen.",
  "invalid-credentials": "Gemeinde-Kürzel, E-Mail oder Passwort ist nicht korrekt.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a className="brand" href="/login">kahal.tools</a>
        <div>
          <p className="eyebrow">Gemeinsam organisiert</p>
          <h1>Willkommen<br />zurück.</h1>
          <p className="intro">Melde dich mit deinem bestehenden Planning-Center-Konto an. Deine Gemeinde wird automatisch erkannt.</p>
        </div>
        {error && <p className="alert">{errorMessages[error] ?? "Die Anmeldung ist fehlgeschlagen."}</p>}
        <a className="primary-button" href="/auth/planning-center">
          Mit Planning Center anmelden
          <span aria-hidden="true">→</span>
        </a>
        <div className="auth-divider"><span>oder als Gemeindebenutzer</span></div>
        <form className="local-login" action="/auth/local" method="post">
          <label>Gemeinde-Kürzel<input name="organization" required autoComplete="organization" placeholder="z. B. ev-kirche-musterstadt-1234" /></label>
          <label>E-Mail<input name="email" type="email" required autoComplete="email" /></label>
          <label>Passwort<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="secondary-button">Lokal anmelden</button>
        </form>
        <p className="fine-print">Beim ersten Login wird ein Gemeindekonto angelegt. Der erste Benutzer wird Administrator, weitere Benutzer benötigen eine Freigabe.</p>
      </section>
      <aside className="auth-aside" aria-hidden="true">
        <div className="orb" />
        <p>Eine Gemeinde.<br />Viele Werkzeuge.<br />Ein Zugang.</p>
      </aside>
    </main>
  );
}
