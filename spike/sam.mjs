// Test 1: can SAM 3.1 find the room's surfaces?
// usage: node sam.mjs <photo|video> [prompt ...]
// Writes out/<name>_sam.json (per-prompt objects + pixel areas) and out/<name>_sam.html (mask overlays).
import { writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parseImageStream, parseVideoStream, recordsOfKind, decodeMaskToRaster, decodeMaskToSVGPath, frameIndexOf } from '@meta-sam/parser';
import { streamResponses, dataUrl, ffmpeg } from './lib.mjs';

const [file, ...userPrompts] = process.argv.slice(2);
if (!file) { console.error('usage: node sam.mjs <photo|video> [prompt ...]'); process.exit(1); }
const prompts = userPrompts.length ? userPrompts : ['door', 'window', 'wall', 'floor', 'ceiling', 'radiator'];
const COLORS = ['#ff3b30', '#0a84ff', '#30d158', '#ffd60a', '#bf5af2', '#ff9f0a', '#64d2ff', '#ff375f'];

const isVideo = ['.mp4', '.mov', '.m4v'].includes(extname(file).toLowerCase());
const name = basename(file, extname(file));
const OUT = 'out';
const FPS = 5; // SAM bills per frame; 5 fps is plenty for a slow walkthrough
mkdirSync(OUT, { recursive: true });

let media = file;
let framesDir;
if (isVideo) {
  media = join(OUT, `${name}_sam.mp4`);
  ffmpeg(['-i', file, '-vf', `fps=${FPS},scale=-2:720`, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', media]);
  framesDir = join(OUT, `${name}_frames`);
  mkdirSync(framesDir, { recursive: true });
  ffmpeg(['-i', media, '-q:v', '4', join(framesDir, '%04d.jpg')]);
}

const part = isVideo
  ? { type: 'input_video', video_url: dataUrl(media) }
  : { type: 'input_image', image_url: dataUrl(media) };

async function* replay(events) { yield* events; }

const summary = { file, isVideo, prompts: {} };
const overlays = {}; // frameIndex -> [{prompt, color, path, left, top}]
let frameSize = null;

for (const [pi, prompt] of prompts.entries()) {
  const t0 = Date.now();
  const events = [];
  try {
    for await (const ev of streamResponses({
      model: 'sam-3.1',
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, part] }],
      metadata: { include_confidence: 'true' },
    })) events.push(ev);
  } catch (e) {
    console.log(`${prompt}: ERROR ${e.message}`);
    summary.prompts[prompt] = { error: e.message };
    continue;
  }
  writeFileSync(join(OUT, `${name}_sam_${prompt.replace(/\W+/g, '_')}.raw.json`), JSON.stringify(events));
  const parsed = (isVideo ? parseVideoStream : parseImageStream)(replay(events));
  for await (const _ of parsed) { /* drain snapshots */ }
  const result = await parsed.finalResult;

  const sizeMatch = JSON.stringify(events).match(/w=(\d+);h=(\d+)/);
  if (sizeMatch && !frameSize) frameSize = { w: +sizeMatch[1], h: +sizeMatch[2] };

  const objects = {};
  for (const m of recordsOfKind(result.records, 'mask')) {
    const f = isVideo ? frameIndexOf(m) : 0;
    const area = decodeMaskToRaster(m.mask).reduce((s, v) => s + v, 0);
    const o = (objects[m.objectId] ??= { frames: 0, areas: [], conf: [] });
    o.frames++;
    o.areas.push(area);
    if (m.confidence !== undefined) o.conf.push(m.confidence);
    (overlays[f] ??= []).push({
      prompt, color: COLORS[pi % COLORS.length], id: m.objectId,
      path: decodeMaskToSVGPath(m.mask), left: m.bounds.left, top: m.bounds.top,
    });
  }
  const objs = Object.entries(objects).map(([id, o]) => ({
    id, frames: o.frames,
    medianAreaPx: o.areas.sort((a, b) => a - b)[o.areas.length >> 1],
    meanConf: o.conf.length ? +(o.conf.reduce((a, b) => a + b, 0) / o.conf.length).toFixed(2) : null,
  }));
  summary.prompts[prompt] = { seconds: +((Date.now() - t0) / 1000).toFixed(1), status: result.outcome.status, objects: objs };
  console.log(`${prompt}: ${objs.length} object(s) in ${summary.prompts[prompt].seconds}s ${objs.map(o => `[#${o.id} ${o.frames}f ~${o.medianAreaPx}px c=${o.meanConf}]`).join(' ')}`);
}
summary.frameSize = frameSize;
writeFileSync(join(OUT, `${name}_sam.json`), JSON.stringify(summary, null, 2));

// HTML viewer: the photo, or 8 evenly spaced video frames, with every mask drawn on top.
let frames = [0];
if (isVideo) {
  const n = readdirSync(framesDir).length;
  frames = Array.from({ length: Math.min(8, n) }, (_, i) => Math.floor((i * (n - 1)) / Math.max(1, Math.min(8, n) - 1)));
}
const { w, h } = frameSize ?? { w: 1280, h: 720 };
const imgSrc = f => (isVideo ? `${name}_frames/${String(f + 1).padStart(4, '0')}.jpg` : dataUrl(file));
const legend = prompts.map((p, i) => `<span style="color:${COLORS[i % COLORS.length]}">■ ${p}</span>`).join(' ');
const cards = frames.map(f => `
  <figure><svg viewBox="0 0 ${w} ${h}"><image href="${imgSrc(f)}" width="${w}" height="${h}"/>
  ${(overlays[f] ?? []).map(o => `<path transform="translate(${o.left} ${o.top})" d="${o.path}" fill="${o.color}" fill-opacity=".35" stroke="${o.color}" stroke-width="2"/>`).join('')}
  </svg><figcaption>${isVideo ? `frame ${f}` : name}</figcaption></figure>`).join('');
writeFileSync(join(OUT, `${name}_sam.html`), `<!doctype html><meta charset="utf-8"><title>SAM ${name}</title>
<style>body{font:14px system-ui;background:#111;color:#eee;margin:16px}svg{width:100%;height:auto}figure{margin:0 0 16px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px}</style>
<p>${legend}</p><div class="g">${cards}</div><pre>${JSON.stringify(summary, null, 2)}</pre>`);
console.log(`viewer: ${join(OUT, `${name}_sam.html`)}`);
