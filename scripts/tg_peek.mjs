// Print a few recent text messages from a chat (phones redacted). Read-only.
//   node scripts/tg_peek.mjs <username> [n=15]
import { connect } from '../lib/tg.mjs';
const [user, n = 15] = process.argv.slice(2);
const client = await connect();
let shown = 0;
for await (const m of client.iterMessages(user, { limit: 200 })) {
  const t = (m.message ?? '').replace(/\+?\d[\d\s()-]{8,}\d/g, '[tel]').replace(/@\w+/g, '@[u]').replace(/\s+/g, ' ').trim();
  if (t.length < 15) continue;
  console.log('-', new Date(m.date * 1000).toISOString().slice(0, 10), t.slice(0, 220));
  if (++shown >= Number(n)) break;
}
await client.disconnect(); process.exit(0);
