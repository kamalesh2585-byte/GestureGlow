import type {Point} from './engine';

type Sample=Point & {time:number};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);

// One deliberate out-and-back movement, rather than a single swipe or tracking jitter.
export class ShakeDetector {
 private samples:Sample[]=[];
 private cooldownUntil=0;
 sample(point:Point,palmSize:number,now:number):boolean {
  if(now<this.cooldownUntil)return false;
  const last=this.samples.at(-1);
  if(last&&now-last.time<25)return false;
  const size=Math.max(palmSize,.06);
  if(last&&(now-last.time>200||distance(last,point)>size*2.5))this.samples=[];
  this.samples=this.samples.filter(p=>now-p.time<=800);
  const end={...point,time:now};
  for(let i=0;i<this.samples.length-1;i++){
   const start=this.samples[i];
   for(let j=i+1;j<this.samples.length;j++){
    const turn=this.samples[j];
    const out=distance(start,turn),back=distance(turn,end);
    const firstTime=turn.time-start.time,secondTime=now-turn.time;
    if(firstTime<65||secondTime<65||out<Math.max(.065,size*.65)||back<out*.7)continue;
    const dot=((turn.x-start.x)*(end.x-turn.x)+(turn.y-start.y)*(end.y-turn.y))/(out*back);
    if(dot<-.8&&distance(start,end)<out*.5&&out/(firstTime/1000)>.25&&back/(secondTime/1000)>.25){
     this.samples=[];this.cooldownUntil=now+2500;return true;
    }
   }
  }
  this.samples.push(end);return false;
 }
}
