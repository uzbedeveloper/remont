// Every model call in Remont. SAM 3.1 sees the surfaces, Muse Spark reasons and writes,
// Muse Image shows the result. Money is never computed here (see estimate.mjs).
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseImageStream, parseVideoStream, recordsOfKind, decodeMaskToRaster, decodeMaskToSVGPath, frameIndexOf,
} from '@meta-sam/parser';
import { streamResponses, sparkJSON, dataUrl, post } from './meta.mjs';
import { areas } from './estimate.mjs';
import { simplifyPath } from './geometry.mjs';

export const SURFACES = ['wall', 'floor', 'ceiling', 'door', 'window', 'radiator'];

const tri = { type: 'object', additionalProperties: false, required: ['en', 'uz', 'ru'],
  properties: { en: { type: 'string' }, uz: { type: 'string' }, ru: { type: 'string' } } };
const LANGS = `Write every {en, uz, ru} field in all three languages: English; Uzbek in Latin script, the way people in Tashkent actually talk (use o' and g' with a plain apostrophe, no long dashes); Russian.`;

const mediaPart = (dir, media) => media.kind === 'video'
  ? { type: 'input_video', video_url: dataUrl(join(dir, 'spark.mp4')) }
  : { type: 'input_image', image_url: dataUrl(join(dir, media.original)) };

// ---------- SAM 3.1: find and track each surface through the walk-around ----------

async function* replay(events) { yield* events; }

export async function segment(dir, media, prompt) {
  const part = media.kind === 'video'
    ? { type: 'input_video', video_url: dataUrl(join(dir, 'sam.mp4')) }
    : { type: 'input_image', image_url: dataUrl(join(dir, 'frames', '0001.jpg')) };
  const events = [];
  for await (const ev of streamResponses({
    model: 'sam-3.1',
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, part] }],
    metadata: { include_confidence: 'true' },
  })) events.push(ev);

  const parsed = (media.kind === 'video' ? parseVideoStream : parseImageStream)(replay(events));
  for await (const _ of parsed) { /* drain snapshots */ }
  const result = await parsed.finalResult;

  const objects = {};
  const masks = []; // [frame, objectId, svgPath, left, top]
  for (const m of recordsOfKind(result.records, 'mask')) {
    const f = media.kind === 'video' ? frameIndexOf(m) ?? 0 : 0;
    const area = decodeMaskToRaster(m.mask).reduce((s, v) => s + v, 0);
    const o = (objects[m.objectId] ??= { frames: 0, areas: [], conf: [] });
    o.frames++;
    o.areas.push(area);
    if (m.confidence !== undefined) o.conf.push(m.confidence);
    masks.push([f, String(m.objectId), simplifyPath(decodeMaskToSVGPath(m.mask)), m.bounds.left, m.bounds.top]);
  }
  const summary = Object.entries(objects).map(([id, o]) => ({
    id, frames: o.frames,
    area_px: o.areas.sort((a, b) => a - b)[o.areas.length >> 1],
    conf: o.conf.length ? +(o.conf.reduce((a, b) => a + b, 0) / o.conf.length).toFixed(2) : null,
  }));
  return { prompt, objects: summary, masks };
}

// ---------- Spark: measure the room ----------

const measureSchema = {
  type: 'object', additionalProperties: false,
  required: ['room_type', 'length_m', 'width_m', 'height_m', 'openings', 'radiators', 'sockets', 'lights', 'condition', 'observations', 'confidence', 'method'],
  properties: {
    room_type: { type: 'string', enum: ['living_room', 'bedroom', 'kitchen', 'bathroom', 'hallway', 'other'] },
    length_m: { type: 'number' }, width_m: { type: 'number' }, height_m: { type: 'number' },
    openings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['type', 'width_m', 'height_m'],
      properties: { type: { type: 'string', enum: ['door', 'window'] }, width_m: { type: 'number' }, height_m: { type: 'number' } } } },
    radiators: { type: 'integer' }, sockets: { type: 'integer' }, lights: { type: 'integer' },
    condition: { type: 'object', additionalProperties: false, required: ['walls', 'floor', 'ceiling', 'window'],
      properties: Object.fromEntries(['walls', 'floor', 'ceiling', 'window'].map(k => [k, { type: 'string', enum: ['good', 'worn', 'poor', 'none'] }])) },
    observations: { type: 'array', items: tri, description: '2-4 short things an estimator would notice' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    method: { type: 'string', description: 'one or two sentences: which objects you used as rulers' },
  },
};

