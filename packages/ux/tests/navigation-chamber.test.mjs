import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick, ref } from 'vue'
import { useNavigationChamber } from '../src/composables/useNavigationChamber.ts'

test('navigation chambers follow caller-owned settings destinations, including query/hash and nested routes', async () => {
  const scope = effectScope()
  const path = ref('/overview'), destinations = ref(['/preferences?tab=team', '/subscription'])
  const navigation = scope.run(() => useNavigationChamber(() => path.value, () => destinations.value))
  assert.equal(navigation.chamber.value, 'app')
  assert.equal(navigation.isSettingsPath('/preferences/team#roles'), true)
  assert.equal(navigation.isSettingsPath('/preferences-archive'), false)
  path.value = '/subscription'
  await nextTick()
  assert.equal(navigation.chamber.value, 'settings')
  navigation.chamber.value = 'app'
  assert.equal(navigation.chamber.value, 'app')
  destinations.value = []
  await nextTick()
  assert.equal(navigation.chamber.value, 'app')
  scope.stop()
})

test('navigation state is instance-scoped and route listeners stop with the owning shell', async () => {
  const firstScope = effectScope(), secondScope = effectScope()
  const path = ref('/preferences')
  const first = firstScope.run(() => useNavigationChamber(() => path.value, () => ['/preferences']))
  const second = secondScope.run(() => useNavigationChamber(() => '/overview', () => ['/preferences']))
  assert.equal(first.chamber.value, 'settings')
  assert.equal(second.chamber.value, 'app')
  firstScope.stop()
  path.value = '/overview'
  await nextTick()
  assert.equal(first.chamber.value, 'settings')
  secondScope.stop()
})
