import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('model discovery child cannot read host credentials or unknown future secrets', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'cp-model-isolation-'))
  try {
    const script = `#!${process.execPath}\nconst forbidden=Object.keys(process.env).filter(key=>/SECRET|TOKEN|PASSWORD|DB_URL|CONTROL_DB|GITHUB/i.test(key));\nif(forbidden.length){console.error(forbidden.join(','));process.exit(17)}\nconst rl=require('node:readline').createInterface({input:process.stdin});\nrl.on('line',line=>{const m=JSON.parse(line);if(m.id)process.stdout.write(JSON.stringify({id:m.id,result:m.id===2?{data:[{id:'synthetic-model'}]}:{}})+'\\n')});\n`
    writeFileSync(path.join(directory, 'codex'), script, { mode: 0o700 })
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../runner/codex-models.mjs', import.meta.url))], {
      env: { ...process.env, PATH:directory+':'+process.env.PATH, CODEX_HOME:directory,
        BS_CONTROL_DB_PASSWORD:'sentinel', PRODUCT_DB_URL:'sentinel', FIXTURE_DB_URL:'sentinel',
        FUTURE_SECRET:'sentinel', FUTURE_TOKEN:'sentinel', FUTURE_PASSWORD:'sentinel', GITHUB_TOKEN:'sentinel' },
      encoding:'utf8', timeout:20_000,
    })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), [{id:'synthetic-model'}])
  } finally { rmSync(directory, {recursive:true,force:true}) }
})
