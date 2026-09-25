-- Read-only input for generate-ar-contracts.mjs, after the AR migration.
select json_agg(row_to_json(contract) order by proname) from (
  select p.proname,pg_get_function_arguments(p.oid) args,pg_get_function_result(p.oid) result
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'post_ar_document','reverse_ar_document','read_ar_open_items',
    'read_ar_statement','preview_legacy_ar','read_ar_workspace'
  )
) contract;
