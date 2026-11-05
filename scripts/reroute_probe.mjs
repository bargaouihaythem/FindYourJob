import { signinCached } from './session_cache.mjs';
const API = 'http://localhost:8080/api', PW = 'password123';
const id = Number(process.argv[2] || 156);
const rh = await signinCached(API, 'rh', PW);

const avant = await (await fetch(API + '/candidates/' + id, { headers: { Authorization: 'Bearer ' + rh } })).json();
console.log('avant : #' + id, avant.firstName, avant.lastName, '| statut', avant.status, '| email', avant.email, '| offre', avant.jobOfferTitle || avant.offerTitle);

const r = await fetch(API + '/candidates/' + id + '/reroute-notification', {
  method: 'POST', headers: { Authorization: 'Bearer ' + rh, 'Content-Type': 'application/json' },
});
const body = await r.text();
console.log('reroute-notification -> HTTP', r.status, '|', body.slice(0, 500));

const s = await fetch(API + '/candidates/' + id + '/routing-status', { headers: { Authorization: 'Bearer ' + rh } });
console.log('routing-status -> HTTP', s.status, '|', (await s.text()).slice(0, 900));

const apres = await (await fetch(API + '/candidates/' + id, { headers: { Authorization: 'Bearer ' + rh } })).json();
console.log('apres : statut', apres.status, '| email', apres.email);
