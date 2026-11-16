// Kamus app module 05-idb. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
bridge({
  idb: [() => idb]
});

// ---- storage: IndexedDB (Cache Storage and service workers only exist on https/localhost, but Kamus is also opened as http://192.168.x.x)
const idb=(()=>{
  let dbp=null;
  const open=()=>dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('kamus',1);
    r.onupgradeneeded=()=>{for(const s of ['wiki','wav','models'])if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s);};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));
  const tx=async(store,mode,fn)=>{const db=await open();return new Promise((res,rej)=>{const t=db.transaction(store,mode),req=fn(t.objectStore(store));
    t.oncomplete=()=>res(req&&req.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);});};
  return {get:(s,k)=>tx(s,'readonly',o=>o.get(k)),put:(s,k,v)=>tx(s,'readwrite',o=>o.put(v,k)),del:(s,k)=>tx(s,'readwrite',o=>o.delete(k)),has:async(s,k)=>(await tx(s,'readonly',o=>o.count(k)))>0,clear:s=>tx(s,'readwrite',o=>o.clear()),
    stats:async(s,pred=()=>true)=>{const db=await open(),sz=v=>v==null?0:v instanceof Blob?v.size:v.byteLength!=null?v.byteLength:typeof v==='string'?v.length:JSON.stringify(v).length;
      return new Promise((res,rej)=>{const r=db.transaction(s,'readonly').objectStore(s).openCursor();let n=0,bytes=0;r.onsuccess=()=>{const c=r.result;if(!c){res({n,bytes});return;}if(pred(c.key)){n++;bytes+=sz(c.value);}c.continue();};r.onerror=()=>rej(r.error);});}};
})();


export { idb };
