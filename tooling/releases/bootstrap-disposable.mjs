import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { collectBatch, workspaceGraph } from './fragments.mjs'

// Called by the existing required review entrypoint, inside its unique disposable container.
export async function testBootstrap({ sql, databaseSql, parallelDatabaseSql, migration }) {
  const initial = readFileSync(new URL('../../apps/super-admin-suit/supabase/migrations/20261015030053_task_release_catalog.sql', import.meta.url), 'utf8')
  const bootstrap = readFileSync(migration, 'utf8')
  const authority = 'a0bb00a1-747c-4cda-8521-9927d0b53065'
  const shop = '7924a9af-a970-4360-a0d0-76df4e18dbfc'
  const anchor = '4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c'
  assert.equal(JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8')).activationAnchor, anchor)
  const jwt = `set request.jwt.claims='{"role":"service_role"}';`
  const json = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
  const parse = output => JSON.parse(output.split('\n').at(-1))
  const fixture = (name, id = authority, kind = 'staging', activeShop = true) => {
    sql(`create database ${name};`)
    const query = statement => databaseSql(name, statement)
    query(`create schema extensions; create extension pgcrypto with schema extensions; create schema super_admin_private;
      create table public.admin_environments(id uuid primary key,stable_key text,environment_kind text,status text);
      create table public.suit_registry(id uuid primary key,stable_key text unique,display_name jsonb,status text);
      -- Stand-ins expose accidental registry/binding/navigation mutations during release replay.
      create table public.suit_environment_bindings(id uuid primary key,suit_id uuid);
      create table public.operator_navigation(module text);
      insert into public.admin_environments values('${id}','sas-staging','${kind}','active'),
        ('2d18defd-a91d-4fec-856f-253ad98dfc5e','shop-staging','staging','active');
      insert into public.suit_registry values('${shop}','shop-suit','{"en":"Shop","ar":"المتجر"}','${activeShop ? 'active' : 'draft'}');
      insert into public.suit_environment_bindings values('00000000-0000-0000-0000-000000000011','${shop}');
      insert into public.operator_navigation values('existing-shop-module');`)
    query(initial)
    return query
  }
  const apply = query => query(`begin; ${bootstrap} commit;`)
  const snapshot = query => query(`select jsonb_build_object(
    'configuration',(select jsonb_agg(c) from public.release_catalog_configuration c),
    'heads',(select jsonb_agg(h) from public.release_version_heads h),
    'manifests',(select jsonb_agg(m order by ordinal) from public.release_manifests m),
    'versions',(select jsonb_agg(v order by version) from public.release_versions v),
    'consumed',(select jsonb_agg(f order by fragment_id) from public.release_consumed_fragments f));`)
  const operations = query => query(`select jsonb_build_object(
    'registry',(select jsonb_agg(s) from public.suit_registry s),
    'bindings',(select jsonb_agg(b) from public.suit_environment_bindings b),
    'navigation',(select jsonb_agg(n) from public.operator_navigation n),
    'environments',(select jsonb_agg(e) from public.admin_environments e));`)
  const first = fixture('bootstrap_first')
  const originalOperations = operations(first)
  apply(first)
  const empty = parse(snapshot(first))
  assert.equal(empty.heads[0].version, '0.0.0')
  assert.match(empty.heads[0].baseline_evidence, /First official versioning.*2026-10-15T21:20:31Z/)
  assert.equal(empty.heads.length, 1, 'Only Shop receives an allocator baseline')
  assert.equal(empty.configuration[0].authority_environment_id, authority, 'SAS authority, never Shop target environment')
  assert.equal(empty.configuration[0].anchor_sha, anchor)
  assert.equal(empty.configuration[0].cursor_sha, anchor)
  assert.equal(empty.manifests, null, 'Bootstrap fabricates no historical release')
  assert.equal(empty.versions, null)
  assert.equal(empty.consumed, null)
  const before = snapshot(first)
  apply(first)
  assert.equal(snapshot(first), before, 'Migration replay does not reset initialized state')
  assert.deepEqual(parse(first('set role anon; select public.release_public_feed();')).suits.map(row => row.id), ['shop-suit'])
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.throws(() => first(`set role ${role}; select * from super_admin_private.release_internal_consumers;`), /permission denied/)
    if (role !== 'service_role') assert.throws(() => first(`set role ${role}; select public.release_stage_accept('{}'::jsonb);`), /permission denied/)
  }
  // Replay the preserved, real first-parent fragment range, without editing accepted fragments.
  const graph = workspaceGraph(process.cwd())
  const stagingMerges = [
    'ecd74b1f5e3f6758bb618e67ca930b5f5f3eadd4',
    '461abc8ba1aa8b59c61a03f34d2cf0ee24cd0a8a'
  ]
  let parent = anchor
  let publicEntries = 0
  const accept = request => parse(first(`${jwt} select public.release_stage_accept(${json(request)});`))
  for (const [index, sourceSha] of stagingMerges.entries()) {
    const fragments = collectBatch(sourceSha, parent, graph)
    const request = { repository: 'Building-Suit/building-suit-monorepo', ref: 'refs/heads/stg', sourceSha, parentSha: parent, fragments }
    const accepted = index === 0
      ? parse((await Promise.all([0, 1].map(() => parallelDatabaseSql('bootstrap_first', `${jwt} select public.release_stage_accept(${json(request)});`))))[0])
      : accept(request)
    assert.equal(accepted.manifest.versions['shop-suit'], index === 0 ? '0.1.0' : '0.1.1')
    assert.deepEqual(Object.keys(accepted.manifest.versions), ['shop-suit'])
    assert.equal(accepted.publishedAt, null)
    assert.deepEqual(accept(request), accepted, 'Actual historical merge retry returns the identical manifest')
    publicEntries += accepted.manifest.entries.length
    parent = sourceSha
  }
  assert.equal(publicEntries, 6, 'First capability batch has five reviewed notes; receipt patch has one')
  assert.deepEqual(parse(first('set role anon; select public.release_public_feed();')).entries, [], 'Reservations are not shipped announcements')
  const reserved = snapshot(first)
  apply(first)
  assert.equal(snapshot(first), reserved, 'Reapplying bootstrap cannot recycle allocated versions, cursor or fragments')
  const internal = { id: 'bootstrap-internal-only', task: 'BS-TEST-001', classification: 'internal', disposition: 'internal', suits: ['ledger-suit', 'inventory-suit', 'automation-suit', 'super-admin-suit'], paths: ['tooling/releases'], reason: 'Bookkeeping only' }
  const candidate = fragments => ({ repository: 'Building-Suit/building-suit-monorepo', ref: 'refs/heads/stg', sourceSha: 'b'.repeat(40), parentSha: parent, fragments })
  const notes = { title: { en: 'New capability', ar: 'ميزة جديدة' }, summary: { en: 'New capability', ar: 'ميزة جديدة' }, details: { en: 'New capability', ar: 'ميزة جديدة' } }
  assert.throws(() => accept(candidate([{ ...internal, id: 'bootstrap-unknown-consumer', suits: ['unknown-suit'] }])), /UNREGISTERED_INTERNAL_CONSUMER/)
  assert.throws(() => accept(candidate([{ ...internal, id: 'bootstrap-public-unregistered', classification: 'minor', disposition: 'public', suits: ['ledger-suit'], notes }])), /UNREGISTERED_SUIT/)
  assert.equal(snapshot(first), reserved, 'Rejected public allocation or unknown internal consumer rolls back all state')
  const noOp = accept(candidate([internal]))
  assert.deepEqual(noOp.manifest.versions, {})
  assert.deepEqual(noOp.manifest.entries, [])
  assert.equal(first(`select version from public.release_version_heads where suit_id='${shop}';`), '0.1.1')
  assert.equal(operations(first), originalOperations, 'No operational registry, environment, binding or navigation changes')
  assert.deepEqual(parse(first('set role anon; select public.release_public_feed();')).suits.map(row => row.id), ['shop-suit'])
  const staged = parse(first(`${jwt} select public.release_catalog_state();`)).manifests
  first(`${jwt} select public.release_publish('staging','refs/heads/stg','${'b'.repeat(40)}',${json(staged)});`)
  const shipped = parse(first('set role anon; select public.release_public_feed();'))
  assert.equal(shipped.entries.length, 6)
  assert.deepEqual([...new Set(shipped.entries.map(row => row.version))], ['0.1.1', '0.1.0'])
  assert.ok(shipped.entries.every(row => row.version !== '0.0.0' && row.publishedAt === row.releasedAt))
  for (const privateField of ['baseline_evidence', 'sourceSha', 'fragments', 'classification', 'BS-CHANGELOG', 'First official']) assert.ok(!JSON.stringify(shipped).includes(privateField))
  const shippedState = snapshot(first)
  apply(first)
  assert.equal(snapshot(first), shippedState, 'Migration replay preserves actual first-publication times and digests')
  assert.equal(operations(first), originalOperations)
  // Missing baseline remains an independent gate after legitimate operational registration.
  first(`insert into public.suit_registry values('00000000-0000-0000-0000-000000000012','ledger-suit','{"en":"Ledger","ar":"الدفتر"}','active');`)
  assert.throws(() => accept({ ...candidate([{ ...internal, id: 'bootstrap-public-no-baseline', classification: 'minor', disposition: 'public', suits: ['ledger-suit'], notes }]), sourceSha: 'c'.repeat(40), parentSha: 'b'.repeat(40) }), /VERIFIED_BASELINE_REQUIRED/)

  const concurrent = fixture('bootstrap_concurrent')
  const initialization = bootstrap.indexOf('-- The migration may traverse')
  assert.ok(initialization > 0)
  concurrent(bootstrap.slice(0, initialization))
  await Promise.all([0, 1].map(() => parallelDatabaseSql('bootstrap_concurrent', `begin; ${bootstrap.slice(initialization)} commit;`)))
  assert.equal(concurrent('select count(*) from public.release_catalog_configuration;'), '1')
  assert.equal(concurrent('select version from public.release_version_heads;'), '0.0.0', 'Concurrent initialization serializes without duplicates or resets')

  const existing = fixture('bootstrap_existing')
  existing(`insert into public.release_catalog_configuration values(true,'${authority}','Building-Suit/building-suit-monorepo','${anchor}','${'d'.repeat(40)}');
    insert into public.release_version_heads values('${shop}','2.7.4','Verified existing historical evidence fixture');`)
  const historical = snapshot(existing)
  apply(existing)
  assert.equal(snapshot(existing), historical, 'Existing historical high-water mark and advanced cursor are preserved')
  existing(`update public.release_catalog_configuration set anchor_sha='${'e'.repeat(40)}';`)
  const conflict = snapshot(existing)
  assert.throws(() => apply(existing), /RELEASE_BOOTSTRAP_CONFIGURATION_CONFLICT/)
  assert.equal(snapshot(existing), conflict)

  const configOnly = fixture('bootstrap_config_only')
  configOnly(`insert into public.release_catalog_configuration values(true,'${authority}','Building-Suit/building-suit-monorepo','${anchor}','${anchor}');`)
  const configOnlyState = snapshot(configOnly)
  assert.throws(() => apply(configOnly), /RELEASE_BOOTSTRAP_PARTIAL_STATE/)
  assert.equal(snapshot(configOnly), configOnlyState, 'A configuration-only partial setup is not silently backfilled')

  const partial = fixture('bootstrap_partial')
  partial(`insert into public.release_version_heads values('${shop}','3.2.1','Partial verified evidence must not be reset');`)
  const partialState = snapshot(partial)
  assert.throws(() => apply(partial), /RELEASE_BOOTSTRAP_PARTIAL_STATE/)
  assert.equal(snapshot(partial), partialState)
  const wrongShop = fixture('bootstrap_wrong_shop', authority, 'staging', false)
  assert.throws(() => apply(wrongShop), /RELEASE_BOOTSTRAP_SHOP_IDENTITY_REQUIRED/)
  assert.equal(wrongShop('select count(*) from public.release_catalog_configuration;'), '0')
  wrongShop(`update public.suit_registry set status='active' where id='${shop}';`)
  apply(wrongShop)
  assert.equal(wrongShop('select count(*) from public.release_version_heads;'), '1', 'A failed atomic bootstrap can recover after reviewed prerequisite repair')
  for (const [name, id, kind] of [
    ['bootstrap_production', '00000000-0000-0000-0000-000000000013', 'production'],
    ['bootstrap_wrong_kind', authority, 'production'],
    ['bootstrap_unknown_staging', '00000000-0000-0000-0000-000000000014', 'staging']
  ]) {
    const other = fixture(name, id, kind)
    apply(other)
    assert.equal(other('select count(*) from public.release_catalog_configuration;'), '0', `${name}: no guessed authority`)
    assert.equal(other('select count(*) from public.release_version_heads;'), '0')
    assert.throws(() => other(`${jwt} select public.release_catalog_state();`), /RELEASE_CONFIGURATION_REQUIRED/)
  }
  console.log('Legacy v1 migration compatibility passed (not current policy): preserved reservation replay, private internal consumers, unchanged operational/public registry, atomic recovery, existing-state preservation and production no-op')
}
