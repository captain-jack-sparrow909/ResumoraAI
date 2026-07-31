import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@resumora/domain"],
};

export default nextConfig;
