-- Guarded staging-only adaptive dispatch activation. CLI-created forward migration.
-- Trusted deployer must independently verify project dpruoncalmwicrqhqelu;
-- database postgres alone is not a project-identity proof. No new access/grants.
-- Entire file AND migration-history insertion require one outer transaction.
-- No authored BEGIN/COMMIT. Autocommit loses this sentinel before preflight,
-- failing before persistent DDL; deployer must stop on the first SQL error.
-- On uncertain commit/history response, inspect history, exact definitions and
-- both cron identities before any retry. Never replay or adopt partial state.
create temporary table hq_adaptive_activation_evidence(label text primary key,value jsonb not null) on commit drop;
-- BEGIN HOSTED ADAPTIVE BASELINE
insert into pg_temp.hq_adaptive_activation_evidence values('expected',$hosted$
{
  "functions": [
    {
      "acl": [
        "=X/supabase_admin",
        "supabase_admin=X/supabase_admin",
        "postgres=X*/supabase_admin"
      ],
      "kind": "f",
      "owner": "supabase_admin",
      "config": null,
      "body_md5": "b3a464e5efed87e0ca18254b65e41db0",
      "security": false,
      "signature": "cron.schedule(text,text)",
      "definition_md5": "6c597582b622a38cf573f29f73315b97"
    },
    {
      "acl": [
        "=X/supabase_admin",
        "supabase_admin=X/supabase_admin",
        "postgres=X*/supabase_admin"
      ],
      "kind": "f",
      "owner": "supabase_admin",
      "config": null,
      "body_md5": "5c92925f774018cbc464e282ae2fdd71",
      "security": false,
      "signature": "cron.schedule(text,text,text)",
      "definition_md5": "e08de01fe12ab7af1eb1d3f335b97e67"
    },
    {
      "acl": [
        "=X/supabase_admin",
        "supabase_admin=X/supabase_admin",
        "postgres=X*/supabase_admin"
      ],
      "kind": "f",
      "owner": "supabase_admin",
      "config": null,
      "body_md5": "04ce3d2d0c8733820cdb658e2ede8283",
      "security": false,
      "signature": "cron.unschedule(bigint)",
      "definition_md5": "dd843bceda448dbc9309df9fa03ad325"
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "bfc681863d6f917aab2ee78798a5a944",
      "security": true,
      "signature": "hq_private.live_deliver(uuid)",
      "definition_md5": "4bbfd7c6dc3d88365cec47482b05d4be"
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "49268338977dc433fb7c676f49c62e1d",
      "security": true,
      "signature": "hq_private.live_dispatch_cancel()",
      "definition_md5": "1bec07057dd489ab52919e1ef7ad823f"
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "b9a4568bb3b5f4e947e7e762ae49a9a3",
      "security": false,
      "signature": "hq_private.live_dispatch_reconcile(uuid,uuid,bigint)",
      "definition_md5": "069ef448654d617ca11c6b8443c408e1"
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "a0a7da72b6d019d3fb113793f074f665",
      "security": true,
      "signature": "hq_private.live_dispatch_schedule(timestamp with time zone)",
      "definition_md5": "18d568690439e57fe29cdb9874c7365f"
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "kind": "p",
      "owner": "postgres",
      "config": null,
      "body_md5": "ed08eed103378864eb6a8386fd187439",
      "security": false,
      "signature": "hq_private.live_dispatch_tick()",
      "definition_md5": "c934046bbd3e9f001a254afb485a31f1"
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "3bff46ba9a8cb136bf33793286e39605",
      "security": true,
      "signature": "hq_private.live_emit(text)",
      "definition_md5": "d3afb835da9eb6990f6f3e023bfaaec3"
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "618470b0fc057294b37835f81a684a87",
      "security": true,
      "signature": "hq_private.live_enqueue_v2(text,text,jsonb)",
      "definition_md5": "0dc2b4539d161fae510dcbc03dcc2911"
    },
    {
      "acl": [
        "postgres=X/postgres",
        "service_role=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "4c2a75079a21171a07156fe1d48a1181",
      "security": true,
      "signature": "hq_private.live_flush(integer)",
      "definition_md5": "089ab51640b0290bd1fb0ee9f62e1dca"
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "c22df5e9d51f1bbaf2fe7e9434117f41",
      "security": false,
      "signature": "hq_private.require_brain_service()",
      "definition_md5": "187710e01e4ea8cdd7026d13cf7d1a6f"
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "4e49f0abc304886312c576a30e55dfc9",
      "security": true,
      "signature": "hq_private.worker_presence(uuid)",
      "definition_md5": "16372e19af257084cb6f8683ab02dd99"
    },
    {
      "acl": [
        "postgres=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "04bd48e5684436bcb4287fbb48485bf9",
      "security": true,
      "signature": "hq_private.workforce_wake()",
      "definition_md5": "56d17c2a277356215b177d727f7ddba7"
    },
    {
      "acl": [
        "postgres=X/postgres",
        "service_role=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "ee8d4a7ba8ff32f3c47e70b49a64be90",
      "security": false,
      "signature": "public.hq_live_flush(integer)",
      "definition_md5": "8e333ce0ccc3c2c8d4cd7fc5d9e70478"
    },
    {
      "acl": [
        "postgres=X/postgres",
        "authenticated=X/postgres"
      ],
      "kind": "f",
      "owner": "postgres",
      "config": [
        "search_path=\"\""
      ],
      "body_md5": "3dddf3e610d829524ca7f4ee65bf3c96",
      "security": false,
      "signature": "public.hq_worker_presence(uuid)",
      "definition_md5": "8599cd38317c439e398bee2d5aa70470"
    },
    {
      "acl": [
        "=X/supabase_realtime_admin",
        "supabase_realtime_admin=X/supabase_realtime_admin",
        "postgres=X/supabase_realtime_admin",
        "dashboard_user=X/supabase_realtime_admin"
      ],
      "kind": "f",
      "owner": "supabase_realtime_admin",
      "config": null,
      "body_md5": "c12384e30dda994bf2e0d23daeaea20b",
      "security": false,
      "signature": "realtime.send(jsonb,text,text,boolean)",
      "definition_md5": "77afe4a67a0330f080cb562cec0898bd"
    }
  ],
  "schema": {
    "acl": [
      "postgres=UC/postgres",
      "authenticated=U/postgres",
      "service_role=U/postgres"
    ],
    "owner": "postgres"
  },
  "tables": [
    {
      "acl": [
        "postgres=arwdDxtm/postgres"
      ],
      "rls": true,
      "name": "live_dispatch_state",
      "owner": "postgres",
      "force_rls": false
    },
    {
      "acl": [
        "postgres=arwdDxtm/postgres"
      ],
      "rls": true,
      "name": "live_invalidations",
      "owner": "postgres",
      "force_rls": false
    }
  ],
  "columns": [
    {
      "acl": null,
      "name": "circuit_open",
      "type": "boolean",
      "table": "hq_private.live_dispatch_state",
      "default": "false",
      "nullable": false
    },
    {
      "acl": null,
      "name": "due_at",
      "type": "timestamp with time zone",
      "table": "hq_private.live_dispatch_state",
      "default": null,
      "nullable": true
    },
    {
      "acl": null,
      "name": "generation",
      "type": "bigint",
      "table": "hq_private.live_dispatch_state",
      "default": "0",
      "nullable": false
    },
    {
      "acl": null,
      "name": "last_error",
      "type": "text",
      "table": "hq_private.live_dispatch_state",
      "default": null,
      "nullable": true
    },
    {
      "acl": null,
      "name": "singleton",
      "type": "boolean",
      "table": "hq_private.live_dispatch_state",
      "default": "true",
      "nullable": false
    },
    {
      "acl": null,
      "name": "attempt_token",
      "type": "uuid",
      "table": "hq_private.live_invalidations",
      "default": null,
      "nullable": true
    },
    {
      "acl": null,
      "name": "attempts",
      "type": "integer",
      "table": "hq_private.live_invalidations",
      "default": "0",
      "nullable": false
    },
    {
      "acl": null,
      "name": "created_at",
      "type": "timestamp with time zone",
      "table": "hq_private.live_invalidations",
      "default": "clock_timestamp()",
      "nullable": false
    },
    {
      "acl": null,
      "name": "delivered_at",
      "type": "timestamp with time zone",
      "table": "hq_private.live_invalidations",
      "default": null,
      "nullable": true
    },
    {
      "acl": null,
      "name": "event",
      "type": "text",
      "table": "hq_private.live_invalidations",
      "default": "'invalidate'::text",
      "nullable": false
    },
    {
      "acl": null,
      "name": "format_version",
      "type": "integer",
      "table": "hq_private.live_invalidations",
      "default": "1",
      "nullable": false
    },
    {
      "acl": null,
      "name": "id",
      "type": "uuid",
      "table": "hq_private.live_invalidations",
      "default": "gen_random_uuid()",
      "nullable": false
    },
    {
      "acl": null,
      "name": "kind",
      "type": "text",
      "table": "hq_private.live_invalidations",
      "default": null,
      "nullable": false
    },
    {
      "acl": null,
      "name": "last_error",
      "type": "text",
      "table": "hq_private.live_invalidations",
      "default": null,
      "nullable": true
    },
    {
      "acl": null,
      "name": "next_attempt_at",
      "type": "timestamp with time zone",
      "table": "hq_private.live_invalidations",
      "default": "clock_timestamp()",
      "nullable": false
    },
    {
      "acl": null,
      "name": "payload",
      "type": "jsonb",
      "table": "hq_private.live_invalidations",
      "default": null,
      "nullable": true
    }
  ],
  "constraints": [
    {
      "name": "live_dispatch_state_generation_check",
      "table": "hq_private.live_dispatch_state",
      "definition": "CHECK ((generation >= 0))"
    },
    {
      "name": "live_dispatch_state_last_error_check",
      "table": "hq_private.live_dispatch_state",
      "definition": "CHECK ((last_error = ANY (ARRAY['publication-unverified'::text, 'attempts-exhausted'::text])))"
    },
    {
      "name": "live_dispatch_state_pkey",
      "table": "hq_private.live_dispatch_state",
      "definition": "PRIMARY KEY (singleton)"
    },
    {
      "name": "live_dispatch_state_singleton_check",
      "table": "hq_private.live_dispatch_state",
      "definition": "CHECK (singleton)"
    },
    {
      "name": "live_invalidations_attempts_check",
      "table": "hq_private.live_invalidations",
      "definition": "CHECK (((attempts >= 0) AND (attempts <= 6)))"
    },
    {
      "name": "live_invalidations_event_check",
      "table": "hq_private.live_invalidations",
      "definition": "CHECK ((event = ANY (ARRAY['invalidate'::text, 'presence'::text])))"
    },
    {
      "name": "live_invalidations_format_version_check",
      "table": "hq_private.live_invalidations",
      "definition": "CHECK ((format_version = ANY (ARRAY[1, 2])))"
    },
    {
      "name": "live_invalidations_kind_check",
      "table": "hq_private.live_invalidations",
      "definition": "CHECK ((kind = ANY (ARRAY['brain'::text, 'company'::text, 'access'::text, 'agents'::text])))"
    },
    {
      "name": "live_invalidations_last_error_check",
      "table": "hq_private.live_invalidations",
      "definition": "CHECK ((last_error = ANY (ARRAY['publication-unverified'::text, 'attempts-exhausted'::text])))"
    },
    {
      "name": "live_invalidations_pkey",
      "table": "hq_private.live_invalidations",
      "definition": "PRIMARY KEY (id)"
    }
  ],
  "indexes": [
    {
      "name": "hq_private.hq_live_pending_idx",
      "definition": "CREATE INDEX hq_live_pending_idx ON hq_private.live_invalidations USING btree (created_at, id) WHERE (delivered_at IS NULL)"
    },
    {
      "name": "hq_private.hq_live_v2_pending_idx",
      "definition": "CREATE INDEX hq_live_v2_pending_idx ON hq_private.live_invalidations USING btree (next_attempt_at, created_at, id) WHERE ((delivered_at IS NULL) AND (format_version = 2))"
    },
    {
      "name": "hq_private.live_dispatch_state_pkey",
      "definition": "CREATE UNIQUE INDEX live_dispatch_state_pkey ON hq_private.live_dispatch_state USING btree (singleton)"
    },
    {
      "name": "hq_private.live_invalidations_pkey",
      "definition": "CREATE UNIQUE INDEX live_invalidations_pkey ON hq_private.live_invalidations USING btree (id)"
    }
  ],
  "roles": [
    {
      "name": "anon",
      "super": false,
      "bypass": false,
      "inherit": true,
      "postgres_set": false,
      "schema_create": false,
      "postgres_usage": false
    },
    {
      "name": "authenticated",
      "super": false,
      "bypass": false,
      "inherit": true,
      "postgres_set": false,
      "schema_create": false,
      "postgres_usage": false
    },
    {
      "name": "postgres",
      "super": false,
      "bypass": true,
      "inherit": true,
      "postgres_set": true,
      "schema_create": true,
      "postgres_usage": true
    },
    {
      "name": "service_role",
      "super": false,
      "bypass": true,
      "inherit": true,
      "postgres_set": false,
      "schema_create": false,
      "postgres_usage": false
    }
  ],
  "cron_table": {
    "owner": "supabase_admin",
    "rls": true,
    "acl": [
      "supabase_admin=arwdDxtm/supabase_admin",
      "=r/supabase_admin",
      "postgres=r*/supabase_admin"
    ]
  }
}
$hosted$::jsonb);
-- END HOSTED ADAPTIVE BASELINE

DO $preflight$
declare expected jsonb; actual jsonb; spec jsonb; owner_id oid; app_role text;
begin
  if pg_catalog.to_regclass('pg_temp.hq_adaptive_activation_evidence') is null then
    raise exception 'HQ_ADAPTIVE_OUTER_TRANSACTION_REQUIRED';
  end if;
  select value into strict expected from pg_temp.hq_adaptive_activation_evidence where label='expected';
  if current_user<>'postgres' or session_user<>'postgres' or pg_catalog.current_database()<>'postgres' then
    raise exception 'HQ_ADAPTIVE_OWNER_DATABASE_MISMATCH';
  end if;
  if pg_catalog.current_setting('server_version_num')::integer<>170011
    or (select extversion from pg_catalog.pg_extension where extname='pg_cron') is distinct from '1.6.4'
    or pg_catalog.current_setting('cron.database_name',true) is distinct from 'postgres'
    or pg_catalog.current_setting('cron.use_background_workers',true) is distinct from 'off'
    or pg_catalog.current_setting('cron.timezone',true) is distinct from 'GMT'
    or pg_catalog.current_setting('cron.host',true) is distinct from 'localhost'
    or pg_catalog.current_setting('port')<>'5432'
    or pg_catalog.current_setting('cron.launch_active_jobs',true) is distinct from 'on'
    or pg_catalog.current_setting('cron.enable_superuser_jobs',true) is distinct from 'on'
    or pg_catalog.current_setting('cron.log_run',true) is distinct from 'on' then
    raise exception 'HQ_ADAPTIVE_RUNTIME_CONFIG_DRIFT';
  end if;
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261109150515' and name='hq_live_dispatch_activation')
    or exists(select 1 from supabase_migrations.schema_migrations where version>'20261109150515') then
    raise exception 'HQ_ADAPTIVE_HISTORY_RECONCILIATION_REQUIRED';
  end if;
  select oid into strict owner_id from pg_catalog.pg_roles where rolname='postgres';
  for spec in select value from pg_catalog.jsonb_array_elements(expected->'roles') loop
  -- BEGIN ADAPTIVE CATALOG ROLES
    select pg_catalog.jsonb_build_object('name',rolname,'super',rolsuper,'bypass',rolbypassrls,'inherit',rolinherit,
      'postgres_set',pg_catalog.pg_has_role(oid,owner_id,'SET'),
      'postgres_usage',pg_catalog.pg_has_role(oid,owner_id,'USAGE'),
      'schema_create',pg_catalog.has_schema_privilege(oid,'hq_private','CREATE')) into actual
      from pg_catalog.pg_roles where rolname=spec->>'name';
  -- END ADAPTIVE CATALOG ROLES
    if actual is distinct from spec then raise exception 'HQ_ADAPTIVE_ROLE_AUTHORITY_DRIFT: %',spec->>'name'; end if;
  end loop;
  -- BEGIN ADAPTIVE CATALOG SCHEMA
  select pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(nspowner),'acl',nspacl::text[]) into actual
    from pg_catalog.pg_namespace where nspname='hq_private';
  -- END ADAPTIVE CATALOG SCHEMA
  if actual is distinct from expected->'schema' then raise exception 'HQ_ADAPTIVE_SCHEMA_ACCESS_DRIFT'; end if;
  if exists(select 1 from pg_catalog.pg_default_acl where defaclrole=owner_id
      and defaclnamespace in (0,'hq_private'::pg_catalog.regnamespace) and defaclobjtype in ('f','r')) then
    raise exception 'HQ_ADAPTIVE_DEFAULT_ACL_REVIEW_REQUIRED';
  end if;
  if not pg_catalog.has_schema_privilege(current_user,'cron','USAGE')
    or not pg_catalog.has_function_privilege(current_user,'cron.schedule(text,text,text)','EXECUTE')
    or not pg_catalog.has_function_privilege(current_user,'cron.schedule(text,text)','EXECUTE')
    or not pg_catalog.has_function_privilege(current_user,'cron.unschedule(bigint)','EXECUTE')
    or not pg_catalog.has_schema_privilege(current_user,'realtime','USAGE')
    or not pg_catalog.has_function_privilege(current_user,'realtime.send(jsonb,text,text,boolean)','EXECUTE')
    or not pg_catalog.has_table_privilege(current_user,'realtime.messages','SELECT')
    or not pg_catalog.has_table_privilege(current_user,'realtime.messages','INSERT') then
    raise exception 'HQ_ADAPTIVE_EXISTING_PRIVILEGES_REQUIRED';
  end if;
  -- Hosted cron metadata is provider-owned and SELECT-only for postgres.
  -- Never lock rows FOR UPDATE, write it directly or grant additional access.
  -- BEGIN ADAPTIVE CATALOG CRON_TABLE
  select pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(relowner),
    'rls',relrowsecurity,'acl',relacl::text[]) into actual from pg_catalog.pg_class
    where oid='cron.job'::pg_catalog.regclass;
  -- END ADAPTIVE CATALOG CRON_TABLE
  if actual is distinct from expected->'cron_table'
    or not pg_catalog.has_table_privilege(current_user,'cron.job','SELECT')
    or pg_catalog.has_table_privilege(current_user,'cron.job','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'HQ_ADAPTIVE_CRON_TABLE_AUTHORITY_DRIFT';
  end if;
  if exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='hq_private' and p.proname='live_dispatch_watchdog')
    or pg_catalog.to_regclass('hq_private.hq_live_v3_jobs_pending_idx') is not null then
    raise exception 'HQ_ADAPTIVE_OBJECT_COLLISION';
  end if;
  -- Existing producer lock order is state -> outbox -> cron. Reverse order
  -- could deadlock against a transaction holding state before its outbox INSERT.
  perform pg_catalog.set_config('lock_timeout','5s',true);
  lock table hq_private.live_dispatch_state in access exclusive mode;
  lock table hq_private.live_invalidations in access exclusive mode;
  for spec in select value from pg_catalog.jsonb_array_elements(expected->'functions') loop
    -- BEGIN ADAPTIVE CATALOG FUNCTIONS
    select pg_catalog.jsonb_build_object('signature',spec->>'signature','owner',pg_catalog.pg_get_userbyid(routine.proowner),
      'kind',routine.prokind::text,'security',routine.prosecdef,'config',routine.proconfig,'acl',routine.proacl::text[],
      'body_md5',pg_catalog.md5(routine.prosrc),'definition_md5',pg_catalog.md5(pg_catalog.pg_get_functiondef(routine.oid))) into actual
      from pg_catalog.pg_proc routine where routine.oid=pg_catalog.to_regprocedure(spec->>'signature');
    -- END ADAPTIVE CATALOG FUNCTIONS
    if not found then raise exception 'HQ_ADAPTIVE_ROUTINE_MISSING: %',spec->>'signature'; end if;
    if actual is distinct from spec then raise exception 'HQ_ADAPTIVE_ROUTINE_DRIFT: %',spec->>'signature'; end if;
  end loop;
  -- BEGIN ADAPTIVE CATALOG TABLES
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),
      'acl',c.relacl::text[],'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by c.relname) into actual
    from pg_catalog.pg_class c where c.oid in ('hq_private.live_invalidations'::pg_catalog.regclass,'hq_private.live_dispatch_state'::pg_catalog.regclass);
  -- END ADAPTIVE CATALOG TABLES
  if actual is distinct from expected->'tables' then raise exception 'HQ_ADAPTIVE_TABLE_ACCESS_DRIFT'; end if;
  -- BEGIN ADAPTIVE CATALOG COLUMNS
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',n.nspname||'.'||c.relname,'name',a.attname,
      'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'nullable',not a.attnotnull,
      'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl::text[]) order by c.relname,a.attname) into actual
    from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where c.oid in ('hq_private.live_invalidations'::pg_catalog.regclass,'hq_private.live_dispatch_state'::pg_catalog.regclass)
      and a.attnum>0 and not a.attisdropped;
  -- END ADAPTIVE CATALOG COLUMNS
  if actual is distinct from expected->'columns' then raise exception 'HQ_ADAPTIVE_COLUMN_DRIFT'; end if;
  -- BEGIN ADAPTIVE CATALOG CONSTRAINTS
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',n.nspname||'.'||c.relname,'name',k.conname,
      'definition',pg_catalog.pg_get_constraintdef(k.oid)) order by c.relname,k.conname) into actual
    from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where c.oid in ('hq_private.live_invalidations'::pg_catalog.regclass,'hq_private.live_dispatch_state'::pg_catalog.regclass);
  -- END ADAPTIVE CATALOG CONSTRAINTS
  if actual is distinct from expected->'constraints' then raise exception 'HQ_ADAPTIVE_CONSTRAINT_DRIFT'; end if;
  -- BEGIN ADAPTIVE CATALOG INDEXES
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',n.nspname||'.'||c.relname,
      'definition',pg_catalog.pg_get_indexdef(i.indexrelid)) order by c.relname) into actual
    from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indexrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where i.indrelid in ('hq_private.live_invalidations'::pg_catalog.regclass,'hq_private.live_dispatch_state'::pg_catalog.regclass);
  -- END ADAPTIVE CATALOG INDEXES
  if actual is distinct from expected->'indexes' then raise exception 'HQ_ADAPTIVE_INDEX_DRIFT'; end if;
  if exists(select 1 from pg_catalog.pg_class where oid in
      ('hq_private.live_invalidations'::pg_catalog.regclass,'hq_private.live_dispatch_state'::pg_catalog.regclass)
      and (relkind<>'r' or relpersistence<>'p'))
    or exists(select 1 from pg_catalog.pg_trigger where not tgisinternal and tgrelid in
      ('hq_private.live_invalidations'::pg_catalog.regclass,'hq_private.live_dispatch_state'::pg_catalog.regclass))
    or exists(select 1 from pg_catalog.pg_index where indrelid in
      ('hq_private.live_invalidations'::pg_catalog.regclass,'hq_private.live_dispatch_state'::pg_catalog.regclass)
      and (not indisvalid or not indisready))
    or exists(select 1 from pg_catalog.pg_policy where polrelid in
      ('hq_private.live_invalidations'::pg_catalog.regclass,'hq_private.live_dispatch_state'::pg_catalog.regclass))
    or (select count(*) from hq_private.live_dispatch_state)<>1
    or not exists(select 1 from hq_private.live_dispatch_state where singleton)
    or exists(select 1 from hq_private.live_invalidations where format_version not in (1,2) or event='jobs') then
    raise exception 'HQ_ADAPTIVE_BASELINE_STATE_DRIFT';
  end if;
  foreach app_role in array array['anon','authenticated','service_role'] loop
    if pg_catalog.has_table_privilege(app_role,'hq_private.live_invalidations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      or pg_catalog.has_any_column_privilege(app_role,'hq_private.live_invalidations','SELECT,INSERT,UPDATE,REFERENCES')
      or pg_catalog.has_table_privilege(app_role,'hq_private.live_dispatch_state','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      or pg_catalog.has_any_column_privilege(app_role,'hq_private.live_dispatch_state','SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception 'HQ_ADAPTIVE_EFFECTIVE_TABLE_ACCESS: %',app_role;
    end if;
  end loop;
  -- Read-only identity checks. The new cold job uses the append-only two-arg
  -- schedule overload, never the named upsert; absence needs no write lock.
  -- Existing watchdog-like jobs mean uncertain prior action and are not adopted.
  if exists(select 1 from cron.job where jobname='hq-live-watchdog'
      or command ~ 'hq_private[.]live_dispatch_watchdog')
    or (select count(*) from cron.job where jobname='hq-live-once')>1
    or exists(select 1 from cron.job where jobname='hq-live-once' and
      (username<>'postgres' or database<>'postgres' or nodename<>'localhost' or nodeport<>5432
       or not active or command<>'call hq_private.live_dispatch_tick()' or schedule !~ '^([1-9]|[1-5][0-9]) seconds?$')) then
    raise exception 'HQ_ADAPTIVE_JOB_IDENTITY_COLLISION';
  end if;
  insert into pg_temp.hq_adaptive_activation_evidence
    select 'outbox_rows',coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by id),'[]'::jsonb) from hq_private.live_invalidations i;
  insert into pg_temp.hq_adaptive_activation_evidence
    select 'browser_state',pg_catalog.to_jsonb(s) from hq_private.live_dispatch_state s;
  insert into pg_temp.hq_adaptive_activation_evidence
    select 'other_cron_jobs',coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(j) order by jobid),'[]'::jsonb)
      from cron.job j where jobname is distinct from 'hq-live-once' and jobname is distinct from 'hq-live-watchdog';
  insert into pg_temp.hq_adaptive_activation_evidence
    select 'hot_job',coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(j) order by jobid),'[]'::jsonb) from cron.job j where jobname='hq-live-once';
