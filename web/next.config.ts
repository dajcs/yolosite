import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Load root-level .env into process.env for server-side API routes.
// Uses only Node.js built-ins — no npm package required.
const envFile = path.resolve(process.cwd(), "../.env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT_MODE === "standalone"
    ? { output: "standalone" }
    : process.env.NODE_ENV === "production"
      ? { output: "export" }
      : {}),
  images: {
    unoptimized: true,
  },
  basePath:
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_OUTPUT_MODE !== "standalone"
      ? "/yolosite"
      : "",
};

export default nextConfig;
