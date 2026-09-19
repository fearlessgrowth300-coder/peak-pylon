#!/usr/bin/env bash
set -euo pipefail

# Prepare staging infrastructure only. This does not switch StreamCore traffic
# or alter Supabase data. Never enable shell tracing: runtime credentials must
# not appear in deployment logs.
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this bootstrap as root.' >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq postgresql postgresql-client
fi
systemctl enable --now postgresql
if ! id streamcore >/dev/null 2>&1; then
  useradd --system --home-dir /opt/streamcore --shell /usr/sbin/nologin streamcore
fi
install -d -m 750 -o root -g streamcore /opt/streamcore
install -d -m 700 -o root -g root /opt/streamcore/private
install -d -m 700 -o root -g root /var/backups/streamcore

if [ ! -f /opt/streamcore/private/database.env ]; then
  password=$(openssl rand -hex 32)
  # Refuse to take over a pre-existing role or database without its credentials.
  existing=$(runuser -u postgres -- psql -Atqc "select count(*) from pg_roles where rolname='streamcore_app'")
  if [ "$existing" != 0 ]; then
    echo 'Existing streamcore_app role found without managed credentials; stopped.' >&2
    exit 1
  fi
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 >/dev/null <<SQL
CREATE ROLE streamcore_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$password';
SQL
  umask 077
  printf 'DATABASE_URL=postgresql://streamcore_app:%s@127.0.0.1:5432/streamcore\n' "$password" > /opt/streamcore/private/database.env
  unset password
fi
exists=$(runuser -u postgres -- psql -Atqc "select count(*) from pg_database where datname='streamcore'")
if [ "$exists" = 0 ]; then
  runuser -u postgres -- createdb --owner=streamcore_app streamcore
fi
runuser -u postgres -- psql -d streamcore -v ON_ERROR_STOP=1 -qc 'REVOKE ALL ON DATABASE streamcore FROM PUBLIC;' >/dev/null
listen=$(runuser -u postgres -- psql -Atqc 'SHOW listen_addresses;')
case "$listen" in
  localhost|127.0.0.1|::1) ;;
  *) echo "PostgreSQL is not loopback-only; stopped before API setup." >&2; exit 1 ;;
esac
echo 'StreamCore staging database prepared. Credentials remain on the VPS; no production cutover performed.'
