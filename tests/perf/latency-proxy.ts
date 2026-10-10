/**
 * An HTTP proxy in front of the local Supabase API that adds a fixed delay to
 * every request and counts them.
 *
 * This is how the cross-region cost is reproduced on one machine: the app
 * server talks to Supabase through here, so each server-side round trip costs
 * what it would between a US-East function and an Asia-Pacific database. The
 * request count is the number that matters; the delay just makes it visible.
 *
 *   LATENCY_MS=200 PORT=54399 npx tsx tests/perf/latency-proxy.ts
 *
 *   GET  /__stats   → { total, byPath }
 *   POST /__reset   → zero the counters
 *   POST /__latency?ms=N → change the delay without restarting
 */
import http from 'node:http'

const TARGET = { host: '127.0.0.1', port: 54321 }
const PORT = Number(process.env.PORT ?? 54399)
let LATENCY_MS = Number(process.env.LATENCY_MS ?? 200)

let total = 0
let byPath: Record<string, number> = {}

http
  .createServer((req, res) => {
    if (req.url === '/__stats') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ total, byPath }))
      return
    }
    if (req.url?.startsWith('/__latency')) {
      LATENCY_MS = Number(
        new URL(req.url, 'http://x').searchParams.get('ms') ?? 0,
      )
      res.end(String(LATENCY_MS))
      return
    }
    if (req.url === '/__reset') {
      total = 0
      byPath = {}
      res.end('ok')
      return
    }

    total++
    const key = `${req.method} ${(req.url ?? '').split('?')[0]}`
    byPath[key] = (byPath[key] ?? 0) + 1

    setTimeout(() => {
      const upstream = http.request(
        {
          ...TARGET,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: `${TARGET.host}:${TARGET.port}` },
        },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers)
          up.pipe(res)
        },
      )
      upstream.on('error', (e) => {
        res.statusCode = 502
        res.end(String(e))
      })
      req.pipe(upstream)
    }, LATENCY_MS)
  })
  .listen(PORT, () => {
    console.log(`latency proxy :${PORT} → :${TARGET.port} (+${LATENCY_MS}ms)`)
  })