end $preflight$;

-- The immutable proposal uses no cold-job name at runtime. Persist the fresh
-- unnamed job identity privately, outside the unchanged proposal body.
alter table hq_private.live_dispatch_state add column watchdog_job_id bigint;

-- BEGIN EXACT ADAPTIVE PROPOSAL BODY
-- DISPOSABLE SOURCE PROPOSAL ONLY. Requires the applied 20261109150515 shape.
-- Not an activation migration. No cron job is installed by this file.
-- A separately reviewed owner setup would install hq-live-watchdog with
-- '* * * * *' / 'select hq_private.live_dispatch_watchdog()'. Tests do so locally.
-- No new credentials, grants, RPCs, data replay, circuit reset or cleanup.
-- Jobs use a new format_version=3 fence. Old dispatcher bodies select only
-- version 2 and therefore cannot reserve jobs or open the browser circuit for
-- a jobs failure, even if they begin selection after this atomic replacement.
-- An old callback may still remove the hot wake; the independent cold watchdog
-- recovers it. Existing browser v2 and quarantined v1 rows are never rewritten.
-- The original hq-live-once job becomes a hot, one-second backlog dispatcher.
-- A missed/canceled hot wake is recovered by the durable minute watchdog.
-- Nominal idle cost: 1,440 cold launches/day plus cron run-log retention.
-- Nominal cold latency: up to 60 seconds plus hot launch/connection/queue time;
-- outages, lock contention and failed authentication have no finite SLA here.
-- Five-minute cold polling (288 launches/day) is an UNSELECTED alternative:
-- its cold delay exceeds the existing 150-second presence freshness window.
-- Minimum retry deadlines and six-reservation budget remain unchanged; a
-- future-only retry may wait another cold interval after becoming due.
-- One publication per hot tick limits sustained service to roughly 60/minute
-- before connection/transaction overhead. Idle rate is not a pricing promise.

