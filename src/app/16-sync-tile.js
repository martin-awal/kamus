// Kamus app module 16-sync-tile. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
bridge({
  FB_RULES: [() => FB_RULES],
  drawQr: [() => drawQr],
  loadScriptOnce: [() => loadScriptOnce],
  renderSync: [() => renderSync]
});

// ---- Sync tile (Settings) + hooks for sync.js
const FB_RULES=`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /users/{uid}/{document=**} {\n      allow read, write: if request.auth != null && request.auth.uid == uid;\n    }\n  }\n}`;
function drawQr(){
  const box=document.getElementById('syncQr');if(!box||!window.qrcode)return;
  try{const q=qrcode(0,'M');q.addData(KamusSync.shareUrl());q.make();box.innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true});}catch(err){box.textContent='Could not draw the QR code: '+err.message;}
  const local=['localhost','127.0.0.1','::1'].includes(location.hostname);
  document.getElementById('syncQrNote').textContent=local?'You opened Kamus as '+location.hostname+', which a phone cannot reach: scan this code with the in-app scanner, or open Kamus on this computer through its network/Tailscale address and show the code from there.':'The link points to '+location.origin+'.';
}
const loadScriptOnce=(()=>{const m={};return src=>m[src]||(m[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('could not load '+src));document.head.appendChild(s);}));})();
function renderSync(){
  const box=document.getElementById('syncBox');if(!box)return;if(!window.KamusSync){box.innerHTML='<p class="muted">Sync is not available (sync.js did not load; restart the Kamus server).</p>';return;}const S=KamusSync.state,cfg=KamusSync.getConfig();
  if(!cfg){
    box.innerHTML=`<details class="setup" open><summary>How to set it up (about 5 minutes, free)</summary><ol class="sync-steps">
      <li>Open <b>console.firebase.google.com</b> and create a project (Google Analytics can stay off). It uses the free <b>Spark</b> plan.</li>
      <li><b>Google sign-in:</b> left menu <b>Security → Authentication → Get started</b>. On <b>Sign-in method</b> choose <b>Google</b>, switch <b>Enable</b> on, pick a support email, save.
        Then <b>Settings → Authorised domains → Add domain</b> and add this page’s address: <code>${esc(location.hostname)}</code> (a plain IP address is not accepted; <code>localhost</code> is already allowed).</li>
      <li><b>Database:</b> left menu <b>Databases and storage → Firestore → Create database</b> (Standard edition, any nearby region, <b>production mode</b>). Open the <b>Rules</b> tab, replace everything with the text below and press <b>Publish</b>:<pre>${esc(FB_RULES)}</pre><button type="button" class="text-btn" data-sync="copyrules">Copy rules</button></li>
      <li><b>Config:</b> on <b>Project Overview</b> press <b>+ Add app</b> → <b>Web</b> (<code>&lt;/&gt;</code>), give it a nickname (leave Hosting off), <b>Register app</b>, and copy the <code>const firebaseConfig = {…};</code> block (later: gear → Project settings → General → Your apps).</li>
      <li><b>Here:</b> paste it below and press <b>Save config</b>. Then <b>Sign in with Google</b>: a sign-in page opens, press its button, choose your account, and you return here.</li>
      <li><b>More devices:</b> after signing in, open <b>Set up another device (QR code)</b> here. On the other device scan it with its camera app (open the link) or use <b>Scan a QR code</b> in this same section, confirm, and sign in with the same Google account. Add each device’s address to <b>Authorised domains</b>.</li></ol>
      <p class="muted">The config values are not secrets; the rules above are what protect your data. Cards and history are merged automatically; Anki note ids and progress stay on each device.</p></details>
      <textarea class="sync-cfg" id="syncCfg" placeholder="const firebaseConfig = { apiKey: &quot;…&quot;, authDomain: &quot;…&quot;, projectId: &quot;…&quot;, … };" aria-label="Firebase web config" spellcheck="false"></textarea>
      <p style="margin-top:8px"><button type="button" class="btn-tonal" data-sync="save">Save config</button> <button type="button" class="text-btn" data-sync="scan">Scan a QR code from another device</button></p>${S.error?`<div class="sync-err">${esc(S.error)}</div>`:''}`;
    return;
  }
  const st=S.status,u=S.user,busy=st==='syncing',ago=S.last?new Date(S.last).toLocaleString():'not yet';
  box.innerHTML=`<div class="sync-st"><span class="dot ${u?'ok':(st==='error'?'bad':'')}"></span><span>${u?`Signed in as <b>${esc(u.email||u.name||'your Google account')}</b>`:st==='error'?'Not connected':'Not signed in'} · project <code>${esc(cfg.projectId)}</code></span></div>
    ${S.error?`<div class="sync-err">${esc(S.error)}</div>`:''}
    ${u?`<label class="switchrow"><input type="checkbox" id="syncAuto" ${KamusSync.isAuto()?'checked':''}> Sync automatically</label>
      <p class="muted">${busy?'Syncing…':`Last sync: ${esc(ago)}${S.last?` (${S.pulled} received, ${S.pushed} sent)`:''}`}. Anki note ids and progress stay on each device.</p>
      <p><button type="button" class="btn-tonal" data-sync="now" ${busy?'disabled':''}>Sync now</button> <button type="button" class="text-btn" data-sync="out">Sign out</button></p>`
     :`<p><button type="button" class="btn-filled" data-sync="in" ${st==='signedout'||st==='error'?'':'disabled'}>Sign in with Google</button></p>`}
    <details class="setup" id="syncShare"><summary>Set up another device (QR code)</summary>
      <p class="muted">On the other device open Kamus, then Settings → Sync → <b>Scan a QR code</b>, or just point its camera app at this code and open the link. It only carries the project settings, not your account or your cards; the other device still signs in with Google.</p>
      <div class="qr-box" id="syncQr" role="img" aria-label="QR code with the sync settings"></div>
      <p class="muted" id="syncQrNote"></p><p><button type="button" class="text-btn" data-sync="copylink">Copy link</button></p></details>
    <p><button type="button" class="text-btn" data-sync="remove">Remove this Firebase config</button></p>`;
  drawQr();
}

export { FB_RULES, drawQr, loadScriptOnce, renderSync };
