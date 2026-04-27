# Backend - App Computacion

## Requisitos
- Node.js 20+
- PostgreSQL 14+

## Configuracion
1. Copiar variables de `.env.example` a `.env` (ya creado en local).
2. Instalar dependencias:
   - `npm install`

## Inicializar base de datos
- `npm run db:init`

Esto crea el esquema definido en `DB_SCHEMA` y las tablas del MVP.

## Ejecutar API
- `npm run dev`

## Endpoint de prueba
- `GET http://localhost:3000/health`
