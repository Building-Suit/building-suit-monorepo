-- LS-SUP-001: customer submission boundary and delivery handoff.
alter table public.support_requests add column category text not null default 'general'
  check (category in ('general','product','billing','technical','account'));

create table public.support_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete restrict,
  recipient extensions.citext not null check (recipient='support@building-suit.com'),
  kind text not null check (kind in ('new_request','reminder')),
  delivery_status text not null default 'not_configured' check (delivery_status in ('not_configured','queued','sent','failed')),
  created_at timestamptz not null default now(), delivered_at timestamptz,
  unique (request_id, kind)
);
alter table public.support_notification_outbox enable row level security;
revoke all on public.support_notification_outbox from public, anon, authenticated, service_role;

create or replace function public.submit_support_request(
  p_category text, p_subject text, p_message text, p_reply_email text,
  p_consent boolean, p_honeypot text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid(); v_org uuid; v_email extensions.citext; v_id uuid;
begin
  if coalesce(nullif(btrim(p_honeypot),''),'') <> '' then return jsonb_build_object('ok',true,'accepted',false); end if;
  if not coalesce(p_consent,false) or p_category not in ('general','product','billing','technical','account')
    or p_subject is null or length(btrim(p_subject)) not between 1 and 200
    or p_message is null or length(btrim(p_message)) not between 1 and 10000
    or p_reply_email is null or p_reply_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'SUPPORT_REQUEST_INVALID' using errcode='22023';
  end if;
  v_email := lower(btrim(p_reply_email));
  if v_user is not null then
    select p.email into v_email from public.profiles p where p.id=v_user;
    select om.organization_id into v_org from public.organization_members om
      where om.user_id=v_user and om.status='active' order by om.joined_at nulls last limit 1;
  end if;
  if exists (select 1 from public.support_requests where requester_email=v_email and created_at > clock_timestamp()-interval '10 minutes') then
    raise exception 'SUPPORT_RATE_LIMITED' using errcode='42900';
  end if;
  insert into public.support_requests(organization_id,requester_id,requester_email,category,subject,customer_message,priority)
    values(v_org,v_user,v_email,p_category,btrim(p_subject),btrim(p_message),(case when p_category='billing' then 'high' else 'normal' end)::public.support_request_priority) returning id into v_id;
  insert into public.support_notification_outbox(request_id,recipient,kind) values(v_id,'support@building-suit.com','new_request');
  return jsonb_build_object('ok',true,'accepted',true,'request_id',v_id,'notification','not_configured');
end; $$;
revoke all on function public.submit_support_request(text,text,text,text,boolean,text) from public, anon, authenticated, service_role;
grant execute on function public.submit_support_request(text,text,text,text,boolean,text) to anon, authenticated;
