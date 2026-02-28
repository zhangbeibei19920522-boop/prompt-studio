import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow better-sqlite3 native module
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
