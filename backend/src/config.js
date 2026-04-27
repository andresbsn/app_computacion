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
  db: {
    host: process.env.DB_HOST || "localhost",
    port: toNumber(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || "postgres",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres_35702",
    schema: process.env.DB_SCHEMA || "app_computacion"
  }
};
