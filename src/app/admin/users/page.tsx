import type { RowDataPacket } from "mysql2";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/database";
import { createLocalUser, deleteUser, updateUserApps, updateUserStatus } from "@/app/admin/actions";
import { AVAILABLE_APPS } from "@/lib/apps";

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "pending" | "active" | "rejected";
  created_at: Date;
  app_keys: string | null;
};

const statusLabels = { pending: "Ausstehend", active: "Aktiv", rejected: "Abgelehnt" };

export async function UsersSettingsContent() {
  const admin = await requireAdmin();
  const [users] = await database.execute<UserRow[]>(
    "SELECT users.id, users.name, users.email, users.role, users.status, users.created_at, (SELECT GROUP_CONCAT(app_key) FROM user_app_access WHERE user_id=users.id) AS app_keys FROM users WHERE organization_id = ? ORDER BY FIELD(status, 'pending', 'active', 'rejected'), created_at DESC",
    [admin.organizationId],
  );
  return (
    <>
      <header className="admin-header">
        <div><p className="eyebrow">Administration · {admin.organizationName}</p><h1>Benutzer verwalten</h1></div>
        <span className="count">{users.length} registriert</span>
      </header>
      <details className="create-user-panel">
        <summary>Lokalen Benutzer anlegen</summary>
        <form action={createLocalUser} className="create-user-form">
          <label>Name<input name="name" required minLength={2}/></label>
          <label>E-Mail<input name="email" type="email" required/></label>
          <label>Temporäres Passwort<input name="password" type="password" required minLength={12}/></label>
          <fieldset className="app-checkboxes"><legend>Apps</legend>{AVAILABLE_APPS.map(app => <label key={app.key}><input type="checkbox" name="apps" value={app.key}/>{app.name}</label>)}</fieldset>
          <button className="primary-button">Benutzer anlegen</button>
        </form>
        <p className="fine-print">Lokale Konten sind immer normale Benutzer. Administratoren benötigen zwingend eine Planning-Center-Verknüpfung.</p>
      </details>
      <section className="user-list">
        {users.map((user) => (
          <article className="user-row" key={user.id}>
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div className="user-identity"><strong>{user.name}</strong><span>{user.email}</span></div>
            <span className={`user-status ${user.status}`}>{user.role === "admin" ? "Administrator" : statusLabels[user.status]}</span>
            {user.role !== "admin" && (
              <><form action={updateUserApps} className="user-app-form"><input type="hidden" name="userId" value={user.id}/>{AVAILABLE_APPS.map(app => <label key={app.key}><input type="checkbox" name="apps" value={app.key} defaultChecked={(user.app_keys ?? "").split(",").includes(app.key)}/>{app.name}</label>)}<button className="small-button">Apps speichern</button></form><div className="user-actions">
                {user.status !== "active" && <form action={updateUserStatus}><input type="hidden" name="userId" value={user.id}/><input type="hidden" name="status" value="active"/><button className="small-button approve">Akzeptieren</button></form>}
                {user.status !== "rejected" && <form action={updateUserStatus}><input type="hidden" name="userId" value={user.id}/><input type="hidden" name="status" value="rejected"/><button className="small-button">Ablehnen</button></form>}
                <form action={deleteUser}><input type="hidden" name="userId" value={user.id}/><button className="small-button danger">Löschen</button></form>
              </div></>
            )}
          </article>
        ))}
      </section>
    </>
  );
}

export default function UsersPage() { redirect("/admin/settings/users"); }
