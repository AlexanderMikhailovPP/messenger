const db = require('./db-adapter');

// Initialize tables
const initDb = async () => {
  const isPostgres = db.dbType === 'postgres';
  const autoIncrement = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
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
        edited_at ${isPostgres ? 'TIMESTAMP' : 'DATETIME'},
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (channel_id) REFERENCES channels (id)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS reactions (
        id ${autoIncrement},
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        emoji ${textType} NOT NULL,
        created_at ${isPostgres ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(message_id, user_id, emoji)
      );
    `);

    // Huddle sessions table for tracking calls
    await db.query(`
      CREATE TABLE IF NOT EXISTS huddle_sessions (
        id ${autoIncrement},
        channel_id INTEGER NOT NULL,
        started_by INTEGER NOT NULL,
        message_id INTEGER,
        status ${textType} DEFAULT 'active',
        started_at ${isPostgres ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
        ended_at ${isPostgres ? 'TIMESTAMP' : 'DATETIME'},
        FOREIGN KEY (channel_id) REFERENCES channels (id),
        FOREIGN KEY (started_by) REFERENCES users (id),
        FOREIGN KEY (message_id) REFERENCES messages (id)
      );
    `);

    // Huddle participants table for tracking who joined calls
    await db.query(`
      CREATE TABLE IF NOT EXISTS huddle_participants (
        id ${autoIncrement},
        huddle_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at ${isPostgres ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
        left_at ${isPostgres ? 'TIMESTAMP' : 'DATETIME'},
        FOREIGN KEY (huddle_id) REFERENCES huddle_sessions (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    // Migration: Add type column if it doesn't exist
    try {
      await db.query(`ALTER TABLE channels ADD COLUMN type ${textType} DEFAULT 'public'`);
    } catch (error) {
      // Column likely already exists
    }

    // Migration: Add edited_at column if it doesn't exist
    try {
      await db.query(`ALTER TABLE messages ADD COLUMN edited_at ${isPostgres ? 'TIMESTAMP' : 'DATETIME'}`);
    } catch (error) {
      // Column likely already exists
    }

    // Migration: Add thread_id column for threading support
    try {
      await db.query(`ALTER TABLE messages ADD COLUMN thread_id INTEGER REFERENCES messages(id)`);
    } catch (error) {
      // Column likely already exists
    }

    // Create indexes for better performance
    try {
      if (isPostgres) {
        await db.query('CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_huddle_participants_huddle_id ON huddle_participants(huddle_id)');
      } else {
        // SQLite syntax
        await db.query('CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_huddle_participants_huddle_id ON huddle_participants(huddle_id)');
      }
    } catch (error) {
      // Indexes might already exist
    }

    // Create default channel if not exists
    const general = await db.query('SELECT * FROM channels WHERE name = ?', ['general']);
    if (general.rows.length === 0) {
      await db.query('INSERT INTO channels (name, description, type) VALUES (?, ?, ?)', ['general', 'General discussion', 'public']);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Database initialized (${db.dbType})`);
    }
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
};

initDb();

module.exports = db;
