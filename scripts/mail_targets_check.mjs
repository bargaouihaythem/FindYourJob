import { signinCached } from './session_cache.mjs';
const API = 'http://localhost:8080/api', PW = 'password123';
const rh = await signinCached(API, 'rh', PW);
const h = { Authorization: 'Bearer ' + rh };

// 1) adresses reelles des comptes manager / RH de demonstration
for (const u of ['manager.devops', 'manager.cs', 'manager.rh', 'rh', 'admin', 'candidat']) {
  try {
    const r = await fetch(API + '/users?username=' + u, h);
    const j = await r.json().catch(() => null);
    const list = j && (j.data || j.content || j);
    if (Array.isArray(list) && list.length) {
      const me = list.find((x) => x.username === u) || list[0];
      console.log(u, '| email', me.email, '| nom', me.firstName, me.lastName);
    } else console.log(u, '| HTTP', r.status, JSON.stringify(j).slice(0, 120));
  } catch (e) { console.log(u, 'ERR', e.message); }
}

// 2) etat de l'outbox pour le dossier 156
const s = await (await fetch(API + '/candidates/156/routing-status', h)).json();
console.log('\noutbox 156:', JSON.stringify(s.recipients));
