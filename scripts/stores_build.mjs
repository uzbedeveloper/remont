// Build the store directory: renovation stores and markets in Tashkent, read by Muse Spark.
// Sources: store channels and marketplace groups from scripts/stores_tg.mjs, and the sellers that
// ustas_build.mjs already met in the usta groups (kind "shop" in .data/ustas/read.json).
//   node scripts/stores_build.mjs        (DRY=1 counts what a run would read)
// Spark answers are cached in .data/stores/read.json; output data/stores_directory.json.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { sparkJSON } from '../lib/meta.mjs';
import { DISTRICTS, phones } from '../lib/ustas.mjs';

const CATS = ['materials', 'tiles_floor', 'plumbing', 'electrical', 'paint_walls', 'doors_windows', 'ceiling', 'heating', 'tools', 'furniture'];
const DIR = '.data/stores', CACHE = `${DIR}/read.json`;
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const read = d => (existsSync(`${DIR}/${d}`) ? readdirSync(`${DIR}/${d}`).map(f => JSON.parse(readFileSync(`${DIR}/${d}/${f}`, 'utf8'))) : []);

// ---------- 1. candidates ----------
const cands = new Map();
// a store channel is one candidate
for (const c of read('channels')) {
  const text = [c.about, ...c.posts.slice(0, 6).map(p => p.text)].join('\n').replace(/\s+/g, ' ');
  cands.set(`ch:${c.username}`, { key: `ch:${c.username}`, title: c.title, text: text.slice(0, 1400), phone: phones(c.about)[0] ?? phones(text)[0] ?? null,
    tg: `@${c.username}`, link: `https://t.me/${c.username}`, members: c.members, last: c.posts[0]?.date ?? null, source: 'channel' });
}
// marketplace ads: one candidate per phone (or handle), like the ustas
for (const g of read('groups')) for (const a of g.ads) {
  const ph = phones(a.text)[0], handle = a.sender?.username ? `@${a.sender.username}` : null, key = ph ?? handle;
  if (!key) continue;
  const c = cands.get(key) ?? cands.set(key, { key, title: a.sender?.name ?? '', texts: [], phone: ph ?? null, tg: handle, link: `https://t.me/${a.chat}/${a.msg}`,
    members: null, last: a.date, source: 'group', groups: new Set() }).get(key);
  if (c.texts.length < 3 && !c.texts.some(x => x.slice(0, 100) === a.text.slice(0, 100))) c.texts.push(a.text.replace(/\s+/g, ' ').slice(0, 450));
  c.groups.add(g.title);
  if (a.date > c.last) c.last = a.date;
}
for (const c of cands.values()) if (c.texts) c.text = `posts in: ${[...c.groups].slice(0, 3).join(' | ')}\n${c.texts.join('\n')}`;
// sellers already met in the usta groups
const ustaRead = existsSync('.data/ustas/read.json') ? JSON.parse(readFileSync('.data/ustas/read.json', 'utf8')) : {};
for (const p of Object.values(ustaRead)) {
  if (p.kind !== 'shop' || p.city === 'other' || cands.has(p.key)) continue;
  cands.set(p.key, { key: p.key, title: p.name, text: p.about.en, phone: /^998\d{9}$/.test(p.key) ? p.key : null, tg: p.key.startsWith('@') ? p.key : null,
    link: null, members: null, last: null, source: 'usta_groups' });
}
console.log(`${cands.size} candidates (${read('channels').length} channels, ${read('groups').length} groups)`);

