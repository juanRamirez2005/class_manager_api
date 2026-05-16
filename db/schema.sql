-- ============================================================================
-- Class Manager API — Esquema PostgreSQL
-- Mapea las entidades de la app Android (Task, SubTask, TaskDetail, Auth)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tabla: users ─────────────────────────────────────────────────────────────
-- El email se guarda siempre en minúsculas (normalizado en la API).
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabla: categories ────────────────────────────────────────────────────────
-- Cada usuario tiene sus propias categorías (Product Design, Education, Health)
CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(80) NOT NULL,
    color_hex   VARCHAR(7),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

-- ── Tabla: tasks ─────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    subtitle        VARCHAR(200) NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',
    priority        task_priority NOT NULL DEFAULT 'MEDIUM',
    status          task_status   NOT NULL DEFAULT 'IN_PROGRESS',
    is_done         BOOLEAN NOT NULL DEFAULT FALSE,
    schedule_text   VARCHAR(80) NOT NULL DEFAULT '',  -- "10:00 AM - 12:00 PM"
    due_day         SMALLINT NOT NULL,                -- 1..31
    due_month       SMALLINT NOT NULL,                -- 0..11 (compat. con app)
    due_year        SMALLINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (due_day   BETWEEN 1 AND 31),
    CHECK (due_month BETWEEN 0 AND 11),
    CHECK (due_year  BETWEEN 1970 AND 2100)
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_due
    ON tasks (user_id, due_year, due_month, due_day);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status
    ON tasks (user_id, status);

-- ── Tabla: subtasks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subtasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    is_done     BOOLEAN NOT NULL DEFAULT FALSE,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks (task_id);

-- ── Tabla: password_resets ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Trigger: updated_at automático ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
