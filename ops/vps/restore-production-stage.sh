#!/usr/bin/env bash
set -euo pipefail
umask 077
archive=/var/backups/streamcore/supabase-production-20260915T092735Z.dump.gpg
stage=streamcore_migration_stage
work=$(mktemp -d /opt/streamcore/private/migration.XXXXXXXX)
cleanup() {
  case "$work" in /opt/streamcore/private/migration.*) rm -r -- "$work" ;; *) exit 1 ;; esac
}
trap cleanup EXIT
if runuser -u postgres -- psql -Atc "SELECT 1 FROM pg_database WHERE datname='$stage'" | grep -q 1; then
  printf 'Staging database already exists; refusing to overwrite.\n' >&2
  exit 1
fi
gpg --batch --quiet --pinentry-mode loopback --passphrase-file /opt/streamcore/private/backup-passphrase --decrypt "$archive" > "$work/source.dump"
/usr/lib/postgresql/17/bin/pg_restore --list "$work/source.dump" > "$work/toc"
# Restore application data only, not Supabase-managed auth, policies or workers.
awk '/^[0-9]+; [0-9]+ [0-9]+ (TYPE|TABLE|TABLE DATA|SEQUENCE|SEQUENCE SET) public / { print }' "$work/toc" > "$work/application.toc"
runuser -u postgres -- createdb --owner=streamcore_app "$stage"
/usr/lib/postgresql/17/bin/pg_restore --no-owner --no-acl --use-list="$work/application.toc" --file="$work/application.sql" "$work/source.dump"
# PostgreSQL 17 dumps include a setting not supported by the isolated PG16 stage.
sed '/^SET transaction_timeout = /d' "$work/application.sql" > "$work/compatible.sql"
runuser -u postgres -- psql --set ON_ERROR_STOP=1 --single-transaction -d "$stage" < "$work/compatible.sql" > "$work/restore.log"
runuser -u postgres -- psql -d "$stage" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
printf 'Application staging import completed; production unchanged.\n'
