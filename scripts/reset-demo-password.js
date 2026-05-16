require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

(async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const hash = await bcrypt.hash('Demo1234', 10);
    const r = await client.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [hash, 'demo@classmanager.dev']
    );
    console.log('Filas actualizadas:', r.rowCount);
    await client.end();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
