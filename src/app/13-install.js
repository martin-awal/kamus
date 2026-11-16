// Kamus app module 13-install. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
bridge({
  installEvt: [() => installEvt, v => { installEvt = v; }],
  renderInstall: [() => renderInstall]
});

// ---- Install as an app / HTTPS help
let installEvt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;if(document.body.dataset.view==='settings')renderInstall();});
addEventListener('appinstalled',()=>{installEvt=null;renderInstall();});
function renderInstall(){
  const box=document.getElementById('installBox'),host=location.hostname,standalone=matchMedia('(display-mode: standalone)').matches,secure=isSecureContext;
  const install=standalone?'<p class="muted">Installed: running as an app.</p>'
    :secure?(installEvt?'<p style="margin-top:8px"><button type="button" class="btn-filled" id="installBtn">Install Kamus</button></p>'
      :'<p class="muted">Use your browser’s menu: “Install app” or “Add to Home Screen”.</p>')
    :'<p class="muted">Not available over plain http (see Connection).</p>';
  const url=host.endsWith('.ts.net')?esc(host)+':8443':'&lt;computer&gt;.&lt;tailnet&gt;.ts.net:8443';
  const conn=secure?'<p class="muted">Secure (https).</p>'
    :`<p class="muted">Plain http on <code>${esc(location.host)}</code>: browsers show “Not secure”, refuse to install the app, and in-browser speech uses one thread.</p>
      <details class="setup"><summary>Enable https with Tailscale</summary><ol>
        <li><span class="def">Tailscale admin console → <b>DNS</b> → <b>HTTPS Certificates</b> → <b>Enable HTTPS</b>.</span></li>
        <li><span class="def">On the computer running Kamus:<pre class="cfg">tailscale serve --bg --https=8443 http://127.0.0.1:8765</pre></span></li>
        <li><span class="def">Open <code>https://${url}</code> on your devices.</span></li></ol></details>`;
  box.innerHTML=`<div class="app-sec"><h4>Install</h4>${install}</div><div class="app-sec"><h4>Connection</h4>${conn}</div>`;
  const b=document.getElementById('installBtn');if(b)b.onclick=async()=>{installEvt.prompt();await installEvt.userChoice;installEvt=null;renderInstall();};
}


export { installEvt, renderInstall };
