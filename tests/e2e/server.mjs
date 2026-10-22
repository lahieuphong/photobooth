// Serves the static export (./out) the way GitHub Pages does: everything under
// the base path, directories resolved to index.html, unknown paths to 404.html.
// Refuses to start when the build was made for a different base path, so E2E
// can never silently test `/` while production uses `/photobooth`.
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const OUT_DIR = resolve(process.env.E2E_OUT_DIR ?? 'out')
const BASE_PATH = process.env.E2E_BASE_PATH ?? '/photobooth'
const PORT = Number(process.env.E2E_PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

const welcome = join(OUT_DIR, 'welcome', 'index.html')
if (!existsSync(welcome)) {
  console.error(`No static export at ${OUT_DIR}. Run \`yarn build\` first.`)
  process.exit(1)
}
const html = await readFile(welcome, 'utf8')
if (!html.includes(`${BASE_PATH}/_next/static/`)) {
  console.error(`The export in ${OUT_DIR} was not built for base path "${BASE_PATH}". Rebuild, or set E2E_BASE_PATH.`)
  process.exit(1)
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost')
  if (BASE_PATH && pathname !== BASE_PATH && !pathname.startsWith(`${BASE_PATH}/`)) {
    response.writeHead(404, { 'content-type': TYPES['.txt'] }).end('Outside the base path')
    return
  }

  const relative = normalize(decodeURIComponent(pathname.slice(BASE_PATH.length)) || '/')
  let file = join(OUT_DIR, relative)
  if (!file.startsWith(OUT_DIR)) {
    response.writeHead(403).end()
    return
  }

  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    const body = await readFile(file)
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body)
  } catch {
    response.writeHead(404, { 'content-type': TYPES['.html'] }).end(await readFile(join(OUT_DIR, '404.html')))
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Serving ${OUT_DIR} at http://127.0.0.1:${PORT}${BASE_PATH}/`)
})
