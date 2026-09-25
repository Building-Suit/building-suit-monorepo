-- Read-only input for generate-ap-contracts.mjs, after the AP migration.
select json_agg(row_to_json(contract) order by proname) from (
  select p.proname,pg_get_function_arguments(p.oid) args,pg_get_function_result(p.oid) result
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'post_ap_document','reverse_ap_document','read_ap_open_items',
    'read_ap_statement','preview_legacy_ap','read_ap_workspace'
  )
) contract;
