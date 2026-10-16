-- Read-only metadata inventory for the owning SAS administrator.
-- No baseline/customer rows, function bodies, policy expressions or secret values.
with recursive target as (
  select c.oid,c.reltype,c.relowner,c.relkind,c.relpersistence,c.relispartition,c.relrowsecurity,c.relforcerowsecurity
  from pg_catalog.pg_class c where c.oid=pg_catalog.to_regclass('public.release_candidate_baseline')
), columns as (
  select a.attname,a.atttypid,t.typtype from target x
  join pg_catalog.pg_attribute a on a.attrelid=x.oid and a.attnum>0 and not a.attisdropped
  join pg_catalog.pg_type t on t.oid=a.atttypid
), column_types as (
  select atttypid oid from columns
  union select t.typbasetype from column_types c join pg_catalog.pg_type t on t.oid=c.oid where t.typtype='d'
), controls as (
  select 'trigger'::text kind,'pg_trigger'::regclass catalog,t.oid,t.tgname::text name,
    jsonb_build_object('enabled',t.tgenabled,'eventBits',t.tgtype,'functionOid',t.tgfoid) flags
  from target x join pg_catalog.pg_trigger t on t.tgrelid=x.oid where not t.tgisinternal
  union all select 'rule','pg_rewrite'::regclass,r.oid,r.rulename::text,
    jsonb_build_object('enabled',r.ev_enabled,'event',r.ev_type)
  from target x join pg_catalog.pg_rewrite r on r.ev_class=x.oid
  union all select 'policy','pg_policy'::regclass,p.oid,p.polname::text,
    jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,'roleOids',p.polroles)
  from target x join pg_catalog.pg_policy p on p.polrelid=x.oid
  union all select 'constraint','pg_constraint'::regclass,c.oid,c.conname::text,
    jsonb_build_object('type',c.contype,'validated',c.convalidated,'domainOid',c.contypid)
  from pg_catalog.pg_constraint c where c.conrelid=(select oid from target)
    or c.contypid in(select oid from column_types)
)
select jsonb_build_object(
  'relation',(select jsonb_build_object('oid',oid,'rowTypeOid',reltype,'ownerOid',relowner,'kind',relkind,'persistence',relpersistence,'partition',relispartition,'rls',relrowsecurity,'forceRls',relforcerowsecurity) from target),
  'columns',coalesce((select jsonb_agg(jsonb_build_object('name',attname,'typeOid',atttypid,'typeKind',typtype)) from columns),'[]'),
  'controls',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'oid',oid,'name',name,'flags',flags) order by kind,oid) from controls),'[]'),
  'controlFunctions',coalesce((select jsonb_agg(distinct jsonb_build_object('controlOid',c.oid,'functionOid',d.refobjid,'identity',d.refobjid::regprocedure::text))
    from controls c join pg_catalog.pg_depend d on d.classid=c.catalog and d.objid=c.oid where d.refclassid='pg_proc'::regclass),'[]'),
  'consumers',coalesce((select jsonb_agg(jsonb_build_object('catalog',d.classid::regclass::text,'oid',d.objid,
    'identity',pg_catalog.pg_describe_object(d.classid,d.objid,d.objsubid),'referenceCatalog',d.refclassid::regclass::text,'referenceSubId',d.refobjsubid))
    from target x join pg_catalog.pg_depend d on (d.refclassid='pg_class'::regclass and d.refobjid=x.oid)
      or (d.refclassid='pg_type'::regclass and d.refobjid=x.reltype)),'[]'),
  'publications',coalesce((select jsonb_agg(jsonb_build_object('name',pubname)) from pg_catalog.pg_publication_tables
    where schemaname='public' and tablename='release_candidate_baseline'),'[]')
);
