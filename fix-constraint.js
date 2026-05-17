const { Client } = require('pg');
const client = new Client({ host: 'localhost', port: 5432, database: 'job4you_db', user: 'postgres', password: 'postgres' });
client.connect().then(async () => {
  // Lister toutes les contraintes sur candidates
  const r = await client.query(
    "SELECT conname, contype FROM pg_constraint WHERE conrelid = 'candidates'::regclass"
  );
  console.log('Contraintes actuelles:');
  r.rows.forEach(row => console.log(row.conname, '|', row.contype));

  // Supprimer l'ancienne contrainte unique sur email seul
  await client.query('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS uk_nm2ss73jii2hdupmpphl6agry');
  console.log('Ancienne contrainte supprimee.');

  // Vérifier après
  const r2 = await client.query(
    "SELECT conname, contype FROM pg_constraint WHERE conrelid = 'candidates'::regclass"
  );
  console.log('Contraintes apres correction:');
  r2.rows.forEach(row => console.log(row.conname, '|', row.contype));

  await client.end();
}).catch(e => console.error(e.message));
