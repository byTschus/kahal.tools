import Link from "next/link";
import type { AuthUser } from "@/lib/auth";
import { AVAILABLE_APPS } from "@/lib/apps";

export function AppHeader({ user }: { user: AuthUser }) {
  return <header className="app-header"><div className="app-header-inner">
    <Link className="brand" href="/">kahal.tools</Link>
    <nav className="app-navigation" aria-label="Apps">{AVAILABLE_APPS.filter(app => user.apps.includes(app.key)).map(app => <Link href={app.href} key={app.key}><span className={`app-dot ${app.colorClass}`}/>{app.name}</Link>)}</nav>
    <details className="profile-menu"><summary><span className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="profile-name">{user.name}</span><span aria-hidden="true">⌄</span></summary><div className="profile-dropdown"><div><strong>{user.name}</strong><span>{user.email}</span><small>{user.organizationName}</small></div>{user.role === "admin" && <Link href="/admin/settings/users">Einstellungen</Link>}<form action="/auth/logout" method="post"><button>Abmelden</button></form></div></details>
  </div></header>;
}
