\set ON_ERROR_STOP on

-- Run as the owner/admin of the Automation Suit control-plane PostgreSQL database.
-- Local example after CONTROL_ADMIN_DATABASE_URL is loaded:
--   psql "$CONTROL_ADMIN_DATABASE_URL" \
--     -v dashboard_password='LONG_RANDOM_PASSWORD' \
--     -f apps/automation-suit/sql/001_dashboard_reader.sql

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_dashboard_reader') THEN
    CREATE ROLE bs_dashboard_reader
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOINHERIT;
  END IF;
END
$do$;

ALTER ROLE bs_dashboard_reader PASSWORD :'dashboard_password';
ALTER ROLE bs_dashboard_reader SET default_transaction_read_only = on;
ALTER ROLE bs_dashboard_reader SET statement_timeout = '15s';
ALTER ROLE bs_dashboard_reader SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE bs_dashboard_reader SET search_path = control, public;

GRANT USAGE ON SCHEMA control TO bs_dashboard_reader;
REVOKE CREATE ON SCHEMA control FROM bs_dashboard_reader;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA control FROM bs_dashboard_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA control TO bs_dashboard_reader;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA control FROM bs_dashboard_reader;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA control FROM bs_dashboard_reader;

-- Future control-plane tables/views created by the role executing this setup
-- remain readable, but never writable. This intentionally avoids assuming the
-- database owner is literally named "postgres".
ALTER DEFAULT PRIVILEGES IN SCHEMA control
  GRANT SELECT ON TABLES TO bs_dashboard_reader;

SELECT
  current_database() AS database_name,
  current_user AS setup_role,
  rolname,
  rolcanlogin,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolconfig
FROM pg_roles
WHERE rolname = 'bs_dashboard_reader';
