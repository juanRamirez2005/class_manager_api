const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');

const db = require('../db');
const config = require('../config');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
    name: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(8).max(128),
});

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
});

const forgotSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
});

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );
}

function userPublic(row) {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        lastName: row.last_name,
        createdAt: row.created_at,
    };
}

router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
    const { name, lastName, email, password } = req.body;

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
        throw new HttpError(409, 'Ese email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, name, last_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, last_name, created_at`,
        [email, passwordHash, name, lastName]
    );

    const user = rows[0];
    res.status(201).json({
        token: signToken(user),
        user: userPublic(user),
    });
}));

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { rows } = await db.query(
        'SELECT id, email, password_hash, name, last_name, created_at FROM users WHERE email = $1',
        [email]
    );
    const user = rows[0];
    if (!user) throw new HttpError(401, 'Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new HttpError(401, 'Credenciales inválidas');

    res.json({
        token: signToken(user),
        user: userPublic(user),
    });
}));

router.post('/forgot-password', validate(forgotSchema), asyncHandler(async (req, res) => {
    const { email } = req.body;

    const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    const user = rows[0];

    // Si no existe el usuario, devolvemos 200 igualmente para no filtrar emails.
    if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min

        await db.query(
            `INSERT INTO password_resets (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, tokenHash, expiresAt]
        );

        // En producción aquí se enviaría un correo con el rawToken.
        // Para desarrollo lo devolvemos en la respuesta.
        return res.json({
            messageSent: true,
            devToken: rawToken,
        });
    }

    res.json({ messageSent: true });
}));

router.get('/me', authRequired, asyncHandler(async (req, res) => {
    const { rows } = await db.query(
        'SELECT id, email, name, last_name, created_at FROM users WHERE id = $1',
        [req.user.id]
    );
    if (rows.length === 0) throw new HttpError(404, 'Usuario no encontrado');
    res.json(userPublic(rows[0]));
}));

module.exports = router;
