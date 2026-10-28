// Build the usta directory from the collected Telegram (and OLX) ads.
// 1. Group ads by phone number (or by the poster's @username when there is no phone).
// 2. Muse Spark reads each group's ads in batches: is this an usta offering work in Tashkent, which trades,
//    which districts, a name, experience. Employers ("ishchi kerak"), shops and other cities are dropped.
// 3. Write data/ustas_directory.json for the app.
//   node scripts/ustas_build.mjs [limit]
// Spark answers are cached in .data/ustas/read.json, so a rerun only reads new groups.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { sparkJSON } from '../lib/meta.mjs';
import { DISTRICTS, phones } from '../lib/ustas.mjs';

const LIMIT = Number(process.argv[2] ?? Infinity);
const prices = JSON.parse(readFileSync('data/prices_tashkent.json', 'utf8'));
const TRADES = Object.keys(prices.trades);
const CACHE = '.data/ustas/read.json';
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

// ---------- 1. group ----------
const groups = new Map();
const group = key => groups.get(key) ?? groups.set(key, { key, phones: new Set(), handles: new Set(), names: new Set(), ads: [], chats: new Set(), titles: new Set(), photos: false, olx_district: null }).get(key);
const bySender = new Map(); // telegram sender id → group key, so their phone-less posts join the same usta

const tgAds = [];
for (const f of readdirSync('.data/ustas/tg')) {
  const c = JSON.parse(readFileSync(`.data/ustas/tg/${f}`, 'utf8'));
  for (const a of c.ads) tgAds.push({ ...a, chat_title: c.title, public: Boolean(c.username) });
}
tgAds.sort((a, b) => b.date.localeCompare(a.date));
for (const a of tgAds) {
  const ph = phones(a.text);
  const handle = a.sender?.username ? `@${a.sender.username}` : null;
  const key = ph[0] ?? bySender.get(a.sender?.id) ?? handle;
  if (!key) continue;
  if (a.sender?.id && !bySender.has(a.sender.id)) bySender.set(a.sender.id, key);
  const g = group(key);
  ph.forEach(p => g.phones.add(p));
  if (handle) g.handles.add(handle);
  if (a.sender?.name) g.names.add(a.sender.name);
  g.chats.add(a.chat);
  g.titles.add(a.chat_title);
  g.ads.push({ src: 'telegram', date: a.date, text: a.text, link: a.public ? `https://t.me/${a.chat}/${a.msg}` : null });
}

if (existsSync('.data/ustas/olx.json')) {
  const olx = JSON.parse(readFileSync('.data/ustas/olx.json', 'utf8'));
  for (const a of Object.values(olx.ads)) {
    const ph = [...phones(a.text), ...phones((olx.phones[a.user] ?? []).join(' '))];
    if (!ph.length) continue;
    const g = group(ph[0]);
    ph.forEach(p => g.phones.add(p));
    if (a.name) g.names.add(a.name);
    g.chats.add('olx');
    g.titles.add(`OLX, Tashkent${a.district ? `, ${a.district}` : ''}`);
    g.photos ||= a.photos > 0;
    g.olx_district ??= a.district;
    g.ads.push({ src: 'olx', date: a.date, text: `${a.title}\n${a.text}`, link: a.url });
  }
}
console.log(`${tgAds.length} telegram ads → ${groups.size} people`);

// ---------- 2. read with Spark ----------
const tri = { type: 'object', additionalProperties: false, required: ['en', 'uz', 'ru'], properties: { en: { type: 'string' }, uz: { type: 'string' }, ru: { type: 'string' } } };
const schema = {
  type: 'object', additionalProperties: false, required: ['people'],
  properties: { people: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['key', 'kind', 'name', 'trades', 'districts', 'city', 'years', 'materials', 'shows_work', 'langs', 'about'],
    properties: {
      key: { type: 'string', description: 'copy the key you were given' },
      kind: { type: 'string', enum: ['usta', 'crew', 'company', 'employer', 'shop', 'other'], description: 'usta/crew/company = offers renovation work; employer = looking for workers or a client looking for an usta; shop = sells materials' },
      name: { type: 'string', description: 'the name they sign with, or "" (never invent one)' },
      trades: { type: 'array', items: { type: 'string', enum: TRADES }, description: 'renovation trades they offer; [] if none fit' },
      districts: { type: 'array', items: { type: 'string', enum: [...DISTRICTS, 'all'] }, description: 'Tashkent districts they name; ["all"] if they say all of Tashkent; [] if not said' },
      city: { type: 'string', enum: ['tashkent', 'tashkent_region', 'other', 'unknown'] },
      years: { type: 'number', description: 'years of experience if said, else 0' },
      materials: { type: 'boolean', description: 'they can bring / buy the materials' },
      shows_work: { type: 'boolean', description: 'they mention photos, a portfolio or a channel with their work' },
      langs: { type: 'array', items: { type: 'string', enum: ['uz', 'ru'] } },
      about: { ...tri, description: 'one short line: what they do, as a client would want to read it' },
    } } } },
};
const TRADE_HELP = Object.entries(prices.trades).map(([k, v]) => `${k} = ${v.en} (${v.uz} / ${v.ru})`).join('; ');

