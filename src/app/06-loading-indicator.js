// Kamus app module 06-loading-indicator. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
bridge({
  LI: [() => LI],
  LI_SHAPES: [() => LI_SHAPES],
  liPath: [() => liPath],
  liLoop: [() => liLoop],
  syncSpeakBtn: [() => syncSpeakBtn]
});

// ---- Material 3 loading indicator: one rounded shape that morphs through several "cookie" shapes while it rotates.
// It lives inside any .icon-btn that has the class `loading`, and a playing button shows a stop icon instead of the speaker.
const LI={els:new Set(),raf:0};
const LI_SHAPES=[[10,.17],[9,.10],[5,.12],[2,.28],[8,.16],[4,.15],[2,.20]];   // [lobes, amplitude]
function liPath(t,still){
  t=Math.max(0,t);   // the first animation frame can be timestamped a hair before the start time
  const hold=.35,morph=.45,per=hold+morph,k=LI_SHAPES.length,i=Math.floor(t/per)%k,u=t%per;
  let w=u<hold?0:(u-hold)/morph;w=w*w*(3-2*w);
  const [na,aa]=LI_SHAPES[i],[nb,ab]=LI_SHAPES[(i+1)%k],rot=still?0:t*1.1,scale=.94/(1+(1-w)*aa+w*ab),pts=[];
  for(let j=0;j<96;j++){const th=j/96*Math.PI*2,r=scale*(1+(1-w)*aa*Math.cos(na*(th-rot))+w*ab*Math.cos(nb*(th-rot)));pts.push((r*Math.cos(th)).toFixed(3)+' '+(r*Math.sin(th)).toFixed(3));}
  return 'M'+pts.join('L')+'Z';
}
function liLoop(){
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches,t0=performance.now();
  const frame=now=>{if(!LI.els.size){LI.raf=0;return;}const d=liPath((now-t0)/1000,reduce);LI.els.forEach(el=>el.firstElementChild.setAttribute('d',d));LI.raf=requestAnimationFrame(frame);};
  LI.raf=requestAnimationFrame(frame);
}
function syncSpeakBtn(b){
  const loading=b.classList.contains('loading'),playing=b.classList.contains('speaking')&&!loading;
  let li=b.querySelector(':scope > .li');
  if(loading&&!li){b.insertAdjacentHTML('beforeend','<svg class="li" viewBox="-1 -1 2 2" aria-hidden="true"><path fill="currentColor" d="'+liPath(0,true)+'"/></svg>');li=b.querySelector(':scope > .li');LI.els.add(li);if(!LI.raf)liLoop();}
  if(!loading&&li){LI.els.delete(li);li.remove();}
  if(b.dataset.say!==undefined){const use=b.querySelector(':scope > svg:not(.li) use');if(use){use.setAttribute('href',playing||loading?'#i-stop':'#i-vol');}
    const label=playing||loading?'Stop':'Listen: '+b.dataset.say;b.setAttribute('aria-label',label);b.title=playing||loading?'Stop':'Listen';}
}
new MutationObserver(ms=>{for(const m of ms)if(m.target.matches&&m.target.matches('.icon-btn'))syncSpeakBtn(m.target);}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});


export { LI, LI_SHAPES, liPath, liLoop, syncSpeakBtn };
