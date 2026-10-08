// A short, high-frequency transient is a better fallback for a clap than
// requiring two unobscured palms in the exact video frame of contact.
export class MicrophoneClaps {
 private stream:MediaStream|null=null;private context:AudioContext|null=null;private frame=0;private ticket=0;
 async start(onClap:()=>void){
  this.stop();const ticket=this.ticket;
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  if(ticket!==this.ticket){stream.getTracks().forEach(t=>t.stop());return false;}
  this.stream=stream;const context=new AudioContext();this.context=context;await context.resume();
  if(ticket!==this.ticket)return false;
  const source=context.createMediaStreamSource(stream),filter=context.createBiquadFilter(),analyser=context.createAnalyser();filter.type='highpass';filter.frequency.value=1200;analyser.fftSize=1024;source.connect(filter);filter.connect(analyser);
  const data=new Float32Array(analyser.fftSize);let baseline=.004,previous=0,last=-Infinity;const started=performance.now();
  const sample=()=>{if(ticket!==this.ticket)return;analyser.getFloatTimeDomainData(data);const rms=Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length),now=performance.now();
   if(now-started>400&&rms>.02&&rms>baseline*4&&rms>previous*1.6&&now-last>1000){last=now;onClap();}
   baseline+=(Math.min(rms,.03)-baseline)*.025;previous=rms;this.frame=requestAnimationFrame(sample);
  };sample();return true;
 }
 stop(){this.ticket++;cancelAnimationFrame(this.frame);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.context)void this.context.close();this.context=null;}
}
