import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { pool, withClient } from "./db.js";
import { z } from "zod";

const app = express();
const schema = config.db.schema;

const clienteCreateSchema = z.object({
  nombre: z.string().trim().min(1),
  telefono: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  documento: z.string().trim().max(40).optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  observaciones: z.string().trim().optional().nullable()
});

const clienteUpdateSchema = clienteCreateSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Debe enviar al menos un campo para actualizar"
});

const productoCreateSchema = z.object({
  codigo: z.string().trim().max(50).optional().nullable(),
  nombre: z.string().trim().min(1).max(140),
  descripcion: z.string().trim().optional().nullable(),
  costo: z.coerce.number().min(0).default(0),
  precio: z.coerce.number().min(0).default(0),
  stock_actual: z.coerce.number().min(0).default(0)
});

const productoUpdateSchema = productoCreateSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Debe enviar al menos un campo para actualizar"
});

const marcaCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(80)
});

const marcaUpdateSchema = marcaCreateSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Debe enviar al menos un campo para actualizar"
});

const dispositivoCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(120)
});

const dispositivoUpdateSchema = dispositivoCreateSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Debe enviar al menos un campo para actualizar"
});

const USUARIO_ROLES = ["admin", "tecnico", "caja"];

const usuarioCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(120),
  rol: z.enum(USUARIO_ROLES)
});

const usuarioUpdateSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(120).optional(),
    password: z.string().min(6).max(120).optional(),
    rol: z.enum(USUARIO_ROLES).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar"
  });

const TAREA_PRIORIDADES = ["baja", "media", "alta", "urgente"];

const tareaCreateSchema = z.object({
  descripcion: z.string().trim().min(1),
  fecha_vencimiento: z.coerce.date(),
  prioridad: z.enum(TAREA_PRIORIDADES),
  categoria: z.string().trim().max(120).optional().nullable()
});

const tareaUpdateSchema = z
  .object({
    descripcion: z.string().trim().min(1).optional(),
    fecha_vencimiento: z.coerce.date().optional(),
    prioridad: z.enum(TAREA_PRIORIDADES).optional(),
    categoria: z.string().trim().max(120).optional().nullable(),
    completada: z.boolean().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar"
  });

const TAREA_FILTROS_ESTADO = ["vencidas", "pendientes", "completadas", "proximas"];

const authLoginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(120)
});

const bootstrapAdminSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(120)
});

const nullableDateOnlySchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    return value;
  },
  z.coerce.date().nullable()
);

const gastoCreateSchema = z.object({
  concepto: z.string().trim().min(1).max(180),
  categoria: z.string().trim().max(80).optional().nullable(),
  monto: z.coerce.number().positive(),
  fecha: nullableDateOnlySchema.optional().default(null),
  observaciones: z.string().trim().optional().nullable()
});

const gastoUpdateSchema = z
  .object({
    concepto: z.string().trim().min(1).max(180).optional(),
    categoria: z.string().trim().max(80).optional().nullable(),
    monto: z.coerce.number().positive().optional(),
    fecha: nullableDateOnlySchema.optional(),
    observaciones: z.string().trim().optional().nullable()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar"
  });

const ORDEN_ESTADOS = [
  "ingresada",
  "en_diagnostico",
  "en_reparacion",
  "esperando_repuesto",
  "lista_para_entrega",
  "entregada",
  "cancelada"
];

const ORDEN_PRIORIDADES = TAREA_PRIORIDADES;

const nullableDateSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    return value;
  },
  z.coerce.date().nullable()
);

const ordenCreateSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  equipo: z.string().trim().min(1).max(160),
  marca: z.string().trim().max(80).optional().nullable(),
  modelo: z.string().trim().max(80).optional().nullable(),
  contrasena_equipo: z.string().trim().max(120).optional().nullable(),
  diagnostico_inicial: z.string().trim().min(1),
  trajo_cargador: z.boolean().optional().default(false),
  observaciones: z.string().trim().optional().nullable(),
  estado_actual: z.enum(ORDEN_ESTADOS).optional().default("ingresada"),
  prioridad: z.enum(ORDEN_PRIORIDADES),
  fecha_estimada_entrega: nullableDateSchema.optional().default(null),
  created_by: z.coerce.number().int().positive().optional().nullable()
});

const ordenUpdateSchema = z
  .object({
    estado_actual: z.enum(ORDEN_ESTADOS).optional(),
    prioridad: z.enum(ORDEN_PRIORIDADES).optional(),
    fecha_estimada_entrega: nullableDateSchema.optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar"
  });

const ordenMovimientoSchema = z.object({
  estado: z.enum(ORDEN_ESTADOS),
  detalle: z.string().trim().min(1),
  usuario_id: z.coerce.number().int().positive().optional().nullable(),
  prioridad: z.enum(ORDEN_PRIORIDADES).optional()
});

const VENTA_TIPOS = ["afip", "local"];
const VENTA_ORIGENES = ["orden", "mostrador"];
const FORMA_PAGO = ["efectivo", "transferencia", "tarjeta", "mixto"];
const VENTA_ITEM_TIPOS = ["producto", "servicio", "repuesto"];

const ventaItemSchema = z
  .object({
    tipo_item: z.enum(VENTA_ITEM_TIPOS),
    producto_id: z.coerce.number().int().positive().optional().nullable(),
    descripcion: z.string().trim().max(240).optional().nullable(),
    cantidad: z.coerce.number().positive(),
    precio_unitario: z.coerce.number().min(0)
  })
  .refine((data) => data.producto_id || (data.descripcion && data.descripcion.trim().length > 0), {
    message: "Debe enviar descripcion o producto_id",
    path: ["descripcion"]
  });

const ventaCreateSchema = z
  .object({
    tipo: z.enum(VENTA_TIPOS),
    cliente_id: z.coerce.number().int().positive().optional().nullable(),
    origen: z.enum(VENTA_ORIGENES),
    orden_id: z.coerce.number().int().positive().optional().nullable(),
    descuento: z.coerce.number().min(0).optional().default(0),
    impuestos: z.coerce.number().min(0).optional().default(0),
    forma_pago: z.enum(FORMA_PAGO),
    monto_pagado: z.coerce.number().min(0).optional().nullable(),
    items: z.array(ventaItemSchema).min(1)
  })
  .superRefine((data, ctx) => {
    if (data.origen === "orden" && !data.orden_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["orden_id"],
        message: "orden_id es obligatorio cuando origen es 'orden'"
      });
    }
  });

