// Find Tashkent renovation stores on Telegram: building materials, tiles, plumbing, electrical, paint,
// doors and windows, tool rental, furniture. Two kinds of source:
//  - a store's own channel: the channel is the store (its description has the phone and address, its posts the goods)
//  - marketplace groups where many sellers post: their ads are grouped by phone later, like the ustas
// Reads only: nothing is joined, posted or marked read. Paced to stay clear of flood limits; a rerun resumes.
//   node scripts/stores_tg.mjs
// Output: .data/stores/channels/<id>.json and .data/stores/groups/<id>.json; scripts/stores_build.mjs reads them.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { Api } from 'telegram';
import { connect } from '../lib/tg.mjs';
import { PHONE_RE } from '../lib/ustas.mjs';

const DIR = '.data/stores', FOUND = `${DIR}/discover.json`;
for (const d of ['channels', 'groups']) mkdirSync(`${DIR}/${d}`, { recursive: true });

const GOODS = ['qurilish mollari', 'qurilish materiallari', 'stroymaterial', 'stroy market', 'строительные материалы', 'стройматериалы', 'стройрынок',
  'kafel', 'кафель', 'плитка', 'keramogranit', 'керамогранит', 'laminat', 'ламинат', 'parket', 'паркет', 'linoleum', 'линолеум', 'oboy', 'обои',
  'santexnika', 'сантехника', 'unitaz', 'vanna', 'смесители', 'elektr mollari', 'elektrika', 'электротовары', 'электрика', 'rozetka', 'кабель',
  'kraska', 'краска', 'bo\'yoq', 'shpaklyovka', 'gipsokarton', 'гипсокартон', 'profil', 'eshik', 'двери', 'deraza', 'окна', 'plastik rom', 'alyumin rom',
  'natyajnoy potolok', 'натяжной потолок', 'radiator', 'радиаторы', 'kotel', 'котлы', 'asbob uskuna', 'инструменты', 'arenda instrument', 'аренда инструмента',
  'sement', 'цемент', 'gazoblok', 'газоблок', 'g\'isht', 'кирпич', 'armatura', 'арматура', 'mebel', 'мебель', 'oshxona mebel', 'кухни на заказ', 'shkaf kupe', 'шкаф купе', 'yumshoq mebel'];
const PLACES = ['toshkent', 'tashkent', 'ташкент'];
const MARKETS = ['jome bozori', 'джоме', 'sergeli qurilish bozori', 'qo\'yliq bozori', 'куйлюк', 'ipodrom', 'ипподром', 'chilonzor bozori', 'farhod bozori',
  'yunusobod qurilish bozori', 'малика', 'qurilish bozori', 'строительный рынок ташкент', 'stroy bozor', 'magazin toshkent', 'do\'kon toshkent'];
const QUERIES = [...new Set([...GOODS.flatMap(g => [g, `${g} ${PLACES[0]}`, `${g} ${PLACES[2]}`]), ...MARKETS])];

// Titles that look like a store or a market; other cities, jobs, ustas and unrelated shops are skipped.
const WANT = /qurilish|қурилиш|stroy|строй|material|матер|kafel|кафел|plitk|плитк|keramo|керамо|laminat|ламинат|parket|паркет|linol|линол|oboy|обо[ий]|santex|сантех|unitaz|vanna|ванн|смесит|elektr|электр|rozetk|розетк|kabel|кабел|kraska|краск|bo.?yoq|бўёқ|shpak|шпак|gips|гипс|profil|профил|eshik|двер|deraza|окн|rom\b|alyumin|алюмин|potol|потол|radiat|радиат|kotel|котел|котл|asbob|инструм|instrument|arenda|аренд|sement|цемент|blok|блок|g.?isht|кирпич|armatur|арматур|mebel|мебел|kuxn|кухн|shkaf|шкаф|bozor|бозор|рынок|market|маркет|magazin|магазин|do.?kon|дўкон|savdo|склад|sklad|optom|оптом/i;
const SKIP = /ustalar|усталар|usta kerak|ish bor|ishchi|vakans|ваканс|работа|rabota|mardikor|kunlik|kiyim|одежд|avto|авто|telefon|телефон|kompyuter|ноутбук|oziq|продукт|samarq|samark|buxoro|bukhar|farg|fergan|andijon|andijan|namangan|qarshi|karshi|nukus|urganch|termiz|navoiy|jizzax|guliston|qo.?qon|kokand|marg.?ilon|chirchiq|olmaliq|москв|moskva|росси|казах|qozog|кыргыз|bishkek/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const client = await connect();
client.floodSleepThreshold = 300;

