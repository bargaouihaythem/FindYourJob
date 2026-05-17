const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  const client = new Client({
    host: 'localhost', port: 5432,
    database: 'job4you_db', user: 'postgres', password: 'postgres'
  });
  await client.connect();

  const hash = await bcrypt.hash('Test2026!', 10);
  const adminHash = await bcrypt.hash('Admin2026!', 10);

  await client.query("UPDATE users SET password=$1 WHERE username='candidat1'", [hash]);
  await client.query("UPDATE users SET password=$1 WHERE username='rh1'", [hash]);
  await client.query("UPDATE users SET password=$1 WHERE username='manager1'", [hash]);
  await client.query("UPDATE users SET password=$1 WHERE username='manager'", [hash]);
  await client.query("UPDATE users SET password=$1 WHERE username='hrUser'", [hash]);

  const existing = await client.query("SELECT id FROM users WHERE username='admin'");
  if (existing.rows.length === 0) {
    await client.query(
      "INSERT INTO users (username, email, password) VALUES ('admin', 'admin@job4you.com', $1)",
      [adminHash]
    );
    const adminId = (await client.query("SELECT id FROM users WHERE username='admin'")).rows[0].id;
    const roles = await client.query("SELECT id FROM roles");
    for (const role of roles.rows) {
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [adminId, role.id]
      );
    }
    console.log('Admin créé avec tous les rôles');
  } else {
    await client.query("UPDATE users SET password=$1 WHERE username='admin'", [adminHash]);
    console.log('Admin mis à jour');
  }

  console.log('Mots de passe réinitialisés !');
  await client.end();
}
main().catch(console.error);
