import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (expected in web/.env.local)");
  process.exit(1);
}
const sql = neon(url);
const schema = readFileSync(new URL("../lib/schema.sql", import.meta.url), "utf8");

for (const statement of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
  await sql.query(statement);
  console.log("OK:", statement.slice(0, 60).replace(/\s+/g, " "));
}
console.log("Schema applied.");
