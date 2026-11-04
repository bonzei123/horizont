#!/bin/sh
# Alle 15 Minuten als root in der Aufgabenplanung.
# Befehl: /bin/sh /volume1/docker/horizont/deploy/proxy-watch.sh
# Im Reverse Proxy muss das Ziel http://127.0.0.1:7777 sein.
set -eu

HOST="${HORIZONT_HOST:-horizont.bonzei.eu}"
PORT="${HORIZONT_PORT:-7777}"
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl fehlt."
  exit 1
fi

probe() {
  curl -fsS --max-time 8 "$@" >/dev/null
}

if ! probe "http://127.0.0.1:${PORT}/"; then
  echo "Horizont auf 127.0.0.1:${PORT} antwortet nicht. Container wird neu gestartet."
  cd "$ROOT"
  if docker compose version >/dev/null 2>&1; then
    docker compose up -d
    docker compose restart horizont
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose up -d
    docker-compose restart horizont
  else
    echo "docker compose fehlt."
    exit 1
  fi
  sleep 3
  probe "http://127.0.0.1:${PORT}/" || {
    echo "Der Container antwortet nach dem Neustart immer noch nicht."
    exit 1
  }
fi

set +e
curl -fsS --max-time 8 --resolve "${HOST}:443:127.0.0.1" "https://${HOST}/" >/dev/null
status=$?
set -e

if [ "$status" -eq 0 ]; then
  exit 0
fi

if [ "$status" -eq 60 ]; then
  echo "Zertifikat für ${HOST} wird abgelehnt. nginx bleibt unverändert."
  exit 1
fi

echo "Reverse Proxy für ${HOST} antwortet nicht (curl ${status}). nginx wird neu gestartet."
if [ -x /usr/syno/bin/synosystemctl ]; then
  /usr/syno/bin/synosystemctl restart nginx
elif command -v systemctl >/dev/null 2>&1; then
  systemctl restart nginx
else
  echo "Der nginx-Dienst der Synology wurde nicht gefunden."
  exit 1
fi