const cuentaCorrientePagoSchema = z.object({
  monto: z.coerce.number().positive(),
  descripcion: z.string().trim().max(240).optional().nullable(),
  venta_id: z.coerce.number().int().positive().optional().nullable()
});

const numeroComprobantePrefix = {
  local: "LOC",
  afip: "AFIP-PEND"
};

const nextComprobanteNumber = async (client, tipo) => {
  const result = await client.query(
    `
      SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(numero, '[^0-9]', '', 'g'), '')::BIGINT), 0) + 1 AS next_num
      FROM ${schema}.comprobantes
      WHERE tipo = $1
    `,
    [tipo]
  );

  const nextNum = Number(result.rows[0].next_num || 1);
  const prefix = numeroComprobantePrefix[tipo];
  return `${prefix}-${String(nextNum).padStart(6, "0")}`;
};

const parseId = (rawId, res) => {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID invalido" });
    return null;
  }
  return id;
};

const toNullable = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = typeof value === "string" ? value.trim() : value;
  return trimmed === "" ? null : trimmed;
};

const handleZodError = (error, res) => {
  if (!(error instanceof z.ZodError)) {
    return false;
  }

  res.status(400).json({
    error: "Datos invalidos",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  });
  return true;
};

const buildAuthToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre
    },
    config.jwtSecret,
    { expiresIn: "8h" }
  );

const getUsersCount = async () => {
  const result = await pool.query(`SELECT COUNT(*)::INT AS total FROM ${schema}.usuarios`);
  return Number(result.rows[0]?.total || 0);
};

app.use(
  cors({
    origin: config.frontendUrl
  })
);
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (error) {
    res.status(500).json({ ok: false, db: "disconnected", message: error.message });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const body = authLoginSchema.parse(req.body);

    const userResult = await pool.query(
      `
        SELECT id, nombre, email, rol, password_hash, activo
        FROM ${schema}.usuarios
        WHERE email = $1
        LIMIT 1
      `,
      [body.email]
    );

    if (!userResult.rowCount) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const user = userResult.rows[0];
    if (!user.activo) {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    const passwordOk = await bcrypt.compare(body.password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = buildAuthToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    res.status(500).json({ error: "Error al iniciar sesion", message: error.message });
  }
});

app.get("/auth/bootstrap-status", async (_req, res) => {
  try {
    const totalUsers = await getUsersCount();
    res.json({ requiresBootstrap: totalUsers === 0 });
  } catch (error) {
    res.status(500).json({ error: "Error al validar bootstrap", message: error.message });
  }
});

app.post("/auth/bootstrap-admin", async (req, res) => {
  try {
    const totalUsers = await getUsersCount();
    if (totalUsers > 0) {
      return res.status(403).json({ error: "Bootstrap no disponible" });
    }

    const body = bootstrapAdminSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);

    const result = await pool.query(
      `
        INSERT INTO ${schema}.usuarios (nombre, email, password_hash, rol)
        VALUES ($1, $2, $3, 'admin')
        RETURNING id, nombre, email, rol
      `,
      [body.nombre, body.email, passwordHash]
    );

    const user = result.rows[0];
    const token = buildAuthToken(user);
    res.status(201).json({ token, user });
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23505") {
      return res.status(400).json({ error: "El email ya existe" });
    }

    res.status(500).json({ error: "Error al crear admin inicial", message: error.message });
  }
});

app.use(async (req, res, next) => {
  if (
    req.path === "/health" ||
    req.path === "/auth/login" ||
    req.path === "/auth/bootstrap-status" ||
    req.path === "/auth/bootstrap-admin"
  ) {
    return next();
  }

  if (req.path === "/usuarios" && req.method === "POST") {
    try {
      const totalUsers = await getUsersCount();
      if (totalUsers === 0) {
        return next();
      }
    } catch (error) {
      return res.status(500).json({ error: "Error al validar usuarios", message: error.message });
    }
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: Number(payload.sub),
      email: payload.email,
      rol: payload.rol,
      nombre: payload.nombre
    };
    next();
  } catch (_error) {
    res.status(401).json({ error: "Token invalido o expirado" });
  }
});

app.get("/auth/me", (req, res) => {
  res.json({ user: req.user });
});

