/** @type {import("next").NextConfig} */
const config = {
  output:
    process.env.NEXT_OUTPUT_MODE === "standalone" ? "standalone" : "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  transpilePackages: ["db-schema-toolkit"],
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.mistral.ai http://localhost:* http://127.0.0.1:*",
            "worker-src 'self' blob:",
          ].join("; "),
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
      ],
    },
  ],
};

export default config;
