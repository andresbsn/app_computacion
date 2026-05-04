import { config } from "../src/config.js";
import { pool } from "../src/db.js";

const schema = config.db.schema;

const sql = `
CREATE SCHEMA IF NOT EXISTS ${schema};

CREATE TABLE IF NOT EXISTS ${schema}.usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'tecnico', 'caja')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${schema}.clientes (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(140) NOT NULL,
  telefono VARCHAR(40),
  email VARCHAR(120),
  documento VARCHAR(40),
  direccion TEXT,
  ciudad VARCHAR(120),
  provincia VARCHAR(120),
  cuit VARCHAR(20),
  condicion_iva VARCHAR(20) NOT NULL DEFAULT 'consumidor_final',
  observaciones TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ${schema}.clientes
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(120),
  ADD COLUMN IF NOT EXISTS provincia VARCHAR(120),
  ADD COLUMN IF NOT EXISTS cuit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS condicion_iva VARCHAR(20);

UPDATE ${schema}.clientes
SET condicion_iva = 'consumidor_final'
WHERE condicion_iva IS NULL;

ALTER TABLE ${schema}.clientes
  ALTER COLUMN condicion_iva SET DEFAULT 'consumidor_final',
  ALTER COLUMN condicion_iva SET NOT NULL;

CREATE TABLE IF NOT EXISTS ${schema}.cuenta_corriente_movimientos (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL REFERENCES ${schema}.clientes(id),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('debe', 'haber')),
  origen VARCHAR(20) NOT NULL CHECK (origen IN ('venta', 'ajuste', 'pago')),
  referencia_id BIGINT,
  descripcion TEXT,
  monto NUMERIC(12, 2) NOT NULL CHECK (monto >= 0),
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${schema}.productos (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE,
  nombre VARCHAR(140) NOT NULL,
  descripcion TEXT,
  costo NUMERIC(12, 2) NOT NULL DEFAULT 0,
  precio NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_actual NUMERIC(12, 2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${schema}.marcas (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${schema}.dispositivos (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${schema}.gastos (
  id BIGSERIAL PRIMARY KEY,
  concepto VARCHAR(180) NOT NULL,
  categoria VARCHAR(80),
  monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observaciones TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${schema}.programar_tareas (
  id BIGSERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL,
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  prioridad VARCHAR(10) NOT NULL CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  categoria VARCHAR(120),
  completada BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_completada TIMESTAMPTZ,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ${schema}.programar_tareas
  ADD COLUMN IF NOT EXISTS completada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ${schema}.stock_movimientos (
  id BIGSERIAL PRIMARY KEY,
  producto_id BIGINT NOT NULL REFERENCES ${schema}.productos(id),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'ajuste')),
  cantidad NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
  origen VARCHAR(20) NOT NULL CHECK (origen IN ('compra', 'venta', 'reparacion', 'ajuste')),
  referencia_id BIGINT,
  observaciones TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${schema}.ordenes_reparacion (
  id BIGSERIAL PRIMARY KEY,
  nro_orden BIGSERIAL UNIQUE,
  cliente_id BIGINT NOT NULL REFERENCES ${schema}.clientes(id),
  equipo VARCHAR(160) NOT NULL,
  marca VARCHAR(80),
  modelo VARCHAR(80),
  contrasena_equipo VARCHAR(120),
  diagnostico_inicial TEXT NOT NULL,
  trajo_cargador BOOLEAN NOT NULL DEFAULT FALSE,
  observaciones TEXT,
  estado_actual VARCHAR(30) NOT NULL CHECK (
    estado_actual IN ('ingresada', 'en_diagnostico', 'en_reparacion', 'esperando_repuesto', 'lista_para_entrega', 'entregada', 'cancelada')
  ),
  prioridad VARCHAR(10) NOT NULL CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_estimada_entrega TIMESTAMPTZ,
  fecha_cierre TIMESTAMPTZ,
  created_by BIGINT REFERENCES ${schema}.usuarios(id)
);

ALTER TABLE ${schema}.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS marca VARCHAR(80),
  ADD COLUMN IF NOT EXISTS modelo VARCHAR(80),
  ADD COLUMN IF NOT EXISTS contrasena_equipo VARCHAR(120);

ALTER TABLE ${schema}.ordenes_reparacion
  DROP COLUMN IF EXISTS tiene_contrasena;

CREATE TABLE IF NOT EXISTS ${schema}.ordenes_movimientos (
  id BIGSERIAL PRIMARY KEY,
  orden_id BIGINT NOT NULL REFERENCES ${schema}.ordenes_reparacion(id),
  estado VARCHAR(30) NOT NULL CHECK (
    estado IN ('ingresada', 'en_diagnostico', 'en_reparacion', 'esperando_repuesto', 'lista_para_entrega', 'entregada', 'cancelada')
  ),
  detalle TEXT NOT NULL,
  precio NUMERIC(12, 2) NOT NULL DEFAULT 0,
  usuario_id BIGINT REFERENCES ${schema}.usuarios(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ${schema}.ordenes_movimientos
  ADD COLUMN IF NOT EXISTS precio NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ${schema}.ventas (
  id BIGSERIAL PRIMARY KEY,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('afip', 'local')),
  cliente_id BIGINT REFERENCES ${schema}.clientes(id),
  origen VARCHAR(20) NOT NULL CHECK (origen IN ('orden', 'mostrador')),
  orden_id BIGINT REFERENCES ${schema}.ordenes_reparacion(id),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  descuento NUMERIC(12, 2) NOT NULL DEFAULT 0,
  impuestos NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  forma_pago VARCHAR(20) NOT NULL CHECK (forma_pago IN ('efectivo', 'transferencia', 'tarjeta', 'mixto')),
  estado VARCHAR(20) NOT NULL DEFAULT 'confirmada',
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${schema}.venta_items (
  id BIGSERIAL PRIMARY KEY,
  venta_id BIGINT NOT NULL REFERENCES ${schema}.ventas(id),
  tipo_item VARCHAR(20) NOT NULL CHECK (tipo_item IN ('producto', 'servicio', 'repuesto')),
  producto_id BIGINT REFERENCES ${schema}.productos(id),
  descripcion VARCHAR(240) NOT NULL,
  cantidad NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS ${schema}.comprobantes (
  id BIGSERIAL PRIMARY KEY,
  venta_id BIGINT NOT NULL UNIQUE REFERENCES ${schema}.ventas(id),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('afip', 'local')),
  punto_venta VARCHAR(10),
  numero VARCHAR(30) NOT NULL,
  cae VARCHAR(20),
  cae_vto DATE,
  fecha_emision TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_respuesta_afip JSONB
);
`;

const run = async () => {
  try {
    await pool.query(sql);
    console.log(`Schema '${schema}' initialized successfully.`);
  } catch (error) {
    console.error("DB init failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