app.get("/clientes/:id/cuenta-corriente", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const clienteResult = await pool.query(`SELECT id, nombre FROM ${schema}.clientes WHERE id = $1`, [id]);
    if (!clienteResult.rowCount) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const movimientosQuery = `
      SELECT
        m.id,
        m.cliente_id,
        m.tipo,
        m.origen,
        m.referencia_id,
        m.descripcion,
        m.monto,
        m.fecha,
        v.id AS venta_id,
        v.total AS venta_total,
        v.fecha AS venta_fecha,
        cb.numero AS venta_comprobante_numero,
        cb.tipo AS venta_comprobante_tipo
      FROM ${schema}.cuenta_corriente_movimientos m
      LEFT JOIN ${schema}.ventas v ON v.id = m.referencia_id AND (m.origen = 'venta' OR m.origen = 'pago')
      LEFT JOIN ${schema}.comprobantes cb ON cb.venta_id = v.id
      WHERE m.cliente_id = $1
      ORDER BY m.fecha DESC, m.id DESC
    `;
    const movimientosResult = await pool.query(movimientosQuery, [id]);

    const ventasQuery = `
      SELECT
        v.id,
        v.tipo,
        v.origen,
        v.total,
        v.forma_pago,
        v.fecha,
        cb.numero AS comprobante_numero,
        cb.tipo AS comprobante_tipo,
        COALESCE(deuda.monto_debe, 0) AS monto_debe_inicial,
        COALESCE(pagos.monto_pagado, 0) AS monto_pagado_cuenta_corriente
      FROM ${schema}.ventas v
      LEFT JOIN ${schema}.comprobantes cb ON cb.venta_id = v.id
      LEFT JOIN (
        SELECT referencia_id AS venta_id, SUM(monto) AS monto_debe
        FROM ${schema}.cuenta_corriente_movimientos
        WHERE cliente_id = $1 AND tipo = 'debe' AND origen = 'venta'
        GROUP BY referencia_id
      ) deuda ON deuda.venta_id = v.id
      LEFT JOIN (
        SELECT referencia_id AS venta_id, SUM(monto) AS monto_pagado
        FROM ${schema}.cuenta_corriente_movimientos
        WHERE cliente_id = $1 AND tipo = 'haber' AND origen = 'pago' AND referencia_id IS NOT NULL
        GROUP BY referencia_id
      ) pagos ON pagos.venta_id = v.id
      WHERE v.cliente_id = $1
      ORDER BY v.fecha DESC, v.id DESC
    `;
    const ventasResult = await pool.query(ventasQuery, [id]);

    const saldoQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'debe' THEN monto ELSE 0 END), 0)
        -
        COALESCE(SUM(CASE WHEN tipo = 'haber' THEN monto ELSE 0 END), 0) AS saldo
      FROM ${schema}.cuenta_corriente_movimientos
      WHERE cliente_id = $1
    `;
    const saldoResult = await pool.query(saldoQuery, [id]);

    res.json({
      cliente: clienteResult.rows[0],
      saldo: Number(saldoResult.rows[0].saldo || 0),
      movimientos: movimientosResult.rows,
      ventas: ventasResult.rows.map((venta) => {
        const montoDebeInicial = Number(venta.monto_debe_inicial || 0);
        const montoPagadoCuentaCorriente = Number(venta.monto_pagado_cuenta_corriente || 0);
        return {
          ...venta,
          total: Number(venta.total || 0),
          monto_debe_inicial: montoDebeInicial,
          monto_pagado_cuenta_corriente: montoPagadoCuentaCorriente,
          saldo_pendiente: Math.max(montoDebeInicial - montoPagadoCuentaCorriente, 0)
        };
      })
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener cuenta corriente", message: error.message });
  }
});

app.post("/clientes/:id/cuenta-corriente/pagos", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = cuentaCorrientePagoSchema.parse(req.body);

    const clienteResult = await pool.query(`SELECT id FROM ${schema}.clientes WHERE id = $1`, [id]);
    if (!clienteResult.rowCount) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    let referenciaVentaId = null;
    if (body.venta_id) {
      const ventaResult = await pool.query(`SELECT id FROM ${schema}.ventas WHERE id = $1 AND cliente_id = $2`, [body.venta_id, id]);
      if (!ventaResult.rowCount) {
        return res.status(400).json({ error: "La venta seleccionada no corresponde al cliente" });
      }
      referenciaVentaId = body.venta_id;
    }

    const descripcionDefault = referenciaVentaId ? `Pago aplicado a venta #${referenciaVentaId}` : "Pago registrado";

    const insertQuery = `
      INSERT INTO ${schema}.cuenta_corriente_movimientos (cliente_id, tipo, origen, referencia_id, descripcion, monto)
      VALUES ($1, 'haber', 'pago', $2, $3, $4)
      RETURNING id, cliente_id, tipo, origen, referencia_id, descripcion, monto, fecha
    `;

    const result = await pool.query(insertQuery, [
      id,
      referenciaVentaId,
      toNullable(body.descripcion) || descripcionDefault,
      body.monto
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    res.status(500).json({ error: "Error al registrar pago", message: error.message });
  }
});

