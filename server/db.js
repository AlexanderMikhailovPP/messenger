const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'corp_messenger.db'), { verbose: console.log });

// Initialize tables
const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, -- In a real app, hash this!
      avatar_url TEXT
    );

    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'public' -- 'public' or 'dm'
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      channel_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (channel_id) REFERENCES channels (id)
    );
  `);

  // Migration: Add type column if it doesn't exist
  try {
    db.prepare('ALTER TABLE channels ADD COLUMN type TEXT DEFAULT "public"').run();
  } catch (error) {
    // Column likely already exists
  }

  // Create default channel if not exists
  const stmt = db.prepare('SELECT * FROM channels WHERE name = ?');
  const general = stmt.get('general');
  if (!general) {
    db.prepare('INSERT INTO channels (name, description, type) VALUES (?, ?, ?)').run('general', 'General discussion', 'public');
  }
};

initDb();

module.exports = db;
