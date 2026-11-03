import { chromium } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateProject, frameTime } from '../scene/manifest.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const id=process.argv[2] || 'shop-suit-from-chaos-to-clarity'
if(!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Invalid project ID')
const project=validateProject(JSON.parse(await readFile(`${root}videos/${id}/project.json`,'utf8')))
const count=Number(process.argv[3] || project.duration*project.fps)
if(!Number.isInteger(count)||count<1||count>project.duration*project.fps) throw new Error('Invalid frame count')
const output=`${root}renders/${id}`
await mkdir(output,{recursive:true})
let browser
try {
 browser=await chromium.launch({
   ...(process.env.VIDEO_CHROMIUM_PATH ? { executablePath: process.env.VIDEO_CHROMIUM_PATH } : {}),
   chromiumSandbox: true,
   ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--unsafely-disable-devtools-self-xss-warnings'],
 })
 const page=await browser.newPage({viewport:{width:project.width,height:project.height},deviceScaleFactor:1})
 await page.goto(`${process.env.VIDEO_BASE_URL || 'http://localhost:3016'}/render.html?project=${id}`)
 await page.waitForFunction(()=>window.videoSuit!==undefined)
 const state=await page.evaluate(()=>({ready:window.videoSuit.ready,error:window.videoSuit.error}))
 if(!state.ready)throw new Error(state.error)
 // Prove arbitrary seeking is repeatable before capture.
 await page.evaluate(()=>window.videoSuit.seek(2))
 const first=await page.screenshot()
 await page.evaluate(()=>{window.videoSuit.seek(4);window.videoSuit.seek(0);window.videoSuit.seek(2)})
 if(!first.equals(await page.screenshot()))throw new Error('Non-deterministic scene seek')
 for(let i=0;i<count;i++){await page.evaluate(t=>window.videoSuit.seek(t),frameTime(i,project));await page.screenshot({path:`${output}/frame-${String(i).padStart(4,'0')}.png`})}
 if(count===project.duration*project.fps){const result=spawnSync('ffmpeg',['-y','-framerate',String(project.fps),'-i',`${output}/frame-%04d.png`,'-frames:v',String(count),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/sample.mp4`],{stdio:'inherit'});if(result.status!==0)throw new Error('FFmpeg failed')}
 console.log(`Exported ${count} actual Three.js frames to ${output}`)
} catch(error){console.error(`Export failed: ${error.message}. A sandbox-capable Chromium with WebGL is required; no fallback video was generated.`);process.exitCode=1}finally{await browser?.close()}
