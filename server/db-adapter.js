const fs = require('fs');
const path = require('path');

let dbType = 'sqlite';
let pool;
let sqliteDb;

if (process.env.DATABASE_URL) {
    dbType = 'postgres';
    const { Pool } = require('pg');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
} else {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, 'corp_messenger.db');
    sqliteDb = new Database(dbPath, { verbose: console.log });
}

// Helper to convert ? to $1, $2, etc for Postgres
const convertSql = (sql) => {
    if (dbType === 'sqlite') return sql;
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
};

const query = async (sql, params = []) => {
    if (dbType === 'postgres') {
        const pgSql = convertSql(sql);
        try {
            const res = await pool.query(pgSql, params);
            return { rows: res.rows, rowCount: res.rowCount };
        } catch (err) {
            console.error('PG Query Error:', err);
            throw err;
        }
    } else {
        // SQLite wrapper to mimic async/pg structure
        return new Promise((resolve, reject) => {
            try {
                const isSelect = sql.trim().toLowerCase().startsWith('select');
                const stmt = sqliteDb.prepare(sql);

                if (isSelect) {
                    const rows = stmt.all(params);
                    resolve({ rows, rowCount: rows.length });
                } else {
                    const info = stmt.run(params);
                    // Mimic PG return for INSERT/UPDATE
                    // For INSERT ... RETURNING *, we need to handle it manually or assume the caller knows what they get
                    // But better-sqlite3 doesn't support RETURNING natively in the same way for .run() result
                    // We might need to fetch the last inserted row if needed.
                    resolve({
                        rows: [], // SQLite run doesn't return rows by default unless we use .get()/.all()
                        rowCount: info.changes,
                        lastID: info.lastInsertRowid
                    });
                }
            } catch (err) {
                console.error('SQLite Query Error:', err);
                reject(err);
            }
        });
    }
};

// Special method for INSERT ... RETURNING
// SQLite needs a separate query to get the inserted row usually, or use RETURNING clause if supported (newer sqlite)
// Postgres supports RETURNING natively.
const insertReturning = async (sql, params = []) => {
    if (dbType === 'postgres') {
        const pgSql = convertSql(sql); // Ensure SQL has RETURNING * or similar
        const res = await pool.query(pgSql, params);
        return res.rows[0];
    } else {
        // For SQLite, we try to run it. If it has RETURNING, better-sqlite3 .run() won't return the data.
        // We should use .get() if we expect a return value.
        return new Promise((resolve, reject) => {
            try {
                const stmt = sqliteDb.prepare(sql);
                // If the SQL has RETURNING, we should use .get() to retrieve the row
                if (sql.toLowerCase().includes('returning')) {
                    const row = stmt.get(params);
                    resolve(row);
                } else {
                    const info = stmt.run(params);
                    resolve({ id: info.lastInsertRowid });
                }
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = {
    query,
    insertReturning,
    dbType
};
