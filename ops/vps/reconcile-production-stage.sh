#!/usr/bin/env bash
set -euo pipefail
umask 077
IFS= read -r supplied_password
PGPASSWORD=$(printf %s "$supplied_password" | tr -d '\r')
export PGPASSWORD PGCONNECT_TIMEOUT=20
unset supplied_password
work=$(mktemp -d /opt/streamcore/private/reconcile.XXXXXXXX)
cleanup() {
  case "$work" in /opt/streamcore/private/reconcile.*) rm -r -- "$work" ;; *) exit 1 ;; esac
}
trap cleanup EXIT
runuser -u postgres -- psql -d streamcore_migration_stage -Atc "SELECT format('SELECT %L, count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), %L ORDER BY md5(to_jsonb(t)::text)), %L)) FROM public.%I t;', tablename, '', '', tablename) FROM pg_tables WHERE schemaname='public' ORDER BY tablename" > "$work/queries.sql"
/usr/lib/postgresql/17/bin/psql 'host=db.remlkdcficnmsosulotw.supabase.co port=5432 dbname=postgres user=postgres sslmode=require' -X -At --set ON_ERROR_STOP=1 -f "$work/queries.sql" > "$work/source"
unset PGPASSWORD
runuser -u postgres -- psql -X -At --set ON_ERROR_STOP=1 -d streamcore_migration_stage < "$work/queries.sql" > "$work/stage"
printf 'Table | rows | content checksum (staging)\n'
cat "$work/stage"
if diff -u "$work/source" "$work/stage"; then
  printf 'All application table counts and content hashes match current Supabase data.\n'
else
  printf 'Data differences detected; no production cutover permitted yet.\n' >&2
  exit 1
fi
