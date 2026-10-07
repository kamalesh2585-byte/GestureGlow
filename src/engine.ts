import {PalmCarDetector} from './palm-car';
export type Point = {x:number;y:number;z?:number};
export type Gesture = 'open'|'pinch'|'fist';
export type Hand = {id:string;points:Point[];gesture:Gesture;candidate:Gesture;since:number;anchor?:Point;lastSeen:number};
type Particle = Point & {vx:number;vy:number;life:number;max:number};
type Line = {a:Point;b:Point};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const distance3=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
const mix=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function handClosure(p:Point[]):number {
 return [8,12,16,20].reduce((sum,i)=>{
  const mcp=p[i-3],pip=p[i-2],tip=p[i];
  const ax=mcp.x-pip.x,ay=mcp.y-pip.y,az=(mcp.z??0)-(pip.z??0);
  const bx=tip.x-pip.x,by=tip.y-pip.y,bz=(tip.z??0)-(pip.z??0);
  const lengths=Math.hypot(ax,ay,az)*Math.hypot(bx,by,bz);
  const bend=lengths>1e-8?(ax*bx+ay*by+az*bz)/lengths:-1;
  const reach=distance3(tip,p[0])/Math.max(distance3(pip,p[0]),.0001);
  return sum+Math.max(clamp((bend+.8)/1.35),clamp((1.25-reach)/.55))/4;
 },0);
}
export function isTrayPose(p:Point[],retaining=false,imagePoints?:Point[]):boolean {
 const closure=handClosure(p);
 if(closure>.8)return false;
 if(imagePoints){
  // Match the visible sideways hand in the reference, rather than relying on
  // a noisy depth estimate of an almost edge-on palm.
  const tips=[8,12,16,20].map(i=>imagePoints[i]);
  const end=tips.reduce((sum,tip)=>({x:sum.x+tip.x/4,y:sum.y+tip.y/4}),{x:0,y:0});
  const dx=end.x-imagePoints[0].x,dy=end.y-imagePoints[0].y;
  const axis=Math.hypot(dx,dy);
  if(axis<.005)return false;
  const shape=[0,5,8,9,12,13,16,17,20].map(i=>imagePoints[i]);
  const width=Math.max(...shape.map(p=>p.x))-Math.min(...shape.map(p=>p.x));
  const height=Math.max(...shape.map(p=>p.y))-Math.min(...shape.map(p=>p.y));
  const horizontal=Math.abs(dx)/axis>(retaining?.55:.68);
  const flat=height/Math.max(width,.005)<(retaining?1.15:.95);
  const extended=[8,12,16,20].filter(i=>distance3(p[i],p[0])>distance3(p[i-2],p[0])*1.04).length;
  return horizontal&&flat&&(extended>=2||closure<.68);
 }
 const a={x:p[5].x-p[0].x,y:p[5].y-p[0].y,z:(p[5].z??0)-(p[0].z??0)};
 const b={x:p[17].x-p[0].x,y:p[17].y-p[0].y,z:(p[17].z??0)-(p[0].z??0)};
 const nx=a.y*b.z-a.z*b.y,ny=a.z*b.x-a.x*b.z,nz=a.x*b.y-a.y*b.x;
 const length=Math.hypot(nx,ny,nz);
 // The palm plane should face mostly upward/downward in camera space, like a tray.
 // Absolute normal direction supports either hand without relying on handedness labels.
 return length>1e-8&&Math.abs(ny)/length>(retaining?.38:.55)&&closure<.7;
}
export function classify(p:Point[],previous:Gesture):Gesture {
 const size=Math.max(distance3(p[0],p[9]),.025);
 const pinch=distance3(p[4],p[8])/size;
 const curled=[8,12,16,20].filter(i=>{
  const mcp=p[i-3],pip=p[i-2],tip=p[i];
  const ax=mcp.x-pip.x,ay=mcp.y-pip.y,az=(mcp.z??0)-(pip.z??0);
  const bx=tip.x-pip.x,by=tip.y-pip.y,bz=(tip.z??0)-(pip.z??0);
  const lengths=Math.hypot(ax,ay,az)*Math.hypot(bx,by,bz);
  const bend=lengths>1e-8?(ax*bx+ay*by+az*bz)/lengths:-1;
  return bend>-.35||distance3(tip,p[0])<distance3(pip,p[0])*1.12;
 }).length;
 // Three curled fingers handle partially occluded fists without mistaking a pinch for a fist.
 if(curled>=(previous==='fist'?2:3))return 'fist';
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
 car:{position:Point;target:Point;handId?:string;lastSeen:number;born:number;strands:Point[][];active:boolean;visibility:number}|null=null;
 private palms=new Map<string,PalmCarDetector>();
 private tracked=new Map<string,Hand>();
 private nextHandId=0;
 createCar(position:Point,now:number,handId?:string){
  const anchor=this.carAnchor(position);
  const owner=handId??[...this.hands].sort((a,b)=>distance(a.points[9],position)-distance(b.points[9],position))[0]?.id;
  this.car={position:{...anchor},target:{...anchor},handId:owner,lastSeen:now,born:now,strands:this.hands.map(h=>h.points.map(p=>({...p}))),active:true,visibility:0};
  this.burst(this.car.position,90);
 }
 private carAnchor(p:Point):Point{return {x:Math.min(.95,Math.max(.05,p.x)),y:Math.min(.92,Math.max(.08,p.y-.09))};}
 burst(p:Point,count=20){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=.07+Math.random()*.19;this.particles.push({...p,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4+Math.random()*.8,max:1.2});}this.particles=this.particles.slice(-260);}
 clear(now:number,resetTracking=false){
  this.particles=[];this.car=null;this.hiddenUntil=now+800;
  for(const detector of this.palms.values())detector.suppressUntilRelease();
  if(resetTracking){this.tracked.clear();this.palms.clear();}
 }
 update(inputs:{id:string;points:Point[];gesturePoints?:Point[];imagePoints?:Point[];gesture?:Gesture;tray?:boolean}[],now:number){
  // Preserve identity across short tracking gaps and handedness-label changes.
  if(inputs.length===0)for(const [id,hand] of this.tracked)if(now-hand.lastSeen>2500){this.tracked.delete(id);this.palms.delete(id);}
  const previous=this.hands;
  const used=new Set<string>();
  this.hands=inputs.map(input=>{
   let old:Hand|undefined;
   if(input.gesture!==undefined)old=this.tracked.get(input.id);
   else{
    const maxDistance=Math.max(.16,distance(input.points[0],input.points[9])*1.7);
    old=[...this.tracked.values()].filter(h=>!used.has(h.id)&&distance(h.points[0],input.points[0])<maxDistance).sort((a,b)=>distance(a.points[0],input.points[0])-distance(b.points[0],input.points[0]))[0];
   }
   const id=old?.id??(input.gesture!==undefined?input.id:`tracked-${++this.nextHandId}`);used.add(id);
   const smoothing=old?1-Math.exp(-Math.min(now-old.lastSeen,100)/65):1;
   const points=input.points.map((p,i)=>old?mix(old.points[i],p,smoothing):p);
   const next=input.gesture??classify(input.gesturePoints??input.points,old?.gesture??'open');
   const hand:Hand=old??{id,points,gesture:next,candidate:next,since:now,lastSeen:now,anchor:next==='pinch'?{...points[9]}:undefined};
   if(old&&now-old.lastSeen>250){hand.candidate=next;hand.since=now;}
   if(next!==hand.candidate){hand.candidate=next;hand.since=now;}
   if(now-hand.since>100&&hand.gesture!==next){if(next==='fist')hand.points.forEach(p=>this.burst(p,8));hand.gesture=next;hand.anchor=next==='pinch'?{...hand.points[9]}:undefined;}
   let detector=this.palms.get(id);if(!detector){detector=new PalmCarDetector();this.palms.set(id,detector);}
   const pose=input.tray!==undefined?input.tray&&next==='open':isTrayPose(input.gesturePoints??input.points,detector.active,input.imagePoints??input.points);
   if(now>this.hiddenUntil)detector.sample(pose,now);
   hand.points=points;hand.lastSeen=now;this.tracked.set(id,hand);return hand;
  });
  for(const h of previous)if(!this.hands.includes(h))this.burst(h.points[9],24);
  for(const [id,detector] of this.palms)if(!used.has(id))detector.sample(false,now);
  for(const [id,hand] of this.tracked)if(!used.has(id)&&now-hand.lastSeen>2500){this.tracked.delete(id);this.palms.delete(id);}
  const trayHands=this.hands.filter(hand=>this.palms.get(hand.id)?.active);
  if(!this.car&&trayHands.length&&now>this.hiddenUntil){const hand=trayHands[0];this.createCar(mix(hand.points[0],hand.points[9],.65),now,hand.id);}
  if(this.car){
   this.car.active=trayHands.length>0||!!this.palms.get(this.car.handId??'')?.active;
   let owner=trayHands.find(hand=>hand.id===this.car!.handId);
   if(!owner&&trayHands.length){
    owner=[...trayHands].sort((a,b)=>distance(a.points[9],this.car!.target)-distance(b.points[9],this.car!.target))[0];
    if(owner)this.car.handId=owner.id;
   }
   if(owner){this.car.target=this.carAnchor(mix(owner.points[0],owner.points[9],.65));this.car.lastSeen=now;}
  }
 }
 draw(ctx:CanvasRenderingContext2D,w:number,h:number,now:number,color:string,glow:number,idle:boolean){
  const elapsed=(now-this.last)/1000||.016;
  const dt=Math.min(elapsed,.045);this.last=now;
  if(this.car){
   const carDt=Math.max(0,elapsed);
   this.car.position=mix(this.car.position,this.car.target,1-Math.exp(-carDt/.055));
   this.car.visibility+=(Number(this.car.active)-this.car.visibility)*(1-Math.exp(-carDt/.14));
   if(!this.car.active&&this.car.visibility<.005)this.car=null;
  }
  ctx.clearRect(0,0,w,h);
  const scale=(p:Point)=>({x:p.x*w,y:p.y*h});
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=glow*18;
  const lines:Line[]=[];
  const webAlpha=1-(this.car?.visibility??0);
  const line=(a:Point,b:Point,alpha=.6)=>{lines.push({a,b});const A=scale(a),B=scale(b);ctx.shadowBlur=0;ctx.globalAlpha=alpha*webAlpha;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();};
  const dot=(p:Point,r:number,alpha=1)=>{const P=scale(p);ctx.shadowBlur=r>=3?glow*10:0;ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(P.x,P.y,r,0,Math.PI*2);ctx.fill();};
  if(now>this.hiddenUntil&&webAlpha>.025){
   for(const hand of this.hands){if(hand.gesture==='fist')continue;
    const palm=mix(hand.points[0],hand.points[9],.65);
    const tips=[4,8,12,16,20,0].map(i=>hand.points[i]);
    for(let i=0;i<tips.length;i++){
     line(palm,tips[i],.85);
     for(let ring=1;ring<=5;ring++){const t=ring/5;line(mix(palm,tips[i],t),mix(palm,tips[(i+1)%tips.length],t),.25+t*.36);}
     dot(tips[i],3,webAlpha);if(Math.random()<dt*12)this.particles.push({...tips[i],vx:(Math.random()-.5)*.025,vy:.035,life:.65,max:.65});
    }
    if(hand.gesture==='pinch'&&hand.anchor){const grab=mix(hand.points[4],hand.points[8],.5);line(hand.anchor,grab,1);for(const tip of tips)line(grab,tip,.45);dot(grab,6,webAlpha);}
    dot(palm,3,.8*webAlpha);
   }
   const active=this.hands.filter(h=>h.gesture!=='fist');
   if(active.length===2){for(let i=0;i<5;i++){line(active[0].points[[4,8,12,16,20][i]],active[1].points[[20,16,12,8,4][i]],.45);}}
   if(now-this.sparkTime>100){this.sparkTime=now;let count=0;for(let i=0;i<lines.length&&count<7;i++)for(let j=i+1;j<lines.length&&count<7;j++){
    const a=lines[i],b=lines[j],rx=a.b.x-a.a.x,ry=a.b.y-a.a.y,sx=b.b.x-b.a.x,sy=b.b.y-b.a.y,den=rx*sy-ry*sx;
    if(Math.abs(den)<.00001)continue;const dx=b.a.x-a.a.x,dy=b.a.y-a.a.y,t=(dx*sy-dy*sx)/den,u=(dx*ry-dy*rx)/den;
    if(t>.06&&t<.94&&u>.06&&u<.94){this.burst(mix(a.a,a.b,t),2);count++;}
   }}
  }
  if(lines.length){ctx.shadowBlur=glow*12;ctx.globalAlpha=webAlpha*.25;ctx.lineWidth=1.5;ctx.beginPath();for(const line of lines){ctx.moveTo(line.a.x*w,line.a.y*h);ctx.lineTo(line.b.x*w,line.b.y*h);}ctx.stroke();}
  if(this.car)this.drawCar(ctx,w,h,now,color,glow);
  this.particles=this.particles.filter(p=>p.life>0);
  for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;dot(p,1.3,Math.max(0,p.life/p.max));}
  if(idle){ctx.globalAlpha=.25;for(let i=0;i<26;i++){const x=(Math.sin(i*83.2)*.5+.5)*w,y=((i*73+now*.012)%(h+40))-20;ctx.beginPath();ctx.arc(x,y,i%3===0?1.6:.7,0,7);ctx.fill();}}
  ctx.restore();
 }
 private drawCar(ctx:CanvasRenderingContext2D,w:number,h:number,now:number,color:string,glow:number){
  const car=this.car!;const progress=clamp((now-car.born)/900),ease=progress*progress*(3-2*progress);
  if(progress<1){
   ctx.save();ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=glow*18;ctx.lineWidth=1;ctx.globalAlpha=Math.sin(progress*Math.PI)*.8*car.visibility;
   for(const points of car.strands){const palm=mix(points[0],points[9],.65);for(const i of [4,8,12,16,20]){
    const target={x:car.position.x+(i-12)*.014,y:car.position.y+.02};
    const a=mix(palm,target,ease),b=mix(points[i],target,ease);ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);ctx.stroke();
   }}ctx.restore();
  }
  const width=Math.min(w*.47,390),scale=width/300;
  ctx.save();ctx.translate(car.position.x*w,car.position.y*h+Math.sin(now*.0016)*4);ctx.scale(scale* Math.max(.01,ease),scale*Math.max(.01,ease));
  ctx.globalAlpha=ease*car.visibility;ctx.lineWidth=1.8;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=glow*16;
  const path=(points:number[][],close=false)=>{points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();};
  // Low coupe body, sloped windscreen, wheel arches and offset far-side silhouette.
  const body=[[-146,18],[-132,-7],[-72,-16],[-35,-54],[43,-54],[86,-20],[140,-10],[151,15],[145,32],[116,34],[111,15],[99,7],[80,7],[68,18],[66,35],[-72,35],[-74,17],[-88,8],[-105,8],[-120,19],[-122,33],[-142,30]];
  ctx.fillStyle='#07131fcc';ctx.beginPath();body.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.beginPath();path(body,true);
  path([[-132,-7],[-110,-26],[-50,-35],[-18,-73],[59,-73],[104,-40],[147,-28],[160,-3],[151,15]]);
  for(const [x,y,dx,dy] of [[-72,-16,22,-19],[-35,-54,17,-19],[43,-54,16,-19],[86,-20,18,-20],[140,-10,7,-18]])path([[x,y],[x+dx,y+dy]]);
  path([[-61,-18],[-29,-47],[7,-47],[7,-19]],true);path([[16,-47],[39,-47],[72,-20],[16,-19]],true);
  path([[13,-17],[13,23],[61,23],[75,-9]]);path([[-140,4],[-118,4]]);path([[123,4],[145,4]]);
  for(const x of [-97,91]){
   ctx.moveTo(x+21,28);ctx.arc(x,28,21,0,Math.PI*2);ctx.moveTo(x+12,28);ctx.arc(x,28,12,0,Math.PI*2);
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5+now*.0003;path([[x,28],[x+Math.cos(a)*12,28+Math.sin(a)*12]]);}
  }
  ctx.stroke();
  ctx.strokeStyle='#bd9bff';ctx.shadowColor='#bd9bff';ctx.lineWidth=2;ctx.beginPath();path([[-70,39],[65,39]]);path([[-110,-26],[-50,-35],[-18,-73],[59,-73]]);ctx.stroke();
  ctx.strokeStyle='#edffff';ctx.shadowColor=color;ctx.shadowBlur=glow*25;ctx.lineWidth=3;ctx.beginPath();path([[125,-3],[144,-1]]);ctx.stroke();
  if(progress<1){ctx.strokeStyle=color;ctx.globalAlpha=(1-progress)*.7*car.visibility;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,14,180*progress+30,70*progress+15,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
}