async function read(batch) {
  const input = `These are ads from Telegram groups and OLX in Uzbekistan where renovation workers (ustalar) offer their services, mixed with employers looking for workers, shops and ads from other cities. Each block is one phone number or Telegram user with their recent posts. For each, say what they are.
Trades: ${TRADE_HELP}. A "malyar" usually does plaster, putty and paint (plasterer + painter); "kafelchi" = tiler; "gipsokarton"/"natyajnoy" = ceiling; "laminat"/"styajka" = floor; "rom"/"eshik"/"deraza" = windows_doors; "demontaj"/"buzish" = demolition.
Districts: ${DISTRICTS.join(', ')} (also Chilanzar = Chilonzor, Yunusabad = Yunusobod, Mirzo-Ulugbek = Mirzo Ulug'bek, Almazar = Olmazor, Shaykhantakhur = Shayxontohur, Yashnabad = Yashnobod, Yakkasaray = Yakkasaroy). Toshkent shahar = city "tashkent"; Chirchiq, Olmaliq, Yangiyo'l, Zangiota, Qibray = "tashkent_region". The group names they post in are a strong hint: someone who only posts in "Kosonsoy ustalari", "Samarqand", "Farg'ona" or "Marg'ilon" groups works there ("other"); someone in "Toshkent ustalari" works in Tashkent, unless the ad says otherwise. Use "unknown" only when nothing hints.
Write "about" in English, in Uzbek Latin as people in Tashkent say it (plain ' apostrophe, no long dashes) and in Russian.

${batch.map(g => `### key: ${g.key}\nposts in: ${[...g.titles].slice(0, 4).join(' | ')}\n${g.ads.slice(0, 3).map(a => `- ${a.text.replace(/\s+/g, ' ').slice(0, 450).toWellFormed()}`).join('\n')}`).join('\n\n')}`;
  const r = await sparkJSON({ name: 'ustas', schema, input });
  for (const p of r.people) if (batch.some(g => g.key === p.key)) cache[p.key] = p;
}

const todo = [...groups.values()].filter(g => !cache[g.key]).slice(0, LIMIT);
const batches = [];
for (let i = 0; i < todo.length; i += 12) batches.push(todo.slice(i, i + 12));
console.log(`reading ${todo.length} with Spark in ${batches.length} batches`);
let next = 0, done = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < batches.length) {
    const b = batches[next++];
    for (let attempt = 0; attempt < 2; attempt++) {
      try { await read(b); break; } catch (e) { console.log(`batch failed: ${e.message.slice(0, 120)}`); }
    }
    if (++done % 10 === 0) { writeFileSync(CACHE, JSON.stringify(cache)); console.log(`${done}/${batches.length}`); }
  }
}));
writeFileSync(CACHE, JSON.stringify(cache));

// ---------- 3. write the directory ----------
const ustas = [];
for (const g of groups.values()) {
  const p = cache[g.key];
  if (!p || !['usta', 'crew', 'company'].includes(p.kind) || !p.trades.length || !['tashkent', 'tashkent_region', 'unknown'].includes(p.city)) continue;
  const phone = [...g.phones][0] ?? null;
  const dates = g.ads.map(a => a.date).sort();
  ustas.push({
    id: (phone ?? g.key.replace('@', 'tg_')).slice(-12),
    // The name signed in the ad, else a Telegram display name that looks like a person ("Bobur", "Akmal Karimov"),
    // not "MARKETOLOG", "Sadullaev news" or fancy Unicode.
    name: (p.name.normalize('NFKC').trim().length > 1 && p.name.normalize('NFKC').trim())
      || [...g.names].map(n => n.normalize('NFKC').trim()).find(n => /^(\p{Lu}[\p{Ll}'ʻ’]+)( \p{Lu}[\p{Ll}'ʻ’]+){0,2}$/u.test(n) && !/usta|news|group|servis|service|admin|remont|xizmat|moscow|москва|toshkent|tashkent|ташкент|uzbek|o'zbek/i.test(n))
      || null,
    kind: p.kind,
    phone,
    tg: [...g.handles][0] ?? null,
    trades: p.trades,
    districts: p.districts.length ? p.districts : g.olx_district ? [g.olx_district] : [],
    city: p.city,
    years: p.years,
    materials: p.materials,
    photos: p.shows_work || g.photos,
    langs: p.langs,
    about: p.about,
    posts: g.ads.length,
    first_seen: dates[0],
    last_seen: dates.at(-1),
    sources: [...new Set(g.ads.map(a => a.src))],
    ads: g.ads.filter(a => a.link).slice(0, 3).map(a => a.link),
  });
}
ustas.sort((a, b) => b.last_seen.localeCompare(a.last_seen));
const byTrade = Object.fromEntries(TRADES.map(t => [t, ustas.filter(u => u.trades.includes(t)).length]));
writeFileSync('data/ustas_directory.json', JSON.stringify({
  built: new Date().toISOString().slice(0, 10),
  note: 'Real ustas who advertise their services in public Telegram groups and on OLX.uz. Built by scripts/ustas_tg.mjs, ustas_olx.mjs and ustas_build.mjs (Muse Spark reads the ads).',
  sources: { telegram_chats: readdirSync('.data/ustas/tg').length, telegram_ads: tgAds.length, people: groups.size },
  ustas,
}, null, 1));
console.log(`directory: ${ustas.length} ustas`, byTrade);
