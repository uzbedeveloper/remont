// The measured room as a drawing: the plan from above (to scale, with sizes) and the four walls
// unfolded, each with its doors, windows and net m². hl lights up one surface (a smeta line's);
// with onChange the owner can move a door or window to the right wall.
import { useMemo } from 'react';
import { useT } from '../i18n.js';
import { SURFACE } from '../colors.js';
import { areas } from '../../lib/estimate.mjs';
import { placeOpenings, placeRadiators, wallAreas, walls } from '../../lib/drawing.mjs';

const T = 0.14; // wall thickness on the plan, m
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const pts = list => list.map(p => p.map(n => n.toFixed(3)).join(',')).join(' ');

function Plan({ m, ops, rads, hl, t }) {
  const L = m.length_m, W = m.width_m, pad = 0.75;
  const ws = walls(m);
  const a = areas(m);
  const fs = Math.max(0.17, Math.min(L, W) * 0.055);
  const floorFill = hl === 'floor' ? SURFACE.floor : hl === 'ceiling' ? SURFACE.ceiling : null;
  return (
    <svg className="dr-plan" viewBox={`${-pad} ${-pad} ${L + 2 * pad} ${W + 2 * pad}`} role="img" aria-label={t('dr_plan')}>
      <rect x={0} y={0} width={L} height={W} className="dr-floor" style={floorFill ? { fill: floorFill, fillOpacity: 0.35 } : null} />
      <path className={`dr-wall${hl === 'walls' ? ' hl' : ''}`} fillRule="evenodd"
        d={`M${-T} ${-T}H${L + T}V${W + T}H${-T}Z M0 0V${W}H${L}V0Z`} />
      {rads.map((r, k) => {
        const w = ws[r.wall - 1], inn = [-w.out[0], -w.out[1]];
        const p1 = add(add(w.from, w.dir, r.offset_m), inn, 0.04), p2 = add(p1, w.dir, r.width_m);
        return <polygon key={`r${k}`} className={`dr-rad${hl === 'radiator' ? ' hl' : ''}`} points={pts([p1, p2, add(p2, inn, 0.1), add(p1, inn, 0.1)])} />;
      })}
      {ops.map(o => {
        const w = ws[o.wall - 1];
        const p1 = add(w.from, w.dir, o.offset_m), p2 = add(p1, w.dir, o.width_m);
        const gap = [add(p1, w.out, -0.01), add(p2, w.out, -0.01), add(p2, w.out, T + 0.01), add(p1, w.out, T + 0.01)];
        if (o.type === 'window') {
          const l = k => [add(p1, w.out, T * k), add(p2, w.out, T * k)];
          return (
            <g key={o.i} className={`dr-win${hl === 'window' ? ' hl' : ''}`}>
              <polygon points={pts(gap)} />
              <line x1={l(0.4)[0][0]} y1={l(0.4)[0][1]} x2={l(0.4)[1][0]} y2={l(0.4)[1][1]} />
              <line x1={l(0.6)[0][0]} y1={l(0.6)[0][1]} x2={l(0.6)[1][0]} y2={l(0.6)[1][1]} />
            </g>
          );
        }
        // Door: hinge at the left end, leaf open into the room, swing arc back to the wall.
        const inn = [-w.out[0], -w.out[1]];
        const leaf = add(p1, inn, o.width_m);
        const arc = Array.from({ length: 13 }, (_, k) => {
          const f = (k / 12) * (Math.PI / 2);
          return add(p1, [inn[0] * Math.cos(f) + w.dir[0] * Math.sin(f), inn[1] * Math.cos(f) + w.dir[1] * Math.sin(f)], o.width_m);
        });
        return (
          <g key={o.i} className={`dr-door${hl === 'door' ? ' hl' : ''}`}>
            <polygon className="gap" points={pts(gap)} />
            <polyline className="swing" points={pts(arc)} />
            <line x1={p1[0]} y1={p1[1]} x2={leaf[0]} y2={leaf[1]} />
          </g>
        );
      })}
      {ws.map(w => {
        const c = add(add(w.from, w.dir, w.len / 2), w.out, -0.3);
        return (
          <g key={w.n} className="dr-num">
            <circle cx={c[0]} cy={c[1]} r={fs * 0.85} />
            <text x={c[0]} y={c[1]} fontSize={fs} dy="0.35em">{w.n}</text>
          </g>
        );
      })}
      <g className="dr-dim" fontSize={fs}>
        <line x1={0} y1={-pad * 0.6} x2={L} y2={-pad * 0.6} />
        <line x1={0} y1={-pad * 0.75} x2={0} y2={-pad * 0.45} /><line x1={L} y1={-pad * 0.75} x2={L} y2={-pad * 0.45} />
        <text x={L / 2} y={-pad * 0.6} dy="-0.4em">{t.num(L, 2)} m</text>
        <line x1={L + pad * 0.6} y1={0} x2={L + pad * 0.6} y2={W} />
        <line x1={L + pad * 0.45} y1={0} x2={L + pad * 0.75} y2={0} /><line x1={L + pad * 0.45} y1={W} x2={L + pad * 0.75} y2={W} />
        <text x={L + pad * 0.6} y={W / 2} dy="-0.4em" transform={`rotate(90 ${L + pad * 0.6} ${W / 2})`}>{t.num(W, 2)} m</text>
      </g>
      <text className="dr-room" x={L / 2} y={W / 2} fontSize={fs * 1.05}>
        <tspan x={L / 2} dy="-0.2em">{t(`room_${m.room_type}`)}</tspan>
        <tspan x={L / 2} dy="1.3em" className="b">{t.num(a.floor)} m²</tspan>
      </text>
    </svg>
  );
}

