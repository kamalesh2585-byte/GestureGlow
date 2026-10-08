import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.PLAYGROUND_URL||'http://localhost:5174');
 await page.getByRole('button',{name:'Mouse demo',exact:true}).click();await page.getByRole('button',{name:'Open air board',exact:true}).click();assert.ok(await page.locator('.stage .air-notice').isVisible());assert.equal(await page.locator('.manual-board').count(),0);
 const result=await page.evaluate(async()=>{
  const {AirBoard,airTool}=await import('/src/air-board.ts');
  const pose=(extended)=>{const p=Array.from({length:21},()=>({x:.5,y:.65,z:0}));p[0]={x:.5,y:.85,z:0};for(let f=0;f<4;f++){const i=8+f*4,x=.35+f*.1;p[i-3]={x,y:.65,z:0};p[i-2]={x,y:.5,z:0};p[i-1]={x,y:extended[f]?.4:.6,z:0};p[i]={x,y:extended[f]?.3:.7,z:0};}return p;};
  const pen=pose([true,false,false,false]),palm=pose([true,true,true,true]),two=pose([true,true,false,false]),fist=pose([false,false,false,false]);
  if(airTool(pen)!=='draw'||airTool(palm)!=='erase'||airTool(two)!=='pause'||airTool(fist)!=='pause')throw Error('Gesture classification failed');
  const board=new AirBoard(),p=pen.map(v=>({...v}));p[8]={x:.5,y:.5};board.update(p,pen,100,'#65e7ed','left');p[8]={x:.55,y:.5};board.update(p,pen,140,'#65e7ed','left');
  const pixels=()=>{const data=board.canvas.getContext('2d').getImageData(0,0,1600,1000).data;return data.reduce((n,v,i)=>n+(i%4===3&&v>0?1:0),0);};
  const drawn=pixels();if(!drawn)throw Error('No stroke');board.update(p,two,180,'#65e7ed','left');if(pixels()!==drawn)throw Error('Pause drew');
  const erase=palm.map(v=>({...v}));erase[9]={x:.5,y:.5};board.update(erase,palm,220,'#65e7ed','left');if(pixels()!==drawn)throw Error('An accidental palm frame erased ink');board.update(erase,palm,380,'#65e7ed','left');if(pixels()>=drawn)throw Error('Erase failed');
  board.update(undefined,undefined,550,'#65e7ed','left');if(board.cursor||board.tool!=='pause')throw Error('Tracking loss did not pause');board.clear();if(pixels()!==0)throw Error('Clear failed');
  const stable=new AirBoard();const pos=pen.map(v=>({...v}));pos[8]={x:.5,y:.5};stable.update(pos,pen,1000,'#65e7ed','left');let rawTravel=0,filteredTravel=0,lastRaw=.5,lastFiltered=.5;
  for(let i=1;i<=40;i++){const x=.5+(i%2?.003:-.003);pos[8]={x,y:.5};stable.update(pos,pen,1000+i*33,'#65e7ed','left');rawTravel+=Math.abs(x-lastRaw);filteredTravel+=Math.abs(stable.cursor.x-lastFiltered);lastRaw=x;lastFiltered=stable.cursor.x;}
  if(filteredTravel>rawTravel*.5)throw Error('Stationary fingertip tremor was not reduced');
  const t=2320;stable.update(undefined,undefined,t+33,'#65e7ed','left');if(stable.tool!=='draw')throw Error('A single missed frame broke the stroke');pos[8]={x:.51,y:.5};stable.update(pos,pen,t+66,'#65e7ed','left');if(stable.tool!=='draw')throw Error('Stroke did not resume');
  const jumpBoard=new AirBoard();pos[8]={x:.2,y:.5};jumpBoard.update(pos,pen,3000,'#65e7ed','left');pos[8]={x:.8,y:.5};jumpBoard.update(pos,pen,3033,'#65e7ed','left');const bridge=jumpBoard.canvas.getContext('2d').getImageData(800,500,1,1).data[3];if(bridge)throw Error('Tracking jump drew a line across board');
  const fast=new AirBoard();for(let i=0;i<=15;i++){pos[8]={x:.2+i*.02,y:.5};fast.update(pos,pen,4000+i*33,'#65e7ed','left');}if(.5-fast.cursor.x>.035)throw Error('Fast handwriting lags too far behind finger');
  const output=document.createElement('canvas');output.width=800;output.height=800;fast.draw(output.getContext('2d'),800,800,4495);if(fast.canvas.height!==1600)throw Error('Board did not match camera aspect ratio');
  return 'PASS: finger gestures, jitter reduction, fast handwriting lag, safe jumps, brief tracking gaps, palm dwell, clear and aspect ratio';
 });console.log(result);
 await page.getByRole('button',{name:'Clear air board',exact:true}).click();await page.getByRole('button',{name:'Back to effects',exact:true}).click();assert.equal(await page.locator('.air-notice').count(),0);await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open air board',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log('PASS: board inside camera stage, mode switching, mobile width and no browser errors');
} finally {await browser.close();}
