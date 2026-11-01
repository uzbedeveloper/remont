// Find more renovation chats than ustas_tg.mjs did, and read a longer history from each.
// Finds chats three ways: many more search words (trades × districts, Uzbek Latin/Cyrillic, Russian),
// Telegram's "similar channels" for the chats that had the most ads, and t.me links / @names inside ads.
// Reads only: nothing is joined, posted or marked read. Paced so the account stays clear of flood limits.
//   node scripts/tg_expand.mjs [days=365] [maxPerChat=6000]
// Output: new chats in .data/ustas/tg/<chat>.json (same format, so ustas_build.mjs picks them up), and every
// message that names a price per unit in .data/prices/tg/<chat>.json (also for chats read before).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Api } from 'telegram';
import { connect } from '../lib/tg.mjs';
import { PHONE_RE, TRADE_RE } from '../lib/ustas.mjs';

const DAYS = Number(process.argv[2] ?? 365);
const MAX = Number(process.argv[3] ?? 6000);
const OUT = '.data/ustas/tg', PRICES = '.data/prices/tg', FOUND = '.data/ustas/discover.json';
mkdirSync(OUT, { recursive: true });
mkdirSync(PRICES, { recursive: true });

const TRADES = [
  'usta', 'ustalar', 'remont', 'kafel', 'kafelchi', 'santexnik', 'elektrik', 'gipsokarton', 'malyar', 'shpaklyovka', 'suvoq', 'suvoqchi',
  'laminat', 'parket', 'oboy', 'natyajnoy', 'potolok', 'styajka', 'pol', 'eshik', 'deraza', 'plastik rom', 'svarshik', 'qurilish', 'pardozlash',
  'ремонт', 'мастер', 'мастера', 'плиточник', 'кафель', 'сантехник', 'электрик', 'гипсокартон', 'маляр', 'штукатур', 'шпаклевка', 'ламинат',
  'паркет', 'обои', 'натяжные потолки', 'стяжка', 'двери', 'окна', 'сварщик', 'строители', 'отделка', 'демонтаж', 'усталар', 'уста', 'кафелчи',
];
const PLACES = ['toshkent', 'tashkent', 'ташкент', 'тошкент', 'chilonzor', 'yunusobod', 'sergeli', 'yakkasaroy', 'mirzo ulugbek', 'olmazor',
  'yashnobod', 'uchtepa', 'shayxontohur', 'bektemir', 'mirobod', 'yangihayot', 'чиланзар', 'юнусабад', 'сергели'];
const EXTRA = ['ish bor', 'ishchi kerak', 'kunlik ish', 'mardikor', 'usta kerak', 'usta xizmati', 'ремонт под ключ', 'мастер на час', 'евроремонт',
  'yevro remont', 'qurilish materiallari', 'стройматериалы ташкент', 'remont narxlari', 'цены на ремонт', 'ремонт квартир цена', 'kvartira remont narxi',
  'smeta remont', 'смета ремонт', 'dizayn interer toshkent', 'дизайн интерьера ташкент', 'qurilish bozori', 'строительный рынок ташкент'];
const QUERIES = [...new Set([...TRADES.flatMap(t => [t, `${t} ${PLACES[0]}`, `${t} ${PLACES[2]}`]), ...TRADES.slice(0, 12).flatMap(t => PLACES.slice(4).map(p => `${t} ${p}`)), ...EXTRA])];

// Same title filter as ustas_tg.mjs, with a few more trades.
const WANT = /usta|уста|remont|ремонт|qurilish|қурилиш|строй|строит|мастер|kafel|кафел|plitka|плитк|santex|сантех|elektr|электр|oboy|обо|gips|гипс|shpak|шпак|malyar|маляр|molyar|потол|potol|ish ?bor|ishchi|отдел|pardoz|eshik|двер|deraza|окн|rom\b|kunlik|mardikor|ламинат|laminat|паркет|parket|svarsh|свар|smeta|смета|interer|интерьер/i;
const SKIP = /model|модел|beauty|бьюти|салон|ustaz|mostbet|стиральн|kirmoshina|xaladel|diska|olmaliq|andijon|samarqand|asaka|buxoro|farg|namangan(?!lik toshkent)|фанипол|vazirlig|nazorat|минстрой|deals|машин|avto|авто|telefon|телефон|kompyuter|компьютер|москв|moskva|россия|rossiya|казахст|qozog|питер|спб/i;

