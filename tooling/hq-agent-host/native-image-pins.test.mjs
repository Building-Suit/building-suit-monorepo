import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('native fixture pins compatible extensions without upgrading its PostgreSQL server', async () => {
  const source = await readFile(new URL('./live-dispatch-native.Dockerfile', import.meta.url), 'utf8')
  assert.equal((source.match(/FROM postgres:17\.11-bookworm AS/g) ?? []).length, 2)
  assert.equal((source.match(/apt-mark hold postgresql-17 postgresql-client-17/g) ?? []).length, 2)
  assert.match(source, /postgresql-server-dev-17=17\.11-1\.pgdg12\+2/)
  assert.match(source, /postgresql-17-cron=1\.6\.8-1\.pgdg12\+2/)
  assert.equal((source.match(/postgres --version \| grep -F 'PostgreSQL\) 17\.11'/g) ?? []).length, 2)
  assert.match(source, /test "\$\(git -C \/tmp\/pg_cron rev-parse HEAD\)" = 9490f9cc9803f75105f2f7d89839a998f011f8d8/)
})
