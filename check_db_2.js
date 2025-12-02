const db = require('./server/db-adapter');

async function checkSchema() {
    try {
        console.log('Checking tables...');
        // Try a simple select to see if it errors
        try {
            const rows = await db.query("SELECT * FROM reactions LIMIT 1");
            console.log('Select result:', rows);
        } catch (e) {
            console.log('Select failed:', e.message);
        }

        // Check sqlite_master for the CREATE statement
        const sql = await db.query("SELECT sql FROM sqlite_master WHERE name='reactions'");
        console.log('Create SQL:', sql.rows);
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSchema();
