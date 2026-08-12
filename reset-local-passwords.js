const { Client } = require('pg');
const bcrypt = require('bcrypt');

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Variable ${name} obligatoire`);
  }
  return value;
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'job4you_db',
    user: process.env.DB_USER || 'postgres',
    password: required('DB_PASSWORD')
  });

  const testPassword = required('JOB4YOU_TEST_PASSWORD');
  const adminPassword = required('JOB4YOU_ADMIN_PASSWORD');
  const hash = await bcrypt.hash(testPassword, 10);
  const adminHash = await bcrypt.hash(adminPassword, 10);

  await client.connect();
  try {
    for (const username of ['candidat1', 'rh1', 'manager1', 'manager', 'hrUser']) {
      await client.query('UPDATE users SET password=$1 WHERE username=$2', [hash, username]);
    }

    const existing = await client.query('SELECT id FROM users WHERE username=$1', ['admin']);
    if (existing.rows.length === 0) {
      await client.query(
        'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
        ['admin', process.env.JOB4YOU_ADMIN_EMAIL || 'admin@example.com', adminHash]
      );
      const adminId = (await client.query('SELECT id FROM users WHERE username=$1', ['admin'])).rows[0].id;
      const roles = await client.query('SELECT id FROM roles');
      for (const role of roles.rows) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [adminId, role.id]
        );
      }
      console.log('Admin créé avec les rôles disponibles.');
    } else {
      await client.query('UPDATE users SET password=$1 WHERE username=$2', [adminHash, 'admin']);
      console.log('Admin mis à jour.');
    }

    console.log('Réinitialisation terminée. Les mots de passe ne sont pas affichés.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Échec de la réinitialisation :', error.message);
  process.exitCode = 1;
});
