# Class Manager API

REST API en **Node.js + Express + PostgreSQL** para la app Android `proyecto_class_manager` (`primerLabCompose`). Implementa autenticación con JWT y CRUD de tareas, subtareas, categorías, vista de calendario y estadísticas.

> Para el modelo de datos completo (tablas, columnas, índices, contratos JSON), ver [DATABASE.md](DATABASE.md).

---

## Requisitos

- Node.js **18+**
- PostgreSQL **13+** (local, o servicio en la nube tipo Neon / Supabase / Railway)

---

## Setup rápido

```bash
# 1. Instalar dependencias
cd class_manager_api
npm install

# 2. Crear archivo de entorno
cp .env.example .env
# Edita DATABASE_URL y JWT_SECRET

# 3. Crear la base de datos (una vez)
#    Ej. en psql:  CREATE DATABASE class_manager;

# 4. Aplicar el esquema
npm run db:migrate

# 5. (Opcional) Cargar datos demo
npm run db:seed

# 6. Levantar el servidor
npm run dev
```

Por defecto escucha en `http://localhost:3000`. Health check: `GET /health`.

---

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DATABASE_URL` | — | Cadena `postgres://user:pass@host:port/db` |
| `JWT_SECRET` | `dev-secret-change-me` | Secreto para firmar JWTs |
| `JWT_EXPIRES_IN` | `7d` | Duración del token |
| `BCRYPT_ROUNDS` | `10` | Rondas de bcrypt |

---

## Estructura

```
class_manager_api/
├── db/
│   ├── schema.sql            # DDL completo (tablas + índices + tipos)
│   └── seed.sql              # Datos demo
├── scripts/
│   ├── migrate.js            # Aplica db/schema.sql
│   └── seed.js               # Aplica db/seed.sql
├── src/
│   ├── index.js              # Bootstrap Express
│   ├── config.js             # Carga de .env
│   ├── db.js                 # Pool de pg
│   ├── middleware/
│   │   ├── auth.js           # Verificación JWT (Bearer)
│   │   └── error.js          # Manejador centralizado de errores
│   ├── routes/
│   │   ├── auth.js           # /api/auth/*
│   │   ├── tasks.js          # /api/tasks/*  + /api/tasks/:id/subtasks
│   │   ├── subtasks.js       # /api/subtasks/*
│   │   ├── calendar.js       # /api/calendar/:year/:month
│   │   ├── categories.js     # /api/categories/*
│   │   └── stats.js          # /api/stats/summary
│   └── utils/
│       ├── asyncHandler.js
│       ├── httpError.js
│       └── validate.js       # Validación con Zod
├── package.json
├── .env.example
├── README.md
└── DATABASE.md               # Documentación detallada de la DB y contratos
```

---

## Endpoints (resumen)

Todos los endpoints excepto `auth/*` y `/health` requieren `Authorization: Bearer <token>`.

### Auth
- `POST /api/auth/register` — `{ name, lastName, email, password }` → `{ token, user }`
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `POST /api/auth/forgot-password` — `{ email }` → `{ messageSent, devToken? }`
- `GET  /api/auth/me` — perfil del usuario autenticado

### Tasks
- `GET    /api/tasks?month=&year=&priority=&status=`
- `GET    /api/tasks/:id` (incluye subtasks)
- `POST   /api/tasks`
- `PATCH  /api/tasks/:id`
- `PATCH  /api/tasks/:id/toggle`
- `DELETE /api/tasks/:id`
- `POST   /api/tasks/:id/subtasks`

### Subtasks
- `PATCH  /api/subtasks/:id`
- `PATCH  /api/subtasks/:id/toggle`
- `DELETE /api/subtasks/:id`

### Calendar
- `GET /api/calendar/:year/:month` → días con tareas (para los puntos del calendario, equivalente a `dotsOnDays`)

### Categories
- `GET    /api/categories`
- `POST   /api/categories`
- `PATCH  /api/categories/:id`
- `DELETE /api/categories/:id`

### Stats
- `GET /api/stats/summary` → totales, % completados, agrupados por prioridad y categoría

Los contratos JSON detallados de cada endpoint están en [DATABASE.md](DATABASE.md).

---

## Login demo (tras `npm run db:seed`)

```
email:    demo@classmanager.dev
password: Demo1234
```

Ejemplo con `curl`:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@classmanager.dev","password":"Demo1234"}'
```

---

## Integración con la app Android

La app actualmente usa Room como única fuente de datos. Para conectarla a esta API:

1. Añadir Retrofit + OkHttp al `build.gradle.kts`.
2. Crear un `ApiClient` que inyecte el header `Authorization: Bearer <token>` (token guardado en `DataStore`).
3. Actualizar `TasksRepository` para que combine Room (caché offline) y la API (fuente de verdad), con sincronización al iniciar la app y al hacer cambios.
4. Reemplazar el flujo del `AuthViewModel` para llamar a `/api/auth/login` y `/api/auth/register`.

> Los nombres de campos del DTO ya están en `camelCase` para mapear directo con `kotlinx.serialization` o Gson sin renames.
