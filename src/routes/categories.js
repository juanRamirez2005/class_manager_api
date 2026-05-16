const express = require('express');
const { z } = require('zod');

const db = require('../db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const createSchema = z.object({
    name: z.string().trim().min(1).max(80),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateSchema = createSchema.partial();

function rowToDto(r) {
    return { id: r.id, name: r.name, colorHex: r.color_hex, createdAt: r.created_at };
}

router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await db.query(
        'SELECT * FROM categories WHERE user_id = $1 ORDER BY name',
        [req.user.id]
    );
    res.json(rows.map(rowToDto));
}));

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO categories (user_id, name, color_hex)
             VALUES ($1, $2, $3) RETURNING *`,
            [req.user.id, req.body.name, req.body.colorHex || null]
        );
        res.status(201).json(rowToDto(rows[0]));
    } catch (err) {
        if (err.code === '23505') throw new HttpError(409, 'Ya existe una categoría con ese nombre');
        throw err;
    }
}));

router.patch('/:id', validate(updateSchema), asyncHandler(async (req, res) => {
    const sets = [];
    const values = [];
    if (req.body.name !== undefined)     { values.push(req.body.name);     sets.push(`name = $${values.length}`); }
    if (req.body.colorHex !== undefined) { values.push(req.body.colorHex); sets.push(`color_hex = $${values.length}`); }
    if (sets.length === 0) throw new HttpError(400, 'Sin cambios');

    values.push(req.params.id, req.user.id);
    const { rows, rowCount } = await db.query(
        `UPDATE categories SET ${sets.join(', ')}
         WHERE id = $${values.length - 1} AND user_id = $${values.length}
         RETURNING *`,
        values
    );
    if (rowCount === 0) throw new HttpError(404, 'Categoría no encontrada');
    res.json(rowToDto(rows[0]));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const { rowCount } = await db.query(
        'DELETE FROM categories WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new HttpError(404, 'Categoría no encontrada');
    res.status(204).end();
}));

module.exports = router;
