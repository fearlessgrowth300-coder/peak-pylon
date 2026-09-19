#!/usr/bin/env bash
set -euo pipefail
umask 077
test "$(id -u)" -eq 0
base=/var/backups/streamcore
private=/opt/streamcore/private
install -d -m 700 "$base" "$private"
if [ ! -f "$private/backup-passphrase" ]; then
  openssl rand -hex 48 > "$private/backup-passphrase"
fi
work=$(mktemp -d /var/backups/streamcore/restore-check.XXXXXXXX)
suffix=$(openssl rand -hex 6)
source_db=streamcore_backup_probe_$suffix
restore_db=streamcore_restore_probe_$suffix
actual_restore=streamcore_snapshot_probe_$suffix
cleanup() {
  for db in "$source_db" "$restore_db" "$actual_restore"; do
    case "$db" in
      streamcore_backup_probe_*|streamcore_restore_probe_*|streamcore_snapshot_probe_*)
        runuser -u postgres -- dropdb --if-exists "$db" >/dev/null 2>&1 || true ;;
    esac
  done
  # Only this script's validated temporary directory is removed.
  case "$work" in /var/backups/streamcore/restore-check.*) rm -r -- "$work" ;; esac
}
trap cleanup EXIT
chmod 755 "$work"
runuser -u postgres -- createdb "$source_db"
runuser -u postgres -- psql -d "$source_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE TABLE restore_canary (id integer PRIMARY KEY, content jsonb NOT NULL);
INSERT INTO restore_canary VALUES
  (1, '{"text":"backup restore test","channel":"general"}'),
  (2, '{"text":"second integrity row","channel":"clips"}');
SQL
runuser -u postgres -- pg_dump -Fc "$source_db" > "$work/probe.dump"
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$private/backup-passphrase" --symmetric --cipher-algo AES256 --output "$work/probe.gpg" "$work/probe.dump" 2>/dev/null
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$private/backup-passphrase" --decrypt --output "$work/decrypted.dump" "$work/probe.gpg" 2>/dev/null
cmp "$work/probe.dump" "$work/decrypted.dump"
chmod 644 "$work/decrypted.dump"
runuser -u postgres -- createdb "$restore_db"
runuser -u postgres -- pg_restore --exit-on-error --no-owner --no-acl -d "$restore_db" < "$work/decrypted.dump"
original=$(runuser -u postgres -- psql -d "$source_db" -Atqc 'SELECT md5(string_agg(id::text || content::text, chr(10) ORDER BY id)) FROM restore_canary')
restored=$(runuser -u postgres -- psql -d "$restore_db" -Atqc 'SELECT md5(string_agg(id::text || content::text, chr(10) ORDER BY id)) FROM restore_canary')
test "$original" = "$restored"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="$base/streamcore-$stamp.dump.gpg"
runuser -u postgres -- pg_dump -Fc streamcore > "$work/streamcore.dump"
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$private/backup-passphrase" --symmetric --cipher-algo AES256 --output "$archive" "$work/streamcore.dump" 2>/dev/null
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$private/backup-passphrase" --decrypt --output "$work/actual.dump" "$archive" 2>/dev/null
cmp "$work/streamcore.dump" "$work/actual.dump"
chmod 644 "$work/actual.dump"
runuser -u postgres -- createdb "$actual_restore"
runuser -u postgres -- pg_restore --exit-on-error --no-owner --no-acl -d "$actual_restore" < "$work/actual.dump"
tables=$(runuser -u postgres -- psql -d streamcore -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
restored_tables=$(runuser -u postgres -- psql -d "$actual_restore" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
test "$tables" = "$restored_tables"
sha256sum "$archive" > "$archive.sha256"
printf 'Encrypted canary restore: PASS (2 rows, content checksums match)\nVPS snapshot restore: PASS (%s public tables)\nArchive: %s\nProduction migration: NOT PERFORMED\n' "$tables" "$archive"
