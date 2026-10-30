// Pure money math, shared by the server and the browser.
// The model decides WHAT work is needed and how much; this file decides what it costs.
// No price ever comes from the model.

export const TIERS = ['economy', 'standard', 'premium'];
const COUNT_UNITS = new Set(['pcs', 'bag', 'roll', 'pack', 'set', 'point']);

const r1 = n => Math.round(n * 10) / 10;
const ceilHalf = n => Math.ceil(n * 2) / 2;

// Areas and lengths from the measured box + openings. Spark measures, code does the geometry.
export function areas(m) {
  if (!m) return null;
  const { length_m: L, width_m: W, height_m: H } = m;
  const openings = m.openings ?? [];
  const sum = (type, f) => openings.filter(o => o.type === type).reduce((s, o) => s + f(o), 0);
  const perimeter = 2 * (L + W);
  const doorsArea = sum('door', o => o.width_m * o.height_m);
  const windowsArea = sum('window', o => o.width_m * o.height_m);
  return {
    floor: r1(L * W),
    ceiling: r1(L * W),
    perimeter: r1(perimeter),
    walls_gross: r1(perimeter * H),
    walls_net: r1(perimeter * H - doorsArea - windowsArea),
    windows: r1(windowsArea),
    window_reveals: r1(sum('window', o => 2 * o.height_m + o.width_m)),
    skirting: r1(perimeter - sum('door', o => o.width_m)),
    doors: openings.filter(o => o.type === 'door').length,
    window_count: openings.filter(o => o.type === 'window').length,
  };
}

// Scale every length so that one known size matches what the owner says.
export function rescale(m, factor) {
  const s = n => r1(n * factor);
  return {
    ...m,
    length_m: s(m.length_m), width_m: s(m.width_m), height_m: s(m.height_m),
    openings: m.openings.map(o => ({ ...o, width_m: s(o.width_m), height_m: s(o.height_m), ...(o.offset_m >= 0 ? { offset_m: s(o.offset_m) } : {}), ...(o.sill_m >= 0 ? { sill_m: s(o.sill_m) } : {}) })),
  };
}

function materialLine(mat, workQty, tierIdx) {
  const raw = mat.qty * workQty;
  const qty = COUNT_UNITS.has(mat.unit) ? Math.max(1, Math.ceil(raw - 1e-9)) : r1(Math.max(raw, 0.1));
  const price = mat.price[tierIdx];
  return { name: mat.name, unit: mat.unit, qty, price, total: Math.round(qty * price) };
}

// works: [{ item_id, qty, why }] from the planner → priced, ordered, scheduled smeta.
export function priceSmeta(works, prices, tier = 'standard') {
  const tierIdx = Math.max(0, TIERS.indexOf(tier));
  const byId = Object.fromEntries(prices.items.map(i => [i.id, i]));
  const lines = works
    .filter(w => byId[w.item_id] && w.qty > 0)
    .map(w => {
      const item = byId[w.item_id];
      const qty = item.unit === 'pcs' || item.unit === 'point' ? Math.round(w.qty) : r1(w.qty);
      const materials = item.materials.map(m => materialLine(m, qty, tierIdx));
      const labor = Math.round(qty * item.labor);
      const matTotal = materials.reduce((s, m) => s + m.total, 0);
      return {
        item_id: item.id, trade: item.trade, stage: item.stage, name: item.name, unit: item.unit,
        qty, labor_rate: item.labor, labor, materials, materials_total: matTotal, total: labor + matTotal,
        days: ceilHalf(Math.max(0.5, qty / item.per_day)), why: w.why,
      };
    })
    .sort((a, b) => a.stage - b.stage || prices.trades[a.trade].order - prices.trades[b.trade].order);

  // Works in the same stage run side by side; stages run one after another.
  let day = 0;
  const stages = [...new Set(lines.map(l => l.stage))];
  for (const st of stages) {
    const group = lines.filter(l => l.stage === st);
    for (const l of group) { l.start = day; l.end = day + l.days; }
    day += Math.max(...group.map(l => l.days));
  }
  const labor = lines.reduce((s, l) => s + l.labor, 0);
  const materials = lines.reduce((s, l) => s + l.materials_total, 0);
  return { tier, lines, labor, materials, total: labor + materials, days: day };
}

