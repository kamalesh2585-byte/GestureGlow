import {type Point} from './engine';
export type AirTool='draw'|'erase'|'pause';
export function airTool(p:Point[],previous:AirTool='pause'):AirTool {
 if(p.length!==21)return 'pause';
 const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
 const extended=[8,12,16,20].map(i=>{
  const a=p[i-3],b=p[i-2],c=p[i];
  const ax=a.x-b.x,ay=a.y-b.y,az=(a.z??0)-(b.z??0),bx=c.x-b.x,by=c.y-b.y,bz=(c.z??0)-(b.z??0);
  const cosine=(ax*bx+ay*by+az*bz)/Math.max(Math.hypot(ax,ay,az)*Math.hypot(bx,by,bz),1e-9);
  return cosine<(previous==='draw'&&i===8?-.25:-.4)&&dist(c,p[0])>dist(b,p[0])*(previous==='draw'&&i===8?1.01:1.04);
 });
 if(extended.every(Boolean))return 'erase';
 if(extended[0]&&!extended[1]&&!extended[2]&&!extended[3])return 'draw';
 return 'pause';
}
export class AirBoard {
 readonly canvas=document.createElement('canvas');
 tool:AirTool='pause';cursor:Point|null=null;
 private previous:Point|null=null;private lastTime=0;private handId='';private lastTool:AirTool='pause';
 private raw:Point|null=null;private velocity=0;private eraseSince:number|null=null;
 constructor(){this.canvas.width=1600;this.canvas.height=1000;}
 pause(){this.previous=null;this.cursor=null;this.raw=null;this.velocity=0;this.eraseSince=null;this.lastTool='pause';this.tool='pause';}
 clear(){this.canvas.getContext('2d')!.clearRect(0,0,this.canvas.width,this.canvas.height);this.pause();}
 update(p:Point[]|undefined,world:Point[]|undefined,now:number,color:string,id:string){
  if(!p||!world||p.length!==21||world.length!==21){
   // Keep a stroke across a short missed detection, then lift the pen safely.
   if(now-this.lastTime>120)this.pause();return;
  }
  let tool=airTool(world,this.lastTool);
  if(tool==='erase'){this.eraseSince??=now;if(now-this.eraseSince<140)tool='pause';}else this.eraseSince=null;
  const raw=tool==='erase'?p[9]:p[8];
  if(!Number.isFinite(raw.x)||!Number.isFinite(raw.y)||raw.x<0||raw.x>1||raw.y<0||raw.y>1){this.pause();return;}
  const dt=Math.max(.008,Math.min(.12,(now-this.lastTime)/1000));
  const continuous=now-this.lastTime<=120&&id===this.handId&&tool===this.lastTool;
  const jump=this.raw?Math.hypot(raw.x-this.raw.x,raw.y-this.raw.y):0;
  if(!continuous||jump>Math.max(.08,dt*2.5)){this.previous=null;this.cursor=null;this.raw=null;this.velocity=0;}
  const alpha=(cutoff:number)=>1/(1+1/(2*Math.PI*cutoff*dt));
  const speed=this.raw?Math.hypot(raw.x-this.raw.x,raw.y-this.raw.y)/dt:0;
  this.velocity+=alpha(1.5)*(speed-this.velocity);
  // Suppress stationary tremor, but follow quick handwriting with less lag.
  const blend=alpha(2+this.velocity*12);
  const point=this.cursor?{x:this.cursor.x+(raw.x-this.cursor.x)*blend,y:this.cursor.y+(raw.y-this.cursor.y)*blend}:raw;
  this.raw={...raw};this.cursor=point;this.tool=tool;this.lastTime=now;this.handId=id;this.lastTool=tool;
  if(tool==='pause'){this.previous=null;return;}
  const ctx=this.canvas.getContext('2d')!;ctx.globalCompositeOperation=tool==='erase'?'destination-out':'source-over';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=(tool==='erase'?60:4)*this.canvas.width/1000;ctx.lineCap='round';ctx.lineJoin='round';
  const prev=this.previous;
  if(prev&&Math.hypot(prev.x-point.x,prev.y-point.y)<.2){ctx.beginPath();ctx.moveTo(prev.x*this.canvas.width,prev.y*this.canvas.height);ctx.lineTo(point.x*this.canvas.width,point.y*this.canvas.height);ctx.stroke();}
  else{ctx.beginPath();ctx.arc(point.x*this.canvas.width,point.y*this.canvas.height,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}
  this.previous=point;ctx.globalCompositeOperation='source-over';
 }
 draw(ctx:CanvasRenderingContext2D,w:number,h:number,now:number){
  if(now-this.lastTime>120)this.pause();
  const targetHeight=Math.max(1,Math.round(1600*h/w));
  if(this.canvas.height!==targetHeight){const copy=document.createElement('canvas');copy.width=this.canvas.width;copy.height=this.canvas.height;copy.getContext('2d')!.drawImage(this.canvas,0,0);this.canvas.height=targetHeight;this.canvas.getContext('2d')!.drawImage(copy,0,0,1600,targetHeight);}
  ctx.clearRect(0,0,w,h);ctx.drawImage(this.canvas,0,0,w,h);
  if(this.cursor){ctx.save();ctx.strokeStyle=this.tool==='erase'?'#ffb580':this.tool==='draw'?'#65e7ed':'#ffffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(this.cursor.x*w,this.cursor.y*h,this.tool==='erase'?w*.03:9,0,Math.PI*2);ctx.stroke();ctx.restore();}
 }
}