app.get("/ventas", async (req, res) => {
  try {
    const tipo = req.query.tipo ? req.query.tipo.toString().trim() : "";
    const origen = req.query.origen ? req.query.origen.toString().trim() : "";
    const search = (req.query.search || "").toString().trim();

    const filters = [];
    const params = [];

    if (tipo) {
      if (!VENTA_TIPOS.includes(tipo)) {
        return res.status(400).json({ error: "Tipo de venta invalido" });
      }
      params.push(tipo);
      filters.push(`v.tipo = $${params.length}`);
    }

    if (origen) {
      if (!VENTA_ORIGENES.includes(origen)) {
        return res.status(400).json({ error: "Origen de venta invalido" });
      }
      params.push(origen);
      filters.push(`v.origen = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      filters.push(`(
        CAST(v.id AS TEXT) ILIKE $${i}
        OR COALESCE(c.nombre, '') ILIKE $${i}
        OR COALESCE(cb.numero, '') ILIKE $${i}
      )`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT
        v.id,
        v.tipo,
        v.cliente_id,
        c.nombre AS cliente_nombre,
        v.origen,
        v.orden_id,
        v.subtotal,
        v.descuento,
        v.impuestos,
        v.total,
        v.forma_pago,
        v.estado,
        v.fecha,
        cb.numero AS comprobante_numero,
        cb.cae,
        cb.cae_vto
      FROM ${schema}.ventas v
      LEFT JOIN ${schema}.clientes c ON c.id = v.cliente_id
      LEFT JOIN ${schema}.comprobantes cb ON cb.venta_id = v.id
      ${where}
      ORDER BY v.fecha DESC, v.id DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar ventas", message: error.message });
  }
});

app.get("/ventas/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const ventaQuery = `
      SELECT
        v.id,
        v.tipo,
        v.cliente_id,
        c.nombre AS cliente_nombre,
        v.origen,
        v.orden_id,
        v.subtotal,
        v.descuento,
        v.impuestos,
        v.total,
        v.forma_pago,
        v.estado,
        v.fecha,
        cb.id AS comprobante_id,
        cb.numero AS comprobante_numero,
        cb.cae,
        cb.cae_vto,
        cb.fecha_emision
      FROM ${schema}.ventas v
      LEFT JOIN ${schema}.clientes c ON c.id = v.cliente_id
      LEFT JOIN ${schema}.comprobantes cb ON cb.venta_id = v.id
      WHERE v.id = $1
    `;
    const ventaResult = await pool.query(ventaQuery, [id]);

    if (!ventaResult.rowCount) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    const itemsQuery = `
      SELECT id, venta_id, tipo_item, producto_id, descripcion, cantidad, precio_unitario, subtotal
      FROM ${schema}.venta_items
      WHERE venta_id = $1
      ORDER BY id ASC
    `;
    const itemsResult = await pool.query(itemsQuery, [id]);

    res.json({
      ...ventaResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener venta", message: error.message });
  }
});

app.post("/ventas", async (req, res) => {
  try {
    const body = ventaCreateSchema.parse(req.body);

    const subtotalCalculado = body.items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
    const total = subtotalCalculado - body.descuento + body.impuestos;

    if (total < 0) {
      return res.status(400).json({ error: "Total invalido" });
    }

    const montoPagado = body.monto_pagado ?? total;
    if (montoPagado > total) {
      return res.status(400).json({ error: "monto_pagado no puede ser mayor al total" });
    }

    const saldoPendiente = total - montoPagado;

    let clienteIdFinal = body.cliente_id ?? null;

    const venta = await withClient(async (client) => {
      await client.query("BEGIN");

      try {
        if (body.origen === "orden") {
          const ordenCheck = await client.query(`SELECT id, cliente_id FROM ${schema}.ordenes_reparacion WHERE id = $1`, [body.orden_id]);
          if (!ordenCheck.rowCount) {
            await client.query("ROLLBACK");
            return { error: { code: 404, message: "Orden no encontrada" } };
          }

          const clienteOrdenId = Number(ordenCheck.rows[0].cliente_id);

          if (body.cliente_id && clienteOrdenId !== body.cliente_id) {
            await client.query("ROLLBACK");
            return { error: { code: 400, message: "cliente_id no coincide con la orden" } };
          }

          if (!body.cliente_id) {
            clienteIdFinal = clienteOrdenId;
          }
        }

        if (!clienteIdFinal && saldoPendiente > 0) {
          await client.query("ROLLBACK");
          return { error: { code: 400, message: "No se puede generar saldo pendiente sin cliente" } };
        }

        const insertVentaQuery = `
          INSERT INTO ${schema}.ventas (
            tipo,
            cliente_id,
            origen,
            orden_id,
            subtotal,
            descuento,
            impuestos,
            total,
            forma_pago,
            estado
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmada')
          RETURNING id, tipo, cliente_id, origen, orden_id, subtotal, descuento, impuestos, total, forma_pago, estado, fecha
        `;

        const ventaResult = await client.query(insertVentaQuery, [
          body.tipo,
          clienteIdFinal,
          body.origen,
          body.orden_id ?? null,
          subtotalCalculado,
          body.descuento,
          body.impuestos,
          total,
          body.forma_pago
        ]);

        const ventaCreada = ventaResult.rows[0];

        for (const item of body.items) {
          let descripcion = toNullable(item.descripcion);

          if (item.producto_id) {
            const productoResult = await client.query(
              `SELECT id, nombre, stock_actual, activo FROM ${schema}.productos WHERE id = $1 FOR UPDATE`,
              [item.producto_id]
            );

            if (!productoResult.rowCount || !productoResult.rows[0].activo) {
              await client.query("ROLLBACK");
              return { error: { code: 400, message: `Producto ${item.producto_id} no existe o esta inactivo` } };
            }

            const producto = productoResult.rows[0];
            if (!descripcion) {
              descripcion = producto.nombre;
            }

            if (["producto", "repuesto"].includes(item.tipo_item)) {
              const stockDisponible = Number(producto.stock_actual);
              if (stockDisponible < item.cantidad) {
                await client.query("ROLLBACK");
                return {
                  error: { code: 400, message: `Stock insuficiente para producto ${item.producto_id}. Disponible: ${stockDisponible}` }
                };
              }

              await client.query(`UPDATE ${schema}.productos SET stock_actual = stock_actual - $1 WHERE id = $2`, [
                item.cantidad,
                item.producto_id
              ]);

              await client.query(
                `
                  INSERT INTO ${schema}.stock_movimientos (producto_id, tipo, cantidad, origen, referencia_id, observaciones)
                  VALUES ($1, 'egreso', $2, $3, $4, $5)
                `,
                [
                  item.producto_id,
                  item.cantidad,
                  body.origen === "orden" ? "reparacion" : "venta",
                  ventaCreada.id,
                  `Salida por venta ${ventaCreada.id}`
                ]
              );
            }
          }

          const itemSubtotal = item.cantidad * item.precio_unitario;
          await client.query(
            `
              INSERT INTO ${schema}.venta_items (venta_id, tipo_item, producto_id, descripcion, cantidad, precio_unitario, subtotal)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [ventaCreada.id, item.tipo_item, item.producto_id ?? null, descripcion, item.cantidad, item.precio_unitario, itemSubtotal]
          );
        }

        if (clienteIdFinal && saldoPendiente > 0) {
          await client.query(
            `
              INSERT INTO ${schema}.cuenta_corriente_movimientos (cliente_id, tipo, origen, referencia_id, descripcion, monto)
              VALUES ($1, 'debe', 'venta', $2, $3, $4)
            `,
            [clienteIdFinal, ventaCreada.id, `Saldo pendiente venta ${ventaCreada.id}`, saldoPendiente]
          );
        }

        const numeroComprobante = await nextComprobanteNumber(client, body.tipo);
        const comprobanteResult = await client.query(
          `
            INSERT INTO ${schema}.comprobantes (venta_id, tipo, numero, cae, cae_vto, raw_respuesta_afip)
            VALUES ($1, $2, $3, NULL, NULL, NULL)
            RETURNING id, venta_id, tipo, numero, cae, cae_vto, fecha_emision
          `,
          [ventaCreada.id, body.tipo, numeroComprobante]
        );

        await client.query("COMMIT");

        return {
          ...ventaCreada,
          comprobante: comprobanteResult.rows[0],
          saldo_pendiente: saldoPendiente
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });

    if (venta.error) {
      return res.status(venta.error.code).json({ error: venta.error.message });
    }

    res.status(201).json(venta);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23503") {
      return res.status(400).json({ error: "Cliente, orden o producto no existe" });
    }

    res.status(500).json({ error: "Error al crear venta", message: error.message });
  }
});

