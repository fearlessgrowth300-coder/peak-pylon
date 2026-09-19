#!/usr/bin/env bash
set -euo pipefail
certificate=/opt/streamcore/api/supabase-ca.crt
openssl x509 -in "$certificate" -noout -checkend 86400
chown root:streamcore "$certificate" /opt/streamcore/api/server.mjs /opt/streamcore/api/probe-source.mjs
chmod 640 "$certificate" /opt/streamcore/api/server.mjs /opt/streamcore/api/probe-source.mjs
if ! grep -q '^SOURCE_CA_FILE=' /opt/streamcore/private/api-stage.env; then
  printf 'SOURCE_CA_FILE=%s\n' "$certificate" >> /opt/streamcore/private/api-stage.env
fi
cd /opt/streamcore/api
set -a
source /opt/streamcore/private/api-stage.env
set +a
node probe-source.mjs
systemctl restart streamcore-api
curl --retry 3 --retry-connrefused --retry-delay 1 --fail --silent --show-error http://127.0.0.1:4100/health
