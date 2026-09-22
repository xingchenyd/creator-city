import type { NextConfig } from "next";

const appRoot = process.cwd();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: appRoot,
  turbopack: { root: appRoot },
  async rewrites() {
    const chat = process.env.CHAT_DEBATE_INTERNAL_URL || "http://127.0.0.1:5190";
    const api = process.env.CHAT_API_INTERNAL_URL || "http://127.0.0.1:8811";
    return [
      { source: "/chat-debate", destination: `${chat}/chat-debate/` },
      { source: "/chat-debate/:path*", destination: `${chat}/chat-debate/:path*` },
      { source: "/api/health", destination: `${api}/api/health` },
      { source: "/api/chat/:path*", destination: `${api}/api/chat/:path*` },
    ];
  },
};

export default nextConfig;
