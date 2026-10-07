// A short entry dwell and a longer exit dwell prevent flicker near the pose threshold.
export class PalmCarDetector {
 active=false;
 private candidate=false;
 private since=0;
 private suppressed=false;
 sample(pose:boolean,now:number):boolean {
  if(!pose)this.suppressed=false;
  const next=pose&&!this.suppressed;
  if(next!==this.candidate){this.candidate=next;this.since=now;}
  if(next!==this.active&&now-this.since>=(next?120:400))this.active=next;
  return this.active;
 }
 suppressUntilRelease(){this.suppressed=true;this.active=false;this.candidate=false;}
}
