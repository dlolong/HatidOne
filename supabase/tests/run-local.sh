#!/bin/sh
set -eu
# Creates fresh, isolated databases. Never connects to any existing local or remote stack.
cd "$(dirname "$0")/../.."
container="hatidone-sql-test-$$"
image="${HATIDONE_TEST_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.165}"
logs=$(mktemp -d "${TMPDIR:-/tmp}/hatidone-sql.XXXXXX")
trap 'docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$logs"' EXIT INT TERM
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
 echo 'BLOCKED: disposable PostgreSQL tests require a running Docker engine.' >&2
 exit 2
fi
docker run --name "$container" --detach -e POSTGRES_PASSWORD=local-test-only "$image" >/dev/null
attempt=0
until docker exec "$container" pg_isready -h 127.0.0.1 -U supabase_admin -d postgres >/dev/null 2>&1; do
 attempt=$((attempt+1)); [ "$attempt" -lt 60 ] || { echo 'BLOCKED: PostgreSQL did not become ready.' >&2; exit 2; }; sleep 1
done
apply() {
 if ! docker exec -i "$container" psql -X -qAt -v ON_ERROR_STOP=1 -U supabase_admin -d "$database" < "$1" > "$logs/output" 2> "$logs/error"; then
  echo "FAIL: $database: $1" >&2
  cat "$logs/error" >&2
  exit 1
 fi
 # Display assertion labels, never arbitrary SQL results (which can contain fixture PINs).
 sed -n '/^PASS:/p' "$logs/output"
}
for database in hatidone_test hatidone_upgrade; do
 docker exec "$container" createdb -U supabase_admin -T template0 "$database"
 apply supabase/tests/bootstrap.sql
 if [ "$database" = hatidone_upgrade ]; then
  for migration in supabase/migrations/*.sql; do
   case "$(basename "$migration")" in 000[1-8]_*) apply "$migration" ;; esac
  done
  apply supabase/tests/upgrade-fixture.sql
  { printf 'begin;\n'; cat supabase/migrations/0009_rc1_release_contract.sql; printf '\ncommit;\n'; } > "$logs/blocked-upgrade.sql"
  if docker exec -i "$container" psql -X -qAt -v ON_ERROR_STOP=1 -U supabase_admin -d "$database" < "$logs/blocked-upgrade.sql" > "$logs/output" 2> "$logs/error"; then
   echo 'FAIL: upgrade accepted an active legacy ride' >&2; exit 1
  fi
  if ! rg -q 'RC1 upgrade blocked: drain active rides' "$logs/error"; then
   cat "$logs/error" >&2; exit 1
  fi
  echo 'PASS: upgrade refuses active legacy rides before schema changes'
  apply supabase/tests/upgrade-drain.sql
 fi
 for migration in supabase/migrations/*.sql; do
  if [ "$database" = hatidone_upgrade ]; then
   case "$(basename "$migration")" in 000[1-8]_*) continue ;; esac
  fi
  echo "Applying $database: $migration"
  apply "$migration"
 done
 # This explicit designation exists only inside this newly created disposable container.
 { printf "select set_config('hatidone.allow_fictional_seed','true',false);\n"; cat supabase/seed.sql; } > "$logs/seed.sql"
 apply "$logs/seed.sql"
 if [ "$database" = hatidone_upgrade ]; then apply supabase/tests/upgrade_test.sql; fi
 for test in supabase/tests/*_test.sql; do
  case "$test" in */upgrade_test.sql) continue ;; esac
  echo "Testing $database: $test"
  apply "$test"
 done
 python3 -u supabase/tests/concurrency.py "$container" "$database"
 echo "PASS: $database migration application and integration tests"
done
