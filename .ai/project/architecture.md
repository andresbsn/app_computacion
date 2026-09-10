# Architecture

Backend:
- Runtime: Node.js with ES modules.
- Framework: Express.
- Main entrypoint: `backend/src/server.js`.
- Configuration: `backend/src/config.js`, loaded from `backend/.env` via `dotenv`.
- Database access: `pg` pool in `backend/src/db.js`.
- Database initialization: `backend/scripts/init-db.js` creates and evolves the configured PostgreSQL schema.
- Validation: `zod` schemas are defined near route/domain logic in `backend/src/server.js`.
- Authentication: JWT-based auth with bcrypt password hashing.
- Integrations: SMTP via `nodemailer`; AFIP via `@afipsdk/afip.js` and `backend/src/afipService.js`.

Frontend:
- Runtime/build: Vite.
- UI framework: React 18.
- Routing: `react-router-dom`.
- Server state: `@tanstack/react-query`.
- Main app: `frontend/src/App.jsx`.
- API client: `frontend/src/lib/api.js`.
- Auth context: `frontend/src/lib/auth-context.jsx`.
- Pages include dashboard, login, clients, products, orders, sales, scheduled tasks, and configuration.

Database:
- PostgreSQL 14+ documented for local backend requirements.
- Docker stack uses `postgres:16-alpine`.
- Default schema name is `app_computacion` unless overridden by `DB_SCHEMA`.

Deployment:
- Docker Compose defines `db`, `backend`, and `frontend` services.
- Frontend container serves on port `80`.
- Backend container exposes port `3000`.
- PostgreSQL is exposed on port `5432`.
- Backend mounts `./backend/credenciales` read-only into the container for AFIP certificates.

UI conventions:
- `docs/abm-ui-pattern.md` defines ABM screens with header, actions/filters, main table, create/edit modal, detail modal, and React Query/API-client conventions.
