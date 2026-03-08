import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schemas",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["public"],
} satisfies Config;