app.get("/ordenes-reparacion", async (req, res) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const estado = req.query.estado ? req.query.estado.toString().trim() : "";
    const prioridad = req.query.prioridad ? req.query.prioridad.toString().trim() : "";
    const soloDemoradas = req.query.demorada === "true";

    const filters = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const index = params.length;
      filters.push(
        `(
          o.equipo ILIKE $${index}
          OR COALESCE(o.marca, '') ILIKE $${index}
          OR COALESCE(o.modelo, '') ILIKE $${index}
          OR c.nombre ILIKE $${index}
          OR c.documento ILIKE $${index}
          OR CAST(o.nro_orden AS TEXT) ILIKE $${index}
        )`
      );
    }

    if (estado) {
      if (!ORDEN_ESTADOS.includes(estado)) {
        return res.status(400).json({ error: "Estado invalido" });
      }
      params.push(estado);
      filters.push(`o.estado_actual = $${params.length}`);
    }

    if (prioridad) {
      if (!ORDEN_PRIORIDADES.includes(prioridad)) {
        return res.status(400).json({ error: "Prioridad invalida" });
      }
      params.push(prioridad);
      filters.push(`o.prioridad = $${params.length}`);
    }

    if (soloDemoradas) {
      filters.push(
        "o.fecha_estimada_entrega IS NOT NULL AND o.fecha_estimada_entrega < NOW() AND o.estado_actual NOT IN ('entregada', 'cancelada')"
      );
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const query = `
      SELECT
        o.id,
        o.nro_orden,
        o.cliente_id,
        c.nombre AS cliente_nombre,
        o.equipo,
        o.marca,
        o.modelo,
        o.contrasena_equipo,
        o.estado_actual,
        o.prioridad,
        o.fecha_creacion,
        o.fecha_estimada_entrega,
        o.fecha_cierre,
        (o.fecha_estimada_entrega IS NOT NULL AND o.fecha_estimada_entrega < NOW() AND o.estado_actual NOT IN ('entregada', 'cancelada')) AS demorada
      FROM ${schema}.ordenes_reparacion o
      JOIN ${schema}.clientes c ON c.id = o.cliente_id
      ${where}
      ORDER BY o.fecha_creacion DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar ordenes", message: error.message });
  }
});

app.get("/ordenes-reparacion/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const ordenQuery = `
      SELECT
        o.id,
        o.nro_orden,
        o.cliente_id,
        c.nombre AS cliente_nombre,
        c.telefono AS cliente_telefono,
        c.documento AS cliente_documento,
        o.equipo,
        o.marca,
        o.modelo,
        o.contrasena_equipo,
        o.diagnostico_inicial,
        o.trajo_cargador,
        o.observaciones,
        o.estado_actual,
        o.prioridad,
        o.fecha_creacion,
        o.fecha_estimada_entrega,
        o.fecha_cierre,
        o.created_by,
        (o.fecha_estimada_entrega IS NOT NULL AND o.fecha_estimada_entrega < NOW() AND o.estado_actual NOT IN ('entregada', 'cancelada')) AS demorada
      FROM ${schema}.ordenes_reparacion o
      JOIN ${schema}.clientes c ON c.id = o.cliente_id
      WHERE o.id = $1
    `;

    const ordenResult = await pool.query(ordenQuery, [id]);
    if (!ordenResult.rowCount) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const movimientosQuery = `
      SELECT id, orden_id, estado, detalle, usuario_id, fecha
      FROM ${schema}.ordenes_movimientos
      WHERE orden_id = $1
      ORDER BY fecha ASC, id ASC
    `;
    const movimientosResult = await pool.query(movimientosQuery, [id]);

    res.json({
      ...ordenResult.rows[0],
      movimientos: movimientosResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener orden", message: error.message });
  }
});

app.post("/ordenes-reparacion", async (req, res) => {
  try {
    const body = ordenCreateSchema.parse(req.body);

    const orden = await withClient(async (client) => {
      await client.query("BEGIN");

      try {
        const insertOrdenQuery = `
          INSERT INTO ${schema}.ordenes_reparacion (
            cliente_id,
            equipo,
            marca,
            modelo,
            contrasena_equipo,
            diagnostico_inicial,
            trajo_cargador,
            observaciones,
            estado_actual,
            prioridad,
            fecha_estimada_entrega,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING
            id,
            nro_orden,
            cliente_id,
            equipo,
            marca,
            modelo,
            contrasena_equipo,
            diagnostico_inicial,
            trajo_cargador,
            observaciones,
            estado_actual,
            prioridad,
            fecha_creacion,
            fecha_estimada_entrega,
            fecha_cierre,
            created_by
        `;

        const ordenResult = await client.query(insertOrdenQuery, [
          body.cliente_id,
          body.equipo,
          toNullable(body.marca),
          toNullable(body.modelo),
          toNullable(body.contrasena_equipo),
          body.diagnostico_inicial,
          body.trajo_cargador,
          toNullable(body.observaciones),
          body.estado_actual,
          body.prioridad,
          body.fecha_estimada_entrega,
          body.created_by ?? null
        ]);

        const ordenCreada = ordenResult.rows[0];

        const insertMovimientoQuery = `
          INSERT INTO ${schema}.ordenes_movimientos (orden_id, estado, detalle, usuario_id)
          VALUES ($1, $2, $3, $4)
        `;
        await client.query(insertMovimientoQuery, [
          ordenCreada.id,
          ordenCreada.estado_actual,
          "Orden creada",
          ordenCreada.created_by
        ]);

        await client.query("COMMIT");
        return ordenCreada;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });

    res.status(201).json(orden);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23503") {
      return res.status(400).json({ error: "Cliente o usuario no existe" });
    }

    res.status(500).json({ error: "Error al crear orden", message: error.message });
  }
});

app.put("/ordenes-reparacion/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = ordenUpdateSchema.parse(req.body);

    const fields = ["estado_actual", "prioridad", "fecha_estimada_entrega"];

    const sets = [];
    const values = [];

    for (const field of fields) {
      if (field in body) {
        values.push(body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }

    values.push(id);
    const query = `
      UPDATE ${schema}.ordenes_reparacion
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING
        id,
        nro_orden,
        cliente_id,
        equipo,
        marca,
        modelo,
        contrasena_equipo,
        diagnostico_inicial,
        trajo_cargador,
        observaciones,
        estado_actual,
        prioridad,
        fecha_creacion,
        fecha_estimada_entrega,
        fecha_cierre,
        created_by
    `;

    const result = await pool.query(query, values);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23503") {
      return res.status(400).json({ error: "Cliente no existe" });
    }

    res.status(500).json({ error: "Error al actualizar orden", message: error.message });
  }
});

app.get("/ordenes-reparacion/:id/movimientos", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const ordenResult = await pool.query(`SELECT id FROM ${schema}.ordenes_reparacion WHERE id = $1`, [id]);
    if (!ordenResult.rowCount) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const query = `
      SELECT id, orden_id, estado, detalle, usuario_id, fecha
      FROM ${schema}.ordenes_movimientos
      WHERE orden_id = $1
      ORDER BY fecha ASC, id ASC
    `;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar movimientos", message: error.message });
  }
});

app.post("/ordenes-reparacion/:id/movimientos", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = ordenMovimientoSchema.parse(req.body);

    const movimiento = await withClient(async (client) => {
      await client.query("BEGIN");

      try {
        const ordenResult = await client.query(
          `SELECT id, prioridad FROM ${schema}.ordenes_reparacion WHERE id = $1 FOR UPDATE`,
          [id]
        );
        if (!ordenResult.rowCount) {
          await client.query("ROLLBACK");
          return null;
        }

        const updateFields = ["estado_actual = $1"];
        const updateValues = [body.estado];

        if (body.prioridad) {
          updateValues.push(body.prioridad);
          updateFields.push(`prioridad = $${updateValues.length}`);
        }

        if (body.estado === "entregada" || body.estado === "cancelada") {
          updateFields.push("fecha_cierre = NOW()");
        }

        updateValues.push(id);
        await client.query(
          `UPDATE ${schema}.ordenes_reparacion SET ${updateFields.join(", ")} WHERE id = $${updateValues.length}`,
          updateValues
        );

        const insertQuery = `
          INSERT INTO ${schema}.ordenes_movimientos (orden_id, estado, detalle, usuario_id)
          VALUES ($1, $2, $3, $4)
          RETURNING id, orden_id, estado, detalle, usuario_id, fecha
        `;
        const movimientoResult = await client.query(insertQuery, [id, body.estado, body.detalle, body.usuario_id ?? null]);

        await client.query("COMMIT");
        return movimientoResult.rows[0];
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });

    if (!movimiento) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    res.status(201).json(movimiento);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23503") {
      return res.status(400).json({ error: "Usuario no existe" });
    }

    res.status(500).json({ error: "Error al crear movimiento", message: error.message });
  }
});

app.get("/marcas", async (req, res) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const includeInactive = req.query.includeInactive === "true";

    const filters = [];
    const params = [];

    if (!includeInactive) {
      filters.push("activo = true");
    }

    if (search) {
      params.push(`%${search}%`);
      const index = params.length;
      filters.push(`nombre ILIKE $${index}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT id, nombre, activo, created_at
      FROM ${schema}.marcas
      ${where}
      ORDER BY nombre ASC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar marcas", message: error.message });
  }
});

