// Collect Tashkent renovation-service ads from OLX.uz (category 824 "construction / repair", city 4 = Tashkent),
// then reveal one phone per seller, slowly. Resumable: progress lives in .data/ustas/olx.json.
//   node scripts/ustas_olx.mjs [phoneBudget=400]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { OLX_DISTRICT, TRADE_RE } from '../lib/ustas.mjs';

const BUDGET = Number(process.argv[2] ?? 400);
const FILE = '.data/ustas/olx.json';
mkdirSync('.data/ustas', { recursive: true });
const db = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { ads: {}, phones: {}, searched: [] };
const save = () => writeFileSync(FILE, JSON.stringify(db));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', Accept: 'application/json' };

// OLX shows at most 1000 results per search, so search per trade word and merge.
const QUERIES = ['', 'кафель', 'плиточник', 'kafel', 'сантехник', 'santexnik', 'электрик', 'elektrik', 'маляр', 'malyar', 'шпаклевка', 'штукатур',
  'гипсокартон', 'натяжной потолок', 'потолок', 'ламинат', 'стяжка', 'обои', 'ремонт квартир', 'евроремонт', 'отделка', 'демонтаж', 'двери установка',
  'окна', 'сварщик', 'мастер на час', 'usta', 'remont', 'pardozlash'];

const strip = html => String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

for (const q of QUERIES) {
  if (db.searched.includes(q)) continue;
  let added = 0, blocked = false;
  for (let offset = 0; offset < 1000; offset += 50) {
    const url = `https://www.olx.uz/api/v1/offers/?offset=${offset}&limit=50&category_id=824&city_id=4${q ? `&query=${encodeURIComponent(q)}` : ''}`;
    const r = await fetch(url, { headers: UA });
    if (!r.ok) { console.log(`"${q}" ${offset}: HTTP ${r.status}`); blocked = true; break; }
    const { data } = await r.json();
    for (const o of data) {
      if (db.ads[o.id]) continue;
      db.ads[o.id] = {
        id: o.id, url: o.url, title: o.title, text: strip(o.description).slice(0, 1500), date: (o.last_refresh_time || o.created_time).slice(0, 10),
        user: String(o.user.id), name: o.contact?.name || o.user.name || null, business: Boolean(o.business),
        district: OLX_DISTRICT[o.location?.district?.name] ?? null, photos: o.photos?.length ?? 0, has_phone: Boolean(o.contact?.phone),
      };
      added++;
    }
    if (data.length < 50) break;
    await sleep(3000 + Math.random() * 2000); // OLX answers 403 to fast clients
  }
  if (blocked) { save(); console.log('OLX is refusing requests; try again later'); break; }
  db.searched.push(q);
  save();
  console.log(`"${q}": +${added} (total ${Object.keys(db.ads).length})`);
}

// One phone per seller, for ads that are about renovation work.
const sellers = new Map();
for (const a of Object.values(db.ads)) {
  if (!a.has_phone || !TRADE_RE.test(`${a.title} ${a.text}`)) continue;
  if (!sellers.has(a.user) || a.date > sellers.get(a.user).date) sellers.set(a.user, a);
}
let used = 0;
for (const [user, a] of sellers) {
  if (db.phones[user] !== undefined) continue;
  if (used++ >= BUDGET) break;
  const r = await fetch(`https://www.olx.uz/api/v1/offers/${a.id}/limited-phones/`, { headers: UA });
  if (r.status === 429 || r.status === 403) { console.log(`phones: HTTP ${r.status}, stopping for now`); break; }
  if (!r.ok) { console.log(`phones: HTTP ${r.status}, stopping for now`); break; } // retried next run
  db.phones[user] = (await r.json()).data?.phones ?? [];
  if (used % 25 === 0) { save(); console.log(`phones ${Object.keys(db.phones).length}/${sellers.size}`); }
  await sleep(2500 + Math.random() * 1500);
}
save();
console.log(`ads ${Object.keys(db.ads).length}, renovation sellers ${sellers.size}, phones ${Object.values(db.phones).filter(p => p.length).length}`);
