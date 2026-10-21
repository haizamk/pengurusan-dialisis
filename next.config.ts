import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "@google/genai"],
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
