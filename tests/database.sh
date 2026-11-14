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

sql < supabase/migrations/003_security_premium_ai.sql
sql < tests/db-security.sql
# Twelve independent PostgreSQL connections compete for three Free slots.
pids=()
for attempt in $(seq 1 12); do
  sql >/dev/null <<SQL &
set role service_role;
select public.reserve_ai_request('cccccccc-cccc-4ccc-8ccc-cccccccccccc',gen_random_uuid(),'analyze');
SQL
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
# Then Premium requests compete for the one remaining global slot.
pids=()
for attempt in $(seq 1 12); do
  sql >/dev/null <<SQL &
set role service_role;
select public.reserve_ai_request('dddddddd-dddd-4ddd-8ddd-dddddddddddd',gen_random_uuid(),'report');
SQL
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
sql <<'SQL'
do $$ begin
  if (select used from public.ai_usage where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>3 then raise exception 'concurrent Free quota bypass';end if;
  if (select used from public.ai_usage where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>1 then raise exception 'concurrent global budget bypass';end if;
  if (select used from public.ai_global_usage)<>4 then raise exception 'incorrect global usage';end if;
  if (select count(*) from public.ai_requests)<>4 then raise exception 'incorrect durable reservations';end if;
end $$;
select 'PASS: 24 concurrent connections obey Free and global limits' as result;
SQL
sql < supabase/migrations/004_daily_wellness.sql
sql < supabase/migrations/005_ai_companion.sql
sql < tests/db-wellness.sql
for channel in chat report; do
  pids=()
  for attempt in $(seq 1 12); do
    sql >/dev/null <<SQL &
set role service_role;
select public.reserve_ai_request('99999999-9999-4999-8999-999999999999',gen_random_uuid(),'$channel');
SQL
    pids+=("$!")
  done
  for pid in "${pids[@]}";do wait "$pid";done
done
pids=()
for attempt in $(seq 1 12);do
 sql >/dev/null <<SQL &
set role service_role;
select public.reserve_ai_request('88888888-8888-4888-8888-888888888888',gen_random_uuid(),'chat');
SQL
 pids+=("$!")
done
for pid in "${pids[@]}";do wait "$pid";done
sql <<'SQL'
do $$ begin
 if (select used from public.ai_chat_usage where user_id='99999999-9999-4999-8999-999999999999')<>2 then raise exception 'concurrent chat quota bypass';end if;
 if (select used from public.ai_usage where user_id='99999999-9999-4999-8999-999999999999')<>3 then raise exception 'report quota mixed with chat';end if;
 if (select used from public.ai_chat_usage where user_id='88888888-8888-4888-8888-888888888888')<>1 then raise exception 'combined global budget bypass';end if;
 if (select used from public.ai_global_usage)<>6 then raise exception 'combined global accounting';end if;
end $$;
select 'PASS: 36 concurrent chat/report requests obey separate allowances and one shared budget' as result;
SQL
sql < supabase/migrations/006_google_play_billing.sql
sql < tests/db-billing.sql
