#!/usr/bin/env bash
set -euo pipefail
umask 077
IFS= read -r supplied_password
PGPASSWORD=$(printf %s "$supplied_password" | tr -d '\r')
export PGPASSWORD PGCONNECT_TIMEOUT=20
unset supplied_password
connection='host=db.remlkdcficnmsosulotw.supabase.co port=5432 dbname=postgres user=postgres sslmode=require'
archive="/var/backups/streamcore/supabase-production-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg"
/usr/lib/postgresql/17/bin/pg_dump "$connection" -Fc --no-owner --no-acl | gpg --batch --yes --pinentry-mode loopback --passphrase-file /opt/streamcore/private/backup-passphrase --symmetric --cipher-algo AES256 --output "$archive"
unset PGPASSWORD
sha256sum "$archive"
printf 'Encrypted production export completed: %s\n' "$archive"
