const db = require('./server/db-adapter');

async function checkSchema() {
    try {
        console.log('Checking tables...');
        const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tables:', tables.rows.map(r => r.name));

        const reactionsInfo = await db.query("PRAGMA table_info(reactions)");
        console.log('Reactions table schema:', reactionsInfo.rows);
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSchema();
