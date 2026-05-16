# Documentación de la Base de Datos y Contratos

API: **Class Manager** · Stack: **Express + PostgreSQL** · Cliente objetivo: app Android `proyecto_class_manager` (`primerLabCompose`).

Este documento describe:

1. [Modelo entidad-relación](#1-modelo-entidad-relación)
2. [Tablas y columnas](#2-tablas-y-columnas)
3. [Tipos enumerados](#3-tipos-enumerados)
4. [Índices y restricciones](#4-índices-y-restricciones)
5. [Mapeo con la app Android](#5-mapeo-con-la-app-android)
6. [Contratos JSON de cada endpoint](#6-contratos-json-de-cada-endpoint)
7. [Códigos de error](#7-códigos-de-error)
8. [Decisiones de diseño](#8-decisiones-de-diseño)

---

## 1. Modelo entidad-relación

```
┌───────────┐ 1     N ┌────────────┐
│   users   │─────────│ categories │
└─────┬─────┘         └──────┬─────┘
      │ 1                    │ 0..1
      │                      │
      │ N                    │ N
      ▼                      ▼
┌───────────────────────────────┐ 1     N ┌──────────┐
│            tasks              │─────────│ subtasks │
└───────────────────────────────┘         └──────────┘

┌───────────┐ 1     N ┌────────────────────┐
│   users   │─────────│  password_resets   │
└───────────┘         └────────────────────┘
```

- **`users`** — cuentas. Email único.
- **`categories`** — propias de cada usuario. Únicas por (user_id, name).
- **`tasks`** — pertenecen a un usuario; opcionalmente a una categoría.
- **`subtasks`** — pertenecen a una tarea (cascade delete).
- **`password_resets`** — tokens de un solo uso para flujo "olvidé mi contraseña".

---

## 2. Tablas y columnas

### `users`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | `gen_random_uuid()` |
| `email` | `VARCHAR(255) UNIQUE NOT NULL` | normalizado a minúsculas en la API |
| `password_hash` | `VARCHAR(255) NOT NULL` | bcrypt, 10 rondas por defecto |
| `name` | `VARCHAR(100) NOT NULL` | |
| `last_name` | `VARCHAR(100) NOT NULL` | |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | trigger `set_updated_at()` |

### `categories`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → users(id) ON DELETE CASCADE` | |
| `name` | `VARCHAR(80) NOT NULL` | |
| `color_hex` | `VARCHAR(7)` | nullable, formato `#RRGGBB` |
| `created_at` | `TIMESTAMPTZ` | |

**UNIQUE** (`user_id`, `name`).

### `tasks`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → users(id) ON DELETE CASCADE` | |
| `category_id` | `UUID FK → categories(id) ON DELETE SET NULL` | nullable |
| `title` | `VARCHAR(200) NOT NULL` | |
| `subtitle` | `VARCHAR(200) DEFAULT ''` | "2h restantes", etc. |
| `notes` | `TEXT DEFAULT ''` | descripción larga |
| `priority` | `task_priority` (enum) | `HIGH \| MEDIUM \| LOW` |
| `status` | `task_status` (enum) | `IN_PROGRESS \| COMPLETED \| CANCELLED` |
| `is_done` | `BOOLEAN DEFAULT FALSE` | toggle rápido del listado |
| `schedule_text` | `VARCHAR(80) DEFAULT ''` | `"10:00 AM - 12:00 PM"` |
| `due_day` | `SMALLINT 1..31` | |
| `due_month` | `SMALLINT 0..11` | **0 = enero** (compatible con `Calendar.MONTH` de Android) |
| `due_year` | `SMALLINT 1970..2100` | |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |

### `subtasks`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `task_id` | `UUID FK → tasks(id) ON DELETE CASCADE` | |
| `title` | `VARCHAR(200)` | |
| `is_done` | `BOOLEAN DEFAULT FALSE` | |
| `position` | `INTEGER DEFAULT 0` | orden visual |
| `created_at` | `TIMESTAMPTZ` | |

### `password_resets`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → users(id) ON DELETE CASCADE` | |
| `token_hash` | `VARCHAR(255)` | SHA-256 del token enviado |
| `expires_at` | `TIMESTAMPTZ` | 30 minutos desde la emisión |
| `used_at` | `TIMESTAMPTZ` | nullable, marca uso |
| `created_at` | `TIMESTAMPTZ` | |

---

## 3. Tipos enumerados

```sql
CREATE TYPE task_priority AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE task_status   AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
```

Coinciden con el enum `Priority` y el campo `status` de [TaskModels.kt](../proyecto_class_manager/app/src/main/java/com/example/primerlabcompose/data/model/TaskModels.kt).

---

## 4. Índices y restricciones

| Índice | Tabla | Columnas | Justificación |
|---|---|---|---|
| `idx_tasks_user_due` | `tasks` | `(user_id, due_year, due_month, due_day)` | Listado por mes (vista Calendar) |
| `idx_tasks_user_status` | `tasks` | `(user_id, status)` | Filtro por estado |
| `idx_subtasks_task` | `subtasks` | `(task_id)` | Lookup al abrir detalle |
| `users_email_key` | `users` | `(email) UNIQUE` | Login |
| `categories_user_name_key` | `categories` | `(user_id, name) UNIQUE` | Evita duplicados por usuario |

CHECKs: `due_day BETWEEN 1 AND 31`, `due_month BETWEEN 0 AND 11`, `due_year BETWEEN 1970 AND 2100`.

---

## 5. Mapeo con la app Android

| Modelo Android (Kotlin) | Tabla / DTO de la API |
|---|---|
| `Task(id, title, priority, subtitle, isDone, dueDate)` | `tasks` |
| `SubTask(id, title, isDone)` | `subtasks` |
| `TaskDetail(...)` | `tasks` + `subtasks` (response de `GET /api/tasks/:id`) |
| `LoginUiState`, `SignUpUiState` | inputs de `/api/auth/login`, `/api/auth/register` |
| `CalendarUiState.dotsOnDays` | response de `GET /api/calendar/:year/:month` |
| `BottomNavItem.STATS` | `GET /api/stats/summary` |

**IDs:** la app actualmente usa `Int` autoincremental; al integrar la API hay que migrar a `String` (UUID). Es un cambio de tipo en `TaskEntity`, `SubTaskEntity` y los modelos de dominio.

**Mes 0-indexado:** `due_month` se guarda igual que `Calendar.MONTH` (0 = enero), así no se requiere conversión en el cliente.

---

## 6. Contratos JSON de cada endpoint

Convenciones:
- Todas las rutas viven bajo `/api`.
- Las rutas excepto `/api/auth/*` y `/health` requieren header `Authorization: Bearer <token>`.
- `Content-Type: application/json` en todos los `POST`/`PATCH`.
- Errores siguen el formato común: `{ "error": "<mensaje>", "details": <opcional> }`.

### 6.1 Auth

#### `POST /api/auth/register`

Request:
```json
{
  "name": "Juan",
  "lastName": "Camilo",
  "email": "juan@example.com",
  "password": "MiClave123"
}
```

Response **201**:
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "uuid",
    "email": "juan@example.com",
    "name": "Juan",
    "lastName": "Camilo",
    "createdAt": "2026-05-07T12:00:00.000Z"
  }
}
```

Errores: `400` validación · `409` email ya registrado.

#### `POST /api/auth/login`

Request: `{ "email": "...", "password": "..." }`
Response **200**: igual a `register`.
Errores: `401` credenciales inválidas.

#### `POST /api/auth/forgot-password`

Request: `{ "email": "..." }`
Response **200**: `{ "messageSent": true, "devToken": "<solo en dev>" }`

> En producción, `devToken` no se devuelve; se envía por correo. El cliente luego haría `POST /api/auth/reset-password` (no incluido aún en este MVP).

#### `GET /api/auth/me`

Response **200**: objeto `user` (igual al de login).

### 6.2 Tasks

#### `GET /api/tasks`

Query opcional: `month` (0..11), `year`, `priority` (`HIGH|MEDIUM|LOW`), `status` (`IN_PROGRESS|COMPLETED|CANCELLED`).

Response **200**: array de tareas.
```json
[
  {
    "id": "uuid",
    "title": "Finalizar proyecto apps",
    "subtitle": "2h restantes",
    "notes": "...",
    "priority": "HIGH",
    "status": "IN_PROGRESS",
    "isDone": false,
    "scheduleText": "10:00 AM - 12:00 PM",
    "dueDay": 8, "dueMonth": 1, "dueYear": 2026,
    "categoryId": "uuid|null",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

#### `GET /api/tasks/:id`

Response **200**: tarea + `category` (nombre) + `subtasks[]`.
```json
{
  "id": "uuid",
  "title": "...",
  "priority": "HIGH",
  "status": "IN_PROGRESS",
  "isDone": false,
  "scheduleText": "10:00 AM - 12:00 PM",
  "dueDay": 8, "dueMonth": 1, "dueYear": 2026,
  "categoryId": "uuid|null",
  "category": "Product Design",
  "notes": "...",
  "subtasks": [
    { "id": "uuid", "taskId": "uuid", "title": "...", "isDone": true, "position": 0 }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

#### `POST /api/tasks`

Request:
```json
{
  "title": "Estudiar para parcial",
  "subtitle": "",
  "notes": "Cap. 4 y 5",
  "priority": "MEDIUM",
  "status": "IN_PROGRESS",
  "scheduleText": "07:00 PM - 09:00 PM",
  "dueDay": 15, "dueMonth": 4, "dueYear": 2026,
  "categoryId": null
}
```

Campos obligatorios: `title`, `dueDay`, `dueMonth`, `dueYear`. Resto tienen defaults.

Response **201**: tarea creada.

#### `PATCH /api/tasks/:id`

Cualquier subset del body de `POST`. Response **200**: tarea actualizada.

#### `PATCH /api/tasks/:id/toggle`

Sin body. Alterna `is_done` y sincroniza `status` (`COMPLETED` ↔ `IN_PROGRESS`). Response **200**: tarea actualizada.

#### `DELETE /api/tasks/:id`

Response **204** (sin cuerpo). Borra subtasks en cascada.

#### `POST /api/tasks/:id/subtasks`

Request: `{ "title": "..." }`
Response **201**: subtarea con `position` asignada al final.

### 6.3 Subtasks

#### `PATCH /api/subtasks/:id`

Request: `{ "title"?: "...", "isDone"?: true }`
Response **200**: subtarea actualizada.

#### `PATCH /api/subtasks/:id/toggle`

Sin body. Alterna `isDone`.

#### `DELETE /api/subtasks/:id`

Response **204**.

### 6.4 Calendar

#### `GET /api/calendar/:year/:month`

`month` es 0-indexado (0 = enero).

Response **200**:
```json
{
  "year": 2026,
  "month": 1,
  "days": [
    { "day": 8,  "taskCount": 1 },
    { "day": 12, "taskCount": 1 },
    { "day": 20, "taskCount": 1 }
  ],
  "dotsOnDays": [8, 12, 20]
}
```

`dotsOnDays` mapea directo a `CalendarUiState.dotsOnDays: Set<Int>`.

### 6.5 Categories

#### `GET /api/categories`

Response **200**: array.
```json
[
  { "id": "uuid", "name": "Product Design", "colorHex": "#4F46E5", "createdAt": "..." }
]
```

#### `POST /api/categories`

Request: `{ "name": "Education", "colorHex": "#10B981" }`
Response **201**: categoría creada. Errores: `409` duplicada.

#### `PATCH /api/categories/:id`

Request: subset de los campos. Response **200**.

#### `DELETE /api/categories/:id`

Response **204**. Las tareas que apuntaban a la categoría quedan con `categoryId: null` (FK `ON DELETE SET NULL`).

### 6.6 Stats

#### `GET /api/stats/summary`

Response **200**:
```json
{
  "total": 12,
  "completed": 5,
  "pending": 7,
  "completionRate": 0.42,
  "byPriority": { "HIGH": 3, "MEDIUM": 6, "LOW": 3 },
  "byCategory": [
    { "id": "uuid", "name": "Product Design", "total": 4, "completed": 2 }
  ]
}
```

### 6.7 Health

#### `GET /health`

Sin auth. Response **200**: `{ "status": "ok" }`.

---

## 7. Códigos de error

| Código | Significado |
|---|---|
| `400` | Validación fallida (ver `details` con la salida de Zod) |
| `401` | Falta token, token inválido o credenciales incorrectas |
| `404` | Recurso no encontrado o no pertenece al usuario |
| `409` | Conflicto (email duplicado, categoría duplicada) |
| `500` | Error inesperado del servidor |

Formato:
```json
{ "error": "Mensaje legible", "details": { "...": "opcional" } }
```

---

## 8. Decisiones de diseño

- **PostgreSQL**: enums nativos para `priority`/`status`, `gen_random_uuid()` y triggers `updated_at` evitan código en la API.
- **UUID en vez de auto-int**: facilita sincronización offline-first (el cliente puede generar IDs y resolver conflictos sin colisiones).
- **`due_month` 0-indexado**: coincide con `java.util.Calendar.MONTH` y con `MonthYear.month` de la app. Cero conversiones en el cliente.
- **`schedule_text` como string libre**: replica el formato actual de la app (`"10:00 AM - 12:00 PM"`). Si se quisiera filtrar por hora, migrar a `TIME` o `TSTZRANGE`.
- **`is_done` + `status`**: redundancia controlada. `is_done` es lo que la lista necesita; `status` permite estados extra (`CANCELLED`) sin romper la pantalla principal. El `toggle` los mantiene sincronizados.
- **Cascade vs Set Null**: borrar usuario o tarea borra todo lo dependiente (cascade); borrar categoría no borra tareas (set null) — es más seguro frente a errores del usuario.
- **Validación con Zod**: los DTOs quedan documentados en el código y cualquier campo extra se rechaza implícitamente.
- **`forgot-password` no filtra**: responde `200` exista o no el email; el `devToken` solo se devuelve en desarrollo para facilitar pruebas locales.
- **Sin paginación todavía**: con N esperado bajo (tareas de un estudiante) no es prioridad. Si crece, añadir `?limit=&cursor=` a `GET /api/tasks`.
