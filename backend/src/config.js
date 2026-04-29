import dotenv from "dotenv";

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toNumber(process.env.PORT, 3000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: toNumber(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || ""
  },
  workshop: {
    companyName: process.env.WORKSHOP_COMPANY_NAME || "CGE COMPUTACION",
    ownerName: process.env.WORKSHOP_OWNER_NAME || "Federico Zabala",
    address: process.env.WORKSHOP_ADDRESS || "RIVADAVIA 357 - VILLA RAMALLO, Buenos Aires",
    phone: process.env.WORKSHOP_PHONE || "3407411490"
  },
  db: {
    host: process.env.DB_HOST || "localhost",
    port: toNumber(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || "postgres",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres_35702",
    schema: process.env.DB_SCHEMA || "app_computacion"
  }
};
