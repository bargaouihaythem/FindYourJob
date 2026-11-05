import { signinCached } from './session_cache.mjs';
const API='http://localhost:8080/api', PW='password123';
try{
  const t=await signinCached(API,'rh',PW);
  const h={Authorization:'Bearer '+t};
  for (const id of [115,117,122]) {
    const r=await fetch(`${API}/job-offers/${id}`,{headers:h});
    if(!r.ok){console.log(id,'HTTP',r.status);continue;}
    const j=await r.json();
    console.log(`offre ${id}: titre="${(j.title||'').slice(0,45)}" famille=${j.jobFamily} seniorite=${j.seniorityLevel}`);
  }
  const c=await fetch(`${API}/scoring-settings/gold-set/measurements`,{headers:h});
  console.log('measurements HTTP',c.status);
  if(c.ok) console.log(JSON.stringify(await c.json()).slice(0,1200));
}catch(e){console.log('ERR',e.message);}
