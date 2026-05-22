import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow large JSON bodies for the playground (base64-encoded reference videos)
    serverActions: { bodySizeLimit: "100mb" },
  },
  // App Router API routes read req.json() directly; the default Node runtime accepts
  // larger payloads than this, but we keep this explicit for server actions as well.

  // ali-oss → urllib 里有 lazy require('proxy-agent')，Turbopack 静态分析会因为这个
  // 可选依赖找不到而 build error。把它们标为服务端外部包，运行时由 Node 直接 require，
  // 不进 bundler 分析。
  serverExternalPackages: ["ali-oss", "urllib"],
};

export default nextConfig;
