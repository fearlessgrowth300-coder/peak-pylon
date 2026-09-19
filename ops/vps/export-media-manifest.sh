#!/usr/bin/env bash
set -euo pipefail
umask 077
IFS= read -r supplied_password
PGPASSWORD=$(printf %s "$supplied_password" | tr -d '\r')
export PGPASSWORD PGCONNECT_TIMEOUT=20
unset supplied_password
/usr/lib/postgresql/17/bin/psql 'host=db.remlkdcficnmsosulotw.supabase.co port=5432 dbname=postgres user=postgres sslmode=require' -X -At --set ON_ERROR_STOP=1 <<'SQL' > /opt/streamcore/private/source-media.jsonl
SELECT json_build_object('bucket_id',o.bucket_id,'name',o.name,'size',o.metadata->>'size','mimetype',o.metadata->>'mimetype','public',b.public) FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id ORDER BY o.bucket_id,o.name;
SQL
unset PGPASSWORD
node /root/streamcore-migrate-media.mjs
chown -R root:streamcore /opt/streamcore/media
