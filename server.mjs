// One process: the API + the app. `npm run dev` (Vite middleware) or `npm start` (built dist/).
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { handle } from './lib/api.mjs';

const PROD = process.argv.includes('--prod');
const PORT = +(process.env.PORT || 5173);
const DIST = resolve('dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

let vite;
if (!PROD) {
  const { createServer: createVite } = await import('vite');
  vite = await createVite({ server: { middlewareMode: true }, appType: 'spa' });
}

createServer(async (req, res) => {
  if (await handle(req, res) !== false) return;
  if (vite) return vite.middlewares(req, res);
  let file = normalize(join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`Remont on http://localhost:${PORT}${PROD ? '' : ' (dev)'}`);
  if (process.argv.includes('--phone')) tunnel();
});

// --phone: a temporary https link (Cloudflare quick tunnel) so a phone can use the camera and mic.
// Anyone with the link can use the app while this runs; stop it with Ctrl+C.
function tunnel() {
  const bin = process.env.CLOUDFLARED || (existsSync('C:/Program Files (x86)/cloudflared/cloudflared.exe') ? 'C:/Program Files (x86)/cloudflared/cloudflared.exe' : 'cloudflared');
  const cf = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  let shown = false;
  const scan = async buf => {
    const m = !shown && String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!m) return;
    shown = true;
    const { default: qr } = await import('qrcode-terminal');
    console.log(`
Open on your phone:  ${m[0]}
`);
    qr.generate(m[0], { small: true });
  };
  cf.stdout.on('data', scan);
  cf.stderr.on('data', scan);
  cf.on('error', e => console.error(`cloudflared: ${e.message} (install it: winget install Cloudflare.cloudflared)`));
  process.on('exit', () => cf.kill());
  process.on('SIGINT', () => process.exit(0));
}
