const { Pool } = require('pg');

const connectionString = 'postgresql://postgres.qrbcplzmljnugkmpibln:lnm2oviecmq0ovk2v@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function testConnection() {
    try {
        console.log('Connecting to DB...');
        const client = await pool.connect();
        console.log('Connected!');

        console.log('Checking tables...');
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.table(res.rows);

        client.release();
    } catch (err) {
        console.error('Connection failed:', err);
    } finally {
        await pool.end();
    }
}

testConnection();
