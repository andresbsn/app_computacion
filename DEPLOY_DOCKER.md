# Deploy en VPS con Docker

## 1) Requisitos en el VPS
- Docker Engine
- Docker Compose plugin (`docker compose`)

## 2) Clonar el repo
```bash
git clone <URL_DEL_REPO>
cd app_computacion
```

## 3) Configurar variables
```bash
cp .env.docker.example .env
```

Editar `.env` y ajustar al menos:
- `JWT_SECRET` (obligatorio, seguro)
- `FRONTEND_URL` (ej: `http://tu-dominio.com` o `http://IP_PUBLICA`)
- `DB_PASSWORD` (recomendado cambiar)
- `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` (obligatorios si querés envio de emails)

## 4) Levantar contenedores
```bash
docker compose up -d --build
```

Servicios expuestos:
- Frontend: puerto `80`
- Backend: puerto `3000`
- PostgreSQL: puerto `5432`

## 5) Verificar
```bash
docker compose ps
docker compose logs -f backend
```

API health:
- `http://IP_O_DOMINIO:3000/health`

## 6) Actualizar versión en VPS
```bash
git pull
docker compose up -d --build
```

## 7) Apagar
```bash
docker compose down
```

Si querés bajar también el volumen de Postgres (elimina datos):
```bash
docker compose down -v
```
