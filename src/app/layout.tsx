import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      "https://maxgfr.github.io/db-schema-viewer"
  ),
  title: {
    default: "DB Schema Viewer - Visualize & Share Database Schemas",
    template: "%s | DB Schema Viewer",
  },
  description:
    "Free, open-source database schema visualizer. Upload SQL, Prisma, Drizzle, or TypeORM schemas to get interactive ER diagrams, AI-powered reviews, and shareable URLs. Supports PostgreSQL, MySQL, SQLite, and more. 100% client-side — your data never leaves your browser.",
  keywords: [
    "database schema viewer",
    "ER diagram",
    "entity relationship diagram",
    "SQL visualizer",
    "database design tool",
    "schema visualization",
    "PostgreSQL",
    "MySQL",
    "SQLite",
    "MariaDB",
    "Prisma",
    "Drizzle ORM",
    "TypeORM",
    "DBML",
    "database diagram",
    "free ER diagram tool",
    "open source",
    "SQL to diagram",
    "database modeling",
  ],
  authors: [{ name: "maxgfr", url: "https://github.com/maxgfr" }],
  creator: "maxgfr",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "DB Schema Viewer",
    title: "DB Schema Viewer - Visualize & Share Database Schemas",
    description:
      "Free database schema visualizer with AI-powered review. Upload SQL, get interactive ER diagrams, share via URL. 100% client-side.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DB Schema Viewer - Visualize & Share Database Schemas",
    description:
      "Free database schema visualizer with AI-powered review. Upload SQL, get interactive ER diagrams, share via URL. 100% client-side.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "./",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Inline script to prevent flash of wrong theme + register service worker
const themeScript = `
(function() {
  try {
    var m = localStorage.getItem('db-schema-viewer-theme');
    var t = (m === 'light' || m === 'dark') ? m : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.classList.add(t);
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function() {});
  }
})()
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
