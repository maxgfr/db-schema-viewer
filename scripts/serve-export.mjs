import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("out");
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
createServer(async (request, response) => {
  try {
    if (request.headers.cookie?.includes("test-offline=yes")) { request.socket.destroy(); return; }
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (base && !pathname.startsWith(base + "/")) { response.writeHead(404).end(); return; }
    const path = pathname.slice(base.length);
    const file = resolve(root, "." + path + (path.endsWith("/") ? "index.html" : ""));
    if (!file.startsWith(root + "/")) { response.writeHead(403).end(); return; }
    const data = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" });
    response.end(data);
  } catch { response.writeHead(404).end("Not found"); }
}).listen(Number(process.env.PORT ?? 43871), "127.0.0.1");
