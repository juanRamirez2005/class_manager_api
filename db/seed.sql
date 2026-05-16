-- ============================================================================
-- Seed de prueba: 1 usuario demo con tareas equivalentes a las de TasksRepository
-- Email: demo@classmanager.dev   Password: Demo1234
-- (hash bcrypt 10-rounds del password de arriba)
-- ============================================================================

INSERT INTO users (id, email, password_hash, name, last_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@classmanager.dev',
    '$2b$10$v6Fl27KpJ4XJyfR7YpXuFuwkRJcli/N1IhriXvyDVLjqjePT87koS',
    'Demo',
    'Usuario'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (user_id, name, color_hex) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Product Design', '#4F46E5'),
    ('00000000-0000-0000-0000-000000000001', 'Education',      '#10B981'),
    ('00000000-0000-0000-0000-000000000001', 'Health',         '#EF4444')
ON CONFLICT (user_id, name) DO NOTHING;

-- Tareas
WITH cat AS (
    SELECT id, name FROM categories
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
)
INSERT INTO tasks (id, user_id, category_id, title, subtitle, notes, priority, status, schedule_text, due_day, due_month, due_year)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        (SELECT id FROM cat WHERE name = 'Product Design'),
        'Finalizar proyecto apps',
        '2h restantes',
        'Asegúrate de que la paleta de colores del prototipo coincida con las directrices de marca del cliente. La presentación debe estar en formato PDF.',
        'HIGH', 'IN_PROGRESS', '10:00 AM - 12:00 PM', 8, 1, 2026
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        (SELECT id FROM cat WHERE name = 'Education'),
        'Aguantarme las clases',
        'semestre',
        'Asiste a todas las clases del semestre.',
        'MEDIUM', 'IN_PROGRESS', '08:00 AM - 05:00 PM', 12, 1, 2026
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
        (SELECT id FROM cat WHERE name = 'Health'),
        'No engordar',
        '',
        'Objetivo: mantener el peso. Consultar con un nutricionista.',
        'LOW', 'IN_PROGRESS', 'Diariamente', 20, 1, 2026
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO subtasks (task_id, title, is_done, position) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Escribir resumen ejecutivo', TRUE,  0),
    ('10000000-0000-0000-0000-000000000001', 'Recopilar datos de investigación de mercado', TRUE,  1),
    ('10000000-0000-0000-0000-000000000001', 'Revisar presupuesto con el equipo de finanzas', FALSE, 2),
    ('10000000-0000-0000-0000-000000000001', 'Corrección final y formato', FALSE, 3),
    ('10000000-0000-0000-0000-000000000003', 'Hacer ejercicio 3 veces por semana', FALSE, 0),
    ('10000000-0000-0000-0000-000000000003', 'Mantener una dieta equilibrada', FALSE, 1);
