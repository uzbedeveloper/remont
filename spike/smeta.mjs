// Test 4: can Muse Spark build a priced work -> materials smeta with *current Tashkent prices*?
// usage: node smeta.mjs <measure.json> ["client brief"]
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { post, outputText } from './lib.mjs';

const [measureFile, brief = 'Budget renovation for renting out: remove old wallpaper, level and paint walls light grey, laminate floor, stretch ceiling, replace the old wooden window with PVC, new interior door, new radiator, new sockets and LED lights.'] = process.argv.slice(2);
if (!measureFile) { console.error('usage: node smeta.mjs <measure.json> ["brief"]'); process.exit(1); }
const room = readFileSync(measureFile, 'utf8');

const material = {
  type: 'object', additionalProperties: false,
  required: ['name', 'unit', 'qty', 'unit_price_uzs', 'source_url'],
  properties: {
    name: { type: 'string' }, unit: { type: 'string' }, qty: { type: 'number' },
    unit_price_uzs: { type: 'number' }, source_url: { type: 'string', description: 'page the price came from, or "" if estimated' },
  },
};
const schema = {
  type: 'object', additionalProperties: false,
  required: ['works', 'total_labor_uzs', 'total_materials_uzs', 'total_uzs', 'days', 'assumptions'],
  properties: {
    works: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['step', 'work', 'unit', 'qty', 'labor_price_uzs', 'materials'],
        properties: {
          step: { type: 'integer', description: 'order the crew does it in' },
          work: { type: 'string' }, unit: { type: 'string' }, qty: { type: 'number' },
          labor_price_uzs: { type: 'number', description: 'per unit' },
          materials: { type: 'array', items: material },
        },
      },
    },
    total_labor_uzs: { type: 'number' }, total_materials_uzs: { type: 'number' }, total_uzs: { type: 'number' },
    days: { type: 'number' }, assumptions: { type: 'array', items: { type: 'string' } },
  },
};

const prompt = `You are an experienced renovation estimator (smetchik) in Tashkent, Uzbekistan.
Room measurements (from photo/video analysis):
${room}
Client brief: ${brief}

Build a complete smeta: every work item in the order a crew does it (demolition first), its quantity derived from the measurements,
labor price per unit, and for each work the materials with quantities (include waste margins, e.g. +10% laminate, paint by coverage and coats).
Use web search to find CURRENT retail prices in Tashkent in UZS (olx.uz, stroy markets, store sites). Put the source URL on each material you priced from the web; use "" when estimated.
Totals must equal the sums.`;

const t0 = Date.now();
let r;
try {
  r = await post('/responses', {
    model: 'muse-spark-1.3',
    input: prompt,
    tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'UZ', city: 'Tashkent', timezone: 'Asia/Tashkent' } }],
    text: { format: { type: 'json_schema', name: 'smeta', schema, strict: true } },
  });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
// With web_search, Spark posts progress messages ("checking prices…") before the final JSON message.
const messages = r.output.filter(o => o.type === 'message');
const text = outputText({ output: messages.slice(-1) });
const progress = messages.slice(0, -1).map(m => outputText({ output: [m] }));
if (progress.length) console.log(`progress: ${progress.join(' / ')}\n`);
const out = join('out', `${basename(measureFile, '.json')}_smeta.json`);
writeFileSync(out, text);
const s = JSON.parse(text);
const fmt = n => Math.round(n).toLocaleString('ru-RU');
for (const w of s.works) {
  console.log(`${w.step}. ${w.work}: ${w.qty} ${w.unit} x ${fmt(w.labor_price_uzs)}`);
  for (const m of w.materials) console.log(`     - ${m.name}: ${m.qty} ${m.unit} x ${fmt(m.unit_price_uzs)}${m.source_url ? '  [web]' : ''}`);
}
const searches = r.output.filter(o => o.type === 'web_search_call').length;
const recomputed = s.works.reduce((t, w) => t + w.qty * w.labor_price_uzs + w.materials.reduce((a, m) => a + m.qty * m.unit_price_uzs, 0), 0);
console.log(`\nlabor ${fmt(s.total_labor_uzs)} + materials ${fmt(s.total_materials_uzs)} = ${fmt(s.total_uzs)} UZS (recomputed ${fmt(recomputed)}), ~${s.days} days`);
console.log(`assumptions: ${s.assumptions.join(' | ')}`);
console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s, ${searches} web searches, tokens in/out ${r.usage?.input_tokens}/${r.usage?.output_tokens} -> ${out}`);
