import { gsap } from 'gsap'
export function createTimeline(camera, aim, papers, state) {
 const timeline=gsap.timeline({paused:true,defaults:{ease:'power2.inOut'}})
 camera.position.set(3.6,1.7,6);aim.z=.5
 timeline.to(camera.position,{x:.3,y:5.7,z:4.2,duration:3.5},.5)
 timeline.to(aim,{z:-.4,duration:3.5},.5)
 papers.forEach((p,i)=>{timeline.to(p.position,{x:1.7,y:.18+i*.035,z:-.7+i*.06,duration:2.15},1.2+i*.035);timeline.to(p.rotation,{z:0,duration:2},1.2)})
 timeline.to(state,{glow:1,duration:1},1.5).to(state,{hero:1,duration:.6},3.5)
 timeline.to({}, {duration:1},4)
 return timeline
}
