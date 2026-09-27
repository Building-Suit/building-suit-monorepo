\set ON_ERROR_STOP on

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'bs_control_app'
  ) THEN
    CREATE ROLE bs_control_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      INHERIT;
  END IF;
END
$do$;

ALTER ROLE bs_control_app
  PASSWORD :'runtime_password';

REVOKE ALL
ON SCHEMA control
FROM PUBLIC;

GRANT USAGE
ON SCHEMA control
TO bs_control_app;

GRANT
  SELECT,
  INSERT,
  UPDATE,
  DELETE
ON ALL TABLES
IN SCHEMA control
TO bs_control_app;

GRANT
  USAGE,
  SELECT,
  UPDATE
ON ALL SEQUENCES
IN SCHEMA control
TO bs_control_app;

GRANT EXECUTE
ON ALL FUNCTIONS
IN SCHEMA control
TO bs_control_app;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA control
GRANT
  SELECT,
  INSERT,
  UPDATE,
  DELETE
ON TABLES
TO bs_control_app;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA control
GRANT
  USAGE,
  SELECT,
  UPDATE
ON SEQUENCES
TO bs_control_app;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA control
GRANT EXECUTE
ON FUNCTIONS
TO bs_control_app;
