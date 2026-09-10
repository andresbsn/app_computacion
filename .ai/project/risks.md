# Risks And Guardrails

Secrets:
- Do not read, print, modify, or commit `.env` files or files under `backend/credenciales/`.
- Docker Compose currently documents default/fallback values for sensitive settings; production deployments must override them with secure values.

Database:
- `backend/scripts/init-db.js` contains schema changes, including at least one `DROP COLUMN IF EXISTS` statement. Treat DB initialization/evolution as potentially destructive and require explicit approval before running against non-disposable data.
- The app uses a configurable schema name; confirm `DB_SCHEMA` before database work.

Architecture:
- Backend route/domain logic is concentrated in a large `backend/src/server.js`; small focused changes are preferred unless a refactor is explicitly requested.
- Frontend API calls are centralized in `frontend/src/lib/api.js`; keep new API integration there unless the existing pattern changes.

Verification:
- No dedicated test scripts are currently defined in `backend/package.json` or `frontend/package.json`.
- Available quality gates are primarily frontend build, backend startup/health checks, and targeted manual/API verification.
