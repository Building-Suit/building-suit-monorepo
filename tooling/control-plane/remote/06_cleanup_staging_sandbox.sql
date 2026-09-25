\set ON_ERROR_STOP on

BEGIN;

DELETE FROM control.suits
WHERE slug = 'control-sandbox';

COMMIT;
