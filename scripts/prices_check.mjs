// Check the price base against what ustas really ask in public Telegram groups.
// 1. Every saved message that puts a price next to a unit ("gipsokarton 50 000 so'm/kv", "45к за метр").
// 2. Muse Spark reads each one: which catalog work, price per unit, labour only or with materials, which city.
//    "3000 kv" is a job size, not a price: telling them apart is why a model reads them, not a regex.
// 3. Code takes the median per work and compares it with data/prices_tashkent.json.
//   node scripts/prices_check.mjs        → data/prices_check.json
// Spark answers are cached in .data/prices/read.json, so a rerun only reads new messages.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { sparkJSON } from '../lib/meta.mjs';

const base = JSON.parse(readFileSync('data/prices_tashkent.json', 'utf8'));
const IDS = base.items.map(i => i.id);
const CACHE = '.data/prices/read.json';
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

// ---------- 1. messages with a price per unit ----------
const PER_UNIT = /(\d{1,3}(?:[ .,]\d{3})+|\d+)\s*(ming|минг|тыс\.?|k\b|к\b)?\s*(?:so['ʻ’`]?m|сўм|сум|sum)?\s*(?:\/|за|dan|har|bir|1)?\s*(m2|м2|m²|м²|kv\.?|кв\.?|kvadrat|квадрат|metr|метр|pogon|погон|dona|шт|nuqta|точк)/i;
const SALARY = /maosh|oylik|зарплат|оклад|маош|ойлик/i;
const msgs = new Map();
const take = (chat, msg, date, text) => {
  const t = text.replace(/\s+/g, ' ').trim();
  const key = `${chat}/${msg}`;
  if (msgs.has(key) || SALARY.test(t) || !PER_UNIT.test(t)) return;
  if ([...msgs.values()].some(m => m.text.slice(0, 200) === t.slice(0, 200))) return; // reposts
  msgs.set(key, { key, chat, msg, date, text: t.slice(0, 900) });
};
for (const dir of ['.data/prices/tg', '.data/ustas/tg']) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    const c = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
    for (const a of c.prices ?? c.ads ?? []) take(a.chat, a.msg, a.date, a.text);
  }
}
console.log(`${msgs.size} messages name a price per unit`);

// ---------- 2. Spark reads them ----------
const schema = {
  type: 'object', additionalProperties: false, required: ['quotes'],
  properties: { quotes: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['key', 'item', 'price', 'unit', 'labor_only', 'city', 'who'],
    properties: {
      key: { type: 'string' },
      item: { type: 'string', enum: [...IDS, 'other'], description: 'the catalog work this price is for; other when none fits (facades, roofs, new buildings, materials)' },
      price: { type: 'number', description: "so'm per one unit, e.g. 50000; never the job size or the total" },
      unit: { type: 'string', enum: ['m2', 'm', 'pcs', 'point'] },
      labor_only: { type: 'boolean', description: 'true when the price is for the work alone, the owner buys materials' },
      city: { type: 'string', enum: ['tashkent', 'other', 'unknown'] },
      who: { type: 'string', enum: ['usta_offer', 'crew_rate', 'other'], description: 'usta_offer: an usta advertises his price; crew_rate: a foreman or company pays ustas this rate' },
    } } } },
};
async function read(batch) {
  const prompt = `These are public Telegram posts from Uzbekistan renovation groups (Uzbek Latin/Cyrillic and Russian, slang like "45к", "kv", "ming").
For every price per unit in a post, give one quote. Skip numbers that are a job size ("obyom 3000 kv", "5700 кв"), a total, a salary or a material's shop price.
Catalog works (id: unit, what):
${base.items.map(i => `${i.id}: ${i.unit}, ${i.name.en}`).join('\n')}
A price for "shpaklyovka"/"шпаклевка" is pls_putty, "suvoq"/"штукатурка"/"rotband" is pls_plaster, "gipsokarton" walls are other unless it is a ceiling (cl_stretch is only stretch ceilings), "kafel" on the floor tl_floor, on walls tl_wall, "laminat" fl_laminate, "styajka" fl_screed, "oboy" pt_wallpaper, "kraska"/"bo'yash" pt_wall_paint, "откос"/"atkos" wd_slopes, an electrical point el_point, a plumbing point pl_pipe_point.

${batch.map(m => `### key: ${m.key}\n${m.text.toWellFormed()}`).join('\n\n')}`;
  const r = await sparkJSON({ name: 'price_quotes', schema, effort: 'low', input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }] });
  for (const m of batch) cache[m.key] = r.quotes.filter(q => q.key === m.key);
}
const todo = [...msgs.values()].filter(m => !cache[m.key]);
const batches = [];
for (let i = 0; i < todo.length; i += 10) batches.push(todo.slice(i, i + 10));
console.log(`reading ${todo.length} with Spark in ${batches.length} batches`);
let next = 0, done = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < batches.length) {
    const b = batches[next++];
    for (let k = 0; k < 2; k++) {
      try { await read(b); break; } catch (e) { console.log(`batch failed: ${e.message.slice(0, 120)}`); }
    }
    if (++done % 5 === 0) { writeFileSync(CACHE, JSON.stringify(cache)); console.log(`${done}/${batches.length}`); }
  }
}));
writeFileSync(CACHE, JSON.stringify(cache));

// ---------- 3. compare with the price base ----------
const median = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const quotes = [...msgs.values()].flatMap(m => (cache[m.key] ?? []).map(q => ({ ...q, date: m.date })))
  .filter(q => q.item !== 'other' && q.city !== 'other' && q.price >= 1000 && q.price <= 5e6);
// Two kinds of price: what a foreman or company pays ustas on big jobs (crew rate, wholesale) and what an
// usta asks an owner (offer). A fair price for a flat sits between them, so they are kept apart.
const stats = qs => {
  if (!qs.length) return null;
  const p = qs.map(q => q.price), m = median(p);
  return { n: qs.length, median: m, low: median(p.filter(x => x <= m)), high: median(p.filter(x => x >= m)) };
};
const items = base.items.map(i => {
  const qs = quotes.filter(q => q.item === i.id && q.unit === i.unit && q.labor_only !== false);
  if (qs.length < 3) return null;
  return {
    id: i.id, name: i.name, unit: i.unit, ours: i.labor, n: qs.length,
    crew: stats(qs.filter(q => q.who === 'crew_rate')), offers: stats(qs.filter(q => q.who === 'usta_offer')),
    last: qs.map(q => q.date).sort().at(-1),
  };
}).filter(Boolean).sort((a, b) => b.n - a.n);
const out = {
  built: new Date().toISOString().slice(0, 10), messages: msgs.size, quotes: quotes.length,
  note: 'Labour prices per unit from public Telegram renovation groups, read by Muse Spark. crew = what a foreman pays ustas on big jobs; offers = what ustas ask owners.',
  items,
};
writeFileSync('data/prices_check.json', JSON.stringify(out, null, 1));
console.log(`${quotes.length} quotes on catalog works`);
const fmt = s => (s ? `${String(Math.round(s.median)).padStart(7)} (n=${s.n})` : '      -      ');
for (const i of items) console.log(`${i.id.padEnd(16)} ours ${String(i.ours).padStart(7)}   crew ${fmt(i.crew)}   offers ${fmt(i.offers)}`);
