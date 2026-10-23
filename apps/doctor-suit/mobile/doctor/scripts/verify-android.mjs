import {execFileSync} from 'node:child_process'
import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {androidRuntimeDiagnostics} from './android-diagnostics.mjs'
import {androidForeground} from './android-lifecycle.mjs'

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CI !== 'true') throw new Error('Owned CI emulator required')
const api = Number(process.env.DOCTOR_ANDROID_API)
if (![29, 36].includes(api)) throw new Error('Unregistered Android API')
const directory = resolve('.local/doctor-android')
const metadata = JSON.parse(await readFile(directory + '/build-metadata.json', 'utf8'))
const apk = directory + '/app-debug.apk'
const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim()
if (metadata.sourceHead !== head || metadata.appId !== 'com.buildingsuit.doctor.synthetic' || metadata.variant !== 'debug' ||
    metadata.syntheticOnly !== true || metadata.clinicalAuthority !== false || metadata.externalDistribution !== false ||
    createHash('sha256').update(await readFile(apk)).digest('hex') !== metadata.apkSha256) throw new Error('APK candidate evidence mismatch')
const devices = execFileSync('adb', ['devices'], {encoding: 'utf8'}).split('\n')
  .map(line => /^(emulator-\d+)\s+device$/.exec(line.trim())?.[1]).filter(Boolean)
if (devices.length !== 1) throw new Error('Exactly one owned disposable emulator required')
const serial = devices[0], app = metadata.appId
const adb = args => execFileSync('adb', ['-s', serial, ...args], {encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']}).trim()
if (Number(adb(['shell', 'getprop', 'ro.build.version.sdk'])) !== api) throw new Error('Emulator API mismatch')
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function foreground(expected){
  const deadline=Date.now()+20000
  while(Date.now()<deadline){
    try{const state=androidForeground(adb(['shell','dumpsys','activity','activities']));if(state.known&&state.syntheticForeground===expected)return}catch{/* Bounded observation only; no launch/action retry. */}
    await pause(250)
  }
  throw new Error('Expected owned activity transition unavailable')
}
async function visibleText(value) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      adb(['shell', 'rm', '-f', '/sdcard/doctor-shell.xml'])
      adb(['shell', 'uiautomator', 'dump', '/sdcard/doctor-shell.xml'])
      if (adb(['shell', 'cat', '/sdcard/doctor-shell.xml']).includes(value)) return
    } catch { /* Bounded readiness for this run's owned synthetic emulator only. */ }
    await pause(500)
  }
  throw new Error('Expected synthetic shell state unavailable')
}
const cases = ['cold-launch-signed-out', 'cold-deep-link-signed-out', 'hardware-back-workspace', 'background-resume-signed-out', 'unknown-deep-link-denied']
  .map(id => ({id, status: 'unrun'}))
let stage = 'install', installed = false, cleanup
const lifecycle={backgroundObserved:false,resumeObserved:false}
try {
  adb(['install', '-r', apk]); installed = true
  adb(['shell', 'pm', 'clear', app])
  adb(['logcat', '-c'])
  stage = cases[0].id
  adb(['shell', 'am', 'start', '-n', app + '/.MainActivity'])
  await visibleText('You are signed out'); await visibleText('Your practice, on Android'); cases[0].status = 'passed'
  stage = cases[1].id
  adb(['shell', 'am', 'force-stop', app])
  adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'doctor-suit-synthetic://schedule', app])
  await visibleText('You are signed out'); await visibleText('Your schedule, on Android'); cases[1].status = 'passed'
  stage = cases[2].id
  adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK'])
  await visibleText('Your practice, on Android'); await visibleText('You are signed out'); cases[2].status = 'passed'
  stage = cases[3].id
  adb(['shell', 'input', 'keyevent', 'KEYCODE_HOME'])
  await foreground(false);lifecycle.backgroundObserved=true
  adb(['shell', 'am', 'start', '-W', '-n', app + '/.MainActivity'])
  await foreground(true);lifecycle.resumeObserved=true
  await visibleText('You are signed out'); await visibleText('Your practice, on Android'); cases[3].status = 'passed'
  stage = cases[4].id
  adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'doctor-suit-synthetic://unregistered', app])
  await visibleText('Access unavailable'); cases[4].status = 'passed'
  stage = 'complete'
} catch {
  const failed = cases.find(item => item.id === stage)
  if (failed) failed.status = 'failed'
  process.exitCode = 1
  console.error('Synthetic Android verification failed at ' + stage)
} finally {
  const diagnosticRead = args => {try {return adb(args)} catch {return null}}
  const runtime = androidRuntimeDiagnostics(diagnosticRead(['shell', 'dumpsys', 'webviewupdate']), diagnosticRead(['logcat', '-d', '-t', '300', 'chromium:I', 'Capacitor/Console:I', 'Capacitor:I', 'AndroidRuntime:E', '*:S']), diagnosticRead(['shell', 'cat', '/sdcard/doctor-shell.xml']))
  try {
    // Only the synthetic package installed by this run is owned.
    if (installed) {adb(['shell', 'am', 'force-stop', app]); adb(['uninstall', app])}
    adb(['shell', 'rm', '-f', '/sdcard/doctor-shell.xml'])
    cleanup = 'passed'
  } catch {cleanup = 'failed'; process.exitCode = 1}
  await mkdir('test-results/doctor-mobile', {recursive: true})
  const receipt = {
    version: 1, sourceHead: head, appId: app, apkSha256: metadata.apkSha256, api,
    accepted: stage === 'complete' && cleanup === 'passed' && cases.every(item => item.status === 'passed'),
    stage, cleanup, runtime, lifecycle, runner: 'owned-disposable-android-emulator', physicalDevice: false, cases,
    syntheticOnly: true, clinicalApproval: false, offlineClinicalApproval: false, storeUpload: false,
  }
  await writeFile('test-results/doctor-mobile/device-' + api + '.json', JSON.stringify(receipt, null, 2) + '\n')
  console.log('Synthetic Android receipt ' + JSON.stringify(receipt))
}
if (!process.exitCode) console.log('Android emulator API' + api + ': five synthetic launch/navigation/lifecycle cases passed')
