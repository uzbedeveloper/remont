// Headless screenshots of every screen (desktop + phone). usage: node scripts/shoot.mjs [lang]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('U:/50million_is_mine/web/package.json');
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:5173';
const lang = process.argv[2] || 'uz';
const OUT = '.shots';
mkdirSync(OUT, { recursive: true });
const sample = await (await fetch(`${BASE}/api/sample`, { method: 'POST', body: '{"name":"demo"}' })).json();

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(l => localStorage.setItem('lang', l), lang);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));

const shots = [['home', '#/'], ['measure', `#/p/${sample.id}/measure`], ['smeta', `#/p/${sample.id}/smeta`], ['jobs', `#/p/${sample.id}/jobs`], ['hire', `#/p/${sample.id}/hire/floor`]];
for (const [vw, vh, tag] of [[1440, 900, 'd'], [390, 844, 'm']]) {
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 1 });
  for (const [name, hash] of shots) {
    await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1800));
    await page.screenshot({ path: `${OUT}/${tag}_${name}.png`, fullPage: tag === 'd' || name !== 'home' });
  }
}
await browser.close();
console.log('shots done', errors.length ? `ERRORS: ${[...new Set(errors)].join(' | ')}` : 'no console errors');