export async function measure(dir, media, hint = '', effort = 'low') {
  const prompt = `You are a renovation estimator in Tashkent, Uzbekistan. Measure this room from the ${media.kind}.
Rulers: interior doors in Soviet-era flats are standard, about 2.00 m tall and 0.80 m wide (leaf). Ceilings are usually 2.50-2.80 m. Radiator sections are ~0.5-0.6 m tall, sockets sit ~0.3 m above the floor, standard tiles are 20×30 or 30×60 cm. Correct for perspective. ${media.kind === 'video' ? 'The camera walks around the room: combine what you see in all frames.' : ''}
${hint ? `The owner said while filming: "${hint}". Any size they state (room, ceiling, door) is ground truth; ignore their wishes about finishes here.` : ''}
Count sockets/switches and ceiling lights you can see. Rate the condition of each surface. ${LANGS}`;
  return sparkJSON({
    name: 'room_measure', schema: measureSchema, effort,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, mediaPart(dir, media)] }],
  });
}

// ---------- Spark: plan the works (no prices) ----------

export async function planSmeta(project, prices, brief, effort) {
  const m = project.measure;
  const a = areas(m);
  const ids = prices.items.map(i => i.id);
  const schema = {
    type: 'object', additionalProperties: false, required: ['works', 'assumptions', 'summary'],
    properties: {
      works: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['item_id', 'qty', 'why'],
        properties: { item_id: { type: 'string', enum: ids }, qty: { type: 'number' }, why: tri } } },
      assumptions: { type: 'array', items: tri },
      summary: tri,
    },
  };
  const catalog = prices.items.map(i => `${i.id} | ${i.trade} | ${i.name.en} | per ${i.unit}`).join('\n');
  const prompt = `You are a senior smetchik (renovation estimator) in Tashkent. Plan the works for this room. You do NOT price anything: you pick catalog items and quantities; prices come from our verified price base.

ROOM (measured from video): ${JSON.stringify({ room_type: m.room_type, length_m: m.length_m, width_m: m.width_m, height_m: m.height_m, openings: m.openings, radiators: m.radiators, sockets: m.sockets, lights: m.lights, condition: m.condition })}
COMPUTED: floor ${a.floor} m², ceiling ${a.ceiling} m², walls net ${a.walls_net} m² (gross ${a.walls_gross}), window area ${a.windows} m², window reveals ${a.window_reveals} m, skirting ${a.skirting} m, doors ${a.doors}, windows ${a.window_count}.

OWNER'S WISHES: ${JSON.stringify(brief.choices)}
${brief.text ? `OWNER'S NOTE: "${brief.text}"` : ''}

CATALOG (id | trade | work | unit):
${catalog}

Rules:
- Use the computed quantities exactly (walls net for wall finishes, floor area for floor and debris, reveals in metres, window area in m² for windows, skirting in metres).
- Include every step a real crew needs, including the hidden ones: demolition before new finishes, plaster only if walls are in poor condition, skim coat before paint or wallpaper, waterproofing before bathroom tiles, rough wiring before new sockets, debris removal.
- "keep" means don't touch that surface. Don't add work the owner didn't ask for unless the condition makes it unavoidable, and then say why.
- For sockets and lights, use what you counted, or a sensible number for the room type.
- why: one short line per work, as an estimator would explain it to the owner.
- assumptions: 2-4 things the price depends on. summary: one sentence about the job.
${LANGS}`;
  return sparkJSON({ name: 'smeta_plan', schema, input: prompt, effort });
}

// ---------- Spark: a job post for Telegram worker groups ----------

export async function writeAd(job, prices, ctx) {
  const t = prices.trades[job.trade];
  const scope = job.lines.map(l => `- ${l.name.en}: ${l.qty} ${l.unit}`).join('\n');
  const schema = { type: 'object', additionalProperties: false, required: ['uz', 'ru'],
    properties: { uz: { type: 'string' }, ru: { type: 'string' } } };
  const prompt = `Write a job post for a Telegram group where renovation workers in Tashkent look for jobs. We need a ${t.en} (${t.uz} / ${t.ru}).
