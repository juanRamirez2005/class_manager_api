const { Pool } = require('pg');
const config = require('./config');

const useSsl = /supabase\.co|sslmode=require/.test(config.databaseUrl || '');
const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
    console.error('Postgres pool error:', err);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
};
