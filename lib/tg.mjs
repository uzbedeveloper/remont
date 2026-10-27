// Telegram user client (GramJS) for reading usta groups at build time.
// Credentials come from the Windows user env (app_id_telegram, app_hash_telegram);
// the login session lives in .data/tg.session and never leaves this PC.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Logger, LogLevel } from 'telegram/extensions/Logger.js';

export const SESSION_FILE = '.data/tg.session';

function userEnv(name) {
  if (process.env[name]) return process.env[name];
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', name], { encoding: 'utf8' });
      const m = out.match(new RegExp(`${name}\\s+REG_\\w+\\s+(\\S+)`, 'i'));
      if (m) return m[1];
    } catch { /* not set */ }
  }
  throw new Error(`${name} is not set`);
}

export function makeClient() {
  const session = new StringSession(existsSync(SESSION_FILE) ? readFileSync(SESSION_FILE, 'utf8').trim() : '');
  return new TelegramClient(session, Number(userEnv('app_id_telegram')), userEnv('app_hash_telegram'), {
    connectionRetries: 5,
    baseLogger: new Logger(LogLevel.ERROR),
  });
}

export function saveSession(client) {
  mkdirSync('.data', { recursive: true });
  writeFileSync(SESSION_FILE, client.session.save());
}

// Signed-in client or a clear error telling the user to log in first.
export async function connect() {
  if (!existsSync(SESSION_FILE)) throw new Error('No Telegram session. Run: node scripts/tg_login.mjs');
  const client = makeClient();
  await client.connect();
  if (!(await client.checkAuthorization())) throw new Error('Telegram session expired. Run: node scripts/tg_login.mjs');
  return client;
}
