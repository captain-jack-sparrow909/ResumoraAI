import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

// Next normally searches apps/web. Load the monorepo root for local use;
// Vercel-provided variables retain precedence.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: ["@resumora/domain"],
};

export default nextConfig;