// One job per trade: what an usta of that trade is hired for.
export const FAIR = [0.85, 1.2];
export function jobsFrom(smeta, prices) {
  const byTrade = {};
  for (const l of smeta.lines) (byTrade[l.trade] ??= []).push(l);
  return Object.entries(byTrade)
    .map(([trade, lines]) => {
      const labor = lines.reduce((s, l) => s + l.labor, 0);
      const main = [...lines].sort((a, b) => b.labor - a.labor)[0];
      return {
        trade, lines, labor,
        materials: lines.reduce((s, l) => s + l.materials_total, 0),
        fair: [Math.round(labor * FAIR[0]), Math.round(labor * FAIR[1])],
        start: Math.min(...lines.map(l => l.start)),
        end: Math.max(...lines.map(l => l.end)),
        days: lines.reduce((s, l) => s + l.days, 0),
        main: { item_id: main.item_id, qty: main.qty, unit: main.unit, rate: main.labor_rate },
      };
    })
    .sort((a, b) => a.start - b.start || prices.trades[a.trade].order - prices.trades[b.trade].order);
}

// How a quoted labor price compares with the fair labor price for the job.
export function verdict(price, labor) {
  if (!price || !labor) return { key: 'vague', ratio: null };
  const ratio = price / labor;
  const key = ratio < 0.8 ? 'low' : ratio <= FAIR[1] ? 'fair' : ratio <= 1.4 ? 'high' : 'very_high';
  return { key, ratio };
}

// Compare a parsed worker reply with the fair price of exactly the lines it covers.
// A quote "with materials" is compared with labor + materials of those lines.
export function quote(reply, job) {
  const n = job.lines.length;
  const valid = i => Number.isInteger(i) && i >= 0 && i < n;
  let quoted = 0, fair = 0;
  const covered = new Set();
  for (const o of reply.offers ?? []) {
    if (!(o.price_uzs > 0)) continue;
    const covers = (o.covers ?? []).filter(valid);
    const lines = covers.length ? covers : job.lines.map((_, i) => i);
    let amount = o.price_uzs;
    if (o.basis === 'per_unit') {
      const base = valid(o.per_line) ? o.per_line : lines[0];
      amount = o.price_uzs * job.lines[base].qty;
    }
    quoted += amount;
    for (const i of lines) {
      if (covered.has(i)) continue;
      covered.add(i);
      fair += job.lines[i].labor + (o.includes_materials ? job.lines[i].materials_total : 0);
    }
  }
  quoted = Math.round(quoted);
  return { quoted, fair, partial: covered.size > 0 && covered.size < n, ...verdict(quoted, fair) };
}

export function matchUstas(job, ustas, district) {
  return ustas
    .filter(u => u.trades.includes(job.trade))
    .map(u => {
      const price = Math.round(job.labor * u.rate);
      const v = verdict(price, job.labor);
      const near = district && u.district === district;
      const score = u.rating * 14 + Math.min(u.years, 15) * 1.2 + (near ? 12 : 0)
        - Math.abs(u.rate - 1) * 40 + (u.trades.length === 1 ? 3 : 0);
      return { ...u, price, verdict: v, near, score };
    })
    .sort((a, b) => b.score - a.score);
}

