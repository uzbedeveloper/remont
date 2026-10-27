// Deeper count in usta groups: unique messages that name a renovation price. Read-only.
import { connect } from '../lib/tg.mjs';
const GROUPS = process.argv.slice(3);
const N = Number(process.argv[2]);
const TRADE = /kafel|кафел|plitk|плитк|malyar|маляр|shpak|шпак|shtukat|штукат|gips|гипс|laminat|ламинат|parket|паркет|oboy|обо[йи]|santex|сантех|elektr|электр|styajk|стяжк|stashka|potolok|патол|шифт|shift|suvoq|сувок|beton|бетон|demontaj|демонтаж|remont|ремонт/i;
const MONEY = /\d[\d\s.,]*\s?(ming|минг|тыс|k\b|к\b|so['ʻ’`‘]?m|сум|сўм|mln|млн|\$|dollar|доллар|у\.?е)/i;
const UNIT = /(m2|м2|m²|м²|kv\.?\s?m|кв\.?\s?м|kvadrat|квадрат|\bmetr|\bметр|kv\b|кв\b)/i;
const client = await connect();
let all = { msgs: 0, uniq: 0, hit: 0 }; const ex = [];
for (const g of GROUPS) {
  const seen = new Set(); let msgs = 0, hit = 0, first = '';
  try {
    for await (const m of client.iterMessages(g, { limit: N })) {
      msgs++; first = new Date(m.date * 1000).toISOString().slice(0, 10);
      const t = (m.message ?? '').replace(/\s+/g, ' ').trim(); const key = t.slice(0, 80).toLowerCase();
      if (t.length < 10 || seen.has(key)) continue; seen.add(key);
      if (TRADE.test(t) && MONEY.test(t) && UNIT.test(t)) { hit++; if (ex.length < 14) ex.push(t.replace(/\+?\d[\d\s()-]{8,}\d/g, '[tel]').replace(/@\w+/g, '@[u]').slice(0, 200)); }
    }
  } catch (e) { console.log(g, 'ERR', e.errorMessage ?? e.message); }
  console.log(`${g.padEnd(34)} msgs ${String(msgs).padStart(5)}  unique ${String(seen.size).padStart(5)}  priced ${String(hit).padStart(4)}  since ${first}`);
  all.msgs += msgs; all.uniq += seen.size; all.hit += hit;
  await new Promise(r => setTimeout(r, 2000));
}
console.log('TOTAL', all); console.log('\nexamples:'); ex.forEach(e => console.log('-', e));
await client.disconnect(); process.exit(0);
