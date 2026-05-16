const express = require('express');
const { z } = require('zod');

const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validate');
const HttpError = require('../utils/httpError');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const paramsSchema = z.object({
    year: z.coerce.number().int().min(1970).max(2100),
    month: z.coerce.number().int().min(0).max(11),
});

// ── GET /api/calendar/:year/:month ───────────────────────────────────────────
// Devuelve los días del mes con tareas (equivalente a `dotsOnDays` en CalendarUiState)
router.get('/:year/:month', validate(paramsSchema, 'params'), asyncHandler(async (req, res) => {
    const { year, month } = req.params;

    const { rows } = await db.query(
        `SELECT due_day, COUNT(*)::int AS task_count
         FROM tasks
         WHERE user_id = $1 AND due_year = $2 AND due_month = $3
         GROUP BY due_day
         ORDER BY due_day`,
        [req.user.id, year, month]
    );

    res.json({
        year,
        month,
        days: rows.map((r) => ({ day: r.due_day, taskCount: r.task_count })),
        dotsOnDays: rows.map((r) => r.due_day),
    });
}));

module.exports = router;
