const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// ── GET /api/stats/summary ───────────────────────────────────────────────────
router.get('/summary', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const totals = await db.query(
        `SELECT
            COUNT(*)::int                                            AS total,
            COUNT(*) FILTER (WHERE is_done)::int                     AS completed,
            COUNT(*) FILTER (WHERE NOT is_done)::int                 AS pending,
            COUNT(*) FILTER (WHERE priority = 'HIGH')::int           AS high_priority,
            COUNT(*) FILTER (WHERE priority = 'MEDIUM')::int         AS medium_priority,
            COUNT(*) FILTER (WHERE priority = 'LOW')::int            AS low_priority
         FROM tasks WHERE user_id = $1`,
        [userId]
    );

    const byCategory = await db.query(
        `SELECT c.id, c.name,
                COUNT(t.id)::int                              AS total,
                COUNT(t.id) FILTER (WHERE t.is_done)::int     AS completed
         FROM categories c
         LEFT JOIN tasks t ON t.category_id = c.id AND t.user_id = c.user_id
         WHERE c.user_id = $1
         GROUP BY c.id, c.name
         ORDER BY c.name`,
        [userId]
    );

    const t = totals.rows[0];
    res.json({
        total: t.total,
        completed: t.completed,
        pending: t.pending,
        completionRate: t.total > 0 ? +(t.completed / t.total).toFixed(2) : 0,
        byPriority: {
            HIGH: t.high_priority,
            MEDIUM: t.medium_priority,
            LOW: t.low_priority,
        },
        byCategory: byCategory.rows.map((r) => ({
            id: r.id,
            name: r.name,
            total: r.total,
            completed: r.completed,
        })),
    });
}));

module.exports = router;
