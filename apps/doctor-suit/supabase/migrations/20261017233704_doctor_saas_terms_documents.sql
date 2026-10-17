-- Immutable operator-supplied version text. Empty by default; no legal document is invented.
create table public.doctor_saas_terms_documents(
 terms_version_id uuid primary key references public.doctor_saas_terms_versions(id),
 document_ref text not null check(document_ref~'^[a-z0-9][a-z0-9._/-]{0,199}$'),
 content_en text not null check(char_length(btrim(content_en))between 20 and 50000),
 content_ar text not null check(char_length(btrim(content_ar))between 20 and 50000),
 created_at timestamptz not null default clock_timestamp(),database_actor text not null default session_user
);
alter table public.doctor_saas_terms_documents enable row level security;
alter table public.doctor_saas_terms_documents force row level security;
create policy doctor_saas_terms_documents_database on public.doctor_saas_terms_documents for all to postgres using(true)with check(true);
revoke all on public.doctor_saas_terms_documents from public,anon,authenticated,service_role;
create trigger doctor_saas_terms_documents_immutable before update or delete or truncate on public.doctor_saas_terms_documents
 for each statement execute function doctor_private.saas_history_immutable();
create function doctor_private.saas_document_binding()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if not exists(select 1 from public.doctor_saas_terms_versions t where t.id=new.terms_version_id and t.terms_document_ref=new.document_ref)then
 raise exception using errcode='22023',message='DOCTOR_SAAS_DOCUMENT_BINDING_INVALID';end if;
 return new;
end $$;
create trigger doctor_saas_document_binding before insert on public.doctor_saas_terms_documents
 for each row execute function doctor_private.saas_document_binding();
create function doctor_private.saas_terms_document(p_terms uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();offer jsonb;result jsonb;
begin
 if p_terms is null then raise exception using errcode='22023',message='DOCTOR_SAAS_DOCUMENT_INVALID';end if;
 if not exists(select 1 from public.doctor_saas_periods p where p.subscriber_user_id=actor and p.terms_version_id=p_terms)then
  offer:=doctor_private.saas_terms();
  if (offer->'terms'->>'terms_id')is distinct from p_terms::text then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 end if;
 select jsonb_build_object('terms_id',d.terms_version_id,'document_ref',d.document_ref,'content_en',d.content_en,'content_ar',d.content_ar,'data_mode','synthetic')into result
 from public.doctor_saas_terms_documents d where d.terms_version_id=p_terms;
 return result;
end $$;
create function public.doctor_saas_terms_document(p_terms uuid)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.saas_terms_document(p_terms)$$;
revoke all on function doctor_private.saas_document_binding(),doctor_private.saas_terms_document(uuid),public.doctor_saas_terms_document(uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.saas_terms_document(uuid),public.doctor_saas_terms_document(uuid)to authenticated;
