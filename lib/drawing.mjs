// Room drawing geometry: a rectangle seen from above, walls numbered 1-4 clockwise from the
// entrance wall. Wall 1 is at the bottom of the plan; each wall runs from its left end as you
// face it from inside the room. Older measures have no positions: doors go on wall 1, windows
// on wall 3, radiators under windows (the usual Soviet flat).

const r2 = n => Math.round(n * 100) / 100;

// Corners in plan coords (metres, y down): A top-left, B top-right, C bottom-right, D bottom-left.
export function walls(m) {
  const L = m.length_m, W = m.width_m;
  return [
    { n: 1, len: L, from: [L, W], dir: [-1, 0] },
    { n: 2, len: W, from: [0, W], dir: [0, -1] },
    { n: 3, len: L, from: [0, 0], dir: [1, 0] },
    { n: 4, len: W, from: [L, 0], dir: [0, 1] },
  ].map(w => ({ ...w, out: [w.dir[1], -w.dir[0]] }));
}

// Every opening with a wall, an offset that fits on it and a sill height.
export function placeOpenings(m) {
  const ws = walls(m);
  const byWall = {};
  const placed = (m.openings ?? []).map((o, i) => {
    const wall = [1, 2, 3, 4].includes(o.wall) ? o.wall : o.type === 'door' ? 1 : 3;
    return { ...o, i, wall, sill_m: o.sill_m ?? (o.type === 'door' ? 0 : o.height_m >= 1.9 ? 0 : 0.85) };
  });
  for (const o of placed) (byWall[o.wall] ??= []).push(o);
  for (const [n, list] of Object.entries(byWall)) {
    const len = ws[n - 1].len;
    const guess = list.filter(o => !(o.offset_m >= 0));
    // Openings without a position: doors near the corner, windows spread evenly.
    guess.forEach((o, k) => {
      o.offset_m = o.type === 'door' && guess.length === 1 ? 0.3 : ((k + 1) * len) / (guess.length + 1) - o.width_m / 2;
    });
    for (const o of list) {
      o.width_m = Math.min(o.width_m, len);
      o.offset_m = r2(Math.max(0, Math.min(o.offset_m, len - o.width_m)));
      o.sill_m = r2(Math.max(0, Math.min(o.sill_m, m.height_m - o.height_m)));
    }
  }
  return placed;
}

// Radiators sit under windows; if there are more radiators than windows, the rest go on wall 3.
export function placeRadiators(m, openings) {
  const wins = openings.filter(o => o.type === 'window' && o.sill_m > 0.4);
  const n = m.radiators ?? 0;
  return Array.from({ length: n }, (_, k) => {
    const w = wins[k];
    if (w) return { wall: w.wall, offset_m: w.offset_m + 0.1, width_m: Math.max(0.5, w.width_m - 0.2) };
    return { wall: 3, offset_m: 0.4 + k * 1.2, width_m: 0.8 };
  });
}

// Gross and net area of each wall.
export function wallAreas(m, openings) {
  return walls(m).map(w => {
    const holes = openings.filter(o => o.wall === w.n).reduce((s, o) => s + o.width_m * o.height_m, 0);
    return { n: w.n, len: w.len, gross: r2(w.len * m.height_m), net: r2(w.len * m.height_m - holes) };
  });
}

// Which surface a smeta line is measured on, to light it up on the drawing.
const SURF = {
  walls: ['demo_wall_finish', 'demo_plaster', 'demo_tiles', 'pls_plaster', 'pls_putty', 'tl_wall', 'pt_wall_paint', 'pt_wallpaper', 'el_point', 'el_socket'],
  floor: ['demo_floor', 'debris', 'fl_screed', 'fl_laminate', 'fl_linoleum', 'fl_skirting', 'tl_waterproof', 'tl_floor'],
  ceiling: ['pt_ceiling_paint', 'cl_stretch', 'el_light'],
  window: ['demo_window', 'wd_window', 'wd_slopes'],
  door: ['wd_door'],
  radiator: ['pl_radiator'],
};
export function surfaceOf(itemId) {
  return Object.keys(SURF).find(k => SURF[k].includes(itemId)) ?? null;
}
