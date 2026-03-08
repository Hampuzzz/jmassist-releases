import postgres from "postgres";

const sql = postgres("postgresql://postgres.iqrxufhrkhvvdjdaakgn:6z1bTdRsvVIkfrZkzQRtwvEfKSJ7Fyv3@aws-1-eu-west-1.pooler.supabase.com:6543/postgres", {
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
});

setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 10000);

try {
  const customers = await sql`SELECT id, first_name, last_name, company_name FROM customers`;
  console.log("Customers:", customers.length);
  customers.forEach(c => console.log(" -", c.id, c.company_name || `${c.first_name} ${c.last_name}`));

  const vehicles = await sql`SELECT id, reg_nr, brand, model FROM vehicles`;
  console.log("\nVehicles:", vehicles.length);
  vehicles.forEach(v => console.log(" -", v.id, v.reg_nr, v.brand, v.model));

  const invoices = await sql`SELECT id, invoice_number, status FROM invoices`;
  console.log("\nInvoices:", invoices.length);
  invoices.forEach(i => console.log(" -", i.id, i.invoice_number, i.status));

  await sql.end();
  process.exit(0);
} catch (e) {
  console.error("Error:", e.message);
  await sql.end();
  process.exit(1);
}
