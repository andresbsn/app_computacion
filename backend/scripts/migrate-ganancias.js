import { config } from "../src/config.js";
import { pool } from "../src/db.js";

const schema = config.db.schema;

const run = async () => {
  try {
    await pool.query(`
      ALTER TABLE ${schema}.venta_items
      ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12, 2);
    `);
    console.log(`Migration 'ganancias' applied successfully to schema '${schema}'.`);
  } catch (error) {
    console.error("Ganancias migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
