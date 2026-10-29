-- Keep the product directory's bounded rows consistent with its technical-search
-- total. Replace only the reviewed predicate; retain signature, ACLs, ownership,
-- security mode, tenant permission check and existing page limits.
do $migration$
declare
  definition text := pg_catalog.pg_get_functiondef(
    'shop_private.list_products(uuid,text,uuid,integer,integer)'::regprocedure);
  before_predicate text := $before$or coalesce(category.name, '') ilike '%' || v_search || '%')$before$;
  after_predicate text := $after$or coalesce(category.name, '') ilike '%' || v_search || '%'
        or shop_private.matches_technical_search(p_shop_id,product.id,v_search))$after$;
begin
  if (length(definition) - length(replace(definition, before_predicate, '')))
      / length(before_predicate) <> 1
    or position('or shop_private.matches_technical_search(p_shop_id,product.id,v_search)' in definition) = 0 then
    raise exception 'Reviewed product directory search authority changed';
  end if;
  execute replace(definition, before_predicate, after_predicate);
end;
$migration$;
