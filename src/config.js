require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl: process.env.DATABASE_URL,
    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret-change-me',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
};
