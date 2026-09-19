#!/usr/bin/env bash
set -euo pipefail
config=/opt/streamcore/private/api-stage.env
source "$config"
[[ "$DATABASE_URL" == */streamcore_migration_stage ]] || { echo 'Refusing tests outside staging'; exit 1; }
case "${1:-}" in
  enable)
    runuser -u postgres -- psql -d streamcore_migration_stage --set ON_ERROR_STOP=1 <<'SQL'
GRANT INSERT,UPDATE,DELETE ON public.community_posts TO streamcore_app;
SQL
    sed -i '/^ENABLE_WRITES=/d;/^WORKER_ENABLED=/d' "$config"
    printf '%s\n' 'ENABLE_WRITES=true' 'WORKER_ENABLED=false' >> "$config"
    ;;
  disable)
    sed -i '/^ENABLE_WRITES=/d;/^WORKER_ENABLED=/d' "$config"
    printf '%s\n' 'ENABLE_WRITES=false' 'WORKER_ENABLED=false' >> "$config"
    ;;
  *) echo 'Expected enable or disable'; exit 1;;
esac
chmod 600 "$config"
systemctl restart streamcore-api