Scope (measured from video, exact):
${scope}
Place: ${ctx.district}, Tashkent. Start: ${ctx.start}. Materials: ${ctx.materials === 'owner' ? 'the owner buys them' : 'the usta should include them'}.
Write two versions: "uz" in Uzbek Latin script as a Tashkent person would write in such a group (plain ' apostrophe, no long dashes), and "ru" in Russian.
Style: short, clear, no hype, at most 2 emoji. Lines: what is needed, the exact quantities, place and start, then ask workers to reply with: price (per m² or total), when they can start, years of experience, and photos of past work. No phone number (replies come in the group).`;
  return sparkJSON({ name: 'job_ad', schema, input: prompt });
}

// ---------- Spark: read the messy replies under the post ----------

export async function readReplies(job, prices, text) {
  const t = prices.trades[job.trade];
  const schema = {
    type: 'object', additionalProperties: false, required: ['replies'],
    properties: { replies: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['name', 'contact', 'offers', 'start', 'experience_years', 'has_photos', 'summary', 'flags'],
      properties: {
        name: { type: 'string', description: 'name or username as written, or ""' },
        contact: { type: 'string', description: 'phone or @username if given, else ""' },
        offers: { type: 'array', description: 'every price they quote; empty if no price', items: {
          type: 'object', additionalProperties: false, required: ['covers', 'price_uzs', 'basis', 'per_line', 'includes_materials'],
          properties: {
            covers: { type: 'array', items: { type: 'integer' }, description: 'indices of the job lines this price pays for; [] = the whole job' },
            price_uzs: { type: 'number', description: 'in UZS: "85 ming" = 85000, "1.2 mln" = 1200000, "$300" at 12 800 UZS/$' },
            basis: { type: 'string', enum: ['per_unit', 'total'] },
            per_line: { type: 'integer', description: 'for per_unit: index of the job line whose quantity it multiplies; -1 for total' },
            includes_materials: { type: 'boolean', description: 'true if they say materials are included ("hammasi bilan", "под ключ", "с материалом")' },
          } } },
        start: { type: 'string', description: 'when they can start, short, as said' },
        experience_years: { type: 'number', description: '0 if not said' },
        has_photos: { type: 'boolean', description: 'mentions or attaches photos of past work' },
        summary: tri,
        flags: { type: 'array', items: tri, description: 'red flags: asks for full prepayment, no price, vague scope, far away, etc. Empty if none' },
      } } } },
  };
  const prompt = `These are replies from workers under our job post for a ${t.en} in Tashkent. The job lines:
${job.lines.map((l, i) => `[${i}] ${l.name.en}: ${l.qty} ${l.unit}`).join('\n')}
Replies may mix Uzbek (Latin or Cyrillic), Russian and slang. Extract one entry per worker, in the order they appear. Ignore messages that aren't offers.
${LANGS}

REPLIES:
${text}`;
  return sparkJSON({ name: 'replies', schema, input: prompt });
}

// ---------- Muse Image: the same room, renovated ----------

// Returns the written file name (Muse Image picks the format, usually webp).
export async function renovate(heroPath, outBase, style) {
  const r = await post('/images/edits', {
    model: 'muse-image-1.0',
    n: 1,
    images: [{ image_url: dataUrl(heroPath) }],
    prompt: `Show this exact same room after a full renovation. Keep the camera angle, room shape, wall positions, door and window positions and sizes exactly the same; only change finishes and fixtures. Remove clutter and damage. Renovation: ${style}. Photorealistic, natural daylight, no people, no text.`,
  });
  const outPath = `${outBase}.${r.output_format ?? 'webp'}`;
  writeFileSync(outPath, Buffer.from(r.data[0].b64_json, 'base64'));
  return outPath;
}

// A follow-up change to an existing render ("make the walls grey"): edit the last picture, not the raw room.
export async function editRender(basePath, outBase, instruction) {
  const r = await post('/images/edits', {
    model: 'muse-image-1.0',
    n: 1,
    images: [{ image_url: dataUrl(basePath) }],
    prompt: `Edit this photo of a renovated room. Change only this: ${instruction}. Keep everything else exactly as it is: camera angle, room shape, walls, door and window positions, furniture and all other finishes. Photorealistic, natural daylight, no people, no text.`,
  });
  const outPath = `${outBase}.${r.output_format ?? 'webp'}`;
  writeFileSync(outPath, Buffer.from(r.data[0].b64_json, 'base64'));
  return outPath;
}

export function readOverlays(dir) {
  return JSON.parse(readFileSync(join(dir, 'overlays.json'), 'utf8'));
}

// ---------- Spark: read an usta's quote from photos (handwritten or printed) ----------

export async function readQuote(dir, files, prices) {
  const ids = prices.items.map(i => i.id);
  const catalog = prices.items.map(i => `${i.id} | ${i.name.en} / ${i.name.ru} | per ${i.unit}`).join('\n');
  const schema = {
    type: 'object', additionalProperties: false, required: ['usta', 'lines', 'total_uzs', 'legible', 'notes'],
    properties: {
      usta: { type: 'string', description: 'name or company on the quote, "" if none' },
      lines: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['text', 'item_id', 'surface', 'qty', 'unit', 'unit_price_uzs', 'total_uzs', 'includes_materials', 'meaning'],
        properties: {
          text: { type: 'string', description: 'the line as written, shortened' },
          item_id: { type: 'string', enum: [...ids, 'other'], description: 'closest catalog work, "other" if none fits' },
          surface: { type: 'string', enum: ['walls', 'floor', 'ceiling', 'windows', 'none'], description: 'which surface an m² line is measured on' },
          qty: { type: 'number', description: '0 if not written' },
          unit: { type: 'string', enum: ['m2', 'm', 'pcs', 'point', 'job', 'other'] },
          unit_price_uzs: { type: 'number', description: 'price per unit in UZS: "45 ming" = 45000, "45к" = 45000, "$5" at 12 800 UZS/$; 0 if not written' },
          total_uzs: { type: 'number', description: 'line total in UZS, 0 if not written' },
          includes_materials: { type: 'boolean', description: 'true if the line says materials are included (material bilan, с материалом, под ключ)' },
          meaning: tri,
        } } },
      total_uzs: { type: 'number', description: 'grand total as written, 0 if none' },
      legible: { type: 'string', enum: ['good', 'partial', 'poor'] },
      notes: { type: 'array', items: tri, description: '0-3 things worth noticing: prepayment terms, vague lines ("va boshqalar", "прочие работы"), arithmetic mistakes' },
    },
  };
  const prompt = `This is a renovation quote (smeta) an usta in Tashkent gave a homeowner: a photo of paper, maybe handwritten, in Uzbek (Latin or Cyrillic), Russian or a mix, with slang and abbreviations ("kv" = m², "shpak" = putty, "natyajnoy" = stretch ceiling, "ukladka" = laying, "ta" / "шт" = pieces). Read every priced line exactly as written. Do not fix the usta's numbers; if their arithmetic is wrong, say so in notes. Map each line to the closest catalog work.

CATALOG (id | work | unit):
${catalog}
${LANGS}`;
  return sparkJSON({
    name: 'quote_read', schema, effort: 'low',
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, ...files.map(f => ({ type: 'input_image', image_url: dataUrl(join(dir, f)) }))] }],
  });
}

// ---------- Spark: a polite reply to the usta, with the facts from the check ----------

export async function writeCounter(audit, read, prices) {
  const facts = audit.lines.filter(l => l.flags.length).map(l => {
    const parts = [`"${l.text}"`];
    if (l.flags.includes('qty_over')) parts.push(`they wrote ${l.qty} ${l.unit}, the room measures ${l.measured} ${l.unit}`);
    if (l.flags.includes('price_high')) parts.push(`${l.unit_price} UZS per ${l.unit}, the usual Tashkent rate is about ${l.fair_unit}`);
    if (l.flags.includes('price_low')) parts.push(`price looks low (${l.unit_price} vs ${l.fair_unit}): ask what exactly is included`);
    if (l.flags.includes('unclear')) parts.push('no quantity or unit price: ask what exactly it covers');
    return '- ' + parts.join('; ');
  }).join('\n');
  const missing = audit.missing.slice(0, 6).map(m => `- ${m.name.en}`).join('\n');
  const schema = { type: 'object', additionalProperties: false, required: ['uz', 'ru'], properties: { uz: { type: 'string' }, ru: { type: 'string' } } };
  const prompt = `Write a short, polite Telegram message from a homeowner in Tashkent to the usta who gave them this renovation quote. Respectful ("aka" / "ассалому алайкум"), not accusing: the owner measured the room and compared prices, and wants a corrected quote. Use the facts below with their numbers. Suggest a fair total around ${Math.round(audit.fair / 50000) * 50000} UZS for the same work. ${audit.math_off ? `The written total is ${audit.math_off > 0 ? 'higher' : 'lower'} than the sum of the lines by ${Math.abs(audit.math_off)} UZS; mention it gently.` : ''} ${read.notes.some(n => /prepay|advance|avans|аванс/i.test(n.en)) ? 'They asked for a big advance; propose paying for materials up front and the rest by stages.' : ''} Ask whether the missing works are included or will be charged later.
Usta: ${read.usta || 'unknown'}. Quote total: ${audit.quoted} UZS.
FACTS:
${facts || '- the prices look fair'}
NOT IN THE QUOTE (needed for this room):
${missing || '- nothing'}
Write "uz" in Uzbek Latin script as people in Tashkent write in Telegram (plain ' apostrophe, no long dashes), and "ru" in Russian. Numbers with spaces as thousands separators ("45 000"). At most 8 short lines, no emoji.`;
  return sparkJSON({ name: 'counter', schema, input: prompt });
}
