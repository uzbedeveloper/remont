// The renovation plan after the smeta: one card per trade, moving need → talked → agreed → working → done.
// project.board = { [trade]: { status, usta: {id, name, phone, tg}, price, start, calls: [{usta, name, outcome, at}], photo } }
import { verdict } from './estimate.mjs';

export const STATES = ['need', 'talked', 'agreed', 'working', 'done'];
const WEIGHT = { need: 0, talked: 0.2, agreed: 0.5, working: 0.75, done: 1 };

export const cardOf = (board, trade) => board?.[trade] ?? { status: 'need', calls: [] };

// Where the whole renovation stands, and the one thing to do next.
export function progress(board, jobs) {
  const cards = jobs.map(j => ({ job: j, card: cardOf(board, j.trade) }));
  const at = s => STATES.indexOf(s);
  const hired = cards.filter(c => at(c.card.status) >= at('agreed'));
  const agreed = hired.reduce((s, c) => s + (c.card.price || 0), 0);
  const fair = hired.reduce((s, c) => s + c.job.labor, 0);
  const find = cards.find(c => at(c.card.status) < at('agreed'));
  const begin = cards.find(c => c.card.status === 'agreed');
  const finish = cards.find(c => c.card.status === 'working');
  const next = find ? { trade: find.job.trade, what: find.card.status === 'talked' ? 'agree' : 'find' }
    : finish ? { trade: finish.job.trade, what: 'finish' }
    : begin ? { trade: begin.job.trade, what: 'start' }
    : { trade: null, what: 'all_done' };
  return {
    score: cards.length ? cards.reduce((s, c) => s + WEIGHT[c.card.status], 0) / cards.length : 0,
    total: cards.length,
    hired: hired.length,
    done: cards.filter(c => c.card.status === 'done').length,
    agreed, fair, verdict: hired.some(c => c.card.price) ? verdict(agreed, fair) : null,
    next,
  };
}

// "1.5 mln", "1,5", "850 ming", "1 500 000", "850k" → so'm. Small numbers are millions.
export function parseSum(v) {
  const s = String(v).toLowerCase().replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  if (!(n > 0)) return 0;
  if (/ming|минг|тыс|k|к/.test(s)) return Math.round(n * 1000);
  if (/mln|млн|m/.test(s) || n < 1000) return Math.round(n * 1e6);
  return Math.round(n);
}