-- BEGIN ADAPTIVE SCHEMA PREPARATION
-- Apply the complete proposal in one transaction. Existing v1/v2 rows are
-- untouched; jobs is a new strictly constrained v3 envelope, not a topic field.
alter table hq_private.live_invalidations
  drop constraint live_invalidations_event_check,
  drop constraint live_invalidations_format_version_check;
alter table hq_private.live_invalidations
  add constraint live_invalidations_event_check check (event in ('invalidate','presence','jobs')),
  add constraint live_invalidations_format_version_check check (format_version in (1,2,3)),
  add constraint live_invalidations_v3_event_check check (format_version<>3 or event='jobs'),
  add constraint live_invalidations_jobs_shape_check check (event<>'jobs' or
    (format_version=3 and kind='agents' and payload is not null and payload='{}'::jsonb));
create index hq_live_v3_jobs_pending_idx on hq_private.live_invalidations(next_attempt_at,created_at,id)
  where delivered_at is null and format_version=3 and event='jobs';
-- Existing circuit_open/last_error remain the browser lane and are never reset.
-- Jobs wakes have their own breaker so UI failures cannot permanently suppress
-- the worker's only push wake. Budgets/tokens remain per outbox event.
alter table hq_private.live_dispatch_state
  add column jobs_circuit_open boolean not null default false,
  add column jobs_last_error text check (jobs_last_error in ('publication-unverified','attempts-exhausted'));
