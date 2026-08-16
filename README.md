# kahal.tools

Ein erweiterbares Dashboard, das Services und Kennzahlen für Gemeinden zusammenführt. Das Grundgerüst enthält Next.js mit TypeScript, MariaDB und phpMyAdmin.

Der Zugang ist vollständig geschützt. Die Registrierung erfolgt über Planning Center OpenID Connect. Dabei wird die Gemeinde automatisch erkannt; der erste Benutzer einer Gemeinde wird Administrator, alle weiteren Registrierungen müssen im Adminbereich akzeptiert oder abgelehnt werden.

Mehrere Gemeinden werden getrennt verwaltet. Der erste Planning-Center-Benutzer jeder Gemeinde wird deren Administrator und hinterlegt anschließend die organisationsbezogenen Integrationsdaten. Administratoren können außerdem lokale Benutzer mit Gemeinde-Kürzel, E-Mail und Passwort anlegen. Lokale Benutzer können aus Sicherheitsgründen niemals Administrator sein.

Die YouTube-Integration unterstützt mehrere Kanäle pro Gemeinde. Livestreams können aus zukünftigen Planning-Center-Services-Plans geplant werden. Titel- und Beschreibungsvorlagen, Service Type, Start-Item und Sichtbarkeit werden pro Gemeinde gespeichert; Playlist und Thumbnail werden beim Erstellen gewählt.

## Voraussetzungen

- Docker Desktop mit Docker Compose
- Optional: Node.js 22 für lokale Editor-Werkzeuge

## Entwicklung starten

1. `.env.example` nach `.env` kopieren und bei Bedarf die lokalen Zugangsdaten ändern. Eine Entwicklungsdatei ist beim initialen Setup bereits vorhanden.
2. In Planning Center unter `https://api.planningcenteronline.com/oauth/applications` eine zentrale vertrauliche OAuth-Anwendung für kahal.tools anlegen. Als Redirect-URI `http://localhost:3000/auth/planning-center/callback` eintragen. Client-ID und Secret anschließend in `.env` setzen. Diese zentrale App ermöglicht den Erstlogin; organisationsbezogene Integrationsdaten werden danach in der Einrichtungsmaske erfasst.
3. In der Google Cloud Console die YouTube Data API v3 aktivieren und einen OAuth-Webclient anlegen. Als Redirect-URI `http://localhost:3000/auth/youtube/callback` hinterlegen und `GOOGLE_CLIENT_ID` sowie `GOOGLE_CLIENT_SECRET` in `.env` setzen.
4. In VS Code `Terminal > Run Task > Docker: Entwicklung starten` wählen oder ausführen:

   ```bash
   docker compose up --build
   ```

5. Öffnen:

   - Website: http://localhost:3000
   - Datenbankstatus: http://localhost:3000/api/health
   - phpMyAdmin: http://localhost:8080

Für phpMyAdmin gelten `MYSQL_USER` und `MYSQL_PASSWORD` aus `.env`. Änderungen unter `src/` werden durch Next.js Fast Refresh automatisch im Browser sichtbar.

## Nützliche Befehle

```bash
docker compose up --build     # Entwicklungsumgebung starten
docker compose down           # Container stoppen
docker compose down -v        # Container und lokale Datenbankdaten löschen
docker compose logs -f web    # Webserver-Protokoll verfolgen
```

## Struktur

```text
src/app/             Seiten, Layouts und API-Endpunkte
src/components/      Wiederverwendbare UI-Komponenten
src/lib/             Datenbank und gemeinsame Logik
database/init/       Einmalige SQL-Initialisierung neuer Datenbank-Volumes
.vscode/             Empfohlene Erweiterungen und Start-/Stopp-Tasks
```

Die Integrationen werden später als getrennte Provider-Module ergänzt. Tokens und API-Schlüssel gehören ausschließlich in `.env` und niemals ins Git-Repository.