const found = existsSync(FOUND) ? JSON.parse(readFileSync(FOUND, 'utf8')) : { done: {}, chats: {} };
const save = () => writeFileSync(FOUND, JSON.stringify(found));
const add = (e, via) => {
  if (!(e instanceof Api.Channel || e instanceof Api.Chat)) return;
  const title = e.title ?? '';
  if (!WANT.test(title) || SKIP.test(title)) return;
  const id = String(e.id);
  if (!found.chats[id]) found.chats[id] = { title, username: e.username ?? null, members: e.participantsCount ?? null, broadcast: Boolean(e.broadcast), via };
};
async function step(key, fn) {
  if (found.done[key]) return;
  try { await fn(); } catch (e) {
    console.log(`${key}: ${e.message}`);
    if (/FLOOD|disconnect|ETIMEDOUT|ENETUNREACH|ECONN/i.test(e.message)) { save(); throw e; } // a rerun resumes here
  }
  found.done[key] = true;
}

// ---------- 1. find ----------
let qi = 0;
for (const q of QUERIES) {
  await step(`q:${q}`, async () => {
    const r = await client.invoke(new Api.contacts.Search({ q, limit: 100 }));
    for (const c of r.chats) add(c, `search:${q}`);
  });
  if (++qi % 25 === 0) { save(); console.log(`${qi}/${QUERIES.length} searches, ${Object.keys(found.chats).length} chats`); }
  await sleep(1200);
}
save();
console.log(`${Object.keys(found.chats).length} chats after search`);

// Telegram's "similar channels" for the biggest store channels found so far (one level).
const seeds = Object.entries(found.chats).filter(([, c]) => c.broadcast && c.username).sort((a, b) => (b[1].members ?? 0) - (a[1].members ?? 0)).slice(0, 50);
for (const [, c] of seeds) {
  await step(`sim:${c.username}`, async () => {
    const r = await client.invoke(new Api.channels.GetChannelRecommendations({ channel: c.username }));
    for (const x of r.chats) add(x, `similar:${c.username}`);
  });
  await sleep(1500);
}
save();
console.log(`${Object.keys(found.chats).length} chats after similar channels`);

// ---------- 2. read ----------
const have = new Set([...readdirSync(`${DIR}/channels`), ...readdirSync(`${DIR}/groups`)].map(f => f.replace('.json', '')));
const todo = Object.entries(found.chats).filter(([id, c]) => !have.has(id) && c.username).sort((a, b) => (b[1].members ?? 0) - (a[1].members ?? 0));
console.log(`${todo.length} chats to read`);
const since = Date.now() / 1000 - 365 * 86400;
let n = 0;
for (const [id, c] of todo) {
  try {
    if (c.broadcast) {
      // A store channel: its description and its last posts are enough to say what it sells and where.
      const full = await client.invoke(new Api.channels.GetFullChannel({ channel: c.username }));
      const posts = [];
      for await (const m of client.iterMessages(c.username, { limit: 40 })) if ((m.message ?? '').length > 20) posts.push({ msg: m.id, date: new Date(m.date * 1000).toISOString().slice(0, 10), text: m.message.slice(0, 600) });
      writeFileSync(`${DIR}/channels/${id}.json`, JSON.stringify({ id, ...c, about: full.fullChat.about ?? '', posts }));
      console.log(`${++n}/${todo.length} channel ${String(posts.length).padStart(3)} posts  ${c.title}`);
    } else {
      // A marketplace group: keep the ads that carry a phone or a handle.
      const ads = [];
      let seen = 0;
      for await (const m of client.iterMessages(c.username, { limit: 2500 })) {
        if (m.date < since) break;
        seen++;
        const text = m.message ?? '';
        const s = m.sender;
        const handle = s?.username ? `@${s.username}` : null;
        if (text.length < 15 || (!PHONE_RE.test(text) && !handle)) continue;
        ads.push({ chat: c.username, msg: m.id, date: new Date(m.date * 1000).toISOString().slice(0, 10), text: text.slice(0, 1200),
          sender: s && !(s instanceof Api.Channel) ? { id: String(s.id), username: s.username ?? null, name: [s.firstName, s.lastName].filter(Boolean).join(' ') || null } : null });
      }
      writeFileSync(`${DIR}/groups/${id}.json`, JSON.stringify({ id, ...c, seen, ads }));
      console.log(`${++n}/${todo.length} group   ${String(ads.length).padStart(4)} ads / ${seen} msgs  ${c.title}`);
    }
  } catch (e) {
    console.log(`${c.title}: ${e.message}`);
    if (/FLOOD|disconnect|timeout|ETIMEDOUT|ENETUNREACH|ECONN/i.test(e.message)) break; // not saved: a rerun reads it again
  }
  await sleep(900);
}
await client.disconnect();
process.exit(0);
