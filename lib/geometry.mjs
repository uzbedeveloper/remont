// SAM masks come back as pixel-staircase SVG paths (megabytes per clip).
// Douglas-Peucker on each ring keeps the shape and drops ~95% of the points.

function simplifyRing(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > eps && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function simplifyPath(d, eps = 1.2) {
  if (/[^MLZmlz0-9.\s,eE+-]/.test(d)) return d; // only M/L/Z paths are handled
  const rings = [];
  let cur = null;
  for (const [, cmd, args] of d.matchAll(/([MLZmlz])([^MLZmlz]*)/g)) {
    const nums = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === 'M' || cmd === 'm') { cur = []; rings.push(cur); }
    if (cmd === 'Z' || cmd === 'z') { cur = null; continue; }
    for (let i = 0; i + 1 < nums.length; i += 2) cur?.push([nums[i], nums[i + 1]]);
  }
  return rings
    .map(r => simplifyRing(r, eps))
    .filter(r => r.length >= 3)
    .map(r => 'M' + r.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L') + 'Z')
    .join('');
}
