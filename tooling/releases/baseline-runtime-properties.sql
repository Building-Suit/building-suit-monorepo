-- Read-only SAS staging follow-up. No rows, expressions, bodies or secret values.
with relation as (
  select oid,relowner,relkind,relrowsecurity,relforcerowsecurity
  from pg_catalog.pg_class where oid=pg_catalog.to_regclass('public.release_candidate_baseline')
), publisher as (
  select p.proowner,p.prosecdef,r.rolsuper,r.rolbypassrls from pg_catalog.pg_proc p
  join pg_catalog.pg_roles r on r.oid=p.proowner
  where p.oid=pg_catalog.to_regprocedure('super_admin_private.release_candidate_refresh_retained(jsonb)')
)
select jsonb_build_object(
  'relationKind',t.relkind,'directChildCount',(select count(*) from pg_catalog.pg_inherits where inhparent=t.oid),
  'rlsEnabled',t.relrowsecurity,'forceRls',t.relforcerowsecurity,
  'retainedSecurityDefiner',p.prosecdef,'definerSuperuser',p.rolsuper,'definerBypassRls',p.rolbypassrls,
  'definerHasOwnerPrivileges',pg_catalog.pg_has_role(p.proowner,t.relowner,'USAGE'),
  'rlsWouldApplyToRetained',case when p.prosecdef then t.relrowsecurity and not(p.rolsuper or p.rolbypassrls)
    and (t.relforcerowsecurity or not pg_catalog.pg_has_role(p.proowner,t.relowner,'USAGE')) else null end,
  'indexes',(select jsonb_agg(jsonb_build_object('oid',i.indexrelid,'expression',i.indexprs is not null,'predicate',i.indpred is not null,
    'operatorClassOids',i.indclass::oid[], 'functions',coalesce((select jsonb_agg(distinct jsonb_build_object('oid',d.refobjid,'identity',d.refobjid::regprocedure::text))
      from pg_catalog.pg_depend d where d.classid='pg_class'::regclass and d.objid=i.indexrelid and d.refclassid='pg_proc'::regclass),'[]')))
    from pg_catalog.pg_index i where i.indrelid=t.oid),
  'policyCount',(select count(*) from pg_catalog.pg_policy where polrelid=t.oid),
  'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'generated',a.attgenerated,'identity',a.attidentity,
    'generatedFunctions',case when a.attgenerated<>'' then coalesce((select jsonb_agg(distinct jsonb_build_object(
      'oid',d.refobjid,'identity',d.refobjid::regprocedure::text)) from pg_catalog.pg_depend d
      where d.classid='pg_attrdef'::regclass and d.objid=ad.oid and d.refclassid='pg_proc'::regclass),'[]') else '[]'::jsonb end) order by a.attnum)
    from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
    where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped)
) from relation t cross join publisher p;
