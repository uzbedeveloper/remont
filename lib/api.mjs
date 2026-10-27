// HTTP API. Plain node:http handlers so the same code runs locally and on a server.
import { createReadStream, createWriteStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as store from './store.mjs';
import { prepVideo, prepPhoto, heroFrame } from './media.mjs';
import { SURFACES, segment, measure, planSmeta, writeAd, readReplies, renovate } from './agents.mjs';
import { jobsFrom, priceSmeta } from './estimate.mjs';

export const prices = JSON.parse(readFileSync('data/prices_tashkent.json', 'utf8'));
export const ustas = JSON.parse(readFileSync('data/ustas.json', 'utf8'));

const VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const PHOTO = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_UPLOAD = 300 * 1024 * 1024;
const PATCHABLE = ['tier', 'district', 'hero_frame', 'measure', 'brief', 'plan_stale'];

const TYPES = {
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJSON(req) {
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 2e6) throw Object.assign(new Error('body too large'), { status: 413 }); }
  return raw ? JSON.parse(raw) : {};
}

function job(p, trade) {
  if (!p.plan) throw Object.assign(new Error('no smeta yet'), { status: 409 });
  const j = jobsFrom(priceSmeta(p.plan.works, prices, p.tier), prices).find(x => x.trade === trade);
  if (!j) throw Object.assign(new Error('no such job'), { status: 404 });
  return j;
}

// ---------- the long one: film → SAM tracking + Spark measuring, streamed as NDJSON ----------
async function analyze(id, body, res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  const emit = e => res.write(JSON.stringify(e) + '\n');
  const dir = store.projectDir(id);
  let p = store.load(id);
  try {
    emit({ step: 'prep', status: 'start' });
    const isVideo = VIDEO.has(extname(p.media.original).toLowerCase());
    const info = (isVideo ? prepVideo : prepPhoto)(dir, join(dir, p.media.original));
    p = store.update(id, x => { x.media = { ...x.media, ...info }; });
    emit({ step: 'prep', status: 'done', media: p.media });

    const overlays = { w: p.media.w, h: p.media.h, fps: p.media.fps, frames: p.media.frames, labels: {} };
    const sam = {};
    const t0 = Date.now();
    const samJobs = SURFACES.map(async prompt => {
      emit({ step: 'sam', prompt, status: 'start' });
      try {
        const r = await segment(dir, p.media, prompt);
        overlays.labels[prompt] = r.masks;
        sam[prompt] = { objects: r.objects };
        emit({ step: 'sam', prompt, status: 'done', objects: r.objects.length, frames: Math.max(0, ...r.objects.map(o => o.frames)) });
      } catch (e) {
        sam[prompt] = { error: e.message };
        emit({ step: 'sam', prompt, status: 'error', error: e.message });
      }
    });
    const measureJob = (async () => {
      emit({ step: 'measure', status: 'start' });
      const m = await measure(dir, p.media, body.hint || '');
      emit({ step: 'measure', status: 'done', measure: m });
      return m;
    })();
    const [m] = await Promise.all([measureJob, ...samJobs]);
    writeFileSync(join(dir, 'overlays.json'), JSON.stringify(overlays));
    p = store.update(id, x => {
      x.sam = { ...sam, seconds: Math.round((Date.now() - t0) / 1000) };
      x.measure_ai = m;
      x.measure = m;
      x.hero_frame ??= Math.floor((p.media.frames - 1) / 3);
      x.stage = 'measured';
    });
    emit({ step: 'done', project: p });
  } catch (e) {
    console.error(e);
    emit({ step: 'error', error: e.message });
  }
  res.end();
}

