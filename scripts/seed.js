require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
    await client.query(sql);
    await client.end();
    console.log('Seed aplicado correctamente. Login demo: demo@classmanager.dev / Demo1234');
})().catch((err) => {
    console.error('Error en seed:', err);
    process.exit(1);
});
