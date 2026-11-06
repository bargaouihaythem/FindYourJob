// Verifie la garde de /api/matching : « job ideal » public preserve, harnais Gold Set protege.
// Usage : node scripts/verif_garde_matching.mjs
import { readFileSync } from 'node:fs';
import { signinCached } from './session_cache.mjs';

const API = 'http://localhost:8080/api';
const CV = 'C:/Users/hbargaoui/OneDrive - Sopra Steria/Desktop/projetpfeee/FindYourJob/gold_set/cvs/CV_01_Dev_Java_Senior_Pertinent.pdf';

const etat = async (label, url, { token, form }) => {
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const r = await fetch(url, { method: 'POST', headers, body: form });
  const texte = await r.text();
  console.log(`${label} -> HTTP ${r.status} ${texte.slice(0, 90).replace(/\s+/g, ' ')}`);
  return r.status;
};

const formulaire = (chemin, offreId) => {
  const f = new FormData();
  f.append('cv', new Blob([readFileSync(chemin)], { type: 'application/pdf' }), 'CV_01_Dev_Java_Senior_Pertinent.pdf');
  if (offreId) f.append('jobOfferId', String(offreId));
  return f;
};

let echecs = 0;
const attendu = (obtenu, voulu, quoi) => {
  const ok = obtenu === voulu;
  if (!ok) echecs++;
  console.log(`  ${ok ? 'CONFORME' : 'NON CONFORME'} : ${quoi} (attendu ${voulu}, obtenu ${obtenu})`);
};

const rh = await signinCached(API, 'rh', 'password123');

attendu(await etat('or    Gold Set sans jeton', API + '/matching/evaluate-gold-set', { form: formulaire(CV, 115) }),
  401, 'le harnais refuse la demande anonyme');
attendu(await etat('vert  Gold Set avec jeton RH', API + '/matching/evaluate-gold-set', { token: rh, form: formulaire(CV, 115) }),
  200, 'le harnais fonctionne pour un compte');
attendu(await etat('or    job ideal sans jeton', API + '/matching/upload-cv', { form: formulaire(CV) }),
  200, 'la page publique « job idéal » reste ouverte');

console.log(echecs ? `\n${echecs} garde(s) non conforme(s)` : '\nles trois gardes sont conformes');
process.exit(echecs ? 1 : 0);