app.post("/marcas", async (req, res) => {
  try {
    const body = marcaCreateSchema.parse(req.body);
    const query = `
      INSERT INTO ${schema}.marcas (nombre)
      VALUES ($1)
      RETURNING id, nombre, activo, created_at
    `;

    const result = await pool.query(query, [body.nombre]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23505") {
      return res.status(400).json({ error: "La marca ya existe" });
    }

    res.status(500).json({ error: "Error al crear marca", message: error.message });
  }
});

app.put("/marcas/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = marcaUpdateSchema.parse(req.body);
    const fields = ["nombre"];

    const sets = [];
    const values = [];
    for (const field of fields) {
      if (field in body) {
        values.push(body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }

    values.push(id);
    const query = `
      UPDATE ${schema}.marcas
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, nombre, activo, created_at
    `;

    const result = await pool.query(query, values);
    if (!result.rowCount) {
      return res.status(404).json({ error: "Marca no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23505") {
      return res.status(400).json({ error: "La marca ya existe" });
    }

    res.status(500).json({ error: "Error al actualizar marca", message: error.message });
  }
});

app.delete("/marcas/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      UPDATE ${schema}.marcas
      SET activo = false
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Marca no encontrada" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar marca", message: error.message });
  }
});

app.get("/dispositivos", async (req, res) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const includeInactive = req.query.includeInactive === "true";

    const filters = [];
    const params = [];

    if (!includeInactive) {
      filters.push("activo = true");
    }

    if (search) {
      params.push(`%${search}%`);
      const index = params.length;
      filters.push(`nombre ILIKE $${index}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT id, nombre, activo, created_at
      FROM ${schema}.dispositivos
      ${where}
      ORDER BY nombre ASC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar dispositivos", message: error.message });
  }
});

app.post("/dispositivos", async (req, res) => {
  try {
    const body = dispositivoCreateSchema.parse(req.body);
    const query = `
      INSERT INTO ${schema}.dispositivos (nombre)
      VALUES ($1)
      RETURNING id, nombre, activo, created_at
    `;

    const result = await pool.query(query, [body.nombre]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23505") {
      return res.status(400).json({ error: "El dispositivo ya existe" });
    }

    res.status(500).json({ error: "Error al crear dispositivo", message: error.message });
  }
});

app.put("/dispositivos/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = dispositivoUpdateSchema.parse(req.body);
    const fields = ["nombre"];

    const sets = [];
    const values = [];
    for (const field of fields) {
      if (field in body) {
        values.push(body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }

    values.push(id);
    const query = `
      UPDATE ${schema}.dispositivos
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, nombre, activo, created_at
    `;

    const result = await pool.query(query, values);
    if (!result.rowCount) {
      return res.status(404).json({ error: "Dispositivo no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23505") {
      return res.status(400).json({ error: "El dispositivo ya existe" });
    }

    res.status(500).json({ error: "Error al actualizar dispositivo", message: error.message });
  }
});

app.delete("/dispositivos/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      UPDATE ${schema}.dispositivos
      SET activo = false
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Dispositivo no encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar dispositivo", message: error.message });
  }
});

app.get("/reportes/ordenes-por-marca", async (_req, res) => {
  try {
    const query = `
      SELECT
        COALESCE(NULLIF(TRIM(marca), ''), 'Sin marca') AS marca,
        COUNT(*)::INT AS cantidad
      FROM ${schema}.ordenes_reparacion
      GROUP BY 1
      ORDER BY cantidad DESC, marca ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al generar reporte", message: error.message });
  }
});

app.get("/usuarios", async (req, res) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const includeInactive = req.query.includeInactive === "true";

    const filters = [];
    const params = [];

    if (!includeInactive) {
      filters.push("activo = true");
    }

    if (search) {
      params.push(`%${search}%`);
      const index = params.length;
      filters.push(`(nombre ILIKE $${index} OR email ILIKE $${index})`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT id, nombre, email, rol, activo, created_at
      FROM ${schema}.usuarios
      ${where}
      ORDER BY id DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar usuarios", message: error.message });
  }
});

