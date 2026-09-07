#!/bin/sh
set -eu
# Uses its own disposable PostgreSQL container; never connects to a configured remote database.
cd "$(dirname "$0")/../.."
container="hatidone-sql-test-$$"
image="${HATIDONE_TEST_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.165}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT INT TERM
docker run --name "$container" --detach -e POSTGRES_PASSWORD=local-test-only "$image" >/dev/null
attempt=0
until docker exec "$container" pg_isready -h 127.0.0.1 -U supabase_admin -d postgres >/dev/null 2>&1; do
 attempt=$((attempt+1)); [ "$attempt" -lt 60 ] || exit 1; sleep 1
done
docker exec "$container" createdb -U supabase_admin -T template0 hatidone_test
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d hatidone_test < supabase/tests/bootstrap.sql >/dev/null
for migration in supabase/migrations/*.sql; do
 echo "Applying $migration"
 docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d hatidone_test < "$migration" >/dev/null
done
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d hatidone_test < supabase/seed.sql >/dev/null
for test in supabase/tests/*_test.sql; do
 echo "Testing $test"
 docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d hatidone_test < "$test"
done

python3 supabase/tests/concurrency.py "$container"
