// One process: the API + the app. `npm run dev` (Vite middleware) or `npm start` (built dist/).
import { createServer } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { networkInterfaces } from 'node:os';
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { handle } from './lib/api.mjs';

const PROD = process.argv.includes('--prod');
const LAN = process.argv.includes('--lan');
const PORT = +(process.env.PORT || 5173);
const DIST = resolve('dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

let vite;
if (!PROD) {
  const { createServer: createVite } = await import('vite');
  vite = await createVite({ server: { middlewareMode: true }, appType: 'spa' });
}

const app = async (req, res) => {
  if (await handle(req, res) !== false) return;
  if (vite) return vite.middlewares(req, res);
  let file = normalize(join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
};

if (LAN) lan();
else createServer(app).listen(PORT, () => {
  console.log(`Remont on http://localhost:${PORT}${PROD ? '' : ' (dev)'}`);
  if (process.argv.includes('--phone')) tunnel();
});

// --lan: https on this computer's Wi-Fi address, for a phone on the same network. The certificate is
// self-made, so the phone warns once ("not private" → Advanced → continue); the camera and mic then work.
function lan() {
  const ip = Object.entries(networkInterfaces())
    .filter(([n]) => !/virtual|vethernet|vmware|loopback/i.test(n))
    .flatMap(([n, a]) => a.filter(x => x.family === 'IPv4' && !x.internal && !x.address.startsWith('192.168.56.')).map(x => ({ n, ip: x.address })))
    .sort((a, b) => /wi-?fi|wlan/i.test(b.n) - /wi-?fi|wlan/i.test(a.n))[0]?.ip || '127.0.0.1';
  const key = '.data/lan-key.pem', cert = '.data/lan-cert.pem';
  if (!existsSync(cert)) {
    mkdirSync('.data', { recursive: true });
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365', '-keyout', key, '-out', cert,
      '-subj', '/CN=remont-local', '-addext', `subjectAltName=IP:${ip},DNS:localhost`], { stdio: 'ignore' });
  }
  createHttps({ key: readFileSync(key), cert: readFileSync(cert) }, app).listen(PORT, '0.0.0.0', async () => {
    const url = `https://${ip}:${PORT}`;
    console.log(`Remont on ${url}  (and https://localhost:${PORT} here)

Open on your phone (same Wi-Fi):  ${url}
`);
    const { default: qr } = await import('qrcode-terminal');
    qr.generate(url, { small: true });
  });
}

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
