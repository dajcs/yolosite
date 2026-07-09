import { neon } from "@neondatabase/serverless";

// Lazy so that importing this module never throws at build/test time
// when DATABASE_URL is absent.
let client: ReturnType<typeof neon> | null = null;

export function db() {
  if (!client) client = neon(process.env.DATABASE_URL!);
  return client;
}
