import {type Point} from './engine';
type Vec={x:number;y:number;z:number};
type ClapHand={points:Point[];world?:Point[]};
const palm=(p:Point[])=>[0,5,9,13,17].reduce((a,i)=>({x:a.x+p[i].x/5,y:a.y+p[i].y/5}),{x:0,y:0});
export class ClapDetector {
 private armed=false;private time=0;private lastClap=-Infinity;
 private farDistance=0;private distance=0;private size=0;private approach=-Infinity;
 private center:Point={x:.5,y:.5};
 hint='Show both hands';
 reset(){this.armed=false;this.time=0;this.lastClap=-Infinity;this.farDistance=0;this.distance=0;this.size=0;this.approach=-Infinity;this.hint='Show both hands';}
 sample(hands:ClapHand[],now:number):Point|null {
  if(now-this.time>700)this.armed=false;
  if(hands.length!==2||hands.some(h=>h.points.length!==21)){
   // At contact one palm often hides the other. Accept this only after a
   // measured approach near contact, never simply because tracking vanished.
   if(hands.length===1&&this.armed&&now-this.time<350&&now-this.approach<350&&this.distance<this.size*2.3&&this.farDistance-this.distance>this.size*.6&&now-this.lastClap>900)return this.fire(now);
   this.hint=this.armed?'Keep both hands visible':'Show both hands';return null;
  }
  const [a,b]=hands.map(h=>palm(h.points));
  const observedSize=hands.reduce((sum,h)=>sum+Math.max(
   Math.hypot(h.points[0].x-h.points[9].x,h.points[0].y-h.points[9].y),
   Math.hypot(h.points[5].x-h.points[17].x,h.points[5].y-h.points[17].y)
  )/2,0);
  if(observedSize<.015){this.hint='Move your hands closer to the camera';return null;}
  // Keep the reference size through the approach: turning palms sideways at
   // contact used to shrink the scale and make a real clap fail the threshold.
  if(!this.armed)this.size=observedSize;
  const distance=Math.hypot(a.x-b.x,a.y-b.y);
  this.center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  if(now-this.lastClap>900&&distance>observedSize*2.3){
   if(!this.armed){this.armed=true;this.farDistance=distance;this.size=observedSize;}
   this.farDistance=Math.max(this.farDistance,distance);
  }
  if(this.armed&&this.distance-distance>this.size*.06)this.approach=now;
  this.time=now;this.distance=distance;
  const approaching=now-this.approach<650&&this.farDistance-distance>this.size*.6;
  if(this.armed&&approaching&&distance<Math.max(this.size*1.65,this.farDistance*.28)&&now-this.lastClap>900)return this.fire(now);
  this.hint=this.armed?'Ready - bring your palms together':'Move both hands apart, then clap';
  return null;
 }
 private fire(now:number){this.lastClap=now;this.armed=false;this.hint='Clap detected!';return {...this.center};}
}

// Branching geometry, sparks and rings live in 3D and are perspective-projected.
export class ThunderEffect {
 born=-Infinity;center:Point={x:.5,y:.5};
 private bolts:Vec[][]=[];private sparks:Vec[]=[];
 trigger(point:Point,now:number){
  this.born=now;this.center=point;this.bolts=[];
  for(let i=0;i<9;i++){
   const angle=i*Math.PI*2/9,vertical=i===0;
   const end={x:vertical?0:Math.cos(angle)*(.7+Math.random()*.45),y:vertical?-1.9:Math.sin(angle)*(.55+Math.random()*.35),z:(Math.random()-.5)*1.4};
   const path:Vec[]=[{x:0,y:0,z:0}];
   for(let j=1;j<=18;j++){const t=j/18,envelope=Math.sin(t*Math.PI);path.push({x:end.x*t+(Math.random()-.5)*.16*envelope,y:end.y*t+(Math.random()-.5)*.16*envelope,z:end.z*t+(Math.random()-.5)*.22*envelope});}
   this.bolts.push(path);
   for(let k=0;k<3;k++){const start=path[4+k*4],branch=[start];for(let j=1;j<=5;j++)branch.push({x:start.x+(end.x*.2+(Math.random()-.5)*.12)*j/5,y:start.y+(end.y*.22+(Math.random()-.5)*.12)*j/5,z:start.z+j*.055});this.bolts.push(branch);}
  }
  this.sparks=Array.from({length:85},()=>{const angle=Math.random()*Math.PI*2,z=Math.random()*2-1,r=Math.sqrt(1-z*z),speed=.35+Math.random()*1.25;return {x:Math.cos(angle)*r*speed,y:Math.sin(angle)*r*speed,z:z*speed};});
 }
 clear(){this.born=-Infinity;this.bolts=[];this.sparks=[];}
 draw(ctx:CanvasRenderingContext2D,w:number,h:number,now:number){
  const t=(now-this.born)/1000;if(t<0||t>1.65)return;
  const scale=Math.min(w,h)*.38,angle=t*.32;
  const project=(p:Vec)=>{const x=p.x*Math.cos(angle)+p.z*Math.sin(angle),z=p.z*Math.cos(angle)-p.x*Math.sin(angle),perspective=2.8/(2.8+z);return {x:this.center.x*w+x*scale*perspective,y:this.center.y*h+p.y*scale*perspective,depth:perspective};};
  ctx.save();ctx.globalCompositeOperation='lighter';
  const flash=Math.exp(-t*24)*.35;ctx.fillStyle=`rgba(170,210,255,${flash})`;ctx.fillRect(0,0,w,h);
  const origin=project({x:0,y:0,z:0}),halo=ctx.createRadialGradient(origin.x,origin.y,0,origin.x,origin.y,scale*.8);
  halo.addColorStop(0,`rgba(180,215,255,${Math.exp(-t*5)*.7})`);halo.addColorStop(.25,`rgba(80,120,255,${Math.exp(-t*4)*.3})`);halo.addColorStop(1,'rgba(80,120,255,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
  const intensity=Math.exp(-t*3.3)*(.7+.3*Math.cos(t*55)**2);
  for(const path of this.bolts){const points=path.map(project);for(const [width,color,alpha] of [[9,'#635bff',.22],[3,'#8dcfff',.85],[1,'#effbff',1]] as const){ctx.strokeStyle=color;ctx.lineWidth=width*points[0].depth;ctx.globalAlpha=intensity*alpha;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}}
  for(let ring=0;ring<2;ring++){ctx.globalAlpha=Math.max(0,1-t/1.2)*.6;ctx.lineWidth=1.7;ctx.strokeStyle=ring?'#aeb3ff':'#8deaff';ctx.beginPath();for(let i=0;i<=80;i++){const a=i*Math.PI*2/80,r=t*(1.1+ring*.45),p=project({x:Math.cos(a)*r,y:Math.sin(a)*r*.3,z:Math.sin(a)*r});if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}ctx.stroke();}
  for(const v of this.sparks){const p=project({x:v.x*t,y:v.y*t+t*t*.18,z:v.z*t});ctx.globalAlpha=Math.max(0,1-t/1.65);ctx.fillStyle=v.z>0?'#91a9ff':'#d8faff';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.6,2.2*p.depth*(1-t/2)),0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
}

export function playThunder(context:AudioContext){
 if(context.state!=='running')return;
 const buffer=context.createBuffer(1,context.sampleRate*1.6,context.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/context.sampleRate*2.5);
 const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=700;gain.gain.value=.3;source.connect(filter);filter.connect(gain);gain.connect(context.destination);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start();
}
