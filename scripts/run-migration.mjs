import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const sql = postgres("postgresql://postgres.iqrxufhrkhvvdjdaakgn:6z1bTdRsvVIkfrZkzQRtwvEfKSJ7Fyv3@aws-1-eu-west-1.pooler.supabase.com:6543/postgres", {
  ssl: "require",
  prepare: false,
});

try {
  // Migration 0007: engine_code column
  await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_code TEXT`;
  console.log("✅ 0007: engine_code column");

  await sql`CREATE INDEX IF NOT EXISTS idx_vehicles_engine_code ON vehicles (engine_code) WHERE engine_code IS NOT NULL`;

  // Migration 0009: power_hp column
  await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS power_hp INTEGER`;
  console.log("✅ 0009: power_hp column");

  await sql`UPDATE vehicles SET power_hp = ROUND(power_kw * 1.341) WHERE power_kw IS NOT NULL AND power_hp IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_vehicles_power_hp ON vehicles(power_hp)`;

  // Migration 0010: v1.4.0 — VHC, CRM, Price Search, Media
  console.log("\n── Migration 0010: v1.4.0 ──");

  // Read and execute the SQL migration file
  const migrationPath = path.join(process.cwd(), "supabase/migrations/0010_v14_vhc_crm_media.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  // Split by semicolons and execute each statement (skip storage/RLS that may need special handling)
  const statements = migrationSql
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      // Extract table/object name for logging
      const match = stmt.match(/(?:CREATE TABLE|CREATE INDEX|ALTER TABLE|INSERT INTO|CREATE POLICY)\s+(?:IF NOT EXISTS\s+)?["`]?(\w+)/i);
      if (match) {
        console.log(`  ✅ ${match[0].substring(0, 60)}`);
      }
    } catch (e) {
      // Skip "already exists" errors
      if (e.message.includes("already exists") || e.message.includes("duplicate")) {
        const match = stmt.match(/(\w+)/);
        console.log(`  ⏭️  Already exists, skipping`);
      } else if (e.message.includes("storage")) {
        console.log(`  ⏭️  Storage operation skipped (run via Supabase dashboard)`);
      } else {
        console.error(`  ❌ ${e.message.substring(0, 100)}`);
      }
    }
  }

  console.log("\n🎉 All migrations complete!");
} catch (e) {
  console.error("❌ Error:", e.message);
} finally {
  await sql.end();
}