function Wall({ m, w, area, ops, rads, hl, t }) {
  const H = m.height_m, pad = 0.25;
  const fs = Math.max(0.22, w.len * 0.06);
  return (
    <figure className="dr-elev">
      <figcaption>
        <b>{t('dr_wall', { n: w.n })}</b>
        <span className="tab">{t.num(w.len, 2)} × {t.num(H, 2)} m · {t.num(area.net)} m²</span>
      </figcaption>
      <svg viewBox={`${-pad} ${-pad} ${w.len + 2 * pad} ${H + pad + 0.45}`}>
        <rect x={0} y={0} width={w.len} height={H} className={`dr-face${hl === 'walls' ? ' hl' : ''}`} />
        <line className="dr-ground" x1={-pad} y1={H} x2={w.len + pad} y2={H} />
        {rads.map((r, k) => (
          <rect key={`r${k}`} className={`dr-rad${hl === 'radiator' ? ' hl' : ''}`} x={r.offset_m} y={H - 0.65} width={r.width_m} height={0.5} rx={0.04} />
        ))}
        {ops.map(o => {
          const x = o.offset_m, y = H - o.sill_m - o.height_m;
          return (
            <g key={o.i} className={`${o.type === 'window' ? 'dr-win' : 'dr-door'}${hl === o.type ? ' hl' : ''}`}>
              <rect x={x} y={y} width={o.width_m} height={o.height_m} />
              {o.type === 'window' && <line x1={x + o.width_m / 2} y1={y} x2={x + o.width_m / 2} y2={y + o.height_m} />}
              <text x={x + o.width_m / 2} y={y + o.height_m / 2} fontSize={fs * 0.8} dy="0.35em">{t.num(o.width_m, 2)}×{t.num(o.height_m, 2)}</text>
            </g>
          );
        })}
        <g className="dr-dim" fontSize={fs}>
          <line x1={0} y1={H + 0.25} x2={w.len} y2={H + 0.25} />
          <line x1={0} y1={H + 0.15} x2={0} y2={H + 0.35} /><line x1={w.len} y1={H + 0.15} x2={w.len} y2={H + 0.35} />
        </g>
      </svg>
    </figure>
  );
}

export default function RoomDrawing({ m, hl = null, onChange }) {
  const t = useT();
  const ops = useMemo(() => placeOpenings(m), [m]);
  const rads = useMemo(() => placeRadiators(m, ops), [m, ops]);
  const per = useMemo(() => wallAreas(m, ops), [m, ops]);
  const ws = walls(m);

  // Move one opening: write every opening's position, so the guesses become the owner's facts.
  const move = (i, k, v) => {
    const next = ops.map(({ i: _, ...o }) => o);
    next[i] = { ...next[i], [k]: v };
    if (k === 'wall') next[i].offset_m = Math.max(0, (ws[v - 1].len - next[i].width_m) / 2);
    onChange({ ...m, openings: next.map(o => ({ ...o, offset_m: Math.round(o.offset_m * 100) / 100 })) });
  };

  return (
    <div className="drawing">
      <Plan m={m} ops={ops} rads={rads} hl={hl} t={t} />
      <div className="dr-walls">
        {ws.map(w => (
          <Wall key={w.n} m={m} w={w} area={per[w.n - 1]} hl={hl} t={t}
            ops={ops.filter(o => o.wall === w.n)} rads={rads.filter(r => r.wall === w.n)} />
        ))}
      </div>
      {onChange && (
        <div className="dr-edit">
          <div className="label">{t('dr_where')}</div>
          {ops.map(o => (
            <div key={`${o.i}-${o.wall}-${o.offset_m}`} className="dr-edit-row">
              <span className="dr-key"><i style={{ background: SURFACE[o.type] }} />{t(o.type)} <span className="tab muted">{t.num(o.width_m, 2)} m</span></span>
              <span className="dr-seg">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} className={o.wall === n ? 'on' : ''} onClick={() => move(o.i, 'wall', n)} aria-label={t('dr_wall', { n })}>{n}</button>
                ))}
              </span>
              <label className="dr-off">
                <input className="input tab" inputMode="decimal" defaultValue={o.offset_m}
                  onBlur={e => { const n = parseFloat(e.target.value.replace(',', '.')); if (n >= 0 && n !== o.offset_m) move(o.i, 'offset_m', n); }}
                  onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
                <span className="tiny muted">{t('dr_from')}</span>
              </label>
            </div>
          ))}
          <p className="muted tiny" style={{ margin: 0 }}>{t('dr_edit_hint')}</p>
        </div>
      )}
    </div>
  );
}
