import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';

// Scripted landmarks pass through the real webcam view, worker message handler,
// mirror/crop transform, pose detector and canvas. No demo tray/gesture overrides.
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
const {demoPoints}=await vite.ssrLoadModule('/src/engine.ts');
const upright=demoPoints(.5,.5);
const horizontal=upright.map(p=>({x:.5+(p.y-.5)*.7,y:.5+(p.x-.5)*.3,z:0}));
// Deliberately unreliable depth: the hand's world palm normal still faces forward.
const world=upright.map(p=>({...p,z:0}));
await vite.close();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
let page;
try{
 page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({upright,horizontal,world})=>{
  window.__pose='upright';window.__handX=0;window.__frames=0;window.__lastResult=null;
  window.Worker=class {
   onmessage=null;onerror=null;dead=false;
   postMessage(data){
    if(this.dead)return;
    if(data.type==='init'){setTimeout(()=>this.onmessage?.({data:{type:'ready'}}),0);return;}
    if(data.type==='frame'){
     data.bitmap.close();
     const points=window.__pose==='tray'?horizontal:upright;
     const present=window.__pose!=='none';
     setTimeout(()=>{if(!this.dead){window.__frames++;const result={type:'result',landmarks:present?[points.map(p=>({...p,x:p.x+window.__handX}))]:[],worldLandmarks:present?[world]:[],handedness:present?[[{categoryName:'Left'}]]:[]};window.__lastResult=result;this.onmessage?.({data:result});}},5);
    }
   }
   terminate(){this.dead=true;}
  };
 },{upright,horizontal,world});
 await page.goto(process.env.PLAYGROUND_URL||'http://localhost:5173');
 await page.getByRole('button',{name:'Start Camera',exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelector('.stage-bottom')?.textContent?.includes('Hand detected'));
 const car=page.getByRole('status').filter({hasText:'Web transformed into a car'});
 await page.waitForTimeout(500);assert.equal(await car.count(),0,'Upright webcam hand must show web');
 await page.evaluate(()=>window.__pose='tray');
 await car.waitFor({timeout:4000});
 await page.waitForTimeout(1800);
 const centroid=()=>page.locator('canvas').evaluate(canvas=>{const ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let sum=0,xSum=0;for(let i=3;i<pixels.length;i+=4){sum+=pixels[i];xSum+=((i-3)/4%canvas.width)*pixels[i];}return xSum/sum;});
 const before=await centroid();await page.evaluate(()=>window.__handX=.16);await page.waitForTimeout(1100);const after=await centroid();
 assert.ok(after<before-40,'Mirrored car must follow webcam hand motion');
 await page.screenshot({path:'browser-camera-tray.png',fullPage:true});
 await page.evaluate(()=>window.__pose='upright');await car.waitFor({state:'hidden',timeout:4000});
 await page.screenshot({path:'browser-camera-web.png',fullPage:true});
 await page.evaluate(()=>window.__pose='tray');
 await car.waitFor({timeout:4000});
 await page.evaluate(()=>window.__pose='none');await car.waitFor({state:'hidden',timeout:4000});
 await page.getByRole('button',{name:'Stop Camera',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS: real camera UI path using raw landmarks: upright web, horizontal car despite noisy depth, mirrored car movement, return to web and hand-loss recovery.');
}catch(error){
 if(page)console.log(await page.evaluate(()=>({pose:window.__pose,frames:window.__frames,status:document.querySelector('.stage-bottom')?.textContent})));throw error;
}finally{await browser.close();}