app.post("/usuarios", async (req, res) => {
  try {
    const body = usuarioCreateSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);

    const query = `
      INSERT INTO ${schema}.usuarios (nombre, email, password_hash, rol)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nombre, email, rol, activo, created_at
    `;

    const result = await pool.query(query, [body.nombre, body.email, passwordHash, body.rol]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23505") {
      return res.status(400).json({ error: "El email ya existe" });
    }

    res.status(500).json({ error: "Error al crear usuario", message: error.message });
  }
});

app.put("/usuarios/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = usuarioUpdateSchema.parse(req.body);

    const sets = [];
    const values = [];

    if ("nombre" in body) {
      values.push(body.nombre);
      sets.push(`nombre = $${values.length}`);
    }

    if ("email" in body) {
      values.push(body.email);
      sets.push(`email = $${values.length}`);
    }

    if ("rol" in body) {
      values.push(body.rol);
      sets.push(`rol = $${values.length}`);
    }

    if ("password" in body) {
      const passwordHash = await bcrypt.hash(body.password, 10);
      values.push(passwordHash);
      sets.push(`password_hash = $${values.length}`);
    }

    values.push(id);
    const query = `
      UPDATE ${schema}.usuarios
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, nombre, email, rol, activo, created_at
    `;

    const result = await pool.query(query, values);
    if (!result.rowCount) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    if (error.code === "23505") {
      return res.status(400).json({ error: "El email ya existe" });
    }

    res.status(500).json({ error: "Error al actualizar usuario", message: error.message });
  }
});

app.delete("/usuarios/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      UPDATE ${schema}.usuarios
      SET activo = false
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar usuario", message: error.message });
  }
});

app.get("/gastos", async (req, res) => {
  try {
    const search = (req.query.search || "").toString().trim();

    const filters = ["activo = true"];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const index = params.length;
      filters.push(`(concepto ILIKE $${index} OR COALESCE(categoria, '') ILIKE $${index})`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT id, concepto, categoria, monto, fecha, observaciones, activo, created_at
      FROM ${schema}.gastos
      ${where}
      ORDER BY fecha DESC, id DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar gastos", message: error.message });
  }
});

app.post("/gastos", async (req, res) => {
  try {
    const body = gastoCreateSchema.parse(req.body);
    const query = `
      INSERT INTO ${schema}.gastos (concepto, categoria, monto, fecha, observaciones)
      VALUES ($1, $2, $3, COALESCE($4, NOW()), $5)
      RETURNING id, concepto, categoria, monto, fecha, observaciones, activo, created_at
    `;

    const result = await pool.query(query, [
      body.concepto,
      toNullable(body.categoria),
      body.monto,
      body.fecha,
      toNullable(body.observaciones)
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }
    res.status(500).json({ error: "Error al crear gasto", message: error.message });
  }
});

app.put("/gastos/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = gastoUpdateSchema.parse(req.body);
    const fields = ["concepto", "categoria", "monto", "fecha", "observaciones"];

    const sets = [];
    const values = [];
    for (const field of fields) {
      if (field in body) {
        if (["categoria", "observaciones"].includes(field)) {
          values.push(toNullable(body[field]));
        } else {
          values.push(body[field]);
        }
        sets.push(`${field} = $${values.length}`);
      }
    }

    values.push(id);
    const query = `
      UPDATE ${schema}.gastos
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, concepto, categoria, monto, fecha, observaciones, activo, created_at
    `;

    const result = await pool.query(query, values);
    if (!result.rowCount) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    res.status(500).json({ error: "Error al actualizar gasto", message: error.message });
  }
});

app.delete("/gastos/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      UPDATE ${schema}.gastos
      SET activo = false
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar gasto", message: error.message });
  }
});

