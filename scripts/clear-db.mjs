import postgres from "postgres";

const sql = postgres("postgresql://postgres.iqrxufhrkhvvdjdaakgn:6z1bTdRsvVIkfrZkzQRtwvEfKSJ7Fyv3@aws-1-eu-west-1.pooler.supabase.com:6543/postgres", {
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
});

setTimeout(() => { console.log("TIMEOUT after 15s"); process.exit(1); }, 15000);

try {
  console.log("Deleting invoice_lines...");
  const il = await sql`DELETE FROM invoice_lines RETURNING id`;
  console.log("  Deleted", il.length, "invoice_lines");

  console.log("Deleting invoices...");
  const inv = await sql`DELETE FROM invoices RETURNING id`;
  console.log("  Deleted", inv.length, "invoices");

  console.log("Deleting appointments...");
  const apt = await sql`DELETE FROM appointments RETURNING id`;
  console.log("  Deleted", apt.length, "appointments");

  console.log("Deleting work_order_parts...");
  const wop = await sql`DELETE FROM work_order_parts RETURNING work_order_id`;
  console.log("  Deleted", wop.length, "work_order_parts");

  console.log("Deleting work_order_tasks...");
  const wot = await sql`DELETE FROM work_order_tasks RETURNING id`;
  console.log("  Deleted", wot.length, "work_order_tasks");

  console.log("Deleting work_orders...");
  const wo = await sql`DELETE FROM work_orders RETURNING id`;
  console.log("  Deleted", wo.length, "work_orders");

  console.log("Deleting vehicles...");
  const v = await sql`DELETE FROM vehicles RETURNING id`;
  console.log("  Deleted", v.length, "vehicles");

  console.log("Deleting customers...");
  const c = await sql`DELETE FROM customers RETURNING id`;
  console.log("  Deleted", c.length, "customers");

  console.log("\n✅ ALL DONE! Database cleared.");
  await sql.end();
  process.exit(0);
} catch (e) {
  console.error("Error:", e.message);
  await sql.end();
  process.exit(1);
}
