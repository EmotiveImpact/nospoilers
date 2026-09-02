#!/usr/bin/env node
/**
 * Tiny static server for the watch-desk mockups.
 * Built so Cursor's forwarded localhost:3000 tab can iframe the pages:
 * bind 0.0.0.0, no redirects, no CSP, CORS open, correct types.
 */
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(process.cwd(), "docs/mockups")
const PORT = Number(process.env.PORT ?? 3000)
// Dual-stack: Cursor's IDE preview often connects to ::1, not 127.0.0.1.
const HOST = "::"

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
}

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] || "/")
  const trimmed = decoded === "/" ? "/index.html" : decoded
  const resolved = path.resolve(ROOT, `.${trimmed}`)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) return null
  return resolved
}

const server = createServer(async (req, res) => {
  process.stdout.write(`${req.method} ${req.url} host=${req.headers.host ?? "-"}\n`)
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Cache-Control", "no-store")
  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  const file = safeJoin(req.url ?? "/")
  if (!file) {
    res.writeHead(403)
    res.end("forbidden")
    return
  }

  try {
    let target = file
    let info = await stat(target).catch(() => null)
    if (!info) {
      const withHtml = `${target}.html`
      info = await stat(withHtml).catch(() => null)
      if (info) target = withHtml
    }
    if (info?.isDirectory()) target = path.join(target, "index.html")
    const data = await readFile(target)
    const ext = path.extname(target).toLowerCase()
    res.writeHead(200, {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(data.length),
    })
    res.end(data)
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("not found")
  }
})

server.listen({ port: PORT, host: HOST, ipv6Only: false }, () => {
  process.stdout.write(`mockups on http://localhost:${PORT}/ (dual-stack)\n`)
})
