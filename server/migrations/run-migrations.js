const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigrations() {
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    console.log('Running migrations...');

    for (const file of files) {
        console.log(`  Executing: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(s => s.trim());

        for (const statement of statements) {
            try {
                await db.query(statement);
            } catch (err) {
                console.error(`    Error in ${file}:`, err.message);
                // Continue with other statements
            }
        }

        console.log(`    ✓ ${file} completed`);
    }

    console.log('Migrations completed!');
}

// Run if executed directly
if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}

module.exports = runMigrations;
