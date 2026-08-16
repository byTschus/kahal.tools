# kahal.tools Infomaniak Worker

Dieser Worker verarbeitet ausschliesslich Aufträge des Webtools. Er lädt den eigenen YouTube-Stream, schneidet und normalisiert die Predigt, erzeugt eine MP3-Datei und überträgt sie per FTP/FTPS.

Das Image enthält Deno und die zu `yt-dlp` passenden EJS-Komponenten. Falls YouTube bei einem gerade beendeten Livestream ein leeres Audio-DASH-Manifest liefert, versucht der Worker automatisch einen progressiven Video-/Audio-Stream als Fallback.

Nach abgeschlossener Konvertierung wird die MP3 mit dem aktuellen Unix-Zeitstempel benannt, beispielsweise `1786912345.mp3`. Dieser Dateiname wird unverändert für FTP und den RSS-Feed verwendet.

Wird eine Folge in kahal.tools gelöscht, übernimmt derselbe Worker zuerst die Löschung der MP3 auf FTP/FTPS. Erst nach erfolgreicher Bestätigung entfernt das Webtool die Folge aus Datenbank und RSS-Feed.

1. Docker Engine mit Compose-Plugin auf der Ubuntu-Instanz installieren.
2. Dieses Verzeichnis auf die Instanz kopieren.
3. `sudo sh install.sh` ausführen.
4. `/opt/kahal-worker/.env` bearbeiten und `KAHAL_API_URL` sowie dasselbe `WORKER_API_SECRET` wie im Webtool eintragen.
5. `sudo systemctl start kahal-podcast-worker` ausführen. Die Einheit startet künftig bei jedem Boot automatisch.

Nach der in `IDLE_SHUTDOWN_SECONDS` festgelegten Leerlaufzeit beendet sich der Container. Anschliessend fährt die systemd-Einheit die Cloud-Instanz herunter. Der Container erhält absichtlich keinen Zugriff auf den Docker-Socket oder den Host.

Das Webtool startet die Instanz beim Anlegen eines Auftrags über OpenStack. Dafür werden die `OPENSTACK_*`-Variablen aus der `.env.example` des Webtools benötigt. Verwende dafür einen separaten OpenStack-Benutzer mit möglichst eng begrenzten Rechten.

Verwende für `WORKER_API_SECRET` vorzugsweise 64 zufällige Hex-Zeichen. Ein `$` in einer Docker-Compose-`.env`-Datei wird als Variablenersetzung interpretiert und muss sonst escaped werden.
