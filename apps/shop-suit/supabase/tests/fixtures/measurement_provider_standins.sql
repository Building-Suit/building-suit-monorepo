-- Disposable schema tests only. These provider stand-ins do not verify real Auth/Storage/Cron/Net.
-- Network and scheduler invocation always throw; no external calls or live secrets.
create role authenticator;create role anon;create role authenticated;create role service_role bypassrls;create role supabase_admin superuser;
create schema extensions;create extension pgcrypto with schema extensions;create extension "uuid-ossp" with schema extensions;
create schema auth;create table auth.users(id uuid primary key,email text,encrypted_password text,aud text,role text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz,is_anonymous boolean default false,phone text,confirmed_at timestamptz,deleted_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'sub')::uuid$$;
create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role')$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,jsonb_build_object('sub',auth.uid(),'role',auth.role()))$$;
grant usage on schema auth to anon,authenticated,service_role;
grant select on auth.users to authenticated,service_role;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),unique(bucket_id,name));
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
create schema vault;create table vault.decrypted_secrets(id uuid,name text,decrypted_secret text);
create schema net;create function net.http_post(url text,headers jsonb default '{}',body jsonb default '{}',timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$begin raise exception 'PROVIDER_NETWORK_UNAVAILABLE_IN_SCHEMA_FIXTURE';end$$;
create schema cron;create table cron.job(jobid bigint,jobname text,username text);create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin raise exception 'PROVIDER_CRON_UNAVAILABLE_IN_SCHEMA_FIXTURE';end$$;create function cron.unschedule(bigint) returns boolean language plpgsql as $$begin raise exception 'PROVIDER_CRON_UNAVAILABLE_IN_SCHEMA_FIXTURE';end$$;
create publication supabase_realtime;
