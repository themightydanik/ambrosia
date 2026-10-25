#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Disposable database only. Never accepts a production connection string.
container="ambrosia-sync-test-$RANDOM-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --name "$container" -e POSTGRES_PASSWORD=ambrosia-test-only -d postgres:17 >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
sql() { docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1; }
sql < tests/db-bootstrap.sql
sql < supabase/migrations/001_initial_schema.sql
sql < tests/db-legacy.sql
sql < supabase/migrations/002_bidirectional_sync.sql
sql < tests/db-assertions.sql
