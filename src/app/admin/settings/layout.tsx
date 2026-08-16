import { AppHeader } from "@/components/app-header";
import { SettingsNav } from "@/components/settings-nav";
import { requireAdmin } from "@/lib/auth";
export default async function SettingsLayout({ children }: { children: React.ReactNode }) { const admin = await requireAdmin(); return <><AppHeader user={admin}/><main className="settings-shell"><aside className="settings-sidebar"><p className="eyebrow">{admin.organizationName}</p><h1>Einstellungen</h1><SettingsNav/></aside><section className="settings-content">{children}</section></main></>; }
