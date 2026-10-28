// HTTP API. Plain node:http handlers so the same code runs locally and on a server.
import { appendFileSync, createReadStream, createWriteStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, normalize } from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as store from './store.mjs';
import { prepVideo, prepPhoto, heroFrame, shrinkPhoto } from './media.mjs';
import { SURFACES, segment, measure, planSmeta, writeAd, readReplies, renovate, editRender, readQuote, writeCounter } from './agents.mjs';
import { transcribe, decide, listenToVideo, wishes } from './voice.mjs';
import { auditQuote, jobsFrom, priceSmeta } from './estimate.mjs';
import { lookFor, startChoices } from './look.mjs';

export const prices = JSON.parse(readFileSync('data/prices_tashkent.json', 'utf8'));
export const ustas = JSON.parse(readFileSync('data/ustas.json', 'utf8'));

const VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const PHOTO = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_UPLOAD = 300 * 1024 * 1024;
const PATCHABLE = ['tier', 'district', 'hero_frame', 'measure', 'brief', 'plan_stale', 'render', 'look'];
const AUDIO = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/aac': 'aac' };

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

// ---------- the long one: film → listen + measure (the owner waits), then SAM, smeta, picture (background) ----------
// The owner only waits for the measurements (~12 s). SAM tracking takes up to a minute and nothing
// on the measure screen needs it to start, so it finishes behind their back, as do a first smeta
// and a first picture. project.bg says what is still running; the app polls until it's empty.
async function analyze(id, body, res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  const emit = e => { if (!res.writableEnded) res.write(JSON.stringify(e) + '\n'); };
  const dir = store.projectDir(id);
  let p = store.load(id);
  let samJobs = [];
  const overlays = {};
  const sam = {};
  try {
    emit({ step: 'prep', status: 'start' });
    const isVideo = VIDEO.has(extname(p.media.original).toLowerCase());
    const info = (isVideo ? prepVideo : prepPhoto)(dir, join(dir, p.media.original));
    p = store.update(id, x => { x.media = { ...x.media, ...info }; });
    emit({ step: 'prep', status: 'done', media: p.media });

    Object.assign(overlays, { w: p.media.w, h: p.media.h, fps: p.media.fps, frames: p.media.frames, labels: {} });
    // SAM starts once the measurements are in: six tracking jobs at once slowed measuring to 37 s.
    let t0;
    const startSam = () => { t0 = Date.now(); samJobs = SURFACES.map(async prompt => {
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
    }); };

    // Film and talk: listening runs next to measuring; sizes the owner says override the model's.
    let voice = null;
    const listenJob = isVideo ? (async () => {
      emit({ step: 'listen', status: 'start' });
      const said = await listenToVideo(dir, join(dir, p.media.original), 40).catch(e => { console.error(e); return ''; });
      emit({ step: 'listen', status: 'done', said });
      if (!said) return;
      voice = { said, ...await wishes(said) };
      emit({ step: 'wishes', status: 'done', voice });
    })().catch(e => console.error(e)) : null;
    emit({ step: 'measure', status: 'start' });
    const m = await measure(dir, p.media, body.hint || '');
    await listenJob;
    const spoken = voice ? ['length_m', 'width_m', 'height_m'].filter(k => voice[k] > 0.5 && voice[k] < 50) : [];
    for (const k of spoken) m[k] = voice[k];
    if (spoken.length) m.spoken = spoken;
    emit({ step: 'measure', status: 'done', measure: m });
    startSam();

    p = store.update(id, x => {
      x.measure_ai = m;
      x.measure = m;
      x.voice = voice;
      if (voice?.tier) x.tier = voice.tier;
      x.hero_frame ??= Math.floor((p.media.frames - 1) / 3);
      x.stage = 'measured';
      x.bg = { sam: true, plan: !x.plan, render: !x.render, at: new Date().toISOString() };
    });
    emit({ step: 'done', project: p });
    res.end();

    background(id, p, samJobs, overlays, sam, t0);
  } catch (e) {
    console.error(e);
    emit({ step: 'error', error: e.message });
    res.end();
  }
}

const clearBg = (id, key) => store.update(id, x => { if (x.bg) x.bg[key] = false; });

// After measuring: a first smeta from what the owner said, a first picture, and the SAM overlays.
async function background(id, p, samJobs, overlays, sam, t0) {
  const dir = store.projectDir(id);
  const work = [];
  work.push(Promise.all(samJobs).then(() => {
    writeFileSync(join(dir, 'overlays.json'), JSON.stringify(overlays));
    store.update(id, x => { x.sam = { ...sam, seconds: Math.round((Date.now() - t0) / 1000) }; if (x.bg) x.bg.sam = false; });
  }).catch(e => { console.error(e); clearBg(id, 'sam'); }));

  const brief = { choices: startChoices(p), text: p.voice?.note ?? '' };
  if (p.bg.plan) work.push(planSmeta(p, prices, brief).then(plan => store.update(id, x => {
    if (x.plan) return; // the owner built one meanwhile
    x.brief = brief; x.plan = plan; x.stage = 'smeta'; x.plan_stale = JSON.stringify(x.measure) !== JSON.stringify(p.measure);
  })).catch(e => console.error(e)).finally(() => clearBg(id, 'plan')));

  if (p.bg.render) work.push(paint(id, { look: lookFor(brief.choices, p.tier || 'standard', brief.text, p.look), only_if_none: true })
    .catch(e => console.error(e)).finally(() => clearBg(id, 'render')));
  await Promise.all(work);
}

