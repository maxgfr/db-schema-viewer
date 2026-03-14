import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DB Schema Viewer",
    short_name: "Schema Viewer",
    description:
      "Free, open-source database schema visualizer. Upload SQL, get interactive ER diagrams, AI-powered reviews, and share via URL.",
    start_url: "./",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#6366f1",
    icons: [
      {
        src: "./icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