// Check an usta's quote (as read by Spark) against the measured room and the price base.
// Quantity: their m² vs our measured m². Price: their unit price vs the fair unit price.
export function auditQuote(read, project, prices) {
  const tier = project.tier || 'standard';
  const ti = Math.max(0, TIERS.indexOf(tier));
  const byId = Object.fromEntries(prices.items.map(i => [i.id, i]));
  const ours = project.plan ? Object.fromEntries(priceSmeta(project.plan.works, prices, tier).lines.map(l => [l.item_id, l])) : {};
  const a = areas(project.measure);
  const AREA = { walls: a?.walls_net, floor: a?.floor, ceiling: a?.ceiling, windows: a?.windows };

  const lines = read.lines.map(l => {
    const item = byId[l.item_id];
    const qty = l.qty > 0 ? l.qty : null;
    const unitPrice = l.unit_price_uzs > 0 ? l.unit_price_uzs : l.total_uzs > 0 && qty ? l.total_uzs / qty : 0;
    const total = l.total_uzs > 0 ? l.total_uzs : unitPrice && qty ? unitPrice * qty : 0;
    const measured = ours[l.item_id]?.qty ?? (l.unit === 'm2' && AREA[l.surface] ? AREA[l.surface] : null);
    const qtyRatio = qty && measured ? qty / measured : null;
    const matPerUnit = item ? item.materials.reduce((s, m) => s + m.qty * m.price[ti], 0) : 0;
    const fairUnit = item && unitPrice ? item.labor + (l.includes_materials ? matPerUnit : 0) : null;
    const v = fairUnit ? verdict(unitPrice, fairUnit) : { key: 'vague', ratio: null };
    const fairQty = measured ?? qty ?? 0;
    const extraQty = qtyRatio > 1.08 ? Math.round((qty - measured) * unitPrice) : 0;
    const extraPrice = fairUnit && unitPrice > fairUnit * FAIR[1] ? Math.round((unitPrice - fairUnit * FAIR[1]) * Math.min(qty ?? fairQty, fairQty)) : 0;
    const flags = [];
    if (qtyRatio > 1.08) flags.push('qty_over');
    if (v.key === 'high' || v.key === 'very_high') flags.push('price_high');
    if (v.key === 'low') flags.push('price_low');
    if (!item || !unitPrice) flags.push('unclear');
    return {
      ...l, qty, unit_price: Math.round(unitPrice), total: Math.round(total), measured, qty_ratio: qtyRatio,
      fair_unit: fairUnit && Math.round(fairUnit), fair_total: fairUnit ? Math.round(fairUnit * fairQty) : null,
      verdict: v, extra: extraQty + extraPrice, flags,
    };
  });
  const quoted = read.total_uzs > 0 ? read.total_uzs : lines.reduce((s, l) => s + l.total, 0);
  const sum = lines.reduce((s, l) => s + l.total, 0);
  const fair = lines.reduce((s, l) => s + (l.fair_total ?? l.total), 0);
  // Work the room needs that the quote leaves out: the usual "it wasn't in the smeta" surprise.
  const quotedIds = new Set(read.lines.map(l => l.item_id));
  const missing = Object.values(ours).filter(l => !quotedIds.has(l.item_id)).map(l => ({ item_id: l.item_id, name: l.name, qty: l.qty, unit: l.unit, labor: l.labor }));
  return {
    tier, lines, quoted, fair, extra: lines.reduce((s, x) => s + x.extra, 0),
    math_off: read.total_uzs > 0 && Math.abs(read.total_uzs - sum) > Math.max(1000, sum * 0.01) ? read.total_uzs - sum : 0,
    missing, ...verdict(quoted, fair),
  };
}

// What to buy at the bozor: the materials of every line, merged by name, grouped by the trade
// that needs them, in work order (so the owner buys plaster before the plasterer comes).
export function shoppingList(smeta, prices) {
  const groups = {};
  for (const l of smeta.lines) {
    const g = (groups[l.trade] ??= { trade: l.trade, start: l.start, items: {} });
    g.start = Math.min(g.start, l.start);
    for (const m of l.materials) {
      const key = `${m.name.en}|${m.unit}`;
      const it = (g.items[key] ??= { key, name: m.name, unit: m.unit, qty: 0, price: m.price, total: 0 });
      it.qty = COUNT_UNITS.has(m.unit) ? it.qty + m.qty : r1(it.qty + m.qty);
      it.total += m.total;
    }
  }
  return Object.values(groups)
    .map(g => ({ ...g, items: Object.values(g.items), total: Object.values(g.items).reduce((s, i) => s + i.total, 0) }))
    .filter(g => g.items.length)
    .sort((a, b) => a.start - b.start || prices.trades[a.trade].order - prices.trades[b.trade].order);
}

// "I have 15 mln, what can I do?" Keep the works that can't wait (wiring, pipes, walls); if even
// economy is too much, postpone whole trades that are easy to do later. Fewer postponed beats a
// better tier. Returns the plan that fits, or the closest one and how much is missing.
export const POSTPONE = ['ceiling', 'windows_doors', 'floor', 'tiler'];
export function fitBudget(works, prices, budget) {
  const byId = Object.fromEntries(prices.items.map(i => [i.id, i]));
  const present = POSTPONE.filter(tr => works.some(w => byId[w.item_id]?.trade === tr));
  let last;
  for (let k = 0; k <= present.length; k++) {
    const later = present.slice(0, k);
    const keep = works.filter(w => !later.includes(byId[w.item_id]?.trade));
    for (const tier of [...TIERS].reverse()) {
      const s = priceSmeta(keep, prices, tier);
      last = { tier, later, keep, total: s.total, days: s.days };
      if (s.total <= budget) return { ...last, fits: true, saved: priceSmeta(works, prices, tier).total - s.total };
    }
  }
  return { ...last, fits: false, short: last.total - budget };
}
