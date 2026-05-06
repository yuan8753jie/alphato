import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow large JSON bodies for the playground (base64-encoded reference videos)
    serverActions: { bodySizeLimit: "100mb" },
  },
  // App Router API routes read req.json() directly; the default Node runtime accepts
  // larger payloads than this, but we keep this explicit for server actions as well.
};

export default nextConfig;