-- END ADAPTIVE SCHEMA PREPARATION

-- BEGIN ADAPTIVE ROUTINE DEFINITIONS
-- Test seams distinguish schema-lock behavior from old-CALL compatibility;
-- these markers do not authorize a split production deployment.
-- Keep the existing helper signature; only the jobs event chooses version 3.
create or replace function hq_private.live_enqueue_v2(p_kind text,p_event text,p_payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare key text; begin
  if p_kind is null or p_kind not in ('brain','company','access','agents')
    or p_event is null or p_event not in ('invalidate','presence','jobs')
    or p_payload is null or pg_catalog.jsonb_typeof(p_payload)<>'object' then
    raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
  end if;
  if (p_event='jobs' and (p_kind<>'agents' or p_payload<>'{}'::jsonb)) or
    (p_event='invalidate' and p_payload<>pg_catalog.jsonb_build_object('kind',p_kind)) or
    (p_event='presence' and (p_kind<>'agents' or p_payload-array['observedAt','agentId','taskId']::text[]<>'{}'::jsonb
      or not (p_payload ?& array['observedAt','agentId','taskId'])
      or pg_catalog.jsonb_typeof(p_payload->'observedAt')<>'string'
      or pg_catalog.jsonb_typeof(p_payload->'agentId') not in ('string','null')
      or pg_catalog.jsonb_typeof(p_payload->'taskId') not in ('string','null')))
    or pg_catalog.octet_length(p_payload::text)>1024 then
    raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
  end if;
  key:='hq.live_emitted_v2_'||p_event||'_'||p_kind;
  if pg_catalog.current_setting(key,true)='1' then return; end if;
  insert into hq_private.live_invalidations(kind,format_version,event,payload)
    values(p_kind,case when p_event='jobs' then 3 else 2 end,p_event,p_payload);
  perform pg_catalog.set_config(key,'1',true);
end $$;

create or replace function hq_private.live_deliver(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare item hq_private.live_invalidations; expected jsonb; delivery_topic text; begin
  select * into item from hq_private.live_invalidations where id=p_id for update;
  if not found then raise exception 'HQ_INVALID_LIVE_ID' using errcode='22023'; end if;
  if item.format_version=1 then raise exception 'HQ_LIVE_LEGACY_UNVERIFIED'; end if;
  if not ((item.format_version=2 and item.event in ('invalidate','presence'))
    or (item.format_version=3 and item.event='jobs')) then
    raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
  end if;
  if item.delivered_at is not null then return true; end if;
  if item.attempt_token is null or item.attempts=0 then raise exception 'HQ_LIVE_ATTEMPT_REQUIRED'; end if;
  -- No caller-controlled destination. Jobs wakes contain no task or user data.
  if item.event='jobs' then
    if item.kind is distinct from 'agents' or item.payload is distinct from '{}'::jsonb then
      raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
    end if;
    delivery_topic:='hq-agent-jobs';
  elsif item.event in ('invalidate','presence') then
    delivery_topic:='hq-live';
  else
    raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
  end if;
  expected:=item.payload||pg_catalog.jsonb_build_object('id',item.id);
  perform realtime.send(expected,item.event,delivery_topic,true);
  -- Provider generates an independent messages.id. Correlate payload.id only.
  if not exists(select 1 from realtime.messages m where m.topic=delivery_topic and m.event=item.event
    and m.extension='broadcast' and m.private and m.payload=expected
    and m.inserted_at >= (pg_catalog.transaction_timestamp() at time zone 'UTC')) then
    raise exception 'HQ_LIVE_PUBLICATION_UNVERIFIED';
  end if;
  update hq_private.live_invalidations set delivered_at=pg_catalog.clock_timestamp(),last_error=null,attempt_token=null where id=p_id;
  return true;
end $$;

-- Preserve both effects of workforce_wake without either synchronous send.
-- The worker consumes any broadcast on its existing private jobs channel;
-- only kind=roster has special meaning. The id-only jobs receipt changes none
-- of its claim, lease, journal or late-discard authority checks.
create or replace function hq_private.workforce_wake() returns void
language plpgsql security definer set search_path='' as $$ begin
  perform hq_private.live_emit('agents');
  perform hq_private.live_enqueue_v2('agents','jobs','{}'::jsonb);
end $$;

-- All callers are dispatcher-side and hold the state row lock. p_due is
-- retained for already-running old procedure bodies; it is diagnostic only.
-- A delayed old callback may arm an unnecessary hot wake, which the next tick
-- removes. It cannot change the independent cold-watchdog schedule.
create or replace function hq_private.live_dispatch_schedule(p_due timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare existing_job record; begin
  if p_due is null or not pg_catalog.isfinite(p_due) then raise exception 'HQ_INVALID_DISPATCH_TIME' using errcode='22023'; end if;
  select * into existing_job from cron.job where jobname='hq-live-once' and username=current_user;
  if found and (existing_job.database<>pg_catalog.current_database()
    or existing_job.command<>'call hq_private.live_dispatch_tick()') then
    raise exception 'HQ_LIVE_HOT_JOB_COLLISION';
  end if;
  if existing_job.jobid is null or not existing_job.active or existing_job.schedule<>'1 second' then
    perform cron.schedule('hq-live-once','1 second','call hq_private.live_dispatch_tick()');
  end if;
  update hq_private.live_dispatch_state set due_at=p_due where singleton;
end $$;

-- Keep cancel's identity/ACL, but its scope remains ONLY the hot job.
create or replace function hq_private.live_dispatch_cancel() returns void
language plpgsql security definer set search_path='' as $$
declare j record; begin
  for j in select jobid,database,command from cron.job where jobname='hq-live-once' and username=current_user loop
    if j.database<>pg_catalog.current_database() or j.command<>'call hq_private.live_dispatch_tick()' then
      raise exception 'HQ_LIVE_HOT_JOB_COLLISION';
    end if;
    perform cron.unschedule(j.jobid);
  end loop;
  update hq_private.live_dispatch_state set due_at=null where singleton;
end $$;

-- The cold watchdog only ensures due work has a hot wake. It never cancels
-- an in-flight hot publisher just because its reserved row is not yet due.
-- Empty/future-only queues perform no writes or scheduler mutations here.
create function hq_private.live_dispatch_watchdog() returns void
language plpgsql security invoker set search_path='' as $$
declare state hq_private.live_dispatch_state; next_due timestamptz; begin
  if current_user<>pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class
      where oid='hq_private.live_dispatch_state'::pg_catalog.regclass)) then
    raise exception 'HQ_LIVE_OWNER_REQUIRED' using errcode='42501';
  end if;
  select * into state from hq_private.live_dispatch_state where singleton;
  if not exists(select 1 from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs'))
      and delivered_at is null and next_attempt_at<=pg_catalog.clock_timestamp()
      and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open))) then return; end if;
  select * into state from hq_private.live_dispatch_state where singleton for update skip locked;
  if not found then return; end if;
  select min(next_attempt_at) into next_due from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
    and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open));
  if next_due<=pg_catalog.clock_timestamp() then perform hq_private.live_dispatch_schedule(next_due); end if;
