/** @type {import("next").NextConfig} */
const config = {
  output:
    process.env.NEXT_OUTPUT_MODE === "standalone" ? "standalone" : "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default config;
