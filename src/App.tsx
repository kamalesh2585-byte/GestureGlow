import {useEffect,useRef,useState} from 'react';
import {Camera,Square,RotateCcw,MousePointer2,Hand,Sparkles,MoveUpRight,ShieldCheck,ArrowUpRight,ScanLine,HelpCircle,X} from 'lucide-react';
import {WebEngine,demoPoints,type Gesture} from './engine';
type Mode='idle'|'loading'|'camera'|'demo';
export default function App(){
 const canvas=useRef<HTMLCanvasElement>(null),video=useRef<HTMLVideoElement>(null),stage=useRef<HTMLDivElement>(null);
 const engine=useRef(new WebEngine()),stream=useRef<MediaStream|null>(null),worker=useRef<Worker|null>(null),generation=useRef(0),busy=useRef(false);
 const [mode,setMode]=useState<Mode>('idle'),[error,setError]=useState(''),[color,setColor]=useState('#65e7ed'),[glow,setGlow]=useState(1.15),[count,setCount]=useState(0),[gesture,setGesture]=useState<Gesture>('open'),[help,setHelp]=useState(false),[demoTwo,setDemoTwo]=useState(false),[demoGesture,setDemoGesture]=useState<Gesture>('open');
 const live=useRef({mode,color,glow,demoTwo,demoGesture});live.current={mode,color,glow,demoTwo,demoGesture};
 const pointer=useRef({x:.50,y:.51,down:false,active:false});
 const [carCreated,setCarCreated]=useState(false);
 const stop=()=>{generation.current++;worker.current?.terminate();worker.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;busy.current=false;engine.current.update([],performance.now());engine.current.clear(performance.now());setCarCreated(false);setCount(0);setMode('idle');};
 async function start(){
  stop();setError('');setMode('loading');const ticket=generation.current;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access needs localhost or HTTPS. You can still try mouse demo.');
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
   if(ticket!==generation.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;
   video.current!.srcObject=media;await video.current!.play();
   if(ticket!==generation.current)return;
   const task=new Worker(`${import.meta.env.BASE_URL}tracker.worker.js`);worker.current=task;
   const timeout=window.setTimeout(()=>{if(ticket===generation.current){stop();setError('Tracking took too long to load. Check your internet connection and try again.');}},45000);
   task.onmessage=e=>{if(ticket!==generation.current)return;
    if(e.data.type==='ready'){clearTimeout(timeout);setMode('camera');}
    if(e.data.type==='result'){busy.current=false;const v=video.current!,box=stage.current!.getBoundingClientRect();const scale=Math.max(box.width/v.videoWidth,box.height/v.videoHeight),dx=(v.videoWidth*scale-box.width)/2,dy=(v.videoHeight*scale-box.height)/2;
     engine.current.update(e.data.landmarks.map((points:{x:number;y:number}[],i:number)=>({id:e.data.handedness[i]?.[0]?.categoryName??String(i),points:points.map(p=>({x:((1-p.x)*v.videoWidth*scale-dx)/box.width,y:(p.y*v.videoHeight*scale-dy)/box.height}))})),performance.now());setCount(e.data.landmarks.length);setGesture(engine.current.hands[0]?.gesture??'open');
    }
    if(e.data.type==='error'){console.error('MediaPipe:',e.data.message);clearTimeout(timeout);stop();setError('Hand tracking could not load. Check your connection, then restart the camera.');}
   };
   task.onerror=e=>{console.error('Tracking worker:',e.message);clearTimeout(timeout);if(ticket===generation.current){stop();setError('Hand tracking stopped unexpectedly. Restart the camera or use demo mode.');}};
   task.postMessage({type:'init'});
   media.getVideoTracks()[0].onended=()=>{if(ticket===generation.current){stop();setError('Camera disconnected. Connect it and try again.');}};
  }catch(e){if(ticket!==generation.current)return;stop();const name=e instanceof DOMException?e.name:'';setError(name==='NotAllowedError'?'Camera permission was denied. Allow camera access in your browser, or try mouse demo.':name==='NotFoundError'?'No camera found. Connect a webcam or try mouse demo.':e instanceof Error?e.message:'Unable to start the camera.');}
 }
 function demo(){stop();setError('');setMode('demo');}
 useEffect(()=>{
  let frame=0,lastDetection=0,lastVideo=-1,lastUi=0,lastCarUi=0;
  const render=(now:number)=>{
   const c=canvas.current,v=video.current,box=stage.current;if(!c||!box)return;
   const rect=box.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);if(c.width!==Math.round(rect.width*dpr)||c.height!==Math.round(rect.height*dpr)){c.width=Math.round(rect.width*dpr);c.height=Math.round(rect.height*dpr);}
   const ctx=c.getContext('2d')!;ctx.setTransform(dpr,0,0,dpr,0,0);
   const state=live.current;
   if(state.mode==='demo'){
    const p=pointer.current;const x=p.active?p.x:.5+Math.sin(now*.00045)*.07,y=p.active?p.y:.53+Math.cos(now*.0006)*.025;
    const g=p.down?'pinch':state.demoGesture;const points=demoPoints(x,y,g==='fist');if(g==='pinch')points[4]={...points[8]};
    const inputs=[{id:'demo',points,gesture:g}];if(state.demoTwo)inputs.push({id:'demo2',points:demoPoints(.77,.56),gesture:'open'});engine.current.update(inputs,now);
    if(now-lastUi>150){setCount(inputs.length);setGesture(g);lastUi=now;}
   }
   if(state.mode==='camera'&&v&&v.readyState>=2&&!busy.current&&now-lastDetection>40&&v.currentTime!==lastVideo){busy.current=true;lastDetection=now;lastVideo=v.currentTime;const ticket=generation.current;createImageBitmap(v).then(bitmap=>{if(ticket!==generation.current||!worker.current){bitmap.close();return;}worker.current.postMessage({type:'frame',bitmap,time:now},[bitmap]);}).catch(()=>{busy.current=false;});}
   engine.current.draw(ctx,rect.width,rect.height,now,state.color,state.glow,state.mode==='idle'||state.mode==='loading');
   if(now-lastCarUi>100){setCarCreated(engine.current.car!==null);lastCarUi=now;}
   frame=requestAnimationFrame(render);
  };frame=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(frame);generation.current++;worker.current?.terminate();stream.current?.getTracks().forEach(t=>t.stop());};
 },[]);
 const status=mode==='loading'?'Preparing hand tracking…':mode==='demo'?'Mouse demo active':mode==='camera'?(count?`${count===2?'Two hands':'Hand'} detected · ${gesture==='pinch'?'Stretching':gesture==='fist'?'Dissolving':'Weaving'}`:'Show your hand'):'Camera is off';
 return <div className="app">
  <header><a className="brand" href="./"><span className="brand-icon">✳</span> HAND WEB <span className="brand-light">PLAYGROUND</span></a><button className="help" onClick={()=>setHelp(!help)}><HelpCircle size={16}/> How to play</button></header>
  <main><div className="intro"><div><div className="eyebrow"><span/> A LITTLE MOVEMENT. A LITTLE MAGIC.</div><h1>Weave something <em>extraordinary.</em></h1><p>Your hands, a canvas of light. Open your palm and watch the web come alive.</p></div><div className="local-badge"><ShieldCheck size={17}/><span>On your device.<br/><strong>Always private.</strong></span></div></div>
   <div className="workspace"><section className="play-area"><div className="stage" ref={stage} onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();pointer.current={...pointer.current,x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,active:true};}} onPointerDown={e=>{if(mode==='demo'){e.currentTarget.setPointerCapture(e.pointerId);pointer.current.down=true;}}} onPointerUp={()=>pointer.current.down=false} onPointerCancel={()=>pointer.current.down=false}>
    <video ref={video} muted playsInline className={mode==='camera'?'visible':''}/><div className="stage-grid"/><canvas ref={canvas} aria-label="Animated hand web effects"/>
    {carCreated&&<div className="car-notice" role="status">✦ Neon car created <span>Shake again to rebuild · Clear effects to remove</span></div>}
    <div className="stage-top"><span className="feed-label"><span className={mode==='camera'?'dot active':'dot'}/>{mode==='demo'?'DEMO CANVAS':'LIVE CANVAS'}</span><span className="stage-tag"><ScanLine size={13}/>{mode==='camera'?'MIRRORED VIEW':'INTERACTIVE EXPERIENCE'}</span></div>
    {mode==='idle'||mode==='loading'?<div className="empty"><div className="hand-halo"><Hand size={44} strokeWidth={1}/></div><h2>{mode==='loading'?'A little magic is loading…':'The web starts with you.'}</h2><p>{mode==='loading'?'Allow camera access, then give the model a moment.':'Start your camera, raise your hand, and make light move.'}</p>{mode==='idle'&&<button className="primary" onClick={start}><Camera size={17}/> Start Camera <ArrowUpRight size={16}/></button>}<button className="demo-link" onClick={demo}>Or explore with your mouse <MoveUpRight size={13}/></button></div>:null}
    <div className="stage-bottom"><span><span className={mode==='camera'||mode==='demo'?'dot active':'dot'}/>{status}</span><span>{count.toString().padStart(2,'0')} / 02 HANDS</span></div>
   </div>
   {error&&<div className="error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
   <div className="toolbar"><div><button className={mode==='camera'||mode==='loading'?'primary stop':'primary'} onClick={mode==='camera'||mode==='loading'?stop:start}>{mode==='camera'||mode==='loading'?<Square size={15}/>:<Camera size={17}/>} {mode==='camera'||mode==='loading'?'Stop Camera':'Start Camera'}</button><button className={mode==='demo'?'secondary selected':'secondary'} onClick={mode==='demo'?stop:demo}><MousePointer2 size={16}/> Mouse demo</button></div><button className="clear" onClick={()=>engine.current.clear(performance.now())}><RotateCcw size={15}/> Clear effects</button></div>
   {mode==='demo'&&<div className="demo-controls"><span>Move to weave · hold to pinch · shake to create a car</span><button className={demoGesture==='fist'?'selected':''} onClick={()=>setDemoGesture(demoGesture==='fist'?'open':'fist')}>{demoGesture==='fist'?'Open palm':'Close fist'}</button><button onClick={()=>engine.current.createCar({x:pointer.current.x,y:pointer.current.y},performance.now())}>Create car</button><label><input type="checkbox" checked={demoTwo} onChange={e=>setDemoTwo(e.target.checked)}/> Two hands</label></div>}
   <div className="privacy"><ShieldCheck size={13}/> Camera frames stay in your browser. Nothing is recorded or uploaded.</div>
   </section>
   <aside><section className="panel"><div className="panel-title"><Sparkles size={16}/><h2>Make it yours</h2></div><label className="control-label">Web colour <span>{color==='#65e7ed'?'Glacier':color==='#a78bfa'?'Ultraviolet':color==='#f0abfc'?'Orchid':color==='#fbbf70'?'Amber':'Custom'}</span></label><div className="swatches">{['#65e7ed','#a78bfa','#f0abfc','#fbbf70'].map(c=><button key={c} style={{background:c}} className={c===color?'chosen':''} aria-label={`Choose ${c}`} aria-pressed={c===color} onClick={()=>setColor(c)}/>)}<label className="custom-color" title="Custom colour">+<input aria-label="Custom web colour" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label></div><label className="control-label" htmlFor="glow">Glow intensity <span>{Math.round(glow/2*100)}%</span></label><input id="glow" className="range" type="range" min="0" max="2" step=".05" value={glow} onChange={e=>setGlow(+e.target.value)}/><div className="range-ends"><span>Subtle</span><span>Supernova</span></div><div className="settings-note"><span/> Smooth tracking · up to two hands</div></section>
   <section className="panel guide"><div className="panel-title"><Hand size={17}/><h2>A few simple gestures</h2></div>{[{icon:'✋',title:'Open your palm',text:'Let a glowing web unfold.',g:'open'},{icon:'🤏',title:'Pinch & pull',text:'Grab a strand. Stretch the light.',g:'pinch'},{icon:'✊',title:'Close your fist',text:'Scatter your web into stardust.',g:'fist'},{icon:'👐',title:'Bring both hands',text:'Build a bridge between them.',g:'two'},{icon:'🚗',title:'Shake once',text:'A quick out-and-back creates a car.',g:'shake'}].map((item,i)=><div key={item.title} className={`gesture-row ${count>0&&(item.g===gesture||item.g==='two'&&count===2)?'current':''}`}><div className="gesture-icon">{item.icon}</div><div><h3>{item.title}</h3><p>{item.text}</p></div><span className="gesture-number">0{i+1}</span></div>)}<div className="tip"><Sparkles size={14}/><p>For the best magic, face a light source and keep your whole hand in view.</p></div></section>
   </aside></div>
   {help&&<div className="help-panel"><button aria-label="Close guide" onClick={()=>setHelp(false)}><X size={17}/></button><strong>Ready to weave?</strong><p>Start the camera and allow browser permission. Hold an open palm in view, pinch thumb and index to pull a strand, or close your fist to dissolve it. Shake your hand once with a quick left-right-left or up-down-up movement to create a glowing sports car. Keep your whole hand visible and wait about three seconds before another shake. Clear effects removes the car. In mouse demo, move your pointer and hold to pinch. Shake the pointer or use Create car to preview the new effect.</p></div>}
  </main><footer><span>A playground for your imagination.</span><span>MADE OF LIGHT & A LITTLE CODE <span className="footer-star">✳</span></span></footer>
 </div>;
}
