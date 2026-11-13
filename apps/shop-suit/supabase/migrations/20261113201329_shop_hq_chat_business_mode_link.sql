begin;

create or replace function shop_private.hq_assistant_page(p_destination text) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(p_destination in ('sales','reports','products','inventory','expenses','appointments','customers','business-mode'),false);
$$;

commit;
