#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/streamcore/api
npm install --omit=dev --ignore-scripts --no-audit --no-fund
runuser -u postgres -- psql -d streamcore_migration_stage --set ON_ERROR_STOP=1 <<'SQL'
GRANT CONNECT ON DATABASE streamcore_migration_stage TO streamcore_app;
GRANT USAGE ON SCHEMA public TO streamcore_app;
GRANT SELECT ON public.community_posts, public.profiles, public.user_roles TO streamcore_app;
SQL
source /opt/streamcore/private/database.env
printf 'DATABASE_URL=%s\n' "${DATABASE_URL%/streamcore}/streamcore_migration_stage" > /opt/streamcore/private/api-stage.env
printf '%s\n' 'SUPABASE_URL=https://remlkdcficnmsosulotw.supabase.co' 'SUPABASE_PUBLISHABLE_KEY=sb_publishable_2eGnWft5rQjhZLU4Qjx2bw_9xdgSv_Q' 'ENABLE_WRITES=false' 'PORT=4100' >> /opt/streamcore/private/api-stage.env
chmod 600 /opt/streamcore/private/api-stage.env
chown -R root:streamcore /opt/streamcore/api
chmod -R g+rX /opt/streamcore/api
install -m 644 streamcore-api.service /etc/systemd/system/streamcore-api.service
systemctl daemon-reload
systemctl enable --now streamcore-api.service
