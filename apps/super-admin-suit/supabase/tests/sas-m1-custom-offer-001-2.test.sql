-- Issuer authorization. Mandatory unit/browser gates independently exercise
-- actual target opaque-token recipient, environment and Suit-binding denials.
begin;
select plan(8);
\ir fixtures/custom-offer.inc
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated')::text,true) from adapter_fixture;
select throws_ok('select public.super_admin_custom_offer_command(value) from offer_input','42501','PLATFORM_OWNER_REQUIRED','outsider denied');
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from adapter_fixture;
select lives_ok('select public.super_admin_custom_offer_command(value) from offer_input','owner saves');
select throws_ok('select * from public.custom_offer_versions','42501',null,'raw recipient records hidden');
update offer_input set value=jsonb_set(jsonb_set(jsonb_set(value,'{requestId}',to_jsonb(gen_random_uuid())),'{payload,expectedVersion}','1'),'{payload,recipientUserId}',to_jsonb(gen_random_uuid()));
select throws_ok('select public.super_admin_custom_offer_command(value) from offer_input','42501','OFFER_BINDING_MISMATCH','amendment cannot transplant recipient');
reset role;
update public.suit_environment_bindings set admin_environment_id=(select target_id from adapter_fixture);
set local role authenticated;
select throws_ok('select public.super_admin_custom_offers_read(binding_id) from adapter_fixture','42501',null,'cross authority environment denied');
select throws_ok('select * from public.custom_offer_target_receipts','42501',null,'recipient tokens are not directly readable by browsers');
select ok(not has_table_privilege('authenticated','public.custom_offer_dispatches','insert'),'browser cannot bypass target environment dispatch validation');
select ok(not has_table_privilege('authenticated','public.custom_offer_target_receipts','insert'),'browser cannot forge another Suit receipt');
select * from finish();
rollback;
