// Collect usta ads from public Telegram groups and channels (and the ones you're in).
// Reads only: no joining is needed for public chats, nothing is posted or marked read.
// Keeps messages that carry a phone number or an @username and talk about renovation work.
//   node scripts/ustas_tg.mjs [maxPerChat=3000] [days=120]
// Output: .data/ustas/tg/<chat>.json (one file per chat, so a rerun skips finished chats).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Api } from 'telegram';
import { connect } from '../lib/tg.mjs';
import { PHONE_RE, TRADE_RE } from '../lib/ustas.mjs';

const MAX = Number(process.argv[2] ?? 3000);
const DAYS = Number(process.argv[3] ?? 120);
const OUT = '.data/ustas/tg';
mkdirSync(OUT, { recursive: true });

const QUERIES = [
  'ustalar', 'ustalar toshkent', 'usta toshkent', 'toshkent ustalar', 'usta kerak', 'usta xizmati', 'remont toshkent', 'remont kvartir toshkent',
  'yevro remont', 'evroremont', 'kafel usta', 'kafelchi', 'santexnik toshkent', 'elektrik toshkent', 'gipsokarton toshkent', 'malyar toshkent',
  'shpaklyovka', 'natyajnoy potolok', 'laminat usta', 'oboy usta', 'qurilish ustalari', 'pardozlash', 'suvoqchi', 'svarshik toshkent',
  'ремонт квартир ташкент', 'мастера ташкент', 'отделка ташкент', 'плиточник ташкент', 'сантехник ташкент', 'электрик ташкент',
  'натяжные потолки ташкент', 'гипсокартон ташкент', 'маляр ташкент', 'строители ташкент', 'ремонт под ключ ташкент', 'мастер на час ташкент',
  'chilonzor usta', 'yunusobod usta', 'sergeli usta', 'yakkasaroy', 'mirzo ulugbek usta', 'olmazor usta', 'yashnobod', 'uchtepa',
];
// What a renovation chat looks like by its title, and what to leave out (beauty "masters", washing
// machines, car disks, other cities, ministries, religious "ustaz" channels, betting).
const WANT = /usta|уста|remont|ремонт|qurilish|қурилиш|строй|строит|мастер|kafel|кафел|plitka|плитк|santex|сантех|elektr|электр|oboy|обо|gips|гипс|shpak|шпак|malyar|маляр|molyar|потол|ish ?bor|ishchi|отдел|pardoz|eshik|deraza|rom\b|kunlik/i;
const SKIP = /model|модел|beauty|бьюти|салон|ustaz|mostbet|стиральн|kirmoshina|xaladel|diska|olmaliq|andijon|samarqand|asaka|buxoro|farg|namangan(?!lik toshkent)|фанипол|vazirlig|nazorat|минстрой|deals|машин|avto|авто|telefon|телефон|kompyuter|компьютер/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const client = await connect();
const chats = new Map();
const add = (e, via) => {
  if (!(e instanceof Api.Channel || e instanceof Api.Chat)) return;
  const title = e.title ?? '';
  if (!WANT.test(title) || SKIP.test(title)) return;
  const id = String(e.id);
  if (!chats.has(id)) chats.set(id, { id, entity: e, title, username: e.username ?? null, members: e.participantsCount ?? null, via });
};

for (const d of await client.getDialogs({ limit: 1000 })) if (d.isGroup || d.isChannel) add(d.entity, 'yours');
for (const q of QUERIES) {
  try {
    const r = await client.invoke(new Api.contacts.Search({ q, limit: 50 }));
    for (const c of r.chats) add(c, 'search');
  } catch (e) { console.log(`search "${q}": ${e.message}`); }
  await sleep(1500);
}
console.log(`${chats.size} renovation chats`);

const since = Date.now() / 1000 - DAYS * 86400;
for (const c of [...chats.values()].sort((a, b) => (b.members ?? 0) - (a.members ?? 0))) {
  const file = `${OUT}/${c.id}.json`;
  if (existsSync(file)) { console.log(`skip ${c.title} (done)`); continue; }
  const ads = [];
  let seen = 0;
  try {
    for await (const m of client.iterMessages(c.entity, { limit: MAX })) {
      if (m.date < since) break;
      seen++;
      const text = m.message ?? '';
      if (text.length < 15 || !TRADE_RE.test(text)) continue;
      const s = m.sender;
      const handle = s?.username ? `@${s.username}` : null;
      if (!PHONE_RE.test(text) && !handle && !/@\w{4,}/.test(text)) continue;
      ads.push({
        chat: c.username ?? c.id, msg: m.id, date: new Date(m.date * 1000).toISOString().slice(0, 10), text: text.slice(0, 1500),
        sender: s && !(s instanceof Api.Channel) ? { id: String(s.id), username: s.username ?? null, name: [s.firstName, s.lastName].filter(Boolean).join(' ') || null } : null,
      });
    }
  } catch (e) { console.log(`${c.title}: ${e.message}`); }
  writeFileSync(file, JSON.stringify({ id: c.id, title: c.title, username: c.username, members: c.members, via: c.via, seen, ads }));
  console.log(`${String(ads.length).padStart(5)} ads / ${String(seen).padStart(5)} msgs  ${c.title}`);
}
await client.disconnect();
process.exit(0);
