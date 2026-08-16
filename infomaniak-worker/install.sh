#!/bin/sh
set -eu
if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte als root ausführen: sudo sh install.sh" >&2
  exit 1
fi
install -d -m 0750 /opt/kahal-worker
install -m 0644 compose.yaml Dockerfile worker.py /opt/kahal-worker/
if [ ! -f /opt/kahal-worker/.env ]; then
  install -m 0600 .env.example /opt/kahal-worker/.env
  echo "Bitte /opt/kahal-worker/.env konfigurieren und danach neu starten." >&2
fi
install -m 0644 kahal-podcast-worker.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable kahal-podcast-worker.service
echo "Installiert. Nach dem Konfigurieren: sudo systemctl start kahal-podcast-worker"