end $$;

-- p_generation is retained for in-flight old CALLs, not a producer fence.
-- Producers never touch state. A row committed just after the final queue read
-- may lose the hot wake, but the independent watchdog bounds that cold delay.
create or replace function hq_private.live_dispatch_reconcile(p_id uuid,p_token uuid,p_generation bigint) returns void
language plpgsql security invoker set search_path='' as $$
declare state hq_private.live_dispatch_state; current_item hq_private.live_invalidations; next_due timestamptz;
begin
  if p_id is null or p_token is null or p_generation is null or p_generation<0 then
    raise exception 'HQ_INVALID_LIVE_RECONCILE' using errcode='22023';
  end if;
  select * into state from hq_private.live_dispatch_state where singleton for update;
  select * into current_item from hq_private.live_invalidations where id=p_id and ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs'));
  -- Never reopen either lane or let a jobs callback erase browser diagnostics.
  if current_item.event='jobs' and not state.jobs_circuit_open then
    if current_item.delivered_at is not null then
      update hq_private.live_dispatch_state set jobs_last_error=null where singleton;
    elsif current_item.attempt_token=p_token then
      update hq_private.live_dispatch_state set jobs_last_error='publication-unverified' where singleton;
    end if;
  elsif current_item.event in ('invalidate','presence') and not state.circuit_open then
    if current_item.delivered_at is not null then
      update hq_private.live_dispatch_state set last_error=null where singleton;
    elsif current_item.attempt_token=p_token then
      update hq_private.live_dispatch_state set last_error='publication-unverified' where singleton;
    end if;
  end if;
  select min(next_attempt_at) into next_due from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
    and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open));
  if next_due<=pg_catalog.clock_timestamp() then
    perform hq_private.live_dispatch_schedule(next_due);
  else
    perform hq_private.live_dispatch_cancel();
    update hq_private.live_dispatch_state set due_at=next_due where singleton;
  end if;
