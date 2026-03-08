import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL || "postgresql://postgres.iqrxufhrkhvvdjdaakgn:6z1bTdRsvVIkfrZkzQRtwvEfKSJ7Fyv3@aws-1-eu-west-1.pooler.supabase.com:6543/postgres");

const suppliers = [
  {
    name: "Autodoc",
    integration_type: "autodoc",
    api_base_url: "https://www.autodoc.se",
    default_lead_time_days: 3,
    notes: "Webshop: autodoc.se — brett sortiment, bra priser, 2-5 dagars leverans",
  },
  {
    name: "Trodo",
    integration_type: "trodo",
    api_base_url: "https://www.trodo.se",
    default_lead_time_days: 2,
    notes: "Webshop: trodo.se — lägst priser, 1-3 dagars leverans",
  },
  {
    name: "BilXtra Pro",
    integration_type: "bilxtra",
    api_base_url: "https://pro.bilxtra.se",
    default_lead_time_days: 1,
    notes: "B2B-portal: pro.bilxtra.se — snabb leverans, samma dag vid order före 14:00",
  },
];

for (const s of suppliers) {
  const existing = await sql`SELECT id FROM suppliers WHERE name = ${s.name}`;
  if (existing.length > 0) {
    console.log("Already exists:", s.name);
    continue;
  }
  await sql`
    INSERT INTO suppliers (name, integration_type, api_base_url, default_lead_time_days, notes, is_active)
    VALUES (${s.name}, ${s.integration_type}, ${s.api_base_url}, ${s.default_lead_time_days}, ${s.notes}, true)
  `;
  console.log("Created:", s.name);
}

await sql.end();
console.log("Done!");