// Paint the room. fresh = from the raw frame with a full look; otherwise edit the last render.
async function paint(id, { frame, look, change, only_if_none }) {
  const p = store.load(id);
  const dir = store.projectDir(id);
  if (!p.media?.frames) throw Object.assign(new Error('analyze the video first'), { status: 409 });
  const out = join(dir, `render_${Date.now()}`);
  let file, before, f;
  if (change && p.render) {
    ({ before, frame: f } = p.render);
    file = await editRender(join(dir, p.render.after), out, change);
  } else {
    f = Number.isInteger(frame) ? frame : p.render?.frame ?? p.hero_frame ?? 0;
    const hero = heroFrame(dir, p.media, f, join(dir, `hero_${f}.jpg`));
    before = basename(hero);
    file = await renovate(hero, out, look || change || 'modern, warm and affordable');
  }
  if (only_if_none && store.load(id).render) return store.load(id); // the owner painted one meanwhile
  const style = change && p.render ? `${p.render.style ?? ''}; ${change}` : look || change;
  return store.update(id, x => {
    x.render = { before, after: basename(file), frame: f, style, change: change || null, at: new Date().toISOString() };
    (x.renders ??= p.render ? [p.render] : []).push(x.render);
  });
}

// Talk to the project: audio or text in, Spark decides, the server applies.
// Streams NDJSON so the owner sees their words, then the reply, long before a new picture is painted:
// {step:'heard', said} → {step:'reply', reply, actions} → {step:'done', …everything, project}.
async function talk(id, req, res) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim();
  let audio = null, said = '';
  if (type.startsWith('audio/')) {
    const chunks = [];
    let n = 0;
    for await (const c of req) { n += c.length; if (n > 8e6) throw Object.assign(new Error('voice note too long'), { status: 413 }); chunks.push(c); }
    audio = Buffer.concat(chunks);
  } else {
    said = String((await readJSON(req)).text || '').trim().slice(0, 600);
    if (!said) return send(res, 400, { error: 'say something first' });
  }
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  const emit = e => res.write(JSON.stringify(e) + '\n');
  try {
    if (audio) {
      said = await transcribe(store.projectDir(id), audio, AUDIO[type] || 'webm');
      if (!said) { emit({ step: 'done', said: '', heard: false, project: store.load(id) }); return res.end(); }
    }
    emit({ step: 'heard', said });

    let p = store.load(id);
    const plan = await decide(p, prices, said);
    emit({ step: 'reply', reply: plan.reply, actions: plan.actions.map(a => a.type) });
    const done = [];
    const failed = [];
    const step = async (a, fn) => { try { await fn(); done.push(a); } catch (e) { console.error(e); failed.push({ type: a.type, error: e.message }); } };
    const order = ['size', 'tier', 'smeta', 'render', 'ad', 'go'];
    for (const a of [...plan.actions].sort((x, y) => order.indexOf(x.type) - order.indexOf(y.type))) {
      if (a.type === 'size') await step(a, async () => {
        if (!p.measure) throw new Error('no measurements yet');
        p = store.update(id, x => {
          for (const k of ['length_m', 'width_m', 'height_m']) if (a[k] > 0 && a[k] < 50) x.measure[k] = a[k];
          if (x.plan) x.plan_stale = true;
        });
      });
      if (a.type === 'tier' && a.tier) await step(a, async () => { p = store.update(id, x => { x.tier = a.tier; }); });
      if (a.type === 'smeta') await step(a, async () => {
        if (!p.measure) throw new Error('measure the room first');
        const changed = Object.fromEntries(Object.entries(a.choices).filter(([, v]) => v));
        const brief = { choices: { ...(p.brief?.choices ?? startChoices(p)), ...changed }, text: [p.brief?.text, a.note].filter(Boolean).join('. ').slice(0, 600) };
        const planned = await planSmeta(p, prices, brief);
        p = store.update(id, x => { x.brief = brief; x.plan = planned; x.plan_stale = false; x.stage = 'smeta'; x.ads = {}; x.replies = {}; });
      });
      if (a.type === 'render' && a.instruction) {
        emit({ step: 'project', project: p, painting: true }); // money changes show now; the picture follows
        await step(a, async () => { p = await paint(id, { change: a.instruction }); });
      }
      if (a.type === 'ad' && a.trade) await step(a, async () => {
        const j = job(p, a.trade);
        const ad = await writeAd(j, prices, { district: p.district || 'Tashkent', start: 'as soon as possible', materials: 'owner' });
        p = store.update(id, x => { (x.ads ??= {})[a.trade] = { ...ad, created: new Date().toISOString() }; });
      });
      if (a.type === 'go') done.push(a);
    }

    const at = new Date().toISOString();
    const go = done.find(a => a.type === 'go')?.step
      || (done.some(a => a.type === 'ad') ? `hire/${done.find(a => a.type === 'ad').trade}` : '')
      || (done.some(a => ['smeta', 'tier', 'render'].includes(a.type)) ? 'smeta' : '');
    p = store.update(id, x => {
      x.chat = [...(x.chat ?? []), { who: 'me', text: said, at },
        { who: 'ai', reply: plan.reply, actions: done.map(a => a.type), failed, image: done.some(a => a.type === 'render') ? x.render?.after : null, at }].slice(-40);
    });
    emit({ step: 'done', said, heard: true, reply: plan.reply, actions: done, failed, go, project: p });
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

    // Uploads come in pieces (POST to start, PUT each piece) so a phone on a slow or proxied
    // link never sits in one long request that a tunnel times out (Cloudflare cuts at 100 s).
    if (a === 'upload' && req.method === 'POST') {
      const ext = extname(url.searchParams.get('name') || '').toLowerCase();
      const size = Number(url.searchParams.get('size') || 0);
      if (!VIDEO.has(ext) && !PHOTO.has(ext)) return send(res, 415, { error: 'send a video (mp4, mov) or a photo (jpg, png)' });
      if ((size || +req.headers['content-length']) > MAX_UPLOAD) return send(res, 413, { error: 'file too large (300 MB max)' });
      const p = store.createProject({ media: { original: `original${ext}`, size }, stage: size ? 'uploading' : 'uploaded', tier: 'standard' });
      const file = join(store.projectDir(p.id), p.media.original);
      if (size) { writeFileSync(file, ''); return send(res, 200, p); }
      await pipeline(req, createWriteStream(file)); // whole file in one go (scripts, curl)
      return send(res, 200, p);
    }

    if (a === 'upload' && id && req.method === 'PUT') {
      const p = store.load(id);
      if (p.stage !== 'uploading') return send(res, 409, { error: 'upload already finished', received: p.media.size, done: true, project: p });
      const file = join(store.projectDir(id), p.media.original);
      const have = statSync(file).size;
      const offset = Number(url.searchParams.get('offset'));
      if (offset !== have) return send(res, 409, { error: 'offset mismatch', received: have });
      const chunks = [];
      let n = 0;
      for await (const c of req) { n += c.length; if (n > 16e6) return send(res, 413, { error: 'piece too large' }); chunks.push(c); }
      appendFileSync(file, Buffer.concat(chunks));
      const received = have + n;
      if (received < p.media.size) return send(res, 200, { received, done: false });
      return send(res, 200, { received, done: true, project: store.update(id, x => { x.stage = 'uploaded'; }) });
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
    if (action === 'talk') return await talk(id, req, res);

    // A photo of an usta's quote, raw bytes. Saved smaller (Spark reads 1800 px fine).
    if (action === 'quote_photo') {
      const ext = extname(url.searchParams.get('name') || '').toLowerCase();
      if (!PHOTO.has(ext)) return send(res, 415, { error: 'send a photo (jpg, png)' });
      store.load(id);
      const dir = store.projectDir(id);
      const raw = join(dir, `quote_raw${ext}`);
      await pipeline(req, createWriteStream(raw));
      const file = `quote_${Date.now()}.jpg`;
      shrinkPhoto(raw, join(dir, file), 1800);
      return send(res, 200, { file });
    }
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

    if (action === 'check') {
      const p = store.load(id);
      const files = (body.files ?? []).filter(f => /^quote_\d+\.jpg$/.test(f)).slice(0, 4);
      if (!files.length) return send(res, 400, { error: 'add a photo of the quote first' });
      const read = await readQuote(store.projectDir(id), files, prices);
      return send(res, 200, store.update(id, x => { x.check = { files, read, at: new Date().toISOString() }; }));
    }

    if (action === 'counter') {
      const p = store.load(id);
      if (!p.check) return send(res, 409, { error: 'check a quote first' });
      const msg = await writeCounter(auditQuote(p.check.read, p, prices), p.check.read, prices);
      return send(res, 200, store.update(id, x => { x.check.counter = { ...msg, created: new Date().toISOString() }; }));
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
      return send(res, 200, await paint(id, { frame: body.frame, look: String(body.style || '').slice(0, 400) }));
    }

    return send(res, 404, { error: 'unknown action' });
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.message });
    else res.end();
  }
  return true;
}
