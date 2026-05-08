import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import Afip from "@afipsdk/afip.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { X509Certificate } from "crypto";
import { config } from "./config.js";
import { pool, withClient } from "./db.js";
import { AfipSoapService } from "./afipService.js";
import { z } from "zod";

const app = express();
const schema = config.db.schema;
const CLIENTE_CONDICIONES_IVA = ["consumidor_final", "inscripto", "exento"];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workshopLogoDataUri = (() => {
  try {
    const logoPath = path.resolve(__dirname, "../../frontend/assets/logo.jpeg");
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/jpeg;base64,${logoBuffer.toString("base64")}`;
  } catch {
    return "";
  }
})();

const clienteCreateSchema = z.object({
  nombre: z.string().trim().min(1),
  telefono: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  documento: z.string().trim().max(40).optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  ciudad: z.string().trim().max(120).optional().nullable(),
  provincia: z.string().trim().max(120).optional().nullable(),
  cuit: z.string().trim().max(20).optional().nullable(),
  condicion_iva: z.enum(CLIENTE_CONDICIONES_IVA).optional().default("consumidor_final"),
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

const smtpTestSchema = z.object({
  to: z.string().trim().email().max(120).optional(),
  subject: z.string().trim().max(180).optional(),
  message: z.string().trim().max(3000).optional()
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
  estado: z.enum(ORDEN_ESTADOS).optional(),
  detalle: z.string().trim().min(1),
  precio: z.coerce.number().min(0).optional().default(0),
  usuario_id: z.coerce.number().int().positive().optional().nullable(),
  prioridad: z.enum(ORDEN_PRIORIDADES).optional()
});

const VENTA_TIPOS = ["afip", "local"];
const VENTA_ORIGENES = ["orden", "mostrador"];
const FORMA_PAGO = ["efectivo", "transferencia", "tarjeta", "mixto"];
const VENTA_ITEM_TIPOS = ["producto", "servicio", "repuesto"];
const AFIP_TIPOS_COMPROBANTE = ["A", "B"];
const AFIP_CBTE_TIPO_BY_LETTER = {
  A: 1,
  B: 6
};

const getAfipSoapService = () => {
  if (!config.afip.enabled) {
    return null;
  }

  if (afipSoapService) {
    return afipSoapService;
  }

  if (afipSoapServiceInitError) {
    throw afipSoapServiceInitError;
  }

  const cuit = Number(config.afip.cuit);
  if (!Number.isInteger(cuit) || cuit <= 0) {
    afipSoapServiceInitError = new Error("AFIP_CUIT invalido");
    throw afipSoapServiceInitError;
  }

  try {
    afipSoapService = new AfipSoapService({
      cuit,
      production: config.afip.production,
      certPath: resolveAfipFilePath(config.afip.certPath),
      keyPath: resolveAfipFilePath(config.afip.keyPath)
    });
    return afipSoapService;
  } catch (error) {
    afipSoapServiceInitError = new Error(`No se pudo inicializar AFIP SOAP: ${error.message}`);
    throw afipSoapServiceInitError;
  }
};
const AFIP_IVA_ALICUOTAS = [10.5, 21];
const AFIP_IVA_CONFIG_BY_RATE = {
  "10.5": { id: 4, rate: 10.5 },
  "21": { id: 5, rate: 21 }
};

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
    afip_tipo_comprobante: z.enum(AFIP_TIPOS_COMPROBANTE).optional().nullable(),
    afip_iva_alicuota: z.coerce.number().optional().nullable(),
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

    if (data.tipo === "afip" && !data.afip_tipo_comprobante) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["afip_tipo_comprobante"],
        message: "afip_tipo_comprobante es obligatorio cuando tipo es 'afip'"
      });
    }

    if (data.tipo === "afip") {
      if (data.afip_iva_alicuota === undefined || data.afip_iva_alicuota === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["afip_iva_alicuota"],
          message: "afip_iva_alicuota es obligatorio cuando tipo es 'afip'"
        });
      } else if (!AFIP_IVA_ALICUOTAS.includes(Number(data.afip_iva_alicuota))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["afip_iva_alicuota"],
          message: "afip_iva_alicuota debe ser 10.5 o 21"
        });
      }
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

const MONEY_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

let smtpTransporter = null;
let afipClient = null;
let afipClientInitError = null;
let afipSoapService = null;
let afipSoapServiceInitError = null;

const resolveAfipFilePath = (filePath) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, "..", filePath);

const normalizeDigits = (value) => String(value ?? "").replace(/\D/g, "");

const createTraceId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const safeString = (value, max = 120) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const maskDocument = (value) => {
  const digits = normalizeDigits(value);
  if (!digits) {
    return "";
  }
  if (digits.length <= 4) {
    return digits;
  }
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const logVentaTrace = (traceId, step, data = null) => {
  const prefix = `[ventas][trace:${traceId}] ${step}`;
  if (data === null || data === undefined) {
    console.info(prefix);
    return;
  }
  console.info(prefix, data);
};

const logVentaTraceError = (traceId, step, error) => {
  const payload = {
    message: error?.message || "error desconocido",
    status: error?.response?.status || null,
    statusText: error?.response?.statusText || null,
    data: error?.response?.data || null
  };
  console.error(`[ventas][trace:${traceId}] ${step}`, payload);
};

const formatAfipDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return Number(`${year}${month}${day}`);
};

const parseAfipDate = (value) => {
  const raw = String(value ?? "");
  if (!/^\d{8}$/.test(raw)) {
    return null;
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const formatAfipErrorData = (data) => {
  if (data === undefined || data === null) {
    return "";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object") {
    const knownMessage =
      data.error ||
      data.message ||
      data?.Errors?.[0]?.Msg ||
      data?.errors?.[0]?.message ||
      data?.detail;

    if (knownMessage) {
      return String(knownMessage);
    }

    try {
      return JSON.stringify(data);
    } catch {
      return "";
    }
  }

  return String(data);
};

const buildAfipRequestError = (error, stage) => {
  const status = error?.response?.status;
  const statusText = error?.response?.statusText;
  const details = formatAfipErrorData(error?.response?.data);

  if (status) {
    const statusLabel = statusText ? `${status} ${statusText}` : String(status);
    if (status === 401) {
      const environment = config.afip.production ? "produccion" : "homologacion";
      return new Error(
        `AFIP ${stage}: HTTP ${statusLabel}${details ? ` - ${details}` : ""}. Verifique autenticacion WSAA (${environment}): AFIP_CUIT emisor, par certificado/clave, relacion del servicio WSFEv1 en AFIP y hora del servidor`
      );
    }

    return new Error(`AFIP ${stage}: HTTP ${statusLabel}${details ? ` - ${details}` : ""}`);
  }

  return new Error(`AFIP ${stage}: ${error?.message || "error desconocido"}`);
};

const resolveAfipIvaConfig = (alicuota) => {
  const normalized = Number(alicuota);
  if (!Number.isFinite(normalized)) {
    return null;
  }

  return AFIP_IVA_CONFIG_BY_RATE[normalized.toString()] || null;
};

const resolveAfipDocument = (cliente) => {
  const cuit = normalizeDigits(cliente?.cuit);
  if (cuit.length === 11) {
    return { DocTipo: 80, DocNro: Number(cuit) };
  }

  const documento = normalizeDigits(cliente?.documento);
  if (documento.length >= 7 && documento.length <= 8) {
    return { DocTipo: 96, DocNro: Number(documento) };
  }

  return { DocTipo: 99, DocNro: 0 };
};

const resolveAfipCbteTipoCode = (afipTipoComprobante) => {
  if (afipTipoComprobante && AFIP_CBTE_TIPO_BY_LETTER[afipTipoComprobante]) {
    return AFIP_CBTE_TIPO_BY_LETTER[afipTipoComprobante];
  }
  return config.afip.cbteTipo;
};

const maskCuit = (value) => {
  const digits = normalizeDigits(value);
  if (digits.length !== 11) {
    return digits || "";
  }

  return `${digits.slice(0, 2)}******${digits.slice(-3)}`;
};

const getAfipClient = () => {
  if (!config.afip.enabled) {
    return null;
  }

  if (afipClient) {
    return afipClient;
  }

  if (afipClientInitError) {
    throw afipClientInitError;
  }

  const cuit = Number(config.afip.cuit);
  if (!Number.isInteger(cuit) || cuit <= 0) {
    afipClientInitError = new Error("AFIP_CUIT invalido");
    throw afipClientInitError;
  }

  try {
    const cert = fs.readFileSync(resolveAfipFilePath(config.afip.certPath), "utf8");
    const key = fs.readFileSync(resolveAfipFilePath(config.afip.keyPath), "utf8");

    afipClient = new Afip({
      CUIT: cuit,
      cert,
      key,
      production: config.afip.production
    });

    return afipClient;
  } catch (error) {
    afipClientInitError = new Error(`No se pudo inicializar AFIP: ${error.message}`);
    throw afipClientInitError;
  }
};

const createAfipVoucher = async ({ total, netoGravado, ivaImporte, ivaAlicuota, cliente, afipTipoComprobante, traceId }) => {
  logVentaTrace(traceId || "sin-trace", "AFIP | Inicio createAfipVoucher", {
    total,
    netoGravado,
    ivaImporte,
    ivaAlicuota,
    afipTipoComprobante,
    cliente: cliente
      ? {
          id: cliente.id,
          cuitMasked: maskCuit(cliente.cuit),
          documentoMasked: maskDocument(cliente.documento)
        }
      : null
  });

  const useSoapService = config.afip.useSoapService;
  const afip = useSoapService ? getAfipSoapService() : getAfipClient();
  if (!afip) {
    logVentaTrace(traceId || "sin-trace", "AFIP | AFIP deshabilitado por configuracion");
    throw new Error("AFIP no esta habilitado (AFIP_ENABLED=false)");
  }

  const ptoVta = config.afip.puntoVenta;
  const cbteTipo = resolveAfipCbteTipoCode(afipTipoComprobante);
  const totalRounded = roundMoney(total);
  const netoRounded = roundMoney(netoGravado);
  const ivaRounded = roundMoney(ivaImporte);
  const doc = resolveAfipDocument(cliente);

  const billing = useSoapService ? afip : afip.ElectronicBilling;
  let lastVoucher = 0;
  try {
    logVentaTrace(traceId || "sin-trace", "AFIP | Consultando ultimo comprobante", {
      ptoVta,
      cbteTipo,
      provider: useSoapService ? "soap" : "sdk"
    });
    lastVoucher = await billing.getLastVoucher(ptoVta, cbteTipo);
    logVentaTrace(traceId || "sin-trace", "AFIP | Ultimo comprobante obtenido", {
      ptoVta,
      cbteTipo,
      lastVoucher: Number(lastVoucher || 0)
    });
  } catch (error) {
    logVentaTraceError(traceId || "sin-trace", "AFIP | Error al obtener ultimo comprobante", error);
    throw buildAfipRequestError(error, "al obtener ultimo comprobante");
  }

  const nextVoucher = Number(lastVoucher || 0) + 1;

  const request = {
    CantReg: 1,
    PtoVta: ptoVta,
    CbteTipo: cbteTipo,
    Concepto: 1,
    DocTipo: doc.DocTipo,
    DocNro: doc.DocNro,
    CbteDesde: nextVoucher,
    CbteHasta: nextVoucher,
    CbteFch: formatAfipDate(),
    ImpTotal: totalRounded,
    ImpTotConc: 0,
    ImpNeto: netoRounded,
    ImpOpEx: 0,
    ImpIVA: ivaRounded,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1
  };

  if (ivaRounded > 0) {
    const ivaConfig = resolveAfipIvaConfig(ivaAlicuota);
    if (!ivaConfig) {
      throw new Error("Alicuota de IVA AFIP invalida");
    }

    request.Iva = [
      {
        Id: ivaConfig.id,
        BaseImp: netoRounded,
        Importe: ivaRounded
      }
    ];
  }

  let response;
  try {
    logVentaTrace(traceId || "sin-trace", "AFIP | Enviando createVoucher", {
      ptoVta: request.PtoVta,
      cbteTipo: request.CbteTipo,
      cbteDesde: request.CbteDesde,
      cbteHasta: request.CbteHasta,
      docTipo: request.DocTipo,
      docNro: request.DocNro,
      impTotal: request.ImpTotal,
      impNeto: request.ImpNeto,
      impIva: request.ImpIVA,
      ivaItems: request.Iva || []
    });
    response = await billing.createVoucher(request);
    logVentaTrace(traceId || "sin-trace", "AFIP | createVoucher OK", {
      cae: response?.CAE || null,
      caeVto: response?.CAEFchVto || null,
      voucherNumber: `${String(ptoVta).padStart(4, "0")}-${String(nextVoucher).padStart(8, "0")}`
    });
  } catch (error) {
    logVentaTraceError(traceId || "sin-trace", "AFIP | Error al crear comprobante", error);
    throw buildAfipRequestError(error, "al crear comprobante");
  }

  return {
    numero: `${String(ptoVta).padStart(4, "0")}-${String(nextVoucher).padStart(8, "0")}`,
    cae: response?.CAE || null,
    caeVto: parseAfipDate(response?.CAEFchVto),
    raw: {
      request,
      response,
      provider: useSoapService ? "soap" : "sdk",
      tipo_comprobante: afipTipoComprobante || null,
      environment: config.afip.production ? "produccion" : "homologacion"
    }
  };
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

const escapeHtml = (value) =>
  String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatCurrency = (amount) => `$${MONEY_FORMATTER.format(Number(amount || 0))}`;

const formatDateOnly = (value) => {
  if (!value) {
    return "-";
  }

  return DATE_FORMATTER.format(new Date(value));
};

const escapePdfText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");

const buildTechnicalReportPdfBuffer = ({ venta, comprobante, orden, cliente, total, detalleFacturado = [] }) => {
  const detailLines = detalleFacturado.length ? detalleFacturado : ["-"];
  const streamCommands = [];
  const pageWidth = 595;
  const margin = 40;
  const right = pageWidth - margin;

  const wrapText = (value, maxChars = 86) => {
    const normalized = String(value || "-").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return ["-"];
    }

    const words = normalized.split(" ");
    const result = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current) {
          result.push(current);
        }
        current = word;
      }
    }

    if (current) {
      result.push(current);
    }

    return result.length ? result : ["-"];
  };

  const pushText = (x, y, size, value, bold = false) => {
    streamCommands.push("BT");
    streamCommands.push(`/${bold ? "F2" : "F1"} ${size} Tf`);
    streamCommands.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    streamCommands.push(`(${escapePdfText(value)}) Tj`);
    streamCommands.push("ET");
  };

  const pushHLine = (y) => {
    streamCommands.push(`${margin} ${y.toFixed(2)} m ${right} ${y.toFixed(2)} l S`);
  };

  let y = 800;
  pushText(margin, y, 18, "INFORME TECNICO", true);
  pushText(420, y + 1, 11, `Nro ${comprobante.numero || venta.id}`, true);
  y -= 20;
  pushText(margin, y, 10, escapePdfText(config.workshop.companyName || "Taller"), true);
  pushText(420, y, 10, `Fecha ${formatDateOnly(comprobante.fecha_emision || venta.fecha)}`);
  y -= 14;
  pushHLine(y);
  y -= 18;

  const rightColX = 310;
  const writeRow = (leftLabel, leftValue, rightLabel, rightValue) => {
    pushText(margin, y, 10, `${leftLabel}:`, true);
    pushText(margin + 72, y, 10, leftValue || "-");
    pushText(rightColX, y, 10, `${rightLabel}:`, true);
    pushText(rightColX + 72, y, 10, rightValue || "-");
    y -= 16;
  };

  writeRow("Orden", String(orden.nro_orden || "-"), "Estado", mapEstadoToLabel(orden.estado_actual));
  writeRow("Cliente", String(cliente.nombre || "-"), "Documento", String(cliente.documento || "-"));
  writeRow("Telefono", String(cliente.telefono || "-"), "Equipo", String(orden.equipo || "-"));
  y -= 2;
  pushHLine(y);
  y -= 18;

  streamCommands.push("0.92 g");
  streamCommands.push(`${margin} ${(y - 13).toFixed(2)} ${right - margin} 18 re f`);
  streamCommands.push("0 g");
  pushText(margin + 6, y - 1, 10, "DETALLE DEL DIAGNOSTICO Y REPARACION", true);
  y -= 24;

  for (const rawDetail of detailLines) {
    const wrapped = wrapText(rawDetail, 82);
    wrapped.forEach((line, idx) => {
      if (y < 120) {
        return;
      }
      pushText(margin + 6, y, 10, `${idx === 0 ? "- " : "  "}${line}`);
      y -= 14;
    });
    if (y < 120) {
      break;
    }
  }

  if (y < 120) {
    pushText(margin + 6, 112, 10, "... (detalle truncado)");
    y = 104;
  }

  y -= 8;
  pushHLine(y);
  y -= 26;

  const totalBoxX = right - 205;
  streamCommands.push(`${totalBoxX} ${(y - 8).toFixed(2)} 205 30 re S`);
  pushText(totalBoxX + 10, y + 5, 11, "TOTAL", true);
  pushText(totalBoxX + 100, y + 5, 13, formatCurrency(total), true);

  const stream = `${streamCommands.join("\n")}\n`;
  const streamLength = Buffer.byteLength(stream, "binary");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    `6 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}endstream\nendobj\n`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "binary");
};

const mapEstadoToLabel = (estado) => {
  const labels = {
    ingresada: "Ingresada",
    en_diagnostico: "En diagnóstico",
    en_reparacion: "En reparación",
    esperando_repuesto: "Esperando repuesto",
    lista_para_entrega: "Finalizado",
    entregada: "Entregada",
    cancelada: "Cancelada"
  };

  return labels[estado] || estado || "-";
};

const getSmtpTransporter = () => {
  if (!config.smtp.user || !config.smtp.pass) {
    return null;
  }

  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
  }

  return smtpTransporter;
};

const buildTechnicalReportHtml = ({ venta, comprobante, orden, cliente, total, detalleFacturado = [] }) => `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Informe técnico N° ${escapeHtml(comprobante.numero)}</title>
      <style>
        body { font-family: Arial, sans-serif; background: #efefef; margin: 0; padding: 14px; color: #111; }
        .sheet { max-width: 760px; margin: 0 auto; border: 1px solid #444; background: #fff; }
        .header { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #444; }
        .cell { padding: 10px; border-right: 1px solid #444; }
        .cell:last-child { border-right: none; }
        .brand-head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
        .brand-logo { width: 88px; height: 88px; object-fit: cover; border: 1px solid #bbb; border-radius: 6px; }
        .brand-title { font-size: 24px; margin: 0 0 6px; font-weight: 800; }
        .muted { margin: 2px 0; font-size: 13px; }
        .report-title { text-align: center; margin: 0; font-size: 30px; font-weight: 900; letter-spacing: .6px; }
        .report-sub { text-align: center; font-size: 22px; margin: 8px 0 0; font-weight: 700; }
        .copy-label { display: inline-block; padding: 6px 10px; border: 1px solid #999; border-radius: 4px; font-size: 12px; margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; }
        td { border: 1px solid #bcbcbc; padding: 6px 8px; font-size: 14px; }
        td.label { width: 20%; font-weight: 700; background: #f8f8f8; }
        .bar { background: #0c0c0c; color: #fff; text-transform: uppercase; font-weight: 700; padding: 6px 8px; font-size: 14px; }
        .detail-space { min-height: 140px; border-bottom: 1px solid #ccc; padding: 8px; }
        .detail-line { margin: 0 0 4px; font-size: 13px; line-height: 1.35; }
        .totals td { font-size: 18px; }
        .totals-final td { background: #0c0c0c; color: #fff; font-weight: 900; font-size: 24px; }
        @media print {
          body { background: #fff; padding: 0; }
          .sheet { max-width: 100%; border: 1px solid #444; }
        }
      </style>
    </head>
    <body>
      <section class="sheet">
        <header class="header">
          <div class="cell">
            <div class="brand-head">
              ${workshopLogoDataUri ? `<img class="brand-logo" src="${workshopLogoDataUri}" alt="Logo ${escapeHtml(config.workshop.companyName)}" />` : ""}
              <h1 class="brand-title">${escapeHtml(config.workshop.companyName)}</h1>
            </div>
            <p class="muted">${escapeHtml(config.workshop.ownerName)}</p>
            <p class="muted">${escapeHtml(config.workshop.address)}</p>
            <p class="muted">Tel: ${escapeHtml(config.workshop.phone)}</p>
          </div>
          <div class="cell" style="text-align:center;">
            <h2 class="report-title">INFORME TÉCNICO</h2>
            <p class="report-sub">N° ${escapeHtml(comprobante.numero || venta.id)}</p>
            <p class="muted"><b>Fecha:</b> ${escapeHtml(formatDateOnly(comprobante.fecha_emision || venta.fecha))}</p>
            <span class="copy-label">COPIA CLIENTE</span>
          </div>
        </header>

        <table>
          <tbody>
            <tr>
              <td class="label">Cliente:</td>
              <td>${escapeHtml(cliente.nombre)}</td>
              <td class="label">Documento:</td>
              <td>${escapeHtml(cliente.documento || "-")}</td>
            </tr>
            <tr>
              <td class="label">Teléfono:</td>
              <td>${escapeHtml(cliente.telefono || "-")}</td>
              <td class="label">Fecha ingreso:</td>
              <td>${escapeHtml(formatDateOnly(orden.fecha_ingreso))}</td>
            </tr>
            <tr>
              <td class="label">Equipo:</td>
              <td>${escapeHtml(orden.equipo || "-")}</td>
              <td class="label">Estado:</td>
              <td>${escapeHtml(mapEstadoToLabel(orden.estado_actual))}</td>
            </tr>
            <tr>
              <td class="label">Falla reportada:</td>
              <td colspan="3">${escapeHtml(orden.falla_reportada || "-")}</td>
            </tr>
          </tbody>
        </table>

        <div class="bar">Detalle del diagnóstico y reparación</div>
        <div class="detail-space">
          ${detalleFacturado.length
            ? detalleFacturado
                .map((detalle) => `<p class="detail-line">${escapeHtml(detalle).replace(/\n/g, "<br />")}</p>`)
                .join("")
            : '<p class="detail-line">-</p>'}
        </div>

        <table>
          <tbody class="totals">
            <tr>
              <td style="text-align:right;"><b>Importe de reparación:</b></td>
              <td style="text-align:right; width:28%;"><b>${escapeHtml(formatCurrency(total))}</b></td>
            </tr>
          </tbody>
          <tbody class="totals-final">
            <tr>
              <td style="text-align:right;">TOTAL:</td>
              <td style="text-align:right; width:28%;">${escapeHtml(formatCurrency(total))}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </body>
  </html>
`;

const getTechnicalReportContext = async (ventaId) => {
  const ventaResult = await pool.query(
    `
      SELECT
        v.id,
        v.fecha,
        v.total,
        cb.numero AS comprobante_numero,
        cb.tipo AS comprobante_tipo,
        cb.fecha_emision AS comprobante_fecha,
        o.id AS orden_id,
        o.nro_orden,
        o.estado_actual,
        o.equipo,
        o.diagnostico_inicial,
        o.fecha_creacion AS orden_fecha_ingreso,
        c.nombre AS cliente_nombre,
        c.telefono AS cliente_telefono,
        c.email AS cliente_email,
        c.documento AS cliente_documento
      FROM ${schema}.ventas v
      JOIN ${schema}.ordenes_reparacion o ON o.id = v.orden_id
      LEFT JOIN ${schema}.clientes c ON c.id = o.cliente_id
      LEFT JOIN ${schema}.comprobantes cb ON cb.venta_id = v.id
      WHERE v.id = $1 AND v.origen = 'orden'
      ORDER BY cb.id DESC
      LIMIT 1
    `,
    [ventaId]
  );

  if (!ventaResult.rowCount) {
    return null;
  }

  const detalleItemsResult = await pool.query(
    `
      SELECT descripcion
      FROM ${schema}.venta_items
      WHERE venta_id = $1
      ORDER BY id ASC
    `,
    [ventaId]
  );

  const detalleFacturado = detalleItemsResult.rows
    .map((item) => String(item.descripcion || "").trim())
    .filter((detalle) => detalle.length > 0);

  const row = ventaResult.rows[0];
  return {
    venta: {
      id: row.id,
      fecha: row.fecha,
      total: Number(row.total || 0)
    },
    comprobante: {
      numero: row.comprobante_numero || `VTA-${row.id}`,
      tipo: row.comprobante_tipo || "local",
      fecha_emision: row.comprobante_fecha || row.fecha
    },
    orden: {
      id: row.orden_id,
      nro_orden: row.nro_orden,
      estado_actual: row.estado_actual,
      equipo: row.equipo,
      falla_reportada: row.diagnostico_inicial,
      fecha_ingreso: row.orden_fecha_ingreso
    },
    cliente: {
      nombre: row.cliente_nombre || "Cliente",
      telefono: row.cliente_telefono,
      email: row.cliente_email,
      documento: row.cliente_documento
    },
    detalle_facturado: detalleFacturado
  };
};

const sendTechnicalReportEmail = async (report) => {
  if (!report?.cliente?.email) {
    return { sent: false, reason: "cliente_sin_email" };
  }

  const transporter = getSmtpTransporter();
  if (!transporter || !config.smtp.from) {
    return { sent: false, reason: "smtp_no_configurado" };
  }

  const html = `
    <p>Hola ${escapeHtml(report.cliente.nombre || "cliente")},</p>
    <p>Tu orden <b>N° ${escapeHtml(report.orden.nro_orden || "-")}</b> ya esta lista para retirar.</p>
    <p>Adjuntamos el comprobante en PDF.</p>
    <p>Total: <b>${escapeHtml(formatCurrency(report.venta.total))}</b></p>
  `;
  const pdfBuffer = buildTechnicalReportPdfBuffer({
    venta: report.venta,
    comprobante: report.comprobante,
    orden: report.orden,
    cliente: report.cliente,
    total: report.venta.total,
    detalleFacturado: report.detalle_facturado
  });

  await transporter.sendMail({
    from: config.smtp.from,
    to: report.cliente.email,
    subject: `Nº ${report.orden.nro_orden} - lista para retirar`,
    text: `Tu orden ${report.orden.nro_orden} ya está lista para retirar. Adjuntamos el comprobante generado. Total: ${formatCurrency(report.venta.total)}.`,
    html,
    attachments: [
      {
        filename: `informe-tecnico-orden-${report.orden.nro_orden}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]
  });

  return { sent: true, to: report.cliente.email };
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

app.get("/afip/debug-auth", async (_req, res) => {
  const authHeader = _req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    jwt.verify(authHeader.slice(7).trim(), config.jwtSecret);
  } catch (_error) {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }

  const certResolvedPath = resolveAfipFilePath(config.afip.certPath);
  const keyResolvedPath = resolveAfipFilePath(config.afip.keyPath);
  const certExists = fs.existsSync(certResolvedPath);
  const keyExists = fs.existsSync(keyResolvedPath);

  let certInfo = null;
  if (certExists) {
    try {
      const certPem = fs.readFileSync(certResolvedPath, "utf8");
      const cert = new X509Certificate(certPem);
      certInfo = {
        subject: cert.subject,
        issuer: cert.issuer,
        validFrom: cert.validFrom,
        validTo: cert.validTo
      };
    } catch (error) {
      certInfo = {
        parseError: error?.message || "No se pudo parsear certificado"
      };
    }
  }

  const diagnostics = {
    serverTime: {
      iso: new Date().toISOString(),
      locale: new Date().toString(),
      timezoneOffsetMinutes: new Date().getTimezoneOffset()
    },
    config: {
      enabled: config.afip.enabled,
      production: config.afip.production,
      cuitMasked: maskCuit(config.afip.cuit),
      cuitLength: normalizeDigits(config.afip.cuit).length,
      puntoVenta: config.afip.puntoVenta,
      cbteTipo: config.afip.cbteTipo,
      certPath: config.afip.certPath,
      keyPath: config.afip.keyPath,
      certResolvedPath,
      keyResolvedPath,
      certExists,
      keyExists,
      certInfo
    },
    wsfeProbe: null
  };

  if (!config.afip.enabled) {
    return res.status(400).json({ ok: false, error: "AFIP no habilitado", diagnostics });
  }

  try {
    const afip = getAfipClient();
    const cbteTipo = resolveAfipCbteTipoCode(null);
    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(config.afip.puntoVenta, cbteTipo);
    diagnostics.wsfeProbe = {
      ok: true,
      stage: "getLastVoucher",
      ptoVta: config.afip.puntoVenta,
      cbteTipo,
      lastVoucher: Number(lastVoucher || 0)
    };
    return res.json({ ok: true, diagnostics });
  } catch (error) {
    diagnostics.wsfeProbe = {
      ok: false,
      stage: "getLastVoucher",
      error: buildAfipRequestError(error, "al obtener ultimo comprobante").message,
      raw: {
        message: error?.message || null,
        status: error?.response?.status || null,
        statusText: error?.response?.statusText || null,
        data: error?.response?.data || null
      }
    };
    return res.status(400).json({ ok: false, diagnostics });
  }
});

app.get("/afip/diagnostico-completo", async (_req, res) => {
  const authHeader = _req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    jwt.verify(authHeader.slice(7).trim(), config.jwtSecret);
  } catch (_error) {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }

  if (!config.afip.enabled) {
    return res.status(400).json({ ok: false, error: "AFIP no habilitado" });
  }

  const diagnostics = {
    production: config.afip.production,
    provider: config.afip.useSoapService ? "soap" : "sdk",
    ptoVta: config.afip.puntoVenta,
    cbteTipo: resolveAfipCbteTipoCode(null),
    wsaa_ta: null,
    ultimo_comprobante: null,
    sdk_runtime: null
  };

  try {
    const useSoapService = config.afip.useSoapService;
    if (useSoapService) {
      const afip = getAfipSoapService();
      diagnostics.sdk_runtime = {
        mode: "soap",
        has_getAuth: typeof afip?.getAuth === "function",
        has_getLastVoucher: typeof afip?.getLastVoucher === "function",
        certPath: config.afip.certPath,
        keyPath: config.afip.keyPath
      };
      await afip.getAuth();
      diagnostics.wsaa_ta = "Token generado (SOAP loginCms)";
      const ultimo = await afip.getLastVoucher(diagnostics.ptoVta, diagnostics.cbteTipo);
      diagnostics.ultimo_comprobante = Number(ultimo || 0);
    } else {
      const afip = getAfipClient();
      const wsaaClient = afip.wsaa || afip.WSAA;
      diagnostics.sdk_runtime = {
        mode: "sdk",
        has_wsaa: Boolean(wsaaClient),
        wsaa_methods: wsaaClient ? Object.keys(wsaaClient).slice(0, 20) : [],
        has_getTA: Boolean(wsaaClient?.getTA),
        has_electronic_billing: Boolean(afip?.ElectronicBilling)
      };

      if (wsaaClient?.getTA) {
        const wsaa = await wsaaClient.getTA("wsfe");
        diagnostics.wsaa_ta = wsaa?.token ? "Token generado" : "Sin token";
      } else {
        diagnostics.wsaa_ta = "No disponible: SDK sin wsaa.getTA (se valida TA via WSFE)";
      }

      const ultimo = await afip.ElectronicBilling.getLastVoucher(diagnostics.ptoVta, diagnostics.cbteTipo);
      diagnostics.ultimo_comprobante = Number(ultimo || 0);

      if (!wsaaClient?.getTA) {
        diagnostics.wsaa_ta = "Validado indirectamente: getLastVoucher respondio correctamente";
      }
    }

    return res.json({ ok: true, diagnostics });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error?.message || "Error de diagnostico AFIP",
      stack: error?.stack || null,
      response: error?.response?.data || "Sin respuesta",
      diagnostics
    });
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

app.post("/smtp/test", async (req, res) => {
  try {
    const body = smtpTestSchema.parse(req.body || {});
    const transporter = getSmtpTransporter();

    if (!transporter || !config.smtp.from) {
      return res.status(400).json({
        ok: false,
        error: "SMTP no configurado",
        details: {
          hasUser: Boolean(config.smtp.user),
          hasPass: Boolean(config.smtp.pass),
          hasFrom: Boolean(config.smtp.from)
        }
      });
    }

    await transporter.verify();

    const to = body.to || config.smtp.user;
    const subject = body.subject || `SMTP test app_computacion - ${new Date().toISOString()}`;
    const message =
      body.message ||
      `Prueba de SMTP exitosa.\nUsuario autenticado: ${config.smtp.user}\nDisparado por: ${req.user?.email || "usuario"}`;

    const info = await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text: message,
      html: `<p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`
    });

    res.json({
      ok: true,
      message: "Email de prueba enviado",
      smtp: {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        from: config.smtp.from
      },
      result: {
        to,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response
      }
    });
  } catch (error) {
    if (handleZodError(error, res)) {
      return;
    }

    console.error("[smtp-test] Error:", error);
    res.status(500).json({
      ok: false,
      error: "Fallo prueba SMTP",
      message: error.message,
      code: error.code || null,
      responseCode: error.responseCode || null,
      response: error.response || null,
      command: error.command || null
    });
  }
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
    const ordenIdRaw = req.query.orden_id;
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

    if (ordenIdRaw !== undefined) {
      const ordenId = Number(ordenIdRaw);
      if (!Number.isInteger(ordenId) || ordenId <= 0) {
        return res.status(400).json({ error: "orden_id invalido" });
      }
      params.push(ordenId);
      filters.push(`v.orden_id = $${params.length}`);
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
        v.afip_iva_alicuota,
        v.afip_iva_importe,
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
        v.afip_iva_alicuota,
        v.afip_iva_importe,
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

app.get("/ventas/:id/reporte-tecnico-html", async (req, res) => {
  const id = parseId(req.params.id, res);
  if (!id) {
    return;
  }

  try {
    const technicalReport = await getTechnicalReportContext(id);
    if (!technicalReport) {
      return res.status(404).json({ error: "Venta no encontrada o no corresponde a una orden de reparacion" });
    }

    const html = buildTechnicalReportHtml({
      venta: technicalReport.venta,
      comprobante: technicalReport.comprobante,
      orden: technicalReport.orden,
      cliente: technicalReport.cliente,
      total: technicalReport.venta.total,
      detalleFacturado: technicalReport.detalle_facturado
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: "Error al generar informe tecnico", message: error.message });
  }
});

app.post("/ventas", async (req, res) => {
  const traceId = createTraceId("venta");
  logVentaTrace(traceId, "POST /ventas | Inicio", {
    user: req.user ? { id: req.user.id, email: req.user.email, rol: req.user.rol } : null
  });

  try {
    const body = ventaCreateSchema.parse(req.body);
    logVentaTrace(traceId, "POST /ventas | Body validado", {
      tipo: body.tipo,
      origen: body.origen,
      orden_id: body.orden_id ?? null,
      cliente_id: body.cliente_id ?? null,
      afip_tipo_comprobante: body.afip_tipo_comprobante ?? null,
      afip_iva_alicuota: body.afip_iva_alicuota ?? null,
      forma_pago: body.forma_pago,
      items_count: body.items.length,
      items_preview: body.items.slice(0, 5).map((item) => ({
        tipo_item: item.tipo_item,
        producto_id: item.producto_id ?? null,
        descripcion: safeString(item.descripcion, 80),
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario
      }))
    });

    const subtotalCalculado = body.items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
    logVentaTrace(traceId, "POST /ventas | Subtotal calculado", { subtotalCalculado });

    let clienteIdFinal = body.cliente_id ?? null;
    let esPrimeraFacturaOrden = false;

    const venta = await withClient(async (client) => {
      await client.query("BEGIN");
      logVentaTrace(traceId, "POST /ventas | BEGIN");

      try {
        if (body.origen === "orden") {
          logVentaTrace(traceId, "POST /ventas | Validando orden", { orden_id: body.orden_id });
          const ordenCheck = await client.query(`SELECT id, cliente_id FROM ${schema}.ordenes_reparacion WHERE id = $1`, [body.orden_id]);
          if (!ordenCheck.rowCount) {
            await client.query("ROLLBACK");
            logVentaTrace(traceId, "POST /ventas | ROLLBACK por orden no encontrada", { orden_id: body.orden_id });
            return { error: { code: 404, message: "Orden no encontrada" } };
          }

          const facturasPreviasOrdenResult = await client.query(
            `
              SELECT COUNT(*)::INT AS total
              FROM ${schema}.ventas
              WHERE origen = 'orden' AND orden_id = $1
            `,
            [body.orden_id]
          );
          esPrimeraFacturaOrden = Number(facturasPreviasOrdenResult.rows[0]?.total || 0) === 0;

          const clienteOrdenId = Number(ordenCheck.rows[0].cliente_id);
          logVentaTrace(traceId, "POST /ventas | Orden validada", {
            orden_id: body.orden_id,
            cliente_id_orden: clienteOrdenId,
            facturas_previas: Number(facturasPreviasOrdenResult.rows[0]?.total || 0)
          });

          if (body.cliente_id && clienteOrdenId !== body.cliente_id) {
            await client.query("ROLLBACK");
            logVentaTrace(traceId, "POST /ventas | ROLLBACK por cliente distinto al de la orden", {
              cliente_id_body: body.cliente_id,
              cliente_id_orden: clienteOrdenId
            });
            return { error: { code: 400, message: "cliente_id no coincide con la orden" } };
          }

          if (!body.cliente_id) {
            clienteIdFinal = clienteOrdenId;
          }
        }

        const baseCalculada = subtotalCalculado - body.descuento + body.impuestos;
        const afipIvaConfig = body.tipo === "afip" ? resolveAfipIvaConfig(body.afip_iva_alicuota) : null;

        let totalFinal = roundMoney(baseCalculada);
        let baseImponible = roundMoney(baseCalculada);
        let ivaImporte = 0;

        if (afipIvaConfig) {
          if (body.origen === "orden") {
            totalFinal = roundMoney(baseCalculada);
            ivaImporte = roundMoney(totalFinal * (afipIvaConfig.rate / (100 + afipIvaConfig.rate)));
            baseImponible = roundMoney(totalFinal - ivaImporte);
          } else {
            baseImponible = roundMoney(baseCalculada);
            ivaImporte = roundMoney(baseImponible * (afipIvaConfig.rate / 100));
            totalFinal = roundMoney(baseImponible + ivaImporte);
          }
        }

        logVentaTrace(traceId, "POST /ventas | Totales calculados", {
          baseCalculada,
          baseImponible,
          ivaImporte,
          totalFinal,
          afipIvaRate: afipIvaConfig ? afipIvaConfig.rate : null
        });

        if (totalFinal < 0) {
          await client.query("ROLLBACK");
          logVentaTrace(traceId, "POST /ventas | ROLLBACK por total invalido", { totalFinal });
          return { error: { code: 400, message: "Total invalido" } };
        }

        if (body.tipo === "afip" && !afipIvaConfig) {
          await client.query("ROLLBACK");
          logVentaTrace(traceId, "POST /ventas | ROLLBACK por alicuota AFIP invalida", {
            afip_iva_alicuota: body.afip_iva_alicuota
          });
          return { error: { code: 400, message: "Alicuota de IVA AFIP invalida" } };
        }

        const montoPagado = body.monto_pagado ?? totalFinal;
        if (montoPagado > totalFinal) {
          await client.query("ROLLBACK");
          logVentaTrace(traceId, "POST /ventas | ROLLBACK por monto_pagado mayor al total", {
            monto_pagado: montoPagado,
            total: totalFinal
          });
          return { error: { code: 400, message: "monto_pagado no puede ser mayor al total" } };
        }

        const saldoPendiente = totalFinal - montoPagado;

        if (!clienteIdFinal && saldoPendiente > 0) {
          await client.query("ROLLBACK");
          logVentaTrace(traceId, "POST /ventas | ROLLBACK por saldo pendiente sin cliente", {
            saldoPendiente
          });
          return { error: { code: 400, message: "No se puede generar saldo pendiente sin cliente" } };
        }

        logVentaTrace(traceId, "POST /ventas | Estado financiero", {
          montoPagado,
          saldoPendiente,
          clienteIdFinal
        });

        const insertVentaQuery = `
          INSERT INTO ${schema}.ventas (
            tipo,
            cliente_id,
            origen,
            orden_id,
            subtotal,
            descuento,
            impuestos,
            afip_iva_alicuota,
            afip_iva_importe,
            total,
            forma_pago,
            estado
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'confirmada')
          RETURNING id, tipo, cliente_id, origen, orden_id, subtotal, descuento, impuestos, afip_iva_alicuota, afip_iva_importe, total, forma_pago, estado, fecha
        `;

        const ventaResult = await client.query(insertVentaQuery, [
          body.tipo,
          clienteIdFinal,
          body.origen,
          body.orden_id ?? null,
          subtotalCalculado,
          body.descuento,
          body.impuestos,
          afipIvaConfig ? afipIvaConfig.rate : null,
          ivaImporte,
          totalFinal,
          body.forma_pago
        ]);

        const ventaCreada = ventaResult.rows[0];
        logVentaTrace(traceId, "POST /ventas | Venta insertada", {
          venta_id: ventaCreada.id,
          tipo: ventaCreada.tipo,
          total: ventaCreada.total
        });

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

        logVentaTrace(traceId, "POST /ventas | Items insertados", {
          count: body.items.length
        });

        if (clienteIdFinal && saldoPendiente > 0) {
          await client.query(
            `
              INSERT INTO ${schema}.cuenta_corriente_movimientos (cliente_id, tipo, origen, referencia_id, descripcion, monto)
              VALUES ($1, 'debe', 'venta', $2, $3, $4)
            `,
            [clienteIdFinal, ventaCreada.id, `Saldo pendiente venta ${ventaCreada.id}`, saldoPendiente]
          );
        }

        let numeroComprobante = null;
        let cae = null;
        let caeVto = null;
        let rawRespuestaAfip = null;

        if (body.tipo === "afip") {
          logVentaTrace(traceId, "POST /ventas | Inicio flujo AFIP", {
            clienteIdFinal,
            origen: body.origen,
            afip_tipo_comprobante: body.afip_tipo_comprobante,
            afip_iva_alicuota: afipIvaConfig?.rate || null
          });
          let clienteFacturacion = null;
          if (clienteIdFinal) {
            const clienteResult = await client.query(
              `SELECT id, documento, cuit FROM ${schema}.clientes WHERE id = $1`,
              [clienteIdFinal]
            );

            if (!clienteResult.rowCount) {
              await client.query("ROLLBACK");
              logVentaTrace(traceId, "POST /ventas | ROLLBACK por cliente inexistente para AFIP", {
                clienteIdFinal
              });
              return { error: { code: 400, message: "Cliente no encontrado para facturacion AFIP" } };
            }

            clienteFacturacion = clienteResult.rows[0];
            logVentaTrace(traceId, "POST /ventas | Cliente para AFIP cargado", {
              cliente_id: clienteFacturacion.id,
              cuitMasked: maskCuit(clienteFacturacion.cuit),
              documentoMasked: maskDocument(clienteFacturacion.documento)
            });
          }

          if (body.origen === "orden") {
            if (!clienteFacturacion) {
              await client.query("ROLLBACK");
              logVentaTrace(traceId, "POST /ventas | ROLLBACK por orden sin cliente para AFIP");
              return { error: { code: 400, message: "La orden no tiene cliente asociado para facturar AFIP" } };
            }

            const clienteCuit = normalizeDigits(clienteFacturacion.cuit);
            if (clienteCuit.length !== 11) {
              await client.query("ROLLBACK");
              logVentaTrace(traceId, "POST /ventas | ROLLBACK por CUIT invalido de cliente", {
                cliente_id: clienteFacturacion.id,
                cuitMasked: maskCuit(clienteFacturacion.cuit)
              });
              return {
                error: {
                  code: 400,
                  message: "El cliente de la orden no tiene CUIT valido. Actualice el cliente antes de facturar AFIP"
                }
              };
            }
          }

          try {
            const afipVoucher = await createAfipVoucher({
              total: totalFinal,
              netoGravado: baseImponible,
              ivaImporte,
              ivaAlicuota: afipIvaConfig?.rate,
              cliente: clienteFacturacion,
              afipTipoComprobante: body.afip_tipo_comprobante,
              traceId
            });
            numeroComprobante = afipVoucher.numero;
            cae = afipVoucher.cae;
            caeVto = afipVoucher.caeVto;
            rawRespuestaAfip = afipVoucher.raw;
            logVentaTrace(traceId, "POST /ventas | AFIP comprobante emitido", {
              numeroComprobante,
              cae,
              caeVto
            });
          } catch (afipError) {
            await client.query("ROLLBACK");
            logVentaTraceError(traceId, "POST /ventas | ROLLBACK por error AFIP", afipError);
            return {
              error: {
                code: 400,
                message: `Error al emitir comprobante AFIP: ${afipError.message}`
              }
            };
          }
        } else {
          numeroComprobante = await nextComprobanteNumber(client, body.tipo);
          logVentaTrace(traceId, "POST /ventas | Numero de comprobante local generado", { numeroComprobante });
        }

        const comprobanteResult = await client.query(
          `
            INSERT INTO ${schema}.comprobantes (venta_id, tipo, numero, cae, cae_vto, raw_respuesta_afip)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, venta_id, tipo, numero, cae, cae_vto, fecha_emision
          `,
          [ventaCreada.id, body.tipo, numeroComprobante, cae, caeVto, rawRespuestaAfip]
        );

        await client.query("COMMIT");
        logVentaTrace(traceId, "POST /ventas | COMMIT OK", {
          venta_id: ventaCreada.id,
          numeroComprobante,
          tipo: body.tipo
        });

        return {
          ...ventaCreada,
          comprobante: comprobanteResult.rows[0],
          saldo_pendiente: saldoPendiente,
          es_primera_factura_orden: esPrimeraFacturaOrden
        };
      } catch (error) {
        await client.query("ROLLBACK");
        logVentaTraceError(traceId, "POST /ventas | ROLLBACK por excepcion no controlada", error);
        throw error;
      }
    });

    if (venta.error) {
      logVentaTrace(traceId, "POST /ventas | Finaliza con error controlado", venta.error);
      return res.status(venta.error.code).json({ error: venta.error.message });
    }

    let reporteTecnicoEmail = null;
    if (venta.origen === "orden") {
      try {
        const technicalReport = await getTechnicalReportContext(venta.id);
        if (technicalReport) {
          reporteTecnicoEmail = await sendTechnicalReportEmail(technicalReport);
          if (!reporteTecnicoEmail.sent) {
            console.warn(
              `[email][orden] No enviado para venta ${venta.id} / orden ${technicalReport.orden.nro_orden}. reason=${reporteTecnicoEmail.reason}`
            );
          }
        } else {
          reporteTecnicoEmail = { sent: false, reason: "reporte_no_encontrado" };
          console.warn(`[email][orden] No enviado para venta ${venta.id}. reason=reporte_no_encontrado`);
        }
      } catch (mailError) {
        reporteTecnicoEmail = { sent: false, reason: "email_error", message: mailError.message };
        console.error(`[email][orden] Error enviando para venta ${venta.id}:`, mailError);
      }
    }

    logVentaTrace(traceId, "POST /ventas | Finaliza OK", {
      venta_id: venta.id,
      comprobante_numero: venta.comprobante?.numero || null,
      tipo: venta.tipo,
      origen: venta.origen
    });

    res.status(201).json({
      ...venta,
      reporte_tecnico_email: reporteTecnicoEmail
    });
  } catch (error) {
    logVentaTraceError(traceId, "POST /ventas | Error HTTP 500", error);
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
        c.cuit AS cliente_cuit,
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
      SELECT id, orden_id, estado, detalle, precio, usuario_id, fecha
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
          INSERT INTO ${schema}.ordenes_movimientos (orden_id, estado, detalle, precio, usuario_id)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await client.query(insertMovimientoQuery, [
          ordenCreada.id,
          ordenCreada.estado_actual,
          "Orden creada",
          0,
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
      SELECT id, orden_id, estado, detalle, precio, usuario_id, fecha
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
          `SELECT id, prioridad, estado_actual FROM ${schema}.ordenes_reparacion WHERE id = $1 FOR UPDATE`,
          [id]
        );
        if (!ordenResult.rowCount) {
          await client.query("ROLLBACK");
          return null;
        }

        const updateFields = [];
        const updateValues = [];

        if (body.estado) {
          updateValues.push(body.estado);
          updateFields.push(`estado_actual = $${updateValues.length}`);
        }

        if (body.prioridad) {
          updateValues.push(body.prioridad);
          updateFields.push(`prioridad = $${updateValues.length}`);
        }

        if (body.estado && (body.estado === "entregada" || body.estado === "cancelada")) {
          updateFields.push("fecha_cierre = NOW()");
        }

        if (updateFields.length > 0) {
          updateValues.push(id);
          await client.query(
            `UPDATE ${schema}.ordenes_reparacion SET ${updateFields.join(", ")} WHERE id = $${updateValues.length}`,
            updateValues
          );
        }

        const estadoMovimiento = body.estado || ordenResult.rows[0].estado_actual;

        const insertQuery = `
          INSERT INTO ${schema}.ordenes_movimientos (orden_id, estado, detalle, precio, usuario_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, orden_id, estado, detalle, precio, usuario_id, fecha
        `;
        const movimientoResult = await client.query(insertQuery, [id, estadoMovimiento, body.detalle, body.precio, body.usuario_id ?? null]);

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
      filters.push(`(nombre ILIKE $${index} OR telefono ILIKE $${index} OR documento ILIKE $${index} OR cuit ILIKE $${index})`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const query = `
      SELECT id, nombre, telefono, email, documento, direccion, ciudad, provincia, cuit, condicion_iva, observaciones, activo, created_at
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
      SELECT id, nombre, telefono, email, documento, direccion, ciudad, provincia, cuit, condicion_iva, observaciones, activo, created_at
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
      INSERT INTO ${schema}.clientes (nombre, telefono, email, documento, direccion, ciudad, provincia, cuit, condicion_iva, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, nombre, telefono, email, documento, direccion, ciudad, provincia, cuit, condicion_iva, observaciones, activo, created_at
    `;

    const result = await pool.query(query, [
      body.nombre,
      toNullable(body.telefono),
      toNullable(body.email),
      toNullable(body.documento),
      toNullable(body.direccion),
      toNullable(body.ciudad),
      toNullable(body.provincia),
      toNullable(body.cuit),
      body.condicion_iva,
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
    const fields = ["nombre", "telefono", "email", "documento", "direccion", "ciudad", "provincia", "cuit", "condicion_iva", "observaciones"];

    const sets = [];
    const values = [];
    for (const field of fields) {
      if (field in body) {
        values.push(field === "nombre" || field === "condicion_iva" ? body[field] : toNullable(body[field]));
        sets.push(`${field} = $${values.length}`);
      }
    }

    values.push(id);
    const query = `
      UPDATE ${schema}.clientes
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, nombre, telefono, email, documento, direccion, ciudad, provincia, cuit, condicion_iva, observaciones, activo, created_at
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
