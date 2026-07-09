import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Lazy so that importing this module never throws at build/test time
// when DATABASE_URL is absent. Typed with the concrete <false, false>
// generics (neon's defaults) so query results are a plain, indexable row
// array rather than the widened union of ReturnType<typeof neon>.
let client: NeonQueryFunction<false, false> | null = null;

export function db() {
  if (!client) client = neon(process.env.DATABASE_URL!);
  return client;
}
