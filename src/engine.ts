import {ShakeDetector} from './shake';
export type Point = {x:number;y:number};
export type Gesture = 'open'|'pinch'|'fist';
export type Hand = {id:string;points:Point[];gesture:Gesture;candidate:Gesture;since:number;anchor?:Point;lastSeen:number};
type Particle = Point & {vx:number;vy:number;life:number;max:number};
type Line = {a:Point;b:Point};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const mix=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export function classify(p:Point[],previous:Gesture):Gesture {
 const size=Math.max(distance(p[0],p[9]),.025);
 const pinch=distance(p[4],p[8])/size;
 const curled=[8,12,16,20].filter(i=>distance(p[i],p[0])<distance(p[i-2],p[0])*1.12).length;
 if(curled>=(previous==='fist'?3:4))return 'fist';
 if(pinch<(previous==='pinch'?.42:.29))return 'pinch';
 return 'open';
}
export function demoPoints(x:number,y:number,fist=false):Point[]{
 const p:Point[]=Array.from({length:21},()=>({x,y}));p[0]={x,y:y+.19};
 const tips=[{x:x-.20,y:y-.01},{x:x-.12,y:y-.23},{x:x-.015,y:y-.30},{x:x+.095,y:y-.25},{x:x+.18,y:y-.14}];
 for(let f=0;f<5;f++){const base={x:x+(f-2)*.048,y:y+.04};for(let j=0;j<4;j++)p[1+f*4+j]=mix(base,fist?{x:base.x,y:y+.10}:tips[f],(j+1)/4);}
 return p;
}
export class WebEngine {
 hands:Hand[]=[];particles:Particle[]=[];hiddenUntil=0;last=0;sparkTime=0;
 car:{position:Point;born:number}|null=null;
 private shakes=new Map<string,ShakeDetector>();
 private lastCar=-Infinity;
 createCar(position:Point,now:number){
  this.car={position:{x:Math.min(.73,Math.max(.27,position.x)),y:Math.min(.75,Math.max(.28,position.y))},born:now};
  this.lastCar=now;this.burst(this.car.position,90);
 }
 burst(p:Point,count=20){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=.07+Math.random()*.19;this.particles.push({...p,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4+Math.random()*.8,max:1.2});}this.particles=this.particles.slice(-650);}
 clear(now:number){this.particles=[];this.car=null;this.shakes.clear();this.hiddenUntil=now+800;}
 update(inputs:{id:string;points:Point[];gesture?:Gesture}[],now:number){
  const previous=this.hands;
  this.hands=inputs.map(input=>{
   let detector=this.shakes.get(input.id);if(!detector){detector=new ShakeDetector();this.shakes.set(input.id,detector);}
   const palm=input.points.filter((_,i)=>[0,5,9,13,17].includes(i)).reduce((sum,p)=>({x:sum.x+p.x/5,y:sum.y+p.y/5}),{x:0,y:0});
   if(detector.sample(palm,distance(input.points[0],input.points[9]),now)&&now-this.lastCar>2500&&now>this.hiddenUntil)this.createCar(palm,now);
   const old=previous.find(h=>h.id===input.id);
   const points=input.points.map((p,i)=>old?mix(old.points[i],p,.38):p);
   const next=input.gesture??classify(input.points,old?.gesture??'open');
   const hand:Hand=old??{id:input.id,points,gesture:next,candidate:next,since:now,lastSeen:now,anchor:next==='pinch'?{...points[9]}:undefined};
   if(next!==hand.candidate){hand.candidate=next;hand.since=now;}
   if(now-hand.since>100&&hand.gesture!==next){if(next==='fist')hand.points.forEach(p=>this.burst(p,8));hand.gesture=next;hand.anchor=next==='pinch'?{...hand.points[9]}:undefined;}
   hand.points=points;hand.lastSeen=now;return hand;
  });
  for(const h of previous)if(!this.hands.includes(h))this.burst(h.points[9],24);
  for(const id of this.shakes.keys())if(!inputs.some(input=>input.id===id))this.shakes.delete(id);
 }
 draw(ctx:CanvasRenderingContext2D,w:number,h:number,now:number,color:string,glow:number,idle:boolean){
  const dt=Math.min((now-this.last)/1000||.016,.045);this.last=now;
  ctx.clearRect(0,0,w,h);
  const scale=(p:Point)=>({x:p.x*w,y:p.y*h});
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=glow*18;
  const lines:Line[]=[];
  const line=(a:Point,b:Point,alpha=.6)=>{lines.push({a,b});const A=scale(a),B=scale(b);ctx.globalAlpha=alpha;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();};
  const dot=(p:Point,r:number,alpha=1)=>{const P=scale(p);ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(P.x,P.y,r,0,Math.PI*2);ctx.fill();};
  if(now>this.hiddenUntil){
   for(const hand of this.hands){if(hand.gesture==='fist')continue;
    const palm=mix(hand.points[0],hand.points[9],.65);
    const tips=[4,8,12,16,20,0].map(i=>hand.points[i]);
    for(let i=0;i<tips.length;i++){
     line(palm,tips[i],.85);
     for(let ring=1;ring<=5;ring++){const t=ring/5;line(mix(palm,tips[i],t),mix(palm,tips[(i+1)%tips.length],t),.25+t*.36);}
     dot(tips[i],3);if(Math.random()<dt*12)this.particles.push({...tips[i],vx:(Math.random()-.5)*.025,vy:.035,life:.65,max:.65});
    }
    if(hand.gesture==='pinch'&&hand.anchor){const grab=mix(hand.points[4],hand.points[8],.5);line(hand.anchor,grab,1);for(const tip of tips)line(grab,tip,.45);dot(grab,6);}
    dot(palm,3,.8);
   }
   const active=this.hands.filter(h=>h.gesture!=='fist');
   if(active.length===2){for(let i=0;i<5;i++){line(active[0].points[[4,8,12,16,20][i]],active[1].points[[20,16,12,8,4][i]],.45);}}
   if(now-this.sparkTime>100){this.sparkTime=now;let count=0;for(let i=0;i<lines.length&&count<7;i++)for(let j=i+1;j<lines.length&&count<7;j++){
    const a=lines[i],b=lines[j],rx=a.b.x-a.a.x,ry=a.b.y-a.a.y,sx=b.b.x-b.a.x,sy=b.b.y-b.a.y,den=rx*sy-ry*sx;
    if(Math.abs(den)<.00001)continue;const dx=b.a.x-a.a.x,dy=b.a.y-a.a.y,t=(dx*sy-dy*sx)/den,u=(dx*ry-dy*rx)/den;
    if(t>.06&&t<.94&&u>.06&&u<.94){this.burst(mix(a.a,a.b,t),2);count++;}
   }}
  }
  if(this.car)this.drawCar(ctx,w,h,now,color,glow);
  this.particles=this.particles.filter(p=>p.life>0);
  for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;dot(p,1.3,Math.max(0,p.life/p.max));}
  if(idle){ctx.globalAlpha=.25;for(let i=0;i<26;i++){const x=(Math.sin(i*83.2)*.5+.5)*w,y=((i*73+now*.012)%(h+40))-20;ctx.beginPath();ctx.arc(x,y,i%3===0?1.6:.7,0,7);ctx.fill();}}
  ctx.restore();
 }
 private drawCar(ctx:CanvasRenderingContext2D,w:number,h:number,now:number,color:string,glow:number){
  const car=this.car!;const progress=Math.min(1,(now-car.born)/900),ease=1-Math.pow(1-progress,3);
  const width=Math.min(w*.47,390),scale=width/300;
  ctx.save();ctx.translate(car.position.x*w,car.position.y*h+Math.sin(now*.0016)*4);ctx.scale(scale* Math.max(.01,ease),scale*Math.max(.01,ease));
  ctx.globalAlpha=ease;ctx.lineWidth=1.8;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=glow*16;
  const path=(points:number[][],close=false)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();ctx.stroke();};
  // Low coupe body, sloped windscreen, wheel arches and offset far-side silhouette.
  const body=[[-146,18],[-132,-7],[-72,-16],[-35,-54],[43,-54],[86,-20],[140,-10],[151,15],[145,32],[116,34],[111,15],[99,7],[80,7],[68,18],[66,35],[-72,35],[-74,17],[-88,8],[-105,8],[-120,19],[-122,33],[-142,30]];
  ctx.fillStyle='#07131fcc';ctx.beginPath();body.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();path(body,true);
  path([[-132,-7],[-110,-26],[-50,-35],[-18,-73],[59,-73],[104,-40],[147,-28],[160,-3],[151,15]]);
  for(const [x,y,dx,dy] of [[-72,-16,22,-19],[-35,-54,17,-19],[43,-54,16,-19],[86,-20,18,-20],[140,-10,7,-18]])path([[x,y],[x+dx,y+dy]]);
  path([[-61,-18],[-29,-47],[7,-47],[7,-19]],true);path([[16,-47],[39,-47],[72,-20],[16,-19]],true);
  path([[13,-17],[13,23],[61,23],[75,-9]]);path([[-140,4],[-118,4]]);path([[123,4],[145,4]]);
  for(const x of [-97,91]){
   ctx.beginPath();ctx.arc(x,28,21,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x,28,12,0,Math.PI*2);ctx.stroke();
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5+now*.0003;path([[x,28],[x+Math.cos(a)*12,28+Math.sin(a)*12]]);}
  }
  ctx.strokeStyle='#bd9bff';ctx.shadowColor='#bd9bff';ctx.lineWidth=2;path([[-70,39],[65,39]]);path([[-110,-26],[-50,-35],[-18,-73],[59,-73]]);
  ctx.strokeStyle='#edffff';ctx.shadowColor=color;ctx.shadowBlur=glow*25;ctx.lineWidth=3;path([[125,-3],[144,-1]]);
  if(progress<1){ctx.strokeStyle=color;ctx.globalAlpha=(1-progress)*.7;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,14,180*progress+30,70*progress+15,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
}
