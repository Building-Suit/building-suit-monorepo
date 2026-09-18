-- The hosted project already exposes public and graphql_public. Keep both and
-- add the isolated Shop Suit schema for Supabase Client requests.
-- All shop_crm tables have RLS; browser grants are scoped in Task 03.
-- This role setting takes precedence over the Dashboard exposed-schema list.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, shop_crm';
notify pgrst, 'reload config';
