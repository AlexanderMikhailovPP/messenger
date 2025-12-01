const db = require('./db-adapter');

// Initialize tables
const initDb = async () => {
  const isPostgres = db.dbType === 'postgres';
  const autoIncrement = isPostgres ? 'SERIAL' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const textType = isPostgres ? 'TEXT' : 'TEXT'; // Same for both

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id ${autoIncrement},
        username ${textType} UNIQUE NOT NULL,
        password ${textType} NOT NULL,
        avatar_url ${textType}
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id ${autoIncrement},
        name ${textType} UNIQUE NOT NULL,
        description ${textType},
        type ${textType} DEFAULT 'public'
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id ${autoIncrement},
        content ${textType} NOT NULL,
        user_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        created_at ${isPostgres ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (channel_id) REFERENCES channels (id)
      );
    `);

    // Migration: Add type column if it doesn't exist
    try {
      await db.query(`ALTER TABLE channels ADD COLUMN type ${textType} DEFAULT 'public'`);
    } catch (error) {
      // Column likely already exists
    }

    // Create default channel if not exists
    const general = await db.query('SELECT * FROM channels WHERE name = ?', ['general']);
    if (general.rows.length === 0) {
      await db.query('INSERT INTO channels (name, description, type) VALUES (?, ?, ?)', ['general', 'General discussion', 'public']);
    }

    console.log(`Database initialized (${db.dbType})`);
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
};

initDb();

module.exports = db;
