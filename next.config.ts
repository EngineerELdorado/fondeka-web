import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.FONDEKA_NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/:path((?!api-guides/?$).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: "/api-guides",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors https://www.fondeka.com https://fondeka.com${process.env.NODE_ENV === "development" ? " http://localhost:* http://127.0.0.1:*" : ""}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