async function telegram(text) {
  const token = process.env.TG_BOT_TOKEN, chat = process.env.TG_CHAT_ID;
  if (!token || !chat) throw Object.assign(new Error('Telegram is not set up (TG_BOT_TOKEN, TG_CHAT_ID)'), { status: 501 });
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram: ${j.description}`);
  return j.result.message_id;
}

export async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    // GET /media/<id>/<file…> (a project) or /sample/<name>/<file…> (read-only, for the landing page)
    if ((parts[0] === 'media' || parts[0] === 'sample') && req.method === 'GET') {
      const dir = parts[0] === 'media' ? store.projectDir(parts[1]) : join(store.SAMPLES, parts[1].replace(/[^a-z0-9-]/g, ''));
      const file = normalize(join(dir, ...parts.slice(2)));
      if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' });
      return createReadStream(file).pipe(res);
    }
    if (parts[0] !== 'api') return false;
    const [, a, id, action] = parts;

    if (a === 'config' && req.method === 'GET') {
      return send(res, 200, { prices, ustas: ustas.ustas, telegram: Boolean(process.env.TG_BOT_TOKEN && process.env.TG_CHAT_ID) });
    }

    if (a === 'upload' && req.method === 'POST') {
      const ext = extname(url.searchParams.get('name') || '').toLowerCase();
      if (!VIDEO.has(ext) && !PHOTO.has(ext)) return send(res, 415, { error: 'send a video (mp4, mov) or a photo (jpg, png)' });
      if (+req.headers['content-length'] > MAX_UPLOAD) return send(res, 413, { error: 'file too large (300 MB max)' });
      const p = store.createProject({ media: { original: `original${ext}` }, stage: 'uploaded', tier: 'standard' });
      await pipeline(req, createWriteStream(join(store.projectDir(p.id), p.media.original)));
      return send(res, 200, p);
    }

    if (a === 'sample' && req.method === 'POST') {
      const { name = 'demo' } = await readJSON(req);
      return send(res, 200, store.cloneSample(name));
    }

    if (a !== 'project' || !id) return send(res, 404, { error: 'unknown route' });

    if (!action && req.method === 'GET') return send(res, 200, store.load(id));

    if (!action && req.method === 'PATCH') {
      const body = await readJSON(req);
      return send(res, 200, store.update(id, p => {
        for (const k of PATCHABLE) if (k in body) p[k] = body[k];
      }));
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
    const body = await readJSON(req);

    if (action === 'analyze') return analyze(id, body, res);

    if (action === 'smeta') {
      const p = store.load(id);
      if (!p.measure) return send(res, 409, { error: 'measure the room first' });
      const brief = { choices: body.choices || {}, text: String(body.text || '').slice(0, 600) };
      const plan = await planSmeta(p, prices, brief);
      return send(res, 200, store.update(id, x => {
        x.brief = brief; x.plan = plan; x.tier = body.tier || x.tier || 'standard'; x.stage = 'smeta'; x.plan_stale = false;
        x.ads = {}; x.replies = {};
      }));
    }

    if (action === 'ad') {
      const p = store.load(id);
      const j = job(p, body.trade);
      const ad = await writeAd(j, prices, {
        district: body.district || p.district || 'Tashkent',
        start: body.start || 'as soon as possible',
        materials: body.materials || 'owner',
      });
      return send(res, 200, store.update(id, x => { (x.ads ??= {})[body.trade] = { ...ad, created: new Date().toISOString() }; }));
    }

    if (action === 'replies') {
      const p = store.load(id);
      const j = job(p, body.trade);
      const text = String(body.text || '').slice(0, 12000);
      if (!text.trim()) return send(res, 400, { error: 'paste the replies first' });
      const r = await readReplies(j, prices, text);
      return send(res, 200, store.update(id, x => { (x.replies ??= {})[body.trade] = { text, items: r.replies }; }));
    }

    if (action === 'telegram') {
      const p = store.load(id);
      const ad = p.ads?.[body.trade];
      if (!ad) return send(res, 409, { error: 'write the post first' });
      const mid = await telegram(body.lang === 'ru' ? ad.ru : ad.uz);
      return send(res, 200, store.update(id, x => { x.ads[body.trade].posted = { message_id: mid, at: new Date().toISOString() }; }));
    }

    if (action === 'render') {
      const p = store.load(id);
      const dir = store.projectDir(id);
      const frame = Number.isInteger(body.frame) ? body.frame : p.hero_frame ?? 0;
      const hero = heroFrame(dir, p.media, frame, join(dir, `hero_${frame}.jpg`));
      const out = await renovate(hero, join(dir, `render_${Date.now()}`), String(body.style || '').slice(0, 400) || 'modern, warm and affordable');
      return send(res, 200, store.update(id, x => {
        x.render = { before: hero.split(/[\\/]/).pop(), after: out.split(/[\\/]/).pop(), frame, style: body.style };
      }));
    }

    return send(res, 404, { error: 'unknown action' });
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.message });
    else res.end();
  }
  return true;
}
