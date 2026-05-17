const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'job4you_db',
  user: 'postgres',
  password: 'postgres'
});

async function fix() {
  await client.connect();
  console.log('Connected to PostgreSQL');

  // Drop and recreate the check constraint with ALL status values
  await client.query('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check');
  await client.query(`
    ALTER TABLE candidates ADD CONSTRAINT candidates_status_check CHECK (status IN (
      'APPLIED','CV_REVIEWED','PHONE_SCREENING','TECHNICAL_TEST','INTERVIEW','FINAL_INTERVIEW',
      'ACCEPTED','REJECTED','AUTO_REJECTED','MANAGER_REJECTED','INTERVIEW_SCHEDULED','HIRED','WITHDRAWN'
    ))
  `);
  console.log('✅ Constraint candidates_status_check updated with AUTO_REJECTED and all statuses');

  await client.end();
}

fix().catch(e => {
  console.error('Error:', e.message);
  // Try with different password
  if (e.message.includes('password')) {
    console.log('Hint: Update the password in fix-db-constraint.js');
  }
  process.exit(1);
});
