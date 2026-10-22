// Injected by next.config.ts so asset URLs always match the configured basePath.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function getAssetPath(path: string) {
  if (!path) return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('data:')) return path
  // Callers pass public-root paths; no "already prefixed" check, because the generic
  // '/photobooth' basePath would also match a future public/photobooth/ asset.
  return `${basePath}${path}`
}