end $$;

create or replace procedure hq_private.live_dispatch_tick()
language plpgsql security invoker as $$
declare state hq_private.live_dispatch_state; item hq_private.live_invalidations;
  token uuid; observed_generation bigint; next_due timestamptz;
begin
  perform pg_catalog.set_config('search_path','',true);
  if current_user<>pg_catalog.pg_get_userbyid((select c.relowner from pg_catalog.pg_class c
      where c.oid='hq_private.live_dispatch_state'::pg_catalog.regclass)) then
    raise exception 'HQ_LIVE_OWNER_REQUIRED' using errcode='42501';
  end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then
    raise exception 'HQ_LIVE_READ_COMMITTED_REQUIRED' using errcode='25001';
  end if;
  select * into state from hq_private.live_dispatch_state where singleton for update;
  observed_generation:=state.generation;
  select * into item from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
    and next_attempt_at<=pg_catalog.clock_timestamp()
    and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open))
    order by created_at,id limit 1 for update skip locked;
  if not found then
    select min(next_attempt_at) into next_due from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
      and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open));
    perform hq_private.live_dispatch_cancel();
    update hq_private.live_dispatch_state set due_at=next_due where singleton;
    return;
  end if;
  if item.attempts>=6 then
    update hq_private.live_invalidations set last_error='attempts-exhausted',attempt_token=null where id=item.id;
    if item.event='jobs' then
      update hq_private.live_dispatch_state set jobs_circuit_open=true,jobs_last_error='attempts-exhausted' where singleton;
      state.jobs_circuit_open:=true;
    else
      update hq_private.live_dispatch_state set circuit_open=true,last_error='attempts-exhausted' where singleton;
      state.circuit_open:=true;
    end if;
    select min(next_attempt_at) into next_due from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
      and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open));
    if next_due<=pg_catalog.clock_timestamp() then perform hq_private.live_dispatch_schedule(next_due);
    else
      perform hq_private.live_dispatch_cancel();
      update hq_private.live_dispatch_state set due_at=next_due where singleton;
    end if;
    return;
  end if;
  token:=pg_catalog.gen_random_uuid();
  next_due:=pg_catalog.clock_timestamp()+pg_catalog.make_interval(secs=>least(300,5*(2^item.attempts)::integer));
  update hq_private.live_invalidations set attempts=attempts+1,attempt_token=token,next_attempt_at=next_due where id=item.id;
  update hq_private.live_dispatch_state set due_at=next_due where singleton;
  -- Durable reservation survives cancellation; the fixed watchdog recovers it.
  commit;

  perform pg_catalog.set_config('search_path','',true);
  begin
    -- Lock only this outbox row; never state/cron while publishing. A stale run
    -- cannot publish an attempt that another invocation has already superseded.
    perform 1 from hq_private.live_invalidations where id=item.id and attempt_token=token for update;
    if found then perform hq_private.live_deliver(item.id); end if;
  exception when others then
    update hq_private.live_invalidations set last_error='publication-unverified' where id=item.id and attempt_token=token;
  end;
  -- query_canceled is deliberately NOT caught by WHEN OTHERS.
  commit;

  perform hq_private.live_dispatch_reconcile(item.id,token,observed_generation);
