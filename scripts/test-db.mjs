import postgres from "postgres";

const sql = postgres("postgresql://postgres.iqrxufhrkhvvdjdaakgn:6z1bTdRsvVIkfrZkzQRtwvEfKSJ7Fyv3@aws-1-eu-west-1.pooler.supabase.com:6543/postgres", {
  prepare: false,
  ssl: "require",
  connect_timeout: 5,
});

setTimeout(() => { console.log("TIMEOUT after 8s - DB connection hanging!"); process.exit(1); }, 8000);

try {
  const result = await sql`SELECT count(*) as cnt FROM invoices`;
  console.log("Invoice count:", result[0].cnt);

  const invoices = await sql`SELECT id, invoice_number, status, customer_id FROM invoices LIMIT 5`;
  console.log("Invoices:", JSON.stringify(invoices, null, 2));

  const profiles = await sql`SELECT id, full_name, role FROM user_profiles`;
  console.log("User profiles:", JSON.stringify(profiles, null, 2));

  await sql.end();
  process.exit(0);
} catch (e) {
  console.error("DB Error:", e.message);
  process.exit(1);
}
