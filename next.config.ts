import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // компактная сборка для Docker
  // нативный модуль argon2 не бандлится
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
  // загрузка файлов работ в «Антиплагиат» (до 10 МБ)
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
