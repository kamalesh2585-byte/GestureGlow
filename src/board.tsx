import type {Point} from './engine';
import {handClosure} from './engine';
import './board.css';

export function isThumbsUp(p:Point[],world:Point[]=p){
 if(p.length!==21||world.length!==21)return false;
 const size=Math.hypot(p[0].x-p[9].x,p[0].y-p[9].y);
 return size>.01&&handClosure(world)>.65&&p[4].y<p[3].y-size*.18&&p[4].y<Math.min(...[8,12,16,20].map(i=>p[i].y))-size*.25&&Math.hypot(p[4].x-p[2].x,p[4].y-p[2].y)>size*.55;
}
