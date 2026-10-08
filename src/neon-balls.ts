import type {Point} from './engine';
type NeonBall={x:number;y:number;r:number;color:string;phase:number;launched:boolean;speed:number;vx:number;vy:number};
const colors=['#ff36c8','#9865ff','#35f2ff','#fff36a','#58ffae','#ff7857'];
export class NeonBallGame {
 balls:NeonBall[]=[];score=0;private last=0;private touches:Point[]=[];private touchTime=-Infinity;
 constructor(){this.reset();}
 reset(){this.score=0;this.last=0;this.touches=[];this.touchTime=-Infinity;this.balls=[];for(let i=0;i<24;i++)this.balls.push(this.spawn(i));}
 private spawn(i:number):NeonBall {
  // Choose among random candidates to avoid stacks of balls without a grid.
  let x=.5,y=.6,best=-1;
  for(let j=0;j<60;j++){const cx=.06+Math.random()*.88,cy=.35+Math.random()*.54;const clearance=Math.min(...this.balls.filter(b=>!b.launched).map(b=>Math.hypot(cx-b.x,(cy-b.y)*.75)),1);if(clearance>best){x=cx;y=cy;best=clearance;}if(clearance>.11)break;}
  const angle=Math.random()*Math.PI*2,speed=.015+Math.random()*.025;
  return {x,y,r:.028+Math.random()*.013,color:colors[i%colors.length],phase:Math.random()*Math.PI*2,launched:false,speed:.22+Math.random()*.18,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed};
 }
 touch(points:Point[],now:number,w:number,h:number){
  this.touches=points;this.touchTime=now;
  for(const b of this.balls){if(b.launched)continue;const radius=b.r*Math.min(w,h);
   if(points.some(p=>Math.hypot((p.x-b.x)*w,(p.y-b.y)*h)<=radius+10)){b.launched=true;this.score++;}
  }
 }
 draw(ctx:CanvasRenderingContext2D,w:number,h:number,now:number){
  const dt=this.last?Math.min(.06,(now-this.last)/1000):0;this.last=now;
  ctx.clearRect(0,0,w,h);ctx.save();
  this.balls.forEach((b,i)=>{
   if(b.launched){b.y-=dt*b.speed;b.speed+=dt*.14;b.x+=b.vx*dt;if(b.y<-.15){this.balls[i]=this.spawn(i);return;}}
   else{b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<.06||b.x>.94){b.vx*=-1;b.x=Math.max(.06,Math.min(.94,b.x));}if(b.y<.35||b.y>.9){b.vy*=-1;b.y=Math.max(.35,Math.min(.9,b.y));}}
   const x=b.x*w,y=b.y*h,r=b.r*Math.min(w,h),pulse=.88+.12*Math.sin(now*.002+b.phase);
   const halo=ctx.createRadialGradient(x,y,r*.3,x,y,r*2.8);halo.addColorStop(0,b.color+'70');halo.addColorStop(.45,b.color+'35');halo.addColorStop(1,b.color+'00');ctx.globalAlpha=pulse;ctx.fillStyle=halo;ctx.fillRect(x-r*2.8,y-r*2.8,r*5.6,r*5.6);ctx.globalAlpha=1;
   const sphere=ctx.createRadialGradient(x-r*.3,y-r*.35,0,x,y,r);sphere.addColorStop(0,'#efffff');sphere.addColorStop(.18,b.color);sphere.addColorStop(.55,b.color+'b8');sphere.addColorStop(1,'#080b25d9');ctx.fillStyle=sphere;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
   ctx.shadowColor=b.color;ctx.shadowBlur=12;ctx.strokeStyle=b.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
   ctx.strokeStyle='#ffffff9c';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x-r*.1,y-r*.1,r*.7,Math.PI*1.12,Math.PI*1.55);ctx.stroke();
   if(b.launched){ctx.fillStyle=b.color;for(let j=0;j<4;j++){ctx.globalAlpha=.6-j*.12;ctx.beginPath();ctx.arc(x-b.vx*j*35,y+r*(1.5+j*.6),Math.max(.7,2.8-j*.55),0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
  });
  if(now-this.touchTime<180){ctx.strokeStyle='#eaffff';ctx.lineWidth=2;for(const p of this.touches){ctx.beginPath();ctx.arc(p.x*w,p.y*h,7,0,Math.PI*2);ctx.stroke();}}
  ctx.restore();
 }
}