app.get("/programar-tareas", async (req, res) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const prioridad = req.query.prioridad ? req.query.prioridad.toString().trim() : "";
    const estado = req.query.estado ? req.query.estado.toString().trim() : "";

    const filters = ["activo = true"];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const index = params.length;
      filters.push(`(descripcion ILIKE $${index} OR COALESCE(categoria, '') ILIKE $${index})`);
    }

    if (prioridad) {
      if (!TAREA_PRIORIDADES.includes(prioridad)) {
        return res.status(400).json({ error: "Prioridad invalida" });
      }
      params.push(prioridad);
      filters.push(`prioridad = $${params.length}`);
    }

    if (estado) {
      if (!TAREA_FILTROS_ESTADO.includes(estado)) {
        return res.status(400).json({ error: "Filtro de estado invalido" });
      }

      if (estado === "vencidas") {
        filters.push("completada = false AND fecha_vencimiento < NOW()");
      } else if (estado === "pendientes") {
        filters.push("completada = false AND fecha_vencimiento >= NOW()");
      } else if (estado === "completadas") {
        filters.push("completada = true");
      } else if (estado === "proximas") {
        filters.push("completada = false AND fecha_vencimiento >= NOW() AND fecha_vencimiento <= NOW() + INTERVAL '7 days'");
      }
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT id, descripcion, fecha_vencimiento, prioridad, categoria, completada, fecha_completada, activo, created_at
      FROM ${schema}.programar_tareas
      ${where}
      ORDER BY fecha_vencimiento ASC, id DESC
    `;

    const result = await pool.query(query, params);
    const now = Date.now();

    res.json(
      result.rows.map((row) => ({
        ...row,
        vencida: !row.completada && new Date(row.fecha_vencimiento).getTime() < now
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Error al listar tareas", message: error.message });
  }
});

app.post("/programar-tareas", async (req, res) => {
  try {
    const body = tareaCreateSchema.parse(req.body);
    const query = `
      INSERT INTO ${schema}.programar_tareas (descripcion, fecha_vencimiento, prioridad, categoria)
      VALUES ($1, $2, $3, $4)
      RETURNING id, descripcion, fecha_vencimiento, prioridad, categoria, completada, fecha_completada, activo, created_at
    `;

    const result = await pool.query(query, [body.descripcion, body.fecha_vencimiento, body.prioridad, toNullable(body.categoria)]);
    const tarea = result.rows[0];

    res.status(201).json({
      ...tarea,
      vencida: !tarea.completada && new Date(tarea.fecha_vencimiento).getTime() < Date.now()
    });
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }
    res.status(500).json({ error: "Error al crear tarea", message: error.message });
  }
});

app.put("/programar-tareas/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = tareaUpdateSchema.parse(req.body);
    const fields = ["descripcion", "fecha_vencimiento", "prioridad", "categoria", "completada"];

    const sets = [];
    const values = [];
    for (const field of fields) {
      if (field in body) {
        values.push(field === "categoria" ? toNullable(body[field]) : body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }

    if ("completada" in body) {
      sets.push(`fecha_completada = ${body.completada ? "NOW()" : "NULL"}`);
    }

    values.push(id);
    const query = `
      UPDATE ${schema}.programar_tareas
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, descripcion, fecha_vencimiento, prioridad, categoria, completada, fecha_completada, activo, created_at
    `;

    const result = await pool.query(query, values);
    if (!result.rowCount) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    const tarea = result.rows[0];
    res.json({
      ...tarea,
      vencida: new Date(tarea.fecha_vencimiento).getTime() < Date.now()
    });
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    res.status(500).json({ error: "Error al actualizar tarea", message: error.message });
  }
});

app.delete("/programar-tareas/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      UPDATE ${schema}.programar_tareas
      SET activo = false
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar tarea", message: error.message });
  }
});

app.get("/clientes", async (req, res) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const includeInactive = req.query.includeInactive === "true";

    const filters = [];
    const params = [];

    if (!includeInactive) {
      filters.push("activo = true");
    }

    if (search) {
      params.push(`%${search}%`);
      const index = params.length;
      filters.push(`(nombre ILIKE $${index} OR telefono ILIKE $${index} OR documento ILIKE $${index})`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT id, nombre, telefono, email, documento, direccion, observaciones, activo, created_at
      FROM ${schema}.clientes
      ${where}
      ORDER BY id DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar clientes", message: error.message });
  }
});

app.get("/clientes/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      SELECT id, nombre, telefono, email, documento, direccion, observaciones, activo, created_at
      FROM ${schema}.clientes
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener cliente", message: error.message });
  }
});

app.post("/clientes", async (req, res) => {
  try {
    const body = clienteCreateSchema.parse(req.body);
    const query = `
      INSERT INTO ${schema}.clientes (nombre, telefono, email, documento, direccion, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nombre, telefono, email, documento, direccion, observaciones, activo, created_at
    `;

    const result = await pool.query(query, [
      body.nombre,
      toNullable(body.telefono),
      toNullable(body.email),
      toNullable(body.documento),
      toNullable(body.direccion),
      toNullable(body.observaciones)
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }
    res.status(500).json({ error: "Error al crear cliente", message: error.message });
  }
});

app.put("/clientes/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = clienteUpdateSchema.parse(req.body);
    const fields = ["nombre", "telefono", "email", "documento", "direccion", "observaciones"];

    const sets = [];
    const values = [];
    for (const field of fields) {
      if (field in body) {
        values.push(field === "nombre" ? body[field] : toNullable(body[field]));
        sets.push(`${field} = $${values.length}`);
      }
    }

    values.push(id);
    const query = `
      UPDATE ${schema}.clientes
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, nombre, telefono, email, documento, direccion, observaciones, activo, created_at
    `;

    const result = await pool.query(query, values);
    if (!result.rowCount) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }
    res.status(500).json({ error: "Error al actualizar cliente", message: error.message });
  }
});

app.delete("/clientes/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      UPDATE ${schema}.clientes
      SET activo = false
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar cliente", message: error.message });
  }
});

app.get("/productos", async (req, res) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const includeInactive = req.query.includeInactive === "true";

    const filters = [];
    const params = [];

    if (!includeInactive) {
      filters.push("activo = true");
    }

    if (search) {
      params.push(`%${search}%`);
      const index = params.length;
      filters.push(`(nombre ILIKE $${index} OR codigo ILIKE $${index})`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT id, codigo, nombre, descripcion, costo, precio, stock_actual, activo, created_at
      FROM ${schema}.productos
      ${where}
      ORDER BY id DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al listar productos", message: error.message });
  }
});

app.get("/productos/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      SELECT id, codigo, nombre, descripcion, costo, precio, stock_actual, activo, created_at
      FROM ${schema}.productos
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener producto", message: error.message });
  }
});

app.post("/productos", async (req, res) => {
  try {
    const body = productoCreateSchema.parse(req.body);
    const query = `
      INSERT INTO ${schema}.productos (codigo, nombre, descripcion, costo, precio, stock_actual)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, codigo, nombre, descripcion, costo, precio, stock_actual, activo, created_at
    `;

    const result = await pool.query(query, [
      toNullable(body.codigo),
      body.nombre,
      toNullable(body.descripcion),
      body.costo,
      body.precio,
      body.stock_actual
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }
    res.status(500).json({ error: "Error al crear producto", message: error.message });
  }
});

app.put("/productos/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const body = productoUpdateSchema.parse(req.body);
    const fields = ["codigo", "nombre", "descripcion", "costo", "precio", "stock_actual"];

    const sets = [];
    const values = [];
    for (const field of fields) {
      if (field in body) {
        if (field === "codigo" || field === "descripcion") {
          values.push(toNullable(body[field]));
        } else {
          values.push(body[field]);
        }
        sets.push(`${field} = $${values.length}`);
      }
    }

    values.push(id);
    const query = `
      UPDATE ${schema}.productos
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, codigo, nombre, descripcion, costo, precio, stock_actual, activo, created_at
    `;

    const result = await pool.query(query, values);
    if (!result.rowCount) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }
    res.status(500).json({ error: "Error al actualizar producto", message: error.message });
  }
});

app.delete("/productos/:id", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      UPDATE ${schema}.productos
      SET activo = false
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar producto", message: error.message });
  }
});

const startServer = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.marcas (
      id BIGSERIAL PRIMARY KEY,
      nombre VARCHAR(80) NOT NULL UNIQUE,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.dispositivos (
      id BIGSERIAL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL UNIQUE,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.gastos (
      id BIGSERIAL PRIMARY KEY,
      concepto VARCHAR(180) NOT NULL,
      categoria VARCHAR(80),
      monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
      fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      observaciones TEXT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    ALTER TABLE ${schema}.programar_tareas
    ADD COLUMN IF NOT EXISTS completada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMPTZ
  `);

  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
};

startServer().catch((error) => {
  console.error("Error al iniciar API:", error.message);
  process.exit(1);
});
