const express = require('express');
const { z } = require('zod');

const db = require('../db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// ── PATCH /api/subtasks/:id/toggle ───────────────────────────────────────────
router.patch('/:id/toggle', asyncHandler(async (req, res) => {
    const { rows, rowCount } = await db.query(
        `UPDATE subtasks
         SET is_done = NOT is_done
         WHERE id = $1
           AND task_id IN (SELECT id FROM tasks WHERE user_id = $2)
         RETURNING id, task_id, title, is_done, position`,
        [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new HttpError(404, 'Subtarea no encontrada');
    const r = rows[0];
    res.json({
        id: r.id, taskId: r.task_id, title: r.title,
        isDone: r.is_done, position: r.position,
    });
}));

// ── PATCH /api/subtasks/:id ──────────────────────────────────────────────────
const updateSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    isDone: z.boolean().optional(),
});

router.patch('/:id', validate(updateSchema), asyncHandler(async (req, res) => {
    const { title, isDone } = req.body;
    const sets = [];
    const values = [];

    if (title !== undefined)  { values.push(title);  sets.push(`title = $${values.length}`); }
    if (isDone !== undefined) { values.push(isDone); sets.push(`is_done = $${values.length}`); }
    if (sets.length === 0) throw new HttpError(400, 'Sin cambios');

    values.push(req.params.id, req.user.id);
    const { rows, rowCount } = await db.query(
        `UPDATE subtasks SET ${sets.join(', ')}
         WHERE id = $${values.length - 1}
           AND task_id IN (SELECT id FROM tasks WHERE user_id = $${values.length})
         RETURNING id, task_id, title, is_done, position`,
        values
    );
    if (rowCount === 0) throw new HttpError(404, 'Subtarea no encontrada');
    const r = rows[0];
    res.json({
        id: r.id, taskId: r.task_id, title: r.title,
        isDone: r.is_done, position: r.position,
    });
}));

// ── DELETE /api/subtasks/:id ─────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
    const { rowCount } = await db.query(
        `DELETE FROM subtasks
         WHERE id = $1
           AND task_id IN (SELECT id FROM tasks WHERE user_id = $2)`,
        [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new HttpError(404, 'Subtarea no encontrada');
    res.status(204).end();
}));

module.exports = router;
