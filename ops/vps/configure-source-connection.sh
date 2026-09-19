#!/usr/bin/env bash
set -euo pipefail
umask 077
IFS= read -r supplied_password
PGPASSWORD=$(printf %s "$supplied_password" | tr -d '\r')
export PGPASSWORD
encoded=$(node -e 'process.stdout.write(encodeURIComponent(process.env.PGPASSWORD))')
printf 'SOURCE_DATABASE_URL=postgresql://postgres:%s@db.remlkdcficnmsosulotw.supabase.co:5432/postgres\n' "$encoded" >> /opt/streamcore/private/api-stage.env
unset PGPASSWORD encoded supplied_password
chmod 600 /opt/streamcore/private/api-stage.env
systemctl restart streamcore-api
