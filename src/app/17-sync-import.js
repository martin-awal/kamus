// Kamus app module 17-sync-import. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global mineLoad, renderMine, route */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
import { KEY, hist, renderHist, toast } from './02-speech-history-toc.js';
import { loadCards } from './04-cards-anki.js';
import { FB_RULES, loadScriptOnce, renderSync } from './16-sync-tile.js';
bridge({
  impDlg: [() => impDlg],
  impCfg: [() => impCfg, v => { impCfg = v; }],
  confirmSyncImport: [() => confirmSyncImport],
  handleSyncHash: [() => handleSyncHash],
  scanDlg: [() => scanDlg],
  scanVid: [() => scanVid],
  scanStream: [() => scanStream, v => { scanStream = v; }],
  scanOn: [() => scanOn, v => { scanOn = v; }],
  stopSyncScan: [() => stopSyncScan],
  startSyncScan: [() => startSyncScan]
});

// ---- receive a shared config: from a scanned QR code or by opening a share link (#sync=…)
const impDlg=document.getElementById('syncImpDlg');let impCfg=null;
function confirmSyncImport(cfg){
  impCfg=cfg;const cur=KamusSync.getConfig();
  document.getElementById('syncImpBody').innerHTML=`<p>Project <b>${esc(cfg.projectId)}</b> (${esc(cfg.authDomain)}).</p>`
    +(cur&&cur.projectId!==cfg.projectId?`<p class="sync-err">This replaces the project already set up here (<code>${esc(cur.projectId)}</code>).</p>`:'')
    +`<p class="muted">Only continue if this QR code or link came from you. You will still sign in with Google afterwards.</p>`;
  if(!impDlg.open)impDlg.showModal();
}
document.getElementById('syncImpNo').onclick=()=>{impDlg.close();impCfg=null;};
document.getElementById('syncImpYes').onclick=()=>{if(!impCfg)return;KamusSync.setConfig(impCfg);impCfg=null;impDlg.close();location.hash='#settings';location.reload();};
function handleSyncHash(){
  if(!window.KamusSync||!location.hash.startsWith('#sync='))return;
  const raw=location.hash;history.replaceState(null,'',location.pathname+'#settings');route();   // the config does not stay in the address bar
  try{confirmSyncImport(KamusSync.fromShared(raw));}catch(err){toast(err.message);}
}
const scanDlg=document.getElementById('syncScanDlg'),scanVid=document.getElementById('syncScanVid');let scanStream=null,scanOn=false;
function stopSyncScan(){scanOn=false;if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null;}scanVid.srcObject=null;}
async function startSyncScan(){
  const msg=document.getElementById('syncScanMsg');if(!scanDlg.open)scanDlg.showModal();
  if(!window.isSecureContext||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){msg.textContent='The camera needs a secure address (https or localhost). Use your phone’s own camera app instead: scan the code and open the link it shows.';return;}
  try{
    await loadScriptOnce('/vendor/qr/jsQR.js');
    scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});scanVid.srcObject=scanStream;await scanVid.play();scanOn=true;
    const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
    const tick=()=>{
      if(!scanOn)return;
      if(scanVid.videoWidth){const k=Math.min(1,640/scanVid.videoWidth);cv.width=Math.round(scanVid.videoWidth*k);cv.height=Math.round(scanVid.videoHeight*k);cx.drawImage(scanVid,0,0,cv.width,cv.height);
        const r=jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height,{inversionAttempts:'dontInvert'});
        if(r&&r.data){try{const cfg=KamusSync.fromShared(r.data);stopSyncScan();scanDlg.close();confirmSyncImport(cfg);return;}catch(err){msg.textContent=err.message;}}}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }catch(err){msg.textContent=err.name==='NotAllowedError'?'Camera permission was refused. Allow it for this page and try again.':'Could not use the camera: '+err.message;}
}
document.getElementById('syncScanClose').onclick=()=>{stopSyncScan();scanDlg.close();};
scanDlg.addEventListener('close',stopSyncScan);
if(window.KamusSync){   // sync.js is optional: if it fails to load, the rest of the app must still work
document.getElementById('syncBox').addEventListener('click',async e=>{
  const b=e.target.closest('[data-sync]');if(!b)return;const k=b.dataset.sync;
  if(k==='save'){try{KamusSync.saveConfig(document.getElementById('syncCfg').value);location.reload();}catch(err){KamusSync.state.error=err.message;renderSync();}}
  else if(k==='copylink'){try{await navigator.clipboard.writeText(KamusSync.shareUrl());toast('Link copied.');}catch{toast('Could not copy: select the QR code link manually.');}}
  else if(k==='scan')startSyncScan();
  else if(k==='copyrules'){try{await navigator.clipboard.writeText(FB_RULES);toast('Rules copied.');}catch{toast('Select the text and copy it manually.');}}
  else if(k==='in')KamusSync.signIn();else if(k==='out')KamusSync.signOut();else if(k==='now')KamusSync.syncNow();
  else if(k==='remove'&&confirm('Remove the Firebase config from this browser? Your local cards stay; the cloud copy stays in your Firebase project.')){KamusSync.removeConfig();location.reload();}
});
document.getElementById('syncBox').addEventListener('change',e=>{if(e.target.id==='syncAuto')KamusSync.setAuto(e.target.checked);});
KamusSync.onState(()=>{if(document.body.dataset.view==='settings')renderSync();});
KamusSync.init({
  getHistory:()=>({items:hist(),clearedAt:+(localStorage.getItem('kamus-history-cleared')||0)}),
  setHistory:h=>{try{localStorage.setItem(KEY,JSON.stringify(h.items));localStorage.setItem('kamus-history-cleared',String(h.clearedAt||0));}catch{}renderHist();},
  onRemoteChange:()=>{loadCards();mineLoad().then(renderMine);}
});
}


export { impDlg, impCfg, confirmSyncImport, handleSyncHash, scanDlg, scanVid, scanStream, scanOn, stopSyncScan, startSyncScan };
