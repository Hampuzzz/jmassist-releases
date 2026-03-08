import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schemas";

const connectionString = process.env.DATABASE_URL!;

// Detect if connecting to cloud Supabase (pooler) vs local
const isCloud = connectionString.includes("pooler.supabase.com");

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, {
  prepare: false,
  ...(isCloud ? { ssl: "require" } : {}),
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
