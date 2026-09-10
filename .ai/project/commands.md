# Commands

Backend:
- Install dependencies: `npm install` from `backend/`.
- Run API in development: `npm run dev` from `backend/`.
- Run API normally: `npm start` from `backend/`.
- Initialize database: `npm run db:init` from `backend/`.
- Health endpoint: `GET http://localhost:3000/health`.

Frontend:
- Install dependencies: `npm install` from `frontend/`.
- Run development server: `npm run dev` from `frontend/`.
- Build: `npm run build` from `frontend/`.
- Preview build: `npm run preview` from `frontend/`.

Docker:
- Start/update stack: `docker compose up -d --build` from repository root.
- Check services: `docker compose ps`.
- Follow backend logs: `docker compose logs -f backend`.
- Stop stack: `docker compose down`.

Important guardrails:
- `docker compose down -v` deletes PostgreSQL volume data and requires explicit human approval.
- Do not run database initialization or production/destructive Docker commands unless the task explicitly requires it and approval is clear.
