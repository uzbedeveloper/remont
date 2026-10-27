// One-time Telegram login. Run it yourself in a terminal:
//   node scripts/tg_login.mjs
// Telegram sends a code to your app; type it here. The session is saved to .data/tg.session.
import { createInterface } from 'node:readline/promises';
import { makeClient, saveSession, SESSION_FILE } from '../lib/tg.mjs';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const client = makeClient();

await client.start({
  phoneNumber: () => rl.question('Phone number (+998...): '),
  phoneCode: () => rl.question('Code from Telegram: '),
  password: () => rl.question('2FA password (if you have one): '),
  onError: e => console.error('Login error:', e.message),
});
saveSession(client);
const me = await client.getMe();
console.log(`\nSigned in as ${me.firstName ?? ''} ${me.lastName ?? ''} (@${me.username ?? '-'}). Session saved to ${SESSION_FILE}.`);
rl.close();
await client.disconnect();
process.exit(0);
