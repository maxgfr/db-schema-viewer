import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "DB Schema Viewer - Visualize Database Schemas",
  description:
    "Client-side database schema visualizer with AI-powered analysis. Upload SQL, visualize, share, export. No backend needed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
            },
          }}
        />
      </body>
    </html>
  );
}
