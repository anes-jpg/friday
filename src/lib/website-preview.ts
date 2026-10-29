/** A preview may use a separate loopback development server, never the operator origin. */
export function localPreviewUrl(raw: string, operatorOrigin: string): string {
  const url = new URL(raw)
  if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password) throw new Error("Use a local development URL, such as http://localhost:5173.")
  if (url.origin === operatorOrigin) throw new Error("Use the website's server, on a different port from FRIDAY.")
  return url.href
}
export function starterBlockPreview(markup: string): string {
  return `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:dark}body{margin:16px;background:Canvas;color:CanvasText;font:13px/1.6 system-ui}h1,h2{font-size:20px}a{color:LinkText}ul{padding-left:24px}summary{cursor:pointer}section{padding:8px}p,address{overflow-wrap:anywhere}</style><body>${markup}</body></html>`
}
