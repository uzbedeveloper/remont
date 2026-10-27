import { useEffect, useRef, useState } from 'react';
import { ArrowRight, DoorOpen, Ruler, ScanLine } from 'lucide-react';
import { useT } from '../i18n.js';
import { patch } from '../api.js';
import { SURFACE } from '../colors.js';
import { areas, rescale } from '../../lib/estimate.mjs';
import MaskPlayer from '../components/MaskPlayer.jsx';

function Metric({ label, color, value, unit, note }) {
  return (
    <div className="metric rise">
      <div className="tag"><i style={{ background: color }} />{label}</div>
      <div className="v tab">{value}<small>{unit}</small></div>
      {note && <div className="muted tiny">{note}</div>}
    </div>
  );
}

export default function Measure({ project, setProject, go }) {
  const t = useT();
  const [m, setM] = useState(project.measure);
  const door = m.openings.find(o => o.type === 'door');
  const [doorH, setDoorH] = useState(door ? String(door.height_m) : '');
  const saveTimer = useRef();
  const a = areas(m);
  const counts = Object.fromEntries(Object.entries(project.sam ?? {}).filter(([, v]) => v?.objects).map(([k, v]) => [k, v.objects.length]));

  // Save edits shortly after the last keystroke.
  const commit = next => {
    setM(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setProject(await patch(project.id, { measure: next, ...(project.plan ? { plan_stale: true } : {}) }));
    }, 500);
  };
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const setDim = (k, v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    if (n > 0 && n < 50) commit({ ...m, [k]: n });
  };
  const scaleToDoor = () => {
    const n = parseFloat(doorH.replace(',', '.'));
    if (door && n > 1 && n < 4) commit(rescale(m, n / door.height_m));
  };

  return (
    <main className="page">
      <div className="section-title">
        <h2>{t('me_title')}</h2>
        <span className="badge">{t(`room_${m.room_type}`)}</span>
      </div>
      <div className="grid2">
        <div className="stack">
          <div className="card" style={{ padding: 10, background: 'var(--ink)', borderColor: 'var(--ink)' }}>
            <MaskPlayer base={`/media/${project.id}`} media={project.media} counts={counts} />
          </div>
          {project.sample && <span className="badge">{t('sample_badge')}</span>}
        </div>

        <div className="stack">
          <div className="metrics">
            <Metric label={t('floor')} color={SURFACE.floor} value={t.num(a.floor)} unit="m²" />
            <Metric label={t('walls')} color={SURFACE.wall} value={t.num(a.walls_net)} unit="m²" note={t('me_walls_note')} />
            <Metric label={t('ceiling')} color={SURFACE.ceiling} value={t.num(a.ceiling)} unit="m²" />
            <Metric label={t('height')} color="#c9c1b3" value={t.num(m.height_m, 2)} unit="m" />
          </div>

          <div className="card pad stack">
            <div className="row"><Ruler size={18} /><b>{t('me_dims')}</b></div>
            <div className="dims">
              {[['length_m', 'length'], ['width_m', 'width'], ['height_m', 'height']].map(([k, l]) => (
                <label key={`${k}-${m[k]}`}>
                  <span className="label">{t(l)}, m</span>
                  <input className="input tab" inputMode="decimal" defaultValue={m[k]} onBlur={e => setDim(k, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
                </label>
              ))}
            </div>
            <p className="muted small" style={{ margin: 0 }}>{t('me_edit_hint')}</p>
            {door && (
              <div className="row wrap" style={{ paddingTop: 6, borderTop: '1px dashed var(--line)' }}>
                <DoorOpen size={18} />
                <span className="small" style={{ fontWeight: 700 }}>{t('me_known')}</span>
                <input className="input tab" style={{ width: 90 }} inputMode="decimal" value={doorH} onChange={e => setDoorH(e.target.value)} />
                <span className="small muted">m</span>
                <button className="btn sm ghost" onClick={scaleToDoor}>{t('me_rescale')}</button>
              </div>
            )}
          </div>

          <div className="card pad stack">
            <div className="label">{t('me_openings')}</div>
            <div className="row wrap">
              {m.openings.map((o, i) => (
                <span key={i} className="badge tab"><i style={{ width: 8, height: 8, borderRadius: 2, background: SURFACE[o.type] }} />{t(o.type)} {t.num(o.width_m, 2)} × {t.num(o.height_m, 2)} m</span>
              ))}
            </div>
            <div className="muted small">{t('me_counts', { r: m.radiators, s: m.sockets, l: m.lights })}</div>
            <div className="label">{t('me_condition')}</div>
            <div className="cond">
              {Object.entries(m.condition).map(([k, v]) => (
                <div key={k}><span>{t(k === 'walls' ? 'walls' : k)}</span><span className={`c-${v}`}>{t(`cond_${v}`)}</span></div>
              ))}
            </div>
          </div>
          <div className="card pad">
            <div className="label" style={{ marginBottom: 10 }}>{t('me_notes')}</div>
            <ul className="notes">{m.observations?.map((o, i) => <li key={i}>{t.pick(o)}</li>)}</ul>
            <details style={{ marginTop: 12 }}>
              <summary className="muted small" style={{ cursor: 'pointer', fontWeight: 700 }}>
                {t('me_how')} · {t('me_conf', { c: t(`conf_${m.confidence}`) })}
              </summary>
              <p className="muted small" style={{ marginBottom: 0 }}>{m.method}</p>
            </details>
          </div>
        </div>
      </div>
      <div className="sticky-cta">
        <button className="btn lg" onClick={() => go('smeta')}><ScanLine size={18} />{t('me_next')}<ArrowRight size={18} /></button>
      </div>
    </main>
  );
}
