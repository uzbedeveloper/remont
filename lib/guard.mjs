// Limits for the public site (PUBLIC=1): every visitor has a daily allowance per paid action, and the
// whole site has a daily cap on Meta API calls, so a stranger can't spend the key. Off on a laptop.
export const PUBLIC = process.env.PUBLIC === '1';

// Per visitor (IP) per day. Actions not listed are free (they don't call a model).
const PER_IP = {
  upload: 4, analyze: 4, smeta: 15, render: 12, talk: 40, check: 6, quote_photo: 6, photo: 10, done_photo: 10,
  counter: 10, ad: 10, replies: 10,
};
const DAILY_CALLS = +(process.env.DAILY_CALLS || 1500);

let day = '', calls = 0;
const used = new Map();
const today = () => new Date().toISOString().slice(0, 10);
function roll() { if (day !== today()) { day = today(); calls = 0; used.clear(); } }

const tooMany = msg => Object.assign(new Error(msg), { status: 429 });

export function ipOf(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
}

// Called before an API action runs. Throws 429 when this visitor used up today's allowance.
export function allow(req, action) {
  if (!PUBLIC || !(action in PER_IP)) return;
  roll();
  const k = `${ipOf(req)}|${action}`, n = used.get(k) ?? 0;
  if (n >= PER_IP[action]) throw tooMany('Daily limit reached for this demo. Please try again tomorrow.');
  used.set(k, n + 1);
}

// Called before every Meta API request.
export function spend() {
  if (!PUBLIC) return;
  roll();
  if (++calls > DAILY_CALLS) throw tooMany('The demo is resting for today (daily AI limit). Please try again tomorrow.');
}

export const stats = () => (roll(), { day, calls, cap: DAILY_CALLS, visitors: new Set([...used.keys()].map(k => k.split('|')[0])).size });
