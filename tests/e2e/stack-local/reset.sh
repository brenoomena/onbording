#!/bin/bash
# Recria o banco local do zero: Auth, migrações e cache do PostgREST; reinicia o Next.
set -e
cd /var/tmp/sbstack
pkill -f "/var/tmp/sbbin/auth" || true
fuser -k 3000/tcp >/dev/null 2>&1 || true
sleep 1
P="psql -h /tmp -p 54329 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists sb with (force)" -c "create database sb"
$P -d sb <<'SQL'
grant anon, authenticated, service_role to authenticator;
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
grant create on database sb to supabase_auth_admin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
SQL
(set -a; source auth.env; set +a; GOTRUE_DB_DATABASE_URL="$DATABASE_URL" nohup /var/tmp/sbbin/auth > auth.log 2>&1 &)
for i in $(seq 1 30); do curl -sf localhost:9999/health >/dev/null && break; sleep 0.5; done
for f in /home/claude/plataforma-onboarding/supabase/migrations/*.sql; do $P -d sb -f "$f"; done
pkill -f "postgrest pgrst.conf" || true; sleep 0.5
(nohup /var/tmp/sbbin/postgrest pgrst.conf > pgrst.log 2>&1 &)
curl -s -X POST localhost:54321/__reset >/dev/null || true
echo "reset ok"
cd /home/claude/plataforma-onboarding
(NEXT_TELEMETRY_DISABLED=1 nohup npx next start -p 3000 > /var/tmp/sbstack/next.log 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null localhost:3000/login && break; sleep 0.5; done
node --env-file=.env.local node_modules/.bin/tsx scripts/criar-admin.ts breno@implantta.com.br "Breno Administrador" | tail -1