// ---------- 2. Spark reads them ----------
const tri = { type: 'object', additionalProperties: false, required: ['en', 'uz', 'ru'], properties: { en: { type: 'string' }, uz: { type: 'string' }, ru: { type: 'string' } } };
const schema = {
  type: 'object', additionalProperties: false, required: ['stores'],
  properties: { stores: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['key', 'is_store', 'city', 'cats', 'districts', 'market', 'name', 'about'],
    properties: {
      key: { type: 'string', description: 'copy the key you were given' },
      is_store: { type: 'boolean', description: 'true only for a shop, showroom, warehouse or rental selling renovation goods (materials, finishes, plumbing, electrical, doors, windows, furniture, tools); false for ustas offering work, job ads, news, spam' },
      city: { type: 'string', enum: ['tashkent', 'tashkent_region', 'other', 'unknown'] },
      cats: { type: 'array', items: { type: 'string', enum: CATS }, description: 'what they sell. materials = cement, blocks, plaster, general building materials; tiles_floor = tiles, laminate, parquet, linoleum; paint_walls = paint, wallpaper, putty, drywall' },
      districts: { type: 'array', items: { type: 'string', enum: DISTRICTS }, description: 'Tashkent districts named in the address; [] if not said' },
      market: { type: 'string', description: 'the bazaar or market if named (e.g. "Jome bozori", "Sergeli qurilish bozori", "Qo\'yliq"), else ""' },
      name: { type: 'string', description: 'the store name as written, or ""' },
      about: { ...tri, description: 'one short line: what they sell and where, as a buyer wants to read it' },
    } } } },
};
async function ask(batch) {
  const input = `Telegram channels and posts from Uzbekistan (Uzbek Latin/Cyrillic and Russian). Say which are renovation stores, what they sell and where.
Tashkent districts: ${DISTRICTS.join(', ')} (Chilanzar = Chilonzor, Yunusabad = Yunusobod, Mirzo-Ulugbek = Mirzo Ulug'bek, Almazar = Olmazor, Yashnabad = Yashnobod, Yakkasaray = Yakkasaroy, Shaykhantakhur = Shayxontohur).
Write "about" in English, in Uzbek Latin as people in Tashkent say it (plain ' apostrophe, no long dashes) and in Russian.

${batch.map(c => `### key: ${c.key}\ntitle: ${c.title || '-'}\n${c.text}`.toWellFormed()).join('\n\n')}`;
  const r = await sparkJSON({ name: 'stores', schema, effort: 'low', input });
  for (const s of r.stores) if (batch.some(c => c.key === s.key)) cache[s.key] = s;
  for (const c of batch) cache[c.key] ??= { key: c.key, is_store: false };
}
const todo = [...cands.values()].filter(c => !cache[c.key]);
const batches = [];
for (let i = 0; i < todo.length; i += 10) batches.push(todo.slice(i, i + 10));
console.log(`reading ${todo.length} with Spark in ${batches.length} batches`);
if (process.env.DRY) process.exit(0);
let next = 0, done = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < batches.length) {
    const b = batches[next++];
    for (let k = 0; k < 2; k++) { try { await ask(b); break; } catch (e) { console.log(`batch failed: ${e.message.slice(0, 120)}`); } }
    if (++done % 10 === 0) { writeFileSync(CACHE, JSON.stringify(cache)); console.log(`${done}/${batches.length}`); }
  }
}));
writeFileSync(CACHE, JSON.stringify(cache));

// ---------- 3. write ----------
const stores = [...cands.values()].map(c => ({ c, s: cache[c.key] }))
  .filter(({ s }) => s?.is_store && s.city !== 'other' && s.cats?.length)
  .map(({ c, s }) => ({
    id: c.key.replace(/^ch:|^@/, '').slice(-24), name: s.name || c.title || null, cats: s.cats, districts: s.districts, market: s.market || null, city: s.city,
    about: s.about, phone: c.phone, tg: c.tg, link: c.link, members: c.members, last_seen: c.last, source: c.source,
  }))
  .sort((a, b) => (b.members ?? 0) - (a.members ?? 0) || String(b.last_seen).localeCompare(String(a.last_seen)));
const out = { built: new Date().toISOString().slice(0, 10), sources: { channels: read('channels').length, groups: read('groups').length, candidates: cands.size }, stores };
writeFileSync('data/stores_directory.json', JSON.stringify(out, null, 1));
const count = {};
for (const s of stores) for (const k of s.cats) count[k] = (count[k] ?? 0) + 1;
console.log(`directory: ${stores.length} stores`, count);
