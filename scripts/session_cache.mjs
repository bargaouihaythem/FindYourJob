/**
 * JOB4YOU — Cache de jetons pour les scripts de verification.
 *
 * Le point d'entree de connexion est limite a 10 tentatives par compte et par 15 minutes
 * (AuthController, borne anti-brute-force). Une serie de trois scripts qui se reconnectent a
 * chaque passage franchit cette borne et la verification echoue pour une raison sans rapport
 * avec la regle testee. Le jeton est valide 24 heures : on le relit au lieu de le redemander.
 *
 * Usage :
 *   import { signinCached } from './session_cache.mjs';
 *   const rh = await signinCached(API, 'rh', PW);
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CACHE = path.join(os.tmpdir(), 'job4you_scripts_tokens.json');

function lire() {
  try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { return {}; }
}

function ecrire(d) {
  try { fs.writeFileSync(CACHE, JSON.stringify(d, null, 2), 'utf8'); } catch (e) { /* cache optionnel */ }
}

/** Le jeton porte son expiration : on ne le redemande que s'il lui reste moins d'une minute. */
function expireBientot(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    return !payload.exp || (payload.exp * 1000 - Date.now()) < 60000;
  } catch (e) { return true; }
}

export async function signinCached(API, username, password) {
  const cache = lire();
  const deja = cache[username];
  if (deja && !expireBientot(deja)) return deja;

  const r = await fetch(API + '/auth/signin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.token) {
    throw new Error('connexion ' + username + ' refusee (HTTP ' + r.status + ') '
      + (j.message || '') + ' — borne : 10 connexions par compte / 15 min');
  }
  cache[username] = j.token;
  ecrire(cache);
  return j.token;
}

/** Un jeton revoque (redemarrage, secret change) se voit au premier 401 : on le renouvelle. */
export async function callAuthenticated(API, pathname, username, password, init) {
  let token = await signinCached(API, username, password);
  const faire = async (t) => {
    const r = await fetch(API + pathname, {
      ...(init || {}),
      headers: { Authorization: 'Bearer ' + t, ...(init && init.headers) },
    });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) { /* reponse non JSON */ }
    return { status: r.status, json, text };
  };
  let res = await faire(token);
  if (res.status === 401) {
    const cache = lire();
    delete cache[username];
    ecrire(cache);
    token = await signinCached(API, username, password);
    res = await faire(token);
  }
  return res;
}
