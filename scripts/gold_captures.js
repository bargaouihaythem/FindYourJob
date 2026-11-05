// Captures hautes resol. pour le rapport : carte « Gold Set » (etalonnage) + ligne manager avec l'etoile.
// Les figures du chapitre 4 sont tirees a 880 px CSS / dpr 2 pour rester comparables aux PNG deja valides.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const API = 'http://localhost:8080/api';
const PW = 'password123';
const OUT = path.join(__dirname, 'gold_captures');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function login(page, username) {
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.fill('#username', username);
  await page.fill('#password', PW);
  await page.click('button:has-text("Se connecter")');
  await page.waitForFunction(() => !!localStorage.getItem('token'), null, { timeout: 20000 });
}

/** Taille en px CSS du texte d'un element, pour calculer la taille imprimee dans le PDF. */
async function fontReport(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const out = [];
    el.querySelectorAll('*').forEach((n) => {
      const t = (n.textContent || '').trim();
      if (!t || n.children.length) return;
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      if (r.width === 0) return;
      out.push({ text: t.slice(0, 34), px: parseFloat(cs.fontSize) });
    });
    return out.slice(0, 14);
  }, sel);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // ---- 1. Carte « Gold Set — etalonnage du seuil de decision » (compte rh)
  const ctxRh = await browser.newContext({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  const pRh = await ctxRh.newPage();
  await login(pRh, 'rh');
  await pRh.goto('http://localhost:4200/admin/scoring-settings', { waitUntil: 'networkidle' });
  await pRh.waitForSelector('text=Gold Set', { timeout: 20000 });
  await pRh.waitForTimeout(2500);
  const found = await pRh.evaluate(() => {
    const h = [...document.querySelectorAll('h1,h2,h3,h4,h5,div,span')].find(e => /Gold Set/.test(e.textContent) && e.textContent.length < 90);
    if (!h) return 'aucun titre Gold Set';
    const card = h.closest('.card');
    if (!card) return 'pas de .card ancetre';
    card.id = 'shot-goldset';
    card.scrollIntoView({ block: 'start' });
    const r = card.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY) };
  });
  console.log('carte detectee:', JSON.stringify(found));
  await pRh.waitForTimeout(800);
  const card = pRh.locator('#shot-goldset');
  await card.scrollIntoViewIfNeeded();
  await pRh.waitForTimeout(600);
  const box = await card.boundingBox();
  console.log('carte Gold Set (CSS px):', JSON.stringify(box));
  await card.screenshot({ path: path.join(OUT, 'goldset_card.png') });
  console.log('fonts carte:', JSON.stringify(await fontReport(pRh, '.card table')));
  await ctxRh.close();

  // ---- 2. Ligne manager avec l'etoile « Profil Gold » (compte manager.devops)
  const ctxMg = await browser.newContext({ viewport: { width: 880, height: 1000 }, deviceScaleFactor: 2 });
  const pMg = await ctxMg.newPage();
  await login(pMg, 'manager.devops');
  await pMg.goto('http://localhost:4200/manager/candidates', { waitUntil: 'networkidle' });
  await pMg.waitForSelector('tbody tr', { timeout: 20000 });
  await pMg.waitForTimeout(2000);
  await pMg.evaluate(() => {
    const f = document.querySelector('footer, app-footer');
    if (f) f.style.display = 'none';
  });
  const opts = await pMg.evaluate(() => {
    const s = document.querySelector('select.form-select-sm');
    if (!s) return null;
    return [...s.options].map(o => o.value);
  });
  console.log('options pageSize:', JSON.stringify(opts));
  if (opts && opts.length) {
    const best = opts.reduce((a, b) => (parseInt(b) > parseInt(a) ? b : a));
    await pMg.selectOption('select.form-select-sm', best);
    await pMg.waitForTimeout(1500);
  }
  const rows = await pMg.evaluate(() => {
    const out = [];
    document.querySelectorAll('tbody tr').forEach((tr, i) => {
      const r = tr.getBoundingClientRect();
      out.push({ i, name: (tr.innerText || '').replace(/\n/g, ' ').slice(0, 40), y: r.y + scrollY, h: r.height,
                 star: !!tr.querySelector('.fa-star') });
    });
    return out;
  });
  console.log('lignes:', JSON.stringify(rows));
  const target = rows.find((r) => r.star);
  if (!target) throw new Error('aucune ligne avec etoile');
  // trois lignes consecutives autour de la cible, sans ligne de test
  const clean = rows.filter((r) => !/test/i.test(r.name));
  const idx = clean.findIndex((r) => r.i === target.i);
  const band = clean.slice(Math.max(0, idx - 1), Math.max(0, idx - 1) + 3);
  // On ne recadre pas au scalpel : on masque les lignes hors bande, puis on tire le tableau.
  // La ligne manager fait 1579 px de large : le score et l'etoile debordent du conteneur a 880 px.
  // Contact/CV/Date/Actions ne portent pas le message de la figure ; les masquer ramene le volet a
  // ~832 px, soit 13,8 pt imprimes pour le nom et 9,9 pt pour les badges (au lieu de 12,7 et 9,1).
  await pMg.evaluate(() => {
    const t = document.querySelector('table.table-with-dropdowns');
    const keep = [0, 2, 3, 4];
    [...t.querySelectorAll('thead th')].forEach((th, i) => {
      if (!keep.includes(i)) th.style.display = 'none';
    });
    t.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, i) => { if (!keep.includes(i)) td.style.display = 'none'; });
    });
  });
  await pMg.evaluate((keep) => {
    document.querySelectorAll('tbody tr').forEach((tr, i) => {
      if (!keep.includes(i)) tr.style.display = 'none';
    });
    document.querySelectorAll('.pagination, nav[aria-label*="Page"], .candidates-header').forEach(e => e.style.display = 'none');
  }, band.map((b) => b.i));
  await pMg.waitForTimeout(400);
  const table = pMg.locator('table.table-with-dropdowns').first();
  await table.scrollIntoViewIfNeeded();
  await pMg.waitForTimeout(300);
  console.log('bande:', JSON.stringify(band.map((b) => b.name)));
  console.log('tableau:', JSON.stringify(await pMg.evaluate(() => {
    const t = document.querySelector('table.table-with-dropdowns');
    const w = t.querySelector('tbody tr:not([style*="display: none"])');
    const star = w && w.querySelector('.fa-star');
    return { scrollW: t.scrollWidth, clientW: document.querySelector('.table-responsive').clientWidth,
             starVisible: !!star, starBox: star ? JSON.stringify(star.closest('.badge').getBoundingClientRect()) : null };
  })));
  await table.screenshot({ path: path.join(OUT, 'manager_star.png') });
  console.log('fonts manager:', JSON.stringify(await fontReport(pMg, 'tbody tr')));
  await ctxMg.close();
  await browser.close();
  console.log('OK ->', OUT);
})().catch((e) => { console.error('ECHEC', e.message); process.exit(1); });
