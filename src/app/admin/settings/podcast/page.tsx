import { requireAdmin } from "@/lib/auth";
import { getPodcastSettings } from "@/lib/podcast";
import { savePodcastSettings } from "./actions";

export default async function PodcastSettingsPage() {
  const admin = await requireAdmin();
  const settings = await getPodcastSettings(admin.organizationId);
  return <><header className="admin-header"><div><p className="eyebrow">Einstellungen · {admin.organizationName}</p><h1>Podcast</h1></div></header><section className="settings-section"><h2>Feed und FTP-Speicher</h2><p className="empty-state">Der Cloud-Worker lädt fertige MP3-Dateien in dieses Verzeichnis. Das Passwort wird verschlüsselt gespeichert und nur über die geschützte Worker-API ausgeliefert.</p><form className="settings-form" action={savePodcastSettings}>
    <div className="form-grid"><label>Podcasttitel<input name="podcastTitle" required defaultValue={settings?.podcast_title ?? `${admin.organizationName} Predigten`}/></label><label>Autor<input name="podcastAuthor" defaultValue={settings?.podcast_author ?? admin.organizationName}/></label></div>
    <label>Podcastbeschreibung<textarea name="podcastDescription" rows={4} defaultValue={settings?.podcast_description ?? ""}/></label>
    <div className="form-grid"><label>Sprache<input name="podcastLanguage" defaultValue={settings?.podcast_language ?? "de-CH"}/></label><label>Cover-URL (HTTPS)<input name="podcastImageUrl" type="url" defaultValue={settings?.podcast_image_url ?? ""}/></label></div>
    <div className="form-grid"><label>FTP-Server<input name="ftpHost" required defaultValue={settings?.ftp_host ?? ""}/></label><label>FTP-Port<input name="ftpPort" type="number" min="1" max="65535" required defaultValue={settings?.ftp_port ?? 21}/></label></div>
    <div className="form-grid"><label>FTP-Benutzer<input name="ftpUsername" required defaultValue={settings?.ftp_username ?? ""}/></label><label>FTP-Passwort<input name="ftpPassword" type="password" placeholder={settings ? "Unverändert lassen" : "Passwort"}/></label></div>
    <label className="inline-check"><input name="ftpSecure" type="checkbox" defaultChecked={settings ? Boolean(settings.ftp_secure) : true}/> FTPS (explizites TLS) verwenden</label>
    <div className="form-grid"><label>FTP-Zielverzeichnis<input name="ftpDirectory" defaultValue={settings?.ftp_directory ?? "/podcast"}/></label><label>Öffentliche Basis-URL der Audiodateien<input name="publicBaseUrl" type="url" required placeholder="https://media.example.ch/podcast" defaultValue={settings?.public_base_url ?? ""}/></label></div>
    <p className="template-help"><strong>RSS-Feed</strong><code>{`${process.env.APP_URL ?? "https://deine-domain.ch"}/podcast/${admin.organizationSlug}/feed.xml`}</code></p>
    <button className="primary-button">Podcast-Einstellungen speichern</button>
  </form></section></>;
}
