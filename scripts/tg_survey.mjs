// Read-only survey: how much renovation price talk is in Telegram?
// Finds usta/remont groups (yours + public search), samples recent messages,
// counts the ones that carry a price. Never joins, posts or marks anything read.
//   node scripts/tg_survey.mjs [sample=300]
import { mkdirSync, writeFileSync } from 'node:fs';
import { Api } from 'telegram';
import { connect } from '../lib/tg.mjs';

const SAMPLE = Number(process.argv[2] ?? 300);
const KEYWORDS = /usta|уста|remont|ремонт|qurilish|қурилиш|строй|строит|мастер|kafel|кафел|plitka|плитк|santex|сантех|elektr|электр|oboy|обо|gips|гипс|shpak|шпак|malyar|маляр|pol\b|ish bor|ish kerak|иш бор|ишчи|ishchi|bandlik|vakans|ваканс/i;
const QUERIES = ['usta', 'ustalar', 'usta kerak', 'remont', 'ремонт', 'ремонт ташкент', 'remont toshkent', 'qurilish', 'строительство ташкент',
  'kafel', 'plitka', 'santexnik', 'elektrik', 'мастера ташкент', 'ish bor toshkent', 'ishchi kerak', 'ustalar toshkent', 'отделка ташкент'];
// A money amount: "80 ming", "80 000 so'm", "80к", "1.5 mln", "$300", "300$", "200 тыс"
const MONEY = /(\d[\d\s.,]*\s?(ming|минг|мин\b|тыс|тысяч|k\b|к\b|so['ʻ’`]?m|сум|сўм|sum\b|mln|млн|миллион|million|\$|у\.?е|dollar|доллар))|(\$\s?\d)/i;
const UNIT = /(m2|м2|m²|м²|kv\.?\s?m|кв\.?\s?м|kvadrat|квадрат|metr|метр|dona|шт|штук|xona|комнат)/i;
const PHONE = /\+?\d[\d\s()-]{8,}\d/g;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const client = await connect();
const chats = new Map(); // id -> info

const add = (entity, via) => {
  if (!entity || !(entity instanceof Api.Channel || entity instanceof Api.Chat)) return;
  const id = String(entity.id);
  if (chats.has(id)) return void chats.get(id).via.add(via);
  chats.set(id, {
    id, entity, title: entity.title, username: entity.username ?? null,
    kind: entity instanceof Api.Chat ? 'group' : entity.broadcast ? 'channel' : 'supergroup',
    members: entity.participantsCount ?? null, via: new Set([via]),
  });
};

// 1. Chats you are already in.
const dialogs = await client.getDialogs({ limit: 1000 });
for (const d of dialogs) if ((d.isGroup || d.isChannel) && KEYWORDS.test(d.title ?? '')) add(d.entity, 'yours');
console.log(`Your chats: ${dialogs.length}, renovation-looking: ${[...chats.values()].length}`);

// 2. Public search.
for (const q of QUERIES) {
  try {
    const r = await client.invoke(new Api.contacts.Search({ q, limit: 30 }));
    for (const c of r.chats) if (KEYWORDS.test(c.title ?? '') || KEYWORDS.test(q)) add(c, 'search');
  } catch (e) { console.log(`search "${q}": ${e.message}`); }
  await sleep(1200);
}
console.log(`Candidate chats after search: ${chats.size}`);

// 3. Sample messages from each.
const rows = [];
for (const c of chats.values()) {
  const r = { title: c.title, username: c.username, kind: c.kind, members: c.members, via: [...c.via], sampled: 0, priced: 0, priced_unit: 0, first: null, last: null, examples: [], error: null };
  try {
    for await (const m of client.iterMessages(c.entity, { limit: SAMPLE })) {
      const text = m.message ?? '';
      r.sampled++;
      const d = new Date(m.date * 1000).toISOString().slice(0, 10);
      r.last ??= d; r.first = d;
      if (MONEY.test(text)) {
        r.priced++;
        if (UNIT.test(text)) {
          r.priced_unit++;
          if (r.examples.length < 3) r.examples.push(text.replace(PHONE, '[tel]').replace(/\s+/g, ' ').slice(0, 160));
        }
      }
    }
  } catch (e) { r.error = e.errorMessage ?? e.message; }
  rows.push(r);
  console.log(`${String(r.priced_unit).padStart(4)} / ${String(r.sampled).padStart(4)}  ${r.kind.padEnd(10)} ${String(r.members ?? '?').padStart(7)}  ${r.title}${r.username ? ' @' + r.username : ''}${r.error ? '  ERR ' + r.error : ''}`);
  await sleep(1500);
}

mkdirSync('.data/tg', { recursive: true });
rows.sort((a, b) => b.priced_unit - a.priced_unit);
writeFileSync('.data/tg/survey.json', JSON.stringify({ at: new Date().toISOString(), sample: SAMPLE, rows }, null, 2));
const tot = rows.reduce((s, r) => ({ sampled: s.sampled + r.sampled, priced: s.priced + r.priced, unit: s.unit + r.priced_unit }), { sampled: 0, priced: 0, unit: 0 });
console.log(`\nTOTAL chats ${rows.length}, sampled ${tot.sampled}, with money ${tot.priced}, money+unit ${tot.unit}`);
await client.disconnect();
process.exit(0);