end $$;

-- CREATE OR REPLACE preserves existing ACLs and owners. The new watchdog is
-- private; no service/application role receives direct or inherited authority.
revoke all on function hq_private.live_dispatch_watchdog() from public,anon,authenticated,service_role;
DO $private_watchdog$
declare app_role text; private_routine text; begin
  if exists(select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      where p.oid='hq_private.live_dispatch_watchdog()'::pg_catalog.regprocedure and a.grantee<>p.proowner) then
    raise exception 'HQ_LIVE_WATCHDOG_UNEXPECTED_ACL';
  end if;
  foreach app_role in array array['anon','authenticated','service_role'] loop
    foreach private_routine in array array['hq_private.live_dispatch_watchdog()',
      'hq_private.workforce_wake()','hq_private.live_deliver(uuid)','hq_private.live_enqueue_v2(text,text,jsonb)'] loop
      if pg_catalog.has_function_privilege(app_role,private_routine,'EXECUTE') then
        raise exception 'HQ_LIVE_PRIVATE_EFFECTIVE_ACCESS: %, %',app_role,private_routine;
      end if;
    end loop;
  end loop;
end $private_watchdog$;
-- END EXACT ADAPTIVE PROPOSAL BODY

-- Atomic installation only: no watchdog CALL or producer/claim/finish is run.
-- Default cron destination is pinned above, then checked on the stored job.
-- Two arguments create a fresh UNNAMED row; no competing job can be overwritten.
DO $install_watchdog$
declare fresh_job_id bigint; begin
  fresh_job_id:=cron.schedule('* * * * *','select hq_private.live_dispatch_watchdog()');
  if fresh_job_id is null then raise exception 'HQ_ADAPTIVE_WATCHDOG_ID_REQUIRED'; end if;
  update hq_private.live_dispatch_state set watchdog_job_id=fresh_job_id where singleton;
