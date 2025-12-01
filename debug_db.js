const db = require('./server/db');

console.log('--- USERS ---');
const users = db.prepare('SELECT * FROM users').all();
console.table(users);

console.log('\n--- CHANNELS ---');
const channels = db.prepare('SELECT * FROM channels').all();
console.table(channels);

console.log('\n--- MESSAGES ---');
const messages = db.prepare('SELECT * FROM messages LIMIT 5').all();
console.table(messages);
