import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateProject, frameTime } from '../../scene/manifest.mjs'
const p=JSON.parse(await readFile(new URL('../../videos/shop-suit-from-chaos-to-clarity/project.json',import.meta.url),'utf8'))
test('saved project reopens with the complete export contract',()=>{assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);assert.equal(p.duration*p.fps,150)})
test('unsafe paths, IDs and unsupported versions cannot load',()=>{for(const patch of [{id:'../secret'},{assets:['assets/../../secret.svg']},{schemaVersion:2},{scene:'unknown'},{parameters:{...p.parameters,cameraPush:Infinity}}])assert.throws(()=>validateProject({...p,...patch}))})
test('frame seeking is exact and bounded',()=>{assert.equal(frameTime(0,p),0);assert.equal(frameTime(149,p),149/30);for(const n of [-1,150,NaN,.5])assert.throws(()=>frameTime(n,p))})

test('actual scene timeline seeks identically after forward, rewind and replay',async()=>{
 const { createTimeline }=await import('../../scene/timeline.mjs')
 const vector=()=>({x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}})
 const camera={position:vector()},aim=vector(),papers=Array.from({length:7},()=>({position:vector(),rotation:vector()})),state={hero:0,glow:0}
 const tl=createTimeline(camera,aim,papers,state)
 const snapshot=()=>JSON.stringify({camera:camera.position,aim,papers,state},(key,value)=>key==='_gsap'?undefined:value)
 tl.totalTime(2);const first=snapshot();tl.totalTime(4);tl.totalTime(0);tl.totalTime(2);assert.equal(snapshot(),first)
 tl.totalTime(5);assert.equal(state.hero,1);tl.totalTime(0);assert.equal(state.hero,0);tl.kill()
})

test('download revisions preserve the selected project and reject invalid edits',async()=>{
 const { reviseProject }=await import('../../scene/manifest.mjs')
 const second={...p,id:'another-film',name:'Another film',assets:['assets/another.svg']}
 const changed=reviseProject(second,{...p.parameters,goldIntensity:1.5})
 assert.equal(changed.id,'another-film');assert.deepEqual(changed.assets,['assets/another.svg']);assert.equal(changed.scene,p.scene)
 assert.equal(changed.revision,p.revision+1);assert.equal(second.revision,p.revision);assert.equal(changed.parameters.goldIntensity,1.5)
 assert.throws(()=>reviseProject(p,{...p.parameters,goldIntensity:5}))
})

test('export contracts reject unsupported encoding dimensions and fractional frames',()=>{for(const patch of [{width:721},{height:1281},{duration:1.01},{assets:[]}])assert.throws(()=>validateProject({...p,...patch}))})
