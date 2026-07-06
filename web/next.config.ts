import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only needed for the Docker image (the Dockerfile sets
  // NEXT_OUTPUT_MODE=standalone). On Vercel this is left unset so Vercel builds
  // its own serverless/edge output.
  output: process.env.NEXT_OUTPUT_MODE === "standalone" ? "standalone" : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
