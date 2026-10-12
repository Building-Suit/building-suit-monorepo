-- Disposable issuer fixtures. Actual target redemption/replay is checked by the
-- mandatory task-owned unit/browser gates using the genuine staging contract.
begin;
select plan(13);
\ir fixtures/custom-offer.inc
select lives_ok('select public.super_admin_custom_offer_command(value) from offer_input','owner saves version');
select is((select public.super_admin_custom_offer_command(value) from offer_input),(select public.super_admin_custom_offer_command(value) from offer_input),'exact retry returns same snapshot');
reset role;
select is((select count(*)::integer from public.custom_offer_versions),1,'retry creates one version');
select throws_ok('update public.custom_offer_versions set display_name=''Changed''','55000','CUSTOM_OFFER_VERSIONS_IMMUTABLE','versions immutable');
select throws_ok('delete from public.custom_offer_versions','55000','CUSTOM_OFFER_VERSIONS_IMMUTABLE','history cannot be deleted');
set local role authenticated;
update offer_input set value=jsonb_set(jsonb_set(jsonb_set(value,'{requestId}',to_jsonb(gen_random_uuid())),'{payload,expectedVersion}','1'),'{payload,priceAmount}','"234.56"');
select lives_ok('select public.super_admin_custom_offer_command(value) from offer_input','amendment appends');
reset role;
select is((select count(*)::integer from public.custom_offer_versions),2,'two immutable versions');
select is((select price_amount::text from public.custom_offer_versions where version=1),'123.45','original exact price preserved');
create temporary table revoke_input as select jsonb_build_object('action','revoke','bindingId',binding_id,'requestId',gen_random_uuid(),
 'correlationId',gen_random_uuid(),'reason','Synthetic offer cancellation','payload',jsonb_build_object('offerVersionId',id)) value from public.custom_offer_versions where version=2;
grant select on revoke_input to authenticated;
set local role authenticated;
select lives_ok('select public.super_admin_custom_offer_command(value) from revoke_input','revoke saved version');
select is((select public.super_admin_custom_offer_command(value)#>>'{offer,state}' from revoke_input),'revoked','revocation retry stable');
reset role;
select throws_ok('update public.custom_offer_revocations set reason=''Changed reason''','55000','CUSTOM_OFFER_REVOCATIONS_IMMUTABLE','revocation immutable');
select is(super_admin_private.offer_snapshot(jsonb_populate_record(null::public.custom_offer_versions,
 (select to_jsonb(o)||jsonb_build_object('expires_at',now()-interval '1 second') from public.custom_offer_versions o where version=1)))->>'state','expired','expired state');
select ok(not has_function_privilege('authenticated','super_admin_private.custom_offer_link(public.custom_offer_versions)','execute'),'browser cannot manufacture opaque redemption authority');
select * from finish();
rollback;
