import postgres from "postgres";

const sql = postgres("postgresql://postgres.iqrxufhrkhvvdjdaakgn:6z1bTdRsvVIkfrZkzQRtwvEfKSJ7Fyv3@aws-1-eu-west-1.pooler.supabase.com:6543/postgres", {
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
});

setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 10000);

try {
  // Keep only FAK-0001, delete the rest
  const deleted = await sql`
    DELETE FROM invoice_lines
    WHERE invoice_id IN (
      SELECT id FROM invoices WHERE invoice_number != 'FAK-0001'
    )
    RETURNING id
  `;
  console.log("Deleted", deleted.length, "duplicate invoice lines");

  const delInv = await sql`
    DELETE FROM invoices WHERE invoice_number != 'FAK-0001' RETURNING invoice_number
  `;
  console.log("Deleted duplicate invoices:", delInv.map(i => i.invoice_number).join(", "));

  // Check what's left
  const remaining = await sql`SELECT id, invoice_number, status, total_inc_vat FROM invoices`;
  console.log("\nRemaining invoices:", JSON.stringify(remaining, null, 2));

  // Check invoice lines
  const lines = await sql`SELECT id, invoice_id, description, unit_price, line_total FROM invoice_lines`;
  console.log("Invoice lines:", JSON.stringify(lines, null, 2));

  await sql.end();
  process.exit(0);
} catch (e) {
  console.error("Error:", e.message);
  await sql.end();
  process.exit(1);
}
