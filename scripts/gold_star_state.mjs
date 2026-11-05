import { signinCached } from './session_cache.mjs';
const API='http://localhost:8080/api', PW='password123';
const t=await signinCached(API,'manager.devops',PW);
const r=await fetch(`${API}/candidates/validated`,{headers:{Authorization:'Bearer '+t}});
console.log('HTTP',r.status);
if(r.ok){
  const j=await r.json();
  const list=(j.data||j.content||j);
  console.log('dossiers visibles manager.devops =',Array.isArray(list)?list.length:'?');
  (Array.isArray(list)?list:[]).filter(c=>c.goldStatus||c.goldProposed).forEach(c=>
    console.log(`  #${c.id} ${c.firstName} ${c.lastName} score=${c.effectiveScore} gold=${c.goldStatus} propose=${c.goldProposed} statut=${c.status}`));
}
