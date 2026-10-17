// GitHub-hosted, owned disposable Shop/Ledger service acceptance only.
import { spawn,spawnSync } from 'node:child_process'
import { readFile,writeFile,mkdtemp,mkdir,cp,rm,access,readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../',import.meta.url))
export function doctorShopBackendTarget(environment,product) {
  if(environment.GITHUB_ACTIONS!=='true' || environment.RUNNER_ENVIRONMENT!=='github-hosted' || environment.DOCTOR_SHOP_BACKEND_DISPOSABLE!=='1')throw new Error('OWNED_GITHUB_DISPOSABLE_REQUIRED')
  if(!/^\d+$/.test(environment.GITHUB_RUN_ID || '') || !/^\d+$/.test(environment.GITHUB_RUN_ATTEMPT || ''))throw new Error('RUN_ID_REQUIRED')
  if(!['shop','ledger'].includes(product))throw new Error('PRODUCT_INVALID')
  const port = product==='shop' ? 57321 : 58321
  return { product,project: `doctor-m1-${product}-${environment.GITHUB_RUN_ID}-${environment.GITHUB_RUN_ATTEMPT}`,api: `http://127.0.0.1:${port}`,mail: `http://127.0.0.1:${port+3}` }
}
export function assertDoctorShopBackendCandidate(expected,actual) { if(!/^[0-9a-f]{40}$/.test(expected || '') || expected!==actual)throw new Error('EXACT_CANDIDATE_REQUIRED') }
export function assertDoctorShopBackendOwnership(target,containers,volumes) { if([...containers,...volumes].some(name => name.endsWith(`_${target.project}`)))throw new Error('EXISTING_PROJECT_NOT_OWNED') }
export function doctorShopBackendFailureKind(value) { if(/\bERROR:|SQLSTATE|applying migration/i.test(value))return 'migration';if(/address already in use|port is already allocated/i.test(value))return 'port';if(/unhealthy|failed health/i.test(value))return 'health';if(/timeout|timed out/i.test(value))return 'timeout';return 'unavailable' }
async function main() {
  const targets = ['ledger','shop'].map(product => doctorShopBackendTarget(process.env,product))
  const sourceHead = () => spawnSync('git',['rev-parse','HEAD'],{ cwd: root,encoding: 'utf8' }).stdout?.trim()
  assertDoctorShopBackendCandidate(process.env.M1_HEAD_SHA,sourceHead())
  const scratch = await mkdtemp(path.join(tmpdir(),'doctor-m1-shop-backend-'));const owned = [];const migrationHashes = {};let stage = 'guard';let lastOutput = ''
  const environment = { ...process.env,SUPABASE_HOME: path.join(scratch,'cli') }
  function docker(args,input) { const result = spawnSync('docker',args,{ input,encoding: 'utf8',timeout: 30000,maxBuffer: 1048576 });if(result.status!==0)throw new Error('DOCKER_STEP_FAILED');return result.stdout }
  function command(program,args,env = environment,timeout = 600000) {
    return new Promise((resolve,reject) => {
      const child = spawn(program,args,{ cwd: root,env,detached: true,stdio: ['ignore','pipe','pipe'] })
      let output = '';let stopped = false;let force
      function stop() {
        if(stopped)return;stopped = true
        try { process.kill(-child.pid,'SIGTERM') } catch { /* Owned group already exited. */ }
        force = setTimeout(() => { try { process.kill(-child.pid,'SIGKILL') } catch { /* Owned group exited. */ } },3000)
      }
      const append = chunk => { if(output.length+chunk.length>32000000)stop();else output+=chunk }
      child.stdout.on('data',append);child.stderr.on('data',append)
      const timer = setTimeout(stop,timeout)
      child.on('error',() => { clearTimeout(timer);clearTimeout(force);reject(new Error('COMMAND_UNAVAILABLE')) })
      child.on('exit',code => { if(code!==0)stop() })
      child.on('close',code => { clearTimeout(timer);clearTimeout(force);lastOutput = output;if(code===0 && !stopped)resolve(output);else reject(new Error('DISPOSABLE_COMMAND_FAILED')) })
    })
  }
  const cli = (target,args,timeout) => command('pnpm',['exec','supabase','--workdir',target.workdir,...args],environment,timeout)
  try {
    for(const target of targets) {
      const source = path.join(root,'apps',`${target.product}-suit`,'supabase');const config = await readFile(path.join(source,'config.toml'),'utf8')
      if(!config.includes(`project_id = "building-suit-${target.product}"`))throw new Error('SOURCE_PROJECT_MISMATCH')
      try { await access(path.join(source,'.temp/project-ref'));throw new Error('LINKED_SOURCE_FORBIDDEN') } catch(error) { if(error.code!=='ENOENT')throw error }
      assertDoctorShopBackendOwnership(target,docker(['ps','-a','--format','{{.Names}}']).trim().split('\n'),docker(['volume','ls','--format','{{.Name}}']).trim().split('\n'))
      target.workdir = path.join(scratch,target.product);const destination = path.join(target.workdir,'supabase');await mkdir(destination,{ recursive: true })
      for(const directory of ['migrations','templates']) { try { await cp(path.join(source,directory),path.join(destination,directory),{ recursive: true }) } catch(error) { if(error.code!=='ENOENT')throw error } }
      const oldPrefix = target.product==='shop' ? '613' : '603';const newPrefix = target.product==='shop' ? '573' : '583'
      const copy = config.replace(`project_id = "building-suit-${target.product}"`,`project_id = "${target.project}"`).replace(new RegExp(`\\b${oldPrefix}(2[0-9])\\b`,'g'),`${newPrefix}$1`).replace(/(\[db\.seed\]\s*\n(?:#[^\n]*\n)*enabled\s*=\s*)(?:true|false)/,target.product==='ledger' ? '$1false' : '$1true')
      await writeFile(path.join(destination,'config.toml'),copy)
      try { await cp(path.join(source,'seed.sql'),path.join(destination,'seed.sql')) } catch(error) { if(error.code!=='ENOENT')throw error }
      for(const name of await readdir(path.join(source,'migrations')))if(name.endsWith('.sql')) { const original = await readFile(path.join(source,'migrations',name));const cloned = await readFile(path.join(destination,'migrations',name));if(!original.equals(cloned))throw new Error('MIGRATION_COPY_CHANGED');migrationHashes[`${target.product}/${name}`] = createHash('sha256').update(original).digest('hex') }
      stage = `start owned ${target.product}`;owned.push(target)
      await cli(target,['start','--exclude','studio,realtime,imgproxy,postgres-meta,edge-runtime,logflare,vector,supavisor'])
      const raw = await cli(target,['status','-o','json'],30000);const status = JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));if(status.API_URL!==target.api || !status.ANON_KEY)throw new Error('LOCAL_STATUS_MISMATCH');target.publicKey = status.ANON_KEY
      // No delivery/provider or reminder activation is part of this acceptance.
      docker(['exec','-i',`supabase_db_${target.project}`,'psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],`do $$begin if to_regclass('cron.job') is not null then perform cron.unschedule(jobid) from cron.job;end if;end$$;`)
    }
    stage = 'actual Shop browser signup persistence and independent Ledger'
    const ledger = targets.find(target => target.product==='ledger');const shop = targets.find(target => target.product==='shop')
    const browserEnvironment = { ...environment,BS_ATOMIC_BACKEND_LEDGER_API: ledger.api,BS_ATOMIC_BACKEND_SHOP_API: shop.api,BS_ATOMIC_BACKEND_LEDGER_PUBLIC_KEY: ledger.publicKey,BS_ATOMIC_BACKEND_SHOP_PUBLIC_KEY: shop.publicKey,BS_ATOMIC_BACKEND_SHOP_MAIL: shop.mail,DOCTOR_SHOP_BACKEND_RESULTS: path.join(scratch,'browser-results') }
    const output = await command('pnpm',['exec','playwright','test','-c','packages/testing/playwright.doctor-shop-backend.config.ts'],browserEnvironment,180000)
    const clean = stripVTControlCharacters(output)
    if(!/\b1 passed \(/.test(clean) || /\b1 skipped\b/.test(clean))throw new Error('BACKEND_CASE_NOT_EXECUTED')
    assertDoctorShopBackendCandidate(process.env.M1_HEAD_SHA,sourceHead())
    await rm(path.join(root,'.local/screenshots/shop-products.png'),{ force: true })
    if(spawnSync('git',['status','--porcelain'],{ cwd: root,encoding: 'utf8' }).stdout?.trim())throw new Error('SOURCE_TREE_CHANGED')
    console.log('Actual Shop backend: 1 passed (real signup/email OTP, product persistence after reload, independent Ledger session and product cookie prefixes)')
    const out = process.env.DOCTOR_SHOP_BACKEND_EVIDENCE;if(out) { await mkdir(out,{ recursive: true });await writeFile(path.join(out,'shop-backend-summary.json'),JSON.stringify({ candidateSha: process.env.M1_HEAD_SHA,case: 'Shop signup, product persistence and independent Ledger sessions',passed: 1,skipped: 0,synthetic: true,loopbackOnly: true,sourceMigrationsUnchanged: true,migrationHashes },null,2)+'\n',{ mode: 0o600 }) }
  } catch { const sourceLine = [...lastOutput.matchAll(/shop-backend\.spec\.ts:(\d+):\d+/g)].at(-1)?.[1] || 'unavailable';console.error(`Doctor M1 Shop backend failed at ${stage}; category ${doctorShopBackendFailureKind(lastOutput)}; source line ${sourceLine}; no raw provider or credential material is published`);process.exitCode = 1 }
  finally {
    for(const target of owned.reverse()) { try { await cli(target,['stop','--project-id',target.project,'--no-backup'],120000) } catch { console.error('Owned Shop/Ledger cleanup failed');process.exitCode = 1 } }
    await rm(scratch,{ recursive: true,force: true });await rm(path.join(root,'.local/screenshots/shop-products.png'),{ force: true })
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main()
