-- Admit the exact Shop Suit assistant release while preserving prior worker pairs.
begin;
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue', 0));

do $guard$
begin
  if hq_private.repository_worker_pairs_v2() is distinct from pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('workerSourceDigest', '7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40',
      'moduleSha256', 'bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
    pg_catalog.jsonb_build_object('workerSourceDigest', 'd768ee8a7ed2717c8fd1dbf09d0159b9aca0607b14f95e5608d5ea5980439ce9',
      'moduleSha256', 'bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
    pg_catalog.jsonb_build_object('workerSourceDigest', 'ba4a8a2323f088dbadec551710896247dddec6e4863ac1a49eff8711a74ba572',
      'moduleSha256', 'ee1485139fca3bff250c72266b269a4261d0097852437eb353f3f8e3099b8e58'),
    pg_catalog.jsonb_build_object('workerSourceDigest', '48113a2f9ebd58252cbd05975ca22ad3dea1e35d6cabc8e59152945d04134440',
      'moduleSha256', 'ee1485139fca3bff250c72266b269a4261d0097852437eb353f3f8e3099b8e58')
  ) then
    raise exception 'HQ_SHOP_ASSISTANT_PAIR_PREDECESSOR_MISMATCH' using errcode = '55000';
  end if;
end;
$guard$;

create or replace function hq_private.repository_worker_pairs_v2() returns jsonb
language sql stable security invoker set search_path = '' as $pairs$
  select pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('workerSourceDigest', '7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40',
      'moduleSha256', 'bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
    pg_catalog.jsonb_build_object('workerSourceDigest', 'd768ee8a7ed2717c8fd1dbf09d0159b9aca0607b14f95e5608d5ea5980439ce9',
      'moduleSha256', 'bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
    pg_catalog.jsonb_build_object('workerSourceDigest', 'ba4a8a2323f088dbadec551710896247dddec6e4863ac1a49eff8711a74ba572',
      'moduleSha256', 'ee1485139fca3bff250c72266b269a4261d0097852437eb353f3f8e3099b8e58'),
    pg_catalog.jsonb_build_object('workerSourceDigest', '48113a2f9ebd58252cbd05975ca22ad3dea1e35d6cabc8e59152945d04134440',
      'moduleSha256', 'ee1485139fca3bff250c72266b269a4261d0097852437eb353f3f8e3099b8e58'),
    pg_catalog.jsonb_build_object('workerSourceDigest', 'c78e3f8a36026ffdce5397ac25e9ee61252f79a90f48959c76b910f20c81a783',
      'moduleSha256', '7dd12e60322e1359a068f165d99aa2c097aa3c24932780f785d42f8f8a0b3c8c')
  )
$pairs$;

commit;
