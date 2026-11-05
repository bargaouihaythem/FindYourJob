/**
 * JOB4YOU — Aligne les offres sur le barème d'expérience (Junior 0-2 / Confirmé 2-4 / Senior 5-8 / Expert 8+).
 *
 * Le barème est déjà appliqué à la saisie côté Java (ExperienceLevelNorms, appelé par
 * JobOfferService). Ce script rattrape les offres existantes, créées avant la norme, dont
 * `experience_level` était du texte libre (« junior », « Étudiant », « 4-7 ans », « senior »)
 * et dont `seniority_level` était souvent NULL — donc invisible pour le scoring de séniorité.
 *
 * Règle (identique à Java) :
 *   - minimum d'années lisible dans `experience_level` → seniority déduite du palier,
 *     et libellé remplacé par le palier canonique ;
 *   - pas de minimum lisible mais `seniority_level` renseigné → libellé du palier ;
 *   - les deux absents → la ligne est laissée telle quelle et signalée.
 *
 * Usage : node scripts/normalize_offer_experience_levels.js [nom_de_base] [--apply]
 * Sans --apply, le script se contente de lister les changements proposés (à blanc).
 */

const { Client } = require('pg');

const DB_NAME = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'job4you_db';
const APPLY = process.argv.includes('--apply');

const JUNIOR = '0-2 ans';
const MID = '2-4 ans';
const SENIOR = '5-8 ans';
const EXPERT = '8+ ans';

const ascii = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function parseMinYears(raw) {
  if (!raw) return null;
  const req = ascii(raw);
  let m = req.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
  if (m) { const v = +m[1]; return v >= 0 && v <= 35 ? v : null; }
  m = req.match(/(\d{1,2})\s*\+/);
  if (m) { const v = +m[1]; return v > 0 && v <= 35 ? v : null; }
  m = req.match(/(?:a partir de|minimum|min)[^0-9]*(\d{1,2})/);
  if (m) { const v = +m[1]; return v > 0 && v <= 35 ? v : null; }
  m = req.match(/(\d{1,2})\s*(?:ans|annees|years)/);
  if (m) { const v = +m[1]; return v > 0 && v <= 35 ? v : null; }
  if (/etudiant|stage|intern|junior|entry|debutant|fresher/.test(req)) return 0;
  if (/lead|architect|principal|expert/.test(req)) return 8;
  if (/senior/.test(req)) return 5;
  if (/confirme|confirmed|intermediaire|mid/.test(req)) return 2;
  return null;
}

const labelForMin = (v) => (v >= 8 ? EXPERT : v >= 5 ? SENIOR : v >= 2 ? MID : JUNIOR);
const seniorityForMin = (v) => (v >= 5 ? 'SENIOR' : v >= 2 ? 'MID' : 'JUNIOR');
const labelForSeniority = (s) => (s === 'JUNIOR' ? JUNIOR : s === 'MID' ? MID : s === 'SENIOR' ? SENIOR : null);

(async () => {
  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: +(process.env.PGPORT || 5432),
    database: DB_NAME,
    user: process.env.PGUSER || process.env.SPRING_DATASOURCE_USERNAME,
    password: process.env.PGPASSWORD || process.env.SPRING_DATASOURCE_PASSWORD,
  });
  await client.connect();

  const { rows } = await client.query(
    'select id, title, experience_level, seniority_level from job_offers order by id'
  );

  const changes = [];
  const untouched = [];
  for (const r of rows) {
    const min = parseMinYears(r.experience_level);
    let nextExp = r.experience_level;
    let nextSen = r.seniority_level;
    if (min !== null) {
      nextExp = labelForMin(min);
      nextSen = seniorityForMin(min);
    } else if (r.seniority_level) {
      nextExp = labelForSeniority(r.seniority_level) || r.experience_level;
    } else {
      untouched.push(r);
      continue;
    }
    if (nextExp !== r.experience_level || nextSen !== r.seniority_level) {
      changes.push({ id: r.id, title: r.title, from: `${r.experience_level} / ${r.seniority_level}`, to: `${nextExp} / ${nextSen}` });
      if (APPLY) {
        await client.query('update job_offers set experience_level=$1, seniority_level=$2 where id=$3',
          [nextExp, nextSen, r.id]);
      }
    }
  }

  console.log(`${APPLY ? 'Appliquées' : 'À appliquer'} : ${changes.length} offre(s) sur ${rows.length}`);
  for (const c of changes) console.log(`  #${c.id} ${c.title} — ${c.from} → ${c.to}`);
  if (untouched.length) {
    console.log(`Sans exigence lisible ni séniorité (laissées telles quelles) : ${untouched.length}`);
    for (const u of untouched) console.log(`  #${u.id} ${u.title} — ${u.experience_level} / ${u.seniority_level}`);
  }
  if (!APPLY) console.log('\nRelancez avec --apply pour écrire en base.');

  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
