-- Huddle sessions table
CREATE TABLE IF NOT EXISTS huddle_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    started_by INTEGER NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'ended')),
    message_id INTEGER,
    
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Huddle participants table
CREATE TABLE IF NOT EXISTS huddle_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    huddle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    is_muted INTEGER DEFAULT 0,
    
    FOREIGN KEY (huddle_id) REFERENCES huddle_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(huddle_id, user_id, joined_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_huddle_sessions_channel ON huddle_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_huddle_sessions_status ON huddle_sessions(status);
CREATE INDEX IF NOT EXISTS idx_huddle_participants_huddle ON huddle_participants(huddle_id);
CREATE INDEX IF NOT EXISTS idx_huddle_participants_user ON huddle_participants(user_id);
