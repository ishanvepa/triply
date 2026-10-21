import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local integration tests must not compete with the developer's Next server.
  distDir: process.env.TRIPLY_E2E === "true" ? ".next-e2e" : ".next",
  typescript: { tsconfigPath: process.env.TRIPLY_E2E === "true" ? "tsconfig.e2e.json" : "tsconfig.json" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