end $install_watchdog$;
alter table hq_private.live_dispatch_state
  alter column watchdog_job_id set not null,
  add constraint live_dispatch_watchdog_job_id_check check (watchdog_job_id>0);

DO $postflight$
declare expected jsonb; actual jsonb; spec jsonb; routine record; app_role text; watchdog_id bigint;
  changed text[]:=array['hq_private.live_enqueue_v2(text,text,jsonb)','hq_private.live_deliver(uuid)',
    'hq_private.workforce_wake()','hq_private.live_dispatch_schedule(timestamp with time zone)',
    'hq_private.live_dispatch_cancel()','hq_private.live_dispatch_reconcile(uuid,uuid,bigint)','hq_private.live_dispatch_tick()'];
begin
  select value into strict expected from pg_temp.hq_adaptive_activation_evidence where label='expected';
  for spec in select value from pg_catalog.jsonb_array_elements(expected->'functions') loop
    select p.* into strict routine from pg_catalog.pg_proc p where p.oid=(spec->>'signature')::pg_catalog.regprocedure;
    actual:=pg_catalog.jsonb_build_object('signature',spec->>'signature','owner',pg_catalog.pg_get_userbyid(routine.proowner),
      'kind',routine.prokind::text,'security',routine.prosecdef,'config',routine.proconfig,'acl',routine.proacl::text[],
      'body_md5',pg_catalog.md5(routine.prosrc),'definition_md5',pg_catalog.md5(pg_catalog.pg_get_functiondef(routine.oid)));
    if spec->>'signature'=any(changed) then
      if (actual-array['body_md5','definition_md5']) is distinct from (spec-array['body_md5','definition_md5']) then
        raise exception 'HQ_ADAPTIVE_EXISTING_ROUTINE_ACCESS_CHANGED: %',spec->>'signature';
      end if;
    elsif actual is distinct from spec then raise exception 'HQ_ADAPTIVE_UNCHANGED_ROUTINE_CHANGED: %',spec->>'signature';
    end if;
  end loop;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by id),'[]'::jsonb) into actual from hq_private.live_invalidations i;
  if actual is distinct from (select value from pg_temp.hq_adaptive_activation_evidence where label='outbox_rows') then
    raise exception 'HQ_ADAPTIVE_EXISTING_OUTBOX_CHANGED';
  end if;
  select pg_catalog.to_jsonb(s)-array['jobs_circuit_open','jobs_last_error','watchdog_job_id'] into actual from hq_private.live_dispatch_state s;
  if actual is distinct from (select value from pg_temp.hq_adaptive_activation_evidence where label='browser_state')
    or not exists(select 1 from hq_private.live_dispatch_state where not jobs_circuit_open and jobs_last_error is null) then
    raise exception 'HQ_ADAPTIVE_BROWSER_STATE_CHANGED';
  end if;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),
      'acl',c.relacl::text[],'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by c.relname) into actual
    from pg_catalog.pg_class c where c.oid in ('hq_private.live_invalidations'::pg_catalog.regclass,'hq_private.live_dispatch_state'::pg_catalog.regclass);
  if actual is distinct from expected->'tables' then raise exception 'HQ_ADAPTIVE_TABLE_ACCESS_CHANGED'; end if;
  select pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(nspowner),'acl',nspacl::text[]) into actual
    from pg_catalog.pg_namespace where nspname='hq_private';
  if actual is distinct from expected->'schema' then raise exception 'HQ_ADAPTIVE_SCHEMA_ACCESS_CHANGED'; end if;
  select * into strict routine from pg_catalog.pg_proc where oid='hq_private.live_dispatch_watchdog()'::pg_catalog.regprocedure;
  if pg_catalog.pg_get_userbyid(routine.proowner)<>'postgres' or routine.prokind<>'f' or routine.prosecdef
    or routine.proconfig is distinct from array['search_path=""']::text[]
    or exists(select 1 from pg_catalog.aclexplode(coalesce(routine.proacl,pg_catalog.acldefault('f',routine.proowner))) a
      where a.grantee<>routine.proowner) then raise exception 'HQ_ADAPTIVE_WATCHDOG_ACCESS_CHANGED'; end if;
  foreach app_role in array array['anon','authenticated','service_role'] loop
    if pg_catalog.has_function_privilege(app_role,'hq_private.live_dispatch_watchdog()','EXECUTE')
      or pg_catalog.has_table_privilege(app_role,'hq_private.live_dispatch_state','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      or pg_catalog.has_any_column_privilege(app_role,'hq_private.live_dispatch_state','SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception 'HQ_ADAPTIVE_EFFECTIVE_ACCESS_CHANGED: %',app_role;
    end if;
  end loop;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(j) order by jobid),'[]'::jsonb) into actual from cron.job j where jobname='hq-live-once';
  if actual is distinct from (select value from pg_temp.hq_adaptive_activation_evidence where label='hot_job') then
    raise exception 'HQ_ADAPTIVE_EXISTING_HOT_JOB_CHANGED';
  end if;
  select watchdog_job_id into strict watchdog_id from hq_private.live_dispatch_state where singleton;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(j) order by jobid),'[]'::jsonb) into actual
    from cron.job j where jobid<>watchdog_id and jobname is distinct from 'hq-live-once' and jobname is distinct from 'hq-live-watchdog';
  if actual is distinct from (select value from pg_temp.hq_adaptive_activation_evidence where label='other_cron_jobs') then
    raise exception 'HQ_ADAPTIVE_UNRELATED_CRON_JOB_CHANGED';
  end if;
  if not exists(select 1 from cron.job where jobid=watchdog_id and jobname is null and username='postgres'
      and database='postgres' and nodename='localhost' and nodeport=5432 and active
      and schedule='* * * * *' and command='select hq_private.live_dispatch_watchdog()')
    or exists(select 1 from cron.job where jobid<>watchdog_id and
      (jobname='hq-live-watchdog' or command ~ 'hq_private[.]live_dispatch_watchdog')) then
    raise exception 'HQ_ADAPTIVE_WATCHDOG_DESTINATION_MISMATCH';
  end if;
end $postflight$;
-- Commit and migration-history recording belong to the trusted outer deployer.