// A price per unit: "kafel 60 ming kv", "шпаклевка 35 000 м2", "45к за метр", "rozetka 50 000 dona".
const MONEY = /\d[\d\s.,]{0,9}\s?(?:ming|минг|тыс|k\b|к\b|so['ʻ’`]?m|сўм|сум|sum|000|\$|у\.?е)/i;
const UNIT = /m2|м2|m²|м²|kv\.?\b|кв\.?\b|kvadrat|квадрат|metr|метр|pogon|погон|dona|шт|nuqta|точк|tochka|xona|комнат/i;
const isPrice = t => MONEY.test(t) && UNIT.test(t) && TRADE_RE.test(t);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const client = await connect();
client.floodSleepThreshold = 300; // wait out short flood limits instead of failing

const known = new Set(readdirSync(OUT).map(f => f.replace('.json', '')));
const found = existsSync(FOUND) ? JSON.parse(readFileSync(FOUND, 'utf8')) : { done: {}, chats: {} };
const save = () => writeFileSync(FOUND, JSON.stringify(found));
const chats = new Map();
const add = (e, via) => {
  if (!(e instanceof Api.Channel || e instanceof Api.Chat)) return;
  const title = e.title ?? '';
  if (!WANT.test(title) || SKIP.test(title)) return;
  const id = String(e.id);
  if (!chats.has(id)) chats.set(id, { id, entity: e, title, username: e.username ?? null, members: e.participantsCount ?? null, via });
};
async function step(key, fn) {
  if (found.done[key]) return;
  try { await fn(); } catch (e) {
    console.log(`${key}: ${e.message}`);
    if (/FLOOD/.test(e.message)) { save(); throw e; } // a long flood wait: stop, a rerun resumes here
  }
  found.done[key] = true;
}

// ---------- 1. find chats ----------
for (const q of QUERIES) {
  await step(`q:${q}`, async () => {
    const r = await client.invoke(new Api.contacts.Search({ q, limit: 100 }));
    for (const c of r.chats) add(c, `search:${q}`);
  });
  await sleep(1200);
}
console.log(`${chats.size} chats after search`);

// Similar channels of the chats that had the most ads.
const old = readdirSync(OUT).map(f => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
const top = old.filter(c => c.username).sort((a, b) => b.ads.length - a.ads.length).slice(0, 60);
for (const c of top) {
  await step(`sim:${c.username}`, async () => {
    const r = await client.invoke(new Api.channels.GetChannelRecommendations({ channel: c.username }));
    for (const x of r.chats) add(x, `similar:${c.username}`);
  });
  await sleep(1500);
}
console.log(`${chats.size} chats after similar`);

// t.me links and @names that come up again and again in ads (most are people; chats are kept).
const names = new Map();
for (const c of old) for (const a of c.ads) for (const m of a.text.matchAll(/(?:t\.me\/|@)([A-Za-z]\w{4,31})/g)) {
  const k = m[1].toLowerCase();
  if (!/bot$/.test(k)) names.set(k, (names.get(k) ?? 0) + 1);
}
const oldNames = new Set(old.map(c => c.username?.toLowerCase()).filter(Boolean));
for (const [n] of [...names].filter(([n, k]) => k >= 3 && !oldNames.has(n)).sort((a, b) => b[1] - a[1]).slice(0, 120)) {
  await step(`at:${n}`, async () => {
    const r = await client.invoke(new Api.contacts.ResolveUsername({ username: n }));
    for (const x of r.chats) add(x, `link:${n}`);
  });
  await sleep(2500); // resolving names has the tightest limit
}
save();
for (const c of chats.values()) if (!known.has(c.id)) found.chats[c.id] = { title: c.title, username: c.username, members: c.members, via: c.via };
save();
// Found chats live in discover.json, so a rerun after a dropped connection reads the rest without searching again.
const fresh = Object.entries(found.chats).filter(([id, c]) => !known.has(id) && (chats.has(id) || c.username))
  .map(([id, c]) => ({ id, ...c, entity: chats.get(id)?.entity ?? c.username }));
console.log(`${Object.keys(found.chats).length} chats found, ${fresh.length} still to read`);

// ---------- 2. read the new chats ----------
const since = Date.now() / 1000 - DAYS * 86400;
let n = 0;
for (const c of fresh.sort((a, b) => (b.members ?? 0) - (a.members ?? 0))) {
  const ads = [], prices = [];
  let seen = 0;
  try {
    for await (const m of client.iterMessages(c.entity, { limit: MAX })) {
      if (m.date < since) break;
      seen++;
      const text = m.message ?? '';
      if (text.length < 15 || !TRADE_RE.test(text)) continue;
      const date = new Date(m.date * 1000).toISOString().slice(0, 10);
      if (isPrice(text)) prices.push({ chat: c.username ?? c.id, msg: m.id, date, text: text.slice(0, 1200) });
      const s = m.sender;
      const handle = s?.username ? `@${s.username}` : null;
      if (!PHONE_RE.test(text) && !handle && !/@\w{4,}/.test(text)) continue;
      ads.push({
        chat: c.username ?? c.id, msg: m.id, date, text: text.slice(0, 1500),
        sender: s && !(s instanceof Api.Channel) ? { id: String(s.id), username: s.username ?? null, name: [s.firstName, s.lastName].filter(Boolean).join(' ') || null } : null,
      });
    }
  } catch (e) {
    console.log(`${c.title}: ${e.message}`);
    if (/FLOOD|disconnect|timeout|ETIMEDOUT|ENETUNREACH|ECONN/i.test(e.message)) break; // not saved: a rerun reads this chat again
  }
  writeFileSync(`${OUT}/${c.id}.json`, JSON.stringify({ id: c.id, title: c.title, username: c.username, members: c.members, via: c.via, seen, ads }));
  writeFileSync(`${PRICES}/${c.id}.json`, JSON.stringify({ id: c.id, title: c.title, username: c.username, prices }));
  console.log(`${++n}/${fresh.length} ${String(ads.length).padStart(5)} ads ${String(prices.length).padStart(4)} prices / ${String(seen).padStart(5)} msgs  ${c.title}`);
  await sleep(800);
}

// ---------- 3. prices from chats read before (their saved ads) ----------
for (const c of old) {
  const file = `${PRICES}/${c.id}.json`;
  if (existsSync(file)) continue;
  writeFileSync(file, JSON.stringify({ id: c.id, title: c.title, username: c.username, prices: c.ads.filter(a => isPrice(a.text)).map(({ sender, ...a }) => a) }));
}
await client.disconnect();
process.exit(0);
