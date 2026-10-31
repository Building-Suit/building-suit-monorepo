import * as THREE from 'three'
import { createTimeline } from './timeline.mjs'
import { validateProject } from './manifest.mjs'
const status = document.querySelector('#status')
try {
 const id = new URLSearchParams(location.search).get('project') || 'shop-suit-from-chaos-to-clarity'
 if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Invalid project identifier')
 const project = validateProject(await (await fetch(`/videos/${id}/project.json`)).json())
 const kit = await (await fetch('/shared/models/counter-kit.json')).json()
 const scene = new THREE.Scene(); scene.background = new THREE.Color('#0D1B28')
 scene.fog = new THREE.Fog('#0D1B28', 10, 24)
 const camera = new THREE.PerspectiveCamera(42, project.width/project.height, .1, 60)
 const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true })
 renderer.setSize(project.width,project.height); renderer.setPixelRatio(1)
 renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap
 renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.2
 document.querySelector('#stage').append(renderer.domElement)
 const hemi = new THREE.HemisphereLight('#dce6f1','#16293B',2);scene.add(hemi)
 const key = new THREE.DirectionalLight('#ffdfac',5); key.position.set(-3,8,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);scene.add(key)
 const rim = new THREE.PointLight('#D89B42',35,15);rim.position.set(3,3,-2);scene.add(rim)
 const material = color=>new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.15})
 function box(name,color,pos){const m=new THREE.Mesh(new THREE.BoxGeometry(...kit.models[name].size),material(color));m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
 box('counter','#16293B',[0,-.2,0])
 const tablet=box('tablet','#111820',[0,.12,-.8]);tablet.rotation.x=-.25
 const texture = new THREE.TextureLoader()
 const load = url=>new Promise((resolve,reject)=>texture.load(url,resolve,undefined,reject))
 const [logo,endorsement,receipt,icons]=await Promise.all(['/brand/shop-suit-wordmark-light.svg','/brand/building-suit-logo-light.png',`/videos/${id}/assets/receipt.svg`,'/shared/svg/records.svg'].map(load))
 for(const t of [logo,endorsement,receipt,icons])t.colorSpace=THREE.SRGBColorSpace
 function panel(w,h,map,parent,x,y,z){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,transparent:true,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.x=-Math.PI/2;parent.add(m);return m}
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(2.28,3.12),material('#16293B')); screen.rotation.x=-Math.PI/2;screen.position.y=.075;tablet.add(screen)
 panel(1.92,.58,logo,tablet,0,.085,-.3)
 panel(.85,.37,endorsement,tablet,0,.086,.45)
 const papers=[]
 for(let i=0;i<7;i++){const m=panel(.7,1.25,receipt,scene,(i%3-1)*1.25,.015+i*.008,(Math.floor(i/3)-1)*1.3+.6);m.rotation.z=(i-3)*.3;m.castShadow=true;papers.push(m)}
 for(let i=0;i<3;i++){const b=box('box',i%2?'#36506E':'#9c7445',[-2.3+i*.15,.35,-1.6+i*.9]);b.rotation.y=i*.32}
 const record=panel(2,.6,icons,scene,0,.12,1.45)
 const paths=[]
 for(let i=0;i<3;i++) {const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.9,.1,i*.45),new THREE.Vector3(-1.2,1.2,i*.2),new THREE.Vector3(-.3,.2,-.8)); const path=new THREE.Mesh(new THREE.TubeGeometry(curve,32,.012,6,false),new THREE.MeshStandardMaterial({color:'#D89B42',emissive:'#D89B42',emissiveIntensity:1}));scene.add(path);paths.push(path)}
 const state={hero:0,glow:0};const aim={x:0,y:0,z:0}
 const timeline=createTimeline(camera,aim,papers,state)
 const caption=document.querySelector('#caption');caption.textContent=project.caption
 function seek(t,parameters=project.parameters){
  if(!Number.isFinite(t))throw new Error('Invalid seek')
  timeline.totalTime(Math.max(0,Math.min(project.duration,t))*5/project.duration,false)
  camera.position.y*=parameters.cameraPush
  papers.forEach(p=>{p.position.y*=parameters.receiptLift})
  paths.forEach(p=>{p.visible=state.glow>0;p.material.emissiveIntensity=state.glow*parameters.goldIntensity})
  record.visible=state.glow>.4;caption.style.opacity=String(state.hero)
  camera.lookAt(aim.x,aim.y,aim.z);camera.updateProjectionMatrix();renderer.render(scene,camera)
 }
 // Parameter scaling uses a fresh timeline-evaluated value, without accumulating transforms.
 function render(t,params=project.parameters){timeline.totalTime(0);timeline.totalTime(Math.max(0,Math.min(project.duration,t))*5/project.duration);const y=camera.position.y;const py=papers.map(p=>p.position.y);seek(t,params);camera.position.y=y;papers.forEach((p,i)=>p.position.y=py[i])}
 let playing=false,start=0,current=0,parameters=project.parameters
 function tick(now){if(playing){current=((now-start)/1000)%project.duration;render(current,parameters)}requestAnimationFrame(tick)}requestAnimationFrame(tick)
 window.videoSuit={ready:true,project,seek(t){playing=false;current=t;render(t,parameters)},play(){start=performance.now()-current*1000;playing=true},pause(){playing=false},snapshot(){return {camera:camera.position.toArray(),papers:papers.map(p=>p.position.toArray())}}}
 window.addEventListener('message',event=>{if(event.origin!==location.origin)return;const m=event.data;if(m?.type==='video-suit:seek')window.videoSuit.seek(m.time);if(m?.type==='video-suit:play')window.videoSuit.play();if(m?.type==='video-suit:pause')window.videoSuit.pause();if(m?.type==='video-suit:parameters'){parameters=validateProject({...project,parameters:m.parameters}).parameters;render(current,parameters)}})
 render(0);status.remove()
} catch(error){status.textContent=`Renderer unavailable: ${error.message}. Use a WebGL-capable browser with a working sandbox.`;window.videoSuit={ready:false,error:error.message}}
