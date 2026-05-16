const express = require('express');
const { z } = require('zod');

const db = require('../db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// ── Schemas de validación ────────────────────────────────────────────────────
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const STATUSES = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const taskCreateSchema = z.object({
    title: z.string().trim().min(1).max(200),
    subtitle: z.string().max(200).optional().default(''),
    notes: z.string().max(5000).optional().default(''),
    priority: z.enum(PRIORITIES).optional().default('MEDIUM'),
    status: z.enum(STATUSES).optional().default('IN_PROGRESS'),
    scheduleText: z.string().max(80).optional().default(''),
    dueDay: z.number().int().min(1).max(31),
    dueMonth: z.number().int().min(0).max(11),
    dueYear: z.number().int().min(1970).max(2100),
    categoryId: z.string().uuid().nullable().optional(),
});

const taskUpdateSchema = taskCreateSchema.partial();

const listQuerySchema = z.object({
    month: z.coerce.number().int().min(0).max(11).optional(),
    year: z.coerce.number().int().min(1970).max(2100).optional(),
    priority: z.enum(PRIORITIES).optional(),
    status: z.enum(STATUSES).optional(),
});

// ── Mappers ──────────────────────────────────────────────────────────────────
function taskRowToDto(row) {
    return {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        notes: row.notes,
        priority: row.priority,
        status: row.status,
        isDone: row.is_done,
        scheduleText: row.schedule_text,
        dueDay: row.due_day,
        dueMonth: row.due_month,
        dueYear: row.due_year,
        categoryId: row.category_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function subtaskRowToDto(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        title: row.title,
        isDone: row.is_done,
        position: row.position,
    };
}

// ── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const { month, year, priority, status } = req.query;
    const params = [req.user.id];
    const conditions = ['user_id = $1'];

    if (month !== undefined)   { params.push(month);    conditions.push(`due_month = $${params.length}`); }
    if (year !== undefined)    { params.push(year);     conditions.push(`due_year = $${params.length}`); }
    if (priority !== undefined){ params.push(priority); conditions.push(`priority = $${params.length}`); }
    if (status !== undefined)  { params.push(status);   conditions.push(`status = $${params.length}`); }

    const { rows } = await db.query(
        `SELECT * FROM tasks
         WHERE ${conditions.join(' AND ')}
         ORDER BY due_year, due_month, due_day, created_at`,
        params
    );
    res.json(rows.map(taskRowToDto));
}));

// ── GET /api/tasks/:id (con subtasks) ────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const taskRes = await db.query(
        `SELECT t.*, c.name AS category_name
         FROM tasks t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.id = $1 AND t.user_id = $2`,
        [id, req.user.id]
    );
    if (taskRes.rowCount === 0) throw new HttpError(404, 'Tarea no encontrada');

    const subRes = await db.query(
        `SELECT * FROM subtasks WHERE task_id = $1 ORDER BY position, created_at`,
        [id]
    );

    const task = taskRes.rows[0];
    res.json({
        ...taskRowToDto(task),
        category: task.category_name,
        subtasks: subRes.rows.map(subtaskRowToDto),
    });
}));

// ── POST /api/tasks ──────────────────────────────────────────────────────────
router.post('/', validate(taskCreateSchema), asyncHandler(async (req, res) => {
    const t = req.body;

    if (t.categoryId) {
        const ok = await db.query(
            'SELECT 1 FROM categories WHERE id = $1 AND user_id = $2',
            [t.categoryId, req.user.id]
        );
        if (ok.rowCount === 0) throw new HttpError(400, 'categoryId inválido');
    }

    const { rows } = await db.query(
        `INSERT INTO tasks
            (user_id, category_id, title, subtitle, notes, priority, status,
             schedule_text, due_day, due_month, due_year)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
            req.user.id, t.categoryId || null, t.title, t.subtitle, t.notes,
            t.priority, t.status, t.scheduleText, t.dueDay, t.dueMonth, t.dueYear,
        ]
    );
    res.status(201).json(taskRowToDto(rows[0]));
}));

// ── PATCH /api/tasks/:id ─────────────────────────────────────────────────────
router.patch('/:id', validate(taskUpdateSchema), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const fields = req.body;

    const map = {
        title: 'title', subtitle: 'subtitle', notes: 'notes',
        priority: 'priority', status: 'status', scheduleText: 'schedule_text',
        dueDay: 'due_day', dueMonth: 'due_month', dueYear: 'due_year',
        categoryId: 'category_id',
    };

    const sets = [];
    const values = [];
    for (const [k, col] of Object.entries(map)) {
        if (fields[k] !== undefined) {
            values.push(fields[k]);
            sets.push(`${col} = $${values.length}`);
        }
    }
    if (sets.length === 0) throw new HttpError(400, 'Sin cambios');

    values.push(id, req.user.id);
    const { rows, rowCount } = await db.query(
        `UPDATE tasks SET ${sets.join(', ')}
         WHERE id = $${values.length - 1} AND user_id = $${values.length}
         RETURNING *`,
        values
    );
    if (rowCount === 0) throw new HttpError(404, 'Tarea no encontrada');
    res.json(taskRowToDto(rows[0]));
}));

// ── PATCH /api/tasks/:id/toggle ──────────────────────────────────────────────
router.patch('/:id/toggle', asyncHandler(async (req, res) => {
    const { rows, rowCount } = await db.query(
        `UPDATE tasks
         SET is_done = NOT is_done,
             status  = CASE WHEN NOT is_done THEN 'COMPLETED'::task_status ELSE 'IN_PROGRESS'::task_status END
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new HttpError(404, 'Tarea no encontrada');
    res.json(taskRowToDto(rows[0]));
}));

// ── DELETE /api/tasks/:id ────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
    const { rowCount } = await db.query(
        'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
    );
    if (rowCount === 0) throw new HttpError(404, 'Tarea no encontrada');
    res.status(204).end();
}));

// ── POST /api/tasks/:id/subtasks ─────────────────────────────────────────────
const subtaskCreateSchema = z.object({
    title: z.string().trim().min(1).max(200),
});

router.post('/:id/subtasks', validate(subtaskCreateSchema), asyncHandler(async (req, res) => {
    const { id } = req.params;

    const owns = await db.query(
        'SELECT 1 FROM tasks WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    if (owns.rowCount === 0) throw new HttpError(404, 'Tarea no encontrada');

    const posRes = await db.query(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM subtasks WHERE task_id = $1',
        [id]
    );

    const { rows } = await db.query(
        `INSERT INTO subtasks (task_id, title, position) VALUES ($1, $2, $3) RETURNING *`,
        [id, req.body.title, posRes.rows[0].next]
    );
    res.status(201).json(subtaskRowToDto(rows[0]));
}));

module.exports = router;
