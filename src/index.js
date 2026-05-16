const express = require('express');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middleware/error');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const subtaskRoutes = require('./routes/subtasks');
const calendarRoutes = require('./routes/calendar');
const categoryRoutes = require('./routes/categories');
const statsRoutes = require('./routes/stats');

const app = express();

app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stats', statsRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`Class Manager API escuchando en http://localhost:${config.port}`);
});
