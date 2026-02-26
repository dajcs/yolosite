import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "path";

// Load root-level .env so OPENROUTER_API_KEY is available to API routes
config({ path: path.resolve(process.cwd(), "../.env") });

const nextConfig: NextConfig = {};

export default nextConfig;
