import { signinCached } from './session_cache.mjs';
const API='http://localhost:8080/api', PW='password123';
for (const acc of ['rh','manager.devops','manager.cs']) {
  const t=await signinCached(API,acc,PW);
  const url = acc==='rh' ? '/candidates?size=500' : '/candidates/validated';
  const r=await fetch(API+url,{headers:{Authorization:'Bearer '+t}});
  if(!r.ok){console.log(acc,'HTTP',r.status);continue;}
  const j=await r.json(); const l=j.data||j.content||j;
  const tests=(Array.isArray(l)?l:[]).filter(c=>/test/i.test((c.firstName||'')+(c.lastName||'')));
  console.log(`${acc}: ${Array.isArray(l)?l.length:'?'} dossiers visibles, ${tests.length} de test -> `+
    tests.map(c=>`#${c.id} ${c.firstName} ${c.lastName} [${c.status}]`).join(' | '));
}
