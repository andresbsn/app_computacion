# Project Context

Project: App Computacion.

Purpose: web application for a computer/workshop business, covering authentication, clients, products, repair orders, sales, scheduled tasks, configuration, account balances, reporting, SMTP testing, and AFIP invoicing flows.

Repository shape:
- `backend/`: Node.js 20+ Express API using PostgreSQL.
- `frontend/`: Vite React single-page application.
- `docs/`: project documentation, including ABM UI conventions.
- `docker-compose.yml`: local/VPS stack for PostgreSQL, backend, and frontend.
- `DEPLOY_DOCKER.md`: Docker deployment notes.

Sensitive files observed but not read during onboarding:
- `backend/.env`
- `frontend/.env`
- `backend/credenciales/privada.key`
- `backend/credenciales/CGEELECTRONICA.crt`

Existing untracked files observed during framework installation:
- `20302576239_001_00003_00000254.pdf`
- `factura_b.pdf`
- `logo_nuevo.jpeg`
