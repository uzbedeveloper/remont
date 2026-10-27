import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronRight, Loader2, Printer, RefreshCw, ScanText, Sparkles, WandSparkles } from 'lucide-react';
import { useT } from '../i18n.js';
import { act, patch } from '../api.js';
import { TRADE } from '../colors.js';
import { TIERS, jobsFrom, priceSmeta } from '../../lib/estimate.mjs';
import BeforeAfter from '../components/BeforeAfter.jsx';

const OPTIONS = {
  walls: ['paint', 'wallpaper', 'tiles', 'keep'],
  floor: ['laminate', 'tiles', 'linoleum', 'keep'],
  ceiling: ['stretch', 'paint', 'keep'],
  window: ['replace', 'keep'],
  door: ['replace', 'keep'],
  radiator: ['replace', 'keep'],
  electrics: ['rewire', 'points', 'keep'],
};

function defaults(m) {
  const bath = m.room_type === 'bathroom';
  const tired = c => c === 'worn' || c === 'poor';
  return {
    walls: bath ? 'tiles' : tired(m.condition.walls) ? 'paint' : 'keep',
    floor: bath ? 'tiles' : tired(m.condition.floor) ? 'laminate' : 'keep',
    ceiling: m.condition.ceiling === 'poor' ? 'stretch' : tired(m.condition.ceiling) ? 'paint' : 'keep',
    window: tired(m.condition.window) ? 'replace' : 'keep',
    door: 'replace',
    radiator: m.radiators ? 'replace' : 'keep',
    electrics: 'points',
  };
}

const LOOK = {
  walls: { paint: 'smooth light warm-grey painted walls', wallpaper: 'light, subtly textured wallpaper', tiles: 'light large-format wall tiles' },
  floor: { laminate: 'natural oak laminate floor', tiles: 'light grey porcelain floor tiles', linoleum: 'neat light wood-look linoleum' },
  ceiling: { stretch: 'flat white matte stretch ceiling with small spot lights', paint: 'smooth white painted ceiling' },
  window: { replace: 'new white PVC window with a white sill' },
  door: { replace: 'new white interior door' },
  radiator: { replace: 'slim modern white radiator' },
};
function lookFor(choices, tier, note) {
  const parts = Object.entries(LOOK).map(([k, v]) => v[choices[k]]).filter(Boolean);
  const level = { economy: 'simple, affordable finishes', standard: 'modern, warm, good-quality finishes', premium: 'premium finishes, refined details' }[tier];
  return [level, ...parts, note].filter(Boolean).join(', ');
}

export default function Smeta({ project, setProject, config, go }) {
  const t = useT();
  const { prices } = config;
  // Start from what the owner said while filming, filled in with sensible defaults.
  const spoken = project.voice ? Object.fromEntries(Object.entries(project.voice.choices).filter(([, v]) => v)) : {};
  const [choices, setChoices] = useState(project.brief?.choices ?? { ...defaults(project.measure), ...spoken });
  const [note, setNote] = useState(project.brief?.text ?? project.voice?.note ?? '');
  const [tier, setTier] = useState(project.tier || 'standard');
  const [editing, setEditing] = useState(!project.plan);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [frame, setFrame] = useState(project.render?.frame ?? project.hero_frame ?? 0);

  // Usta (voice) can change the tier, the brief or the picture behind our back: follow it.
  useEffect(() => { setTier(project.tier || 'standard'); }, [project.tier]);
  useEffect(() => {
    if (project.brief?.choices) setChoices(project.brief.choices);
    setNote(project.brief?.text ?? '');
    if (project.plan) setEditing(false);
  }, [project.brief, project.plan]);
  useEffect(() => { if (project.render) setFrame(project.render.frame); }, [project.render]);

  const smeta = useMemo(() => project.plan && priceSmeta(project.plan.works, prices, tier), [project.plan, prices, tier]);
  const jobs = useMemo(() => smeta && jobsFrom(smeta, prices), [smeta, prices]);

  const build = async () => {
    setBusy('smeta'); setError('');
    try { setProject(await act(project.id, 'smeta', { choices, text: note, tier })); setEditing(false); setOpen(null); }
    catch (e) { setError(e.message); }
    setBusy('');
  };
  const pickTier = async v => {
    setTier(v);
    setProject(await patch(project.id, { tier: v }));
  };
  const render = async () => {
    setBusy('render'); setError('');
    try { setProject(await act(project.id, 'render', { frame, style: lookFor(choices, tier, note) })); }
    catch (e) { setError(e.message); }
    setBusy('');
  };

  const n = project.media.frames;
  const thumbs = Array.from({ length: Math.min(8, n) }, (_, i) => Math.round((i * (n - 1)) / Math.max(1, Math.min(8, n) - 1)));
  const pad = i => String(i + 1).padStart(4, '0');

  return (
    <main className="page stack">
      {(editing || !project.plan) ? (
        <section className="card pad no-print">
          <div className="section-title"><h2>{t('sm_title')}</h2></div>
          {project.voice?.said && !project.plan && (
            <div className="said-card">
              <div className="label">{t('sm_from_video')}</div>
              <div className="said">«{project.voice.said}»</div>
              <div className="chips"><span className="chip">{t.pick(project.voice.heard)}</span></div>
            </div>
          )}
          {Object.entries(OPTIONS).map(([k, opts]) => (
            <div key={k} className="brief-row">
              <div className="k">{t(`b_${k}`)}</div>
              <div className="seg">
                {opts.map(o => (
                  <button key={o} className={`${choices[k] === o ? 'on' : ''}${o === 'keep' ? ' keep' : ''}`} onClick={() => setChoices(c => ({ ...c, [k]: o }))}>
                    {o === 'keep' ? t('keep') : t(`o_${o}`)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="brief-row">
            <div className="k">{t('sm_tier')}</div>
            <div className="seg">{TIERS.map(x => <button key={x} className={tier === x ? 'on' : ''} onClick={() => setTier(x)}>{t(`tier_${x}`)}</button>)}</div>
          </div>
          <textarea className="textarea" style={{ marginTop: 14, minHeight: 70 }} value={note} onChange={e => setNote(e.target.value)} placeholder={t('sm_note_ph')} />
          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            {project.plan && <button className="btn ghost" onClick={() => setEditing(false)}>×</button>}
            <button className="btn lg" onClick={build} disabled={busy === 'smeta'}>
              {busy === 'smeta' ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
              {busy === 'smeta' ? t('sm_building') : project.plan ? t('sm_rebuild') : t('sm_build')}
            </button>
          </div>
          {busy === 'smeta' && (
            <div className="stack" style={{ marginTop: 18 }}>
              {[70, 55, 85, 40].map((w, i) => <div key={i} className="skeleton" style={{ height: 18, width: `${w}%` }} />)}
            </div>
          )}
        </section>
      ) : null}
      {error && <div className="err">{t('error', { e: error })}</div>}

      {smeta && (
        <>
          {project.plan_stale && (
            <div className="err no-print" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
              <RefreshCw size={14} style={{ display: 'inline', verticalAlign: -2 }} /> {t('me_edit_hint')} <button className="btn sm ghost" onClick={build}>{t('sm_rebuild')}</button>
            </div>
          )}
          <div className="grid2">
            <section className="total-card rise">
              <div className="row" style={{ justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                <span className="label" style={{ color: 'rgba(255,255,255,.6)' }}>{t('sm_total')}</span>
                <span className="badge" style={{ background: 'rgba(255,255,255,.1)', color: '#fff' }}><CalendarDays size={13} />{t('sm_days', { n: t.day(smeta.days) })}</span>
              </div>
              <div className="big tab">{Math.round(smeta.total).toLocaleString('ru-RU')}<small>{t('currency')}</small></div>
              <div className="split"><div className="l" style={{ width: `${(smeta.labor / smeta.total) * 100}%` }} /><div className="m" style={{ flex: 1 }} /></div>
              <div className="split-legend">
                <span><i style={{ background: 'var(--accent)' }} />{t('sm_labor')} <b className="tab">{t.mln(smeta.labor)}</b></span>
                <span><i style={{ background: '#2ec4b6' }} />{t('sm_materials')} <b className="tab">{t.mln(smeta.materials)}</b></span>
              </div>
              <p style={{ color: 'rgba(255,255,255,.85)', margin: '18px 0', position: 'relative' }}>{t.pick(project.plan.summary)}</p>
              <div className="seg no-print" style={{ position: 'relative' }}>
                {TIERS.map(x => <button key={x} className={tier === x ? 'on' : ''} onClick={() => pickTier(x)}>{t(`tier_${x}`)}</button>)}
              </div>
              <p className="tiny" style={{ color: 'rgba(255,255,255,.5)', margin: '14px 0 0', position: 'relative' }}>{t('sm_price_note', { date: prices.date })}</p>
            </section>

            <section className="card pad">
              <div className="section-title" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 20 }}>{t('sm_schedule')}</h3>
                <div className="row no-print">
                  <button className="btn sm ghost" onClick={() => setEditing(true)}>{t('sm_title')}</button>
                  <button className="btn sm ghost" onClick={() => print()} aria-label={t('sm_print')}><Printer size={15} /></button>
                </div>
              </div>
              <div className="gantt">
                {jobs.map((j, ji) => (
                  <Row key={j.trade} t={t} j={j} days={smeta.days} name={t.pick(prices.trades[j.trade])} delay={ji * 0.06} />
                ))}
                <div />
                <div className="axis tab"><span>0</span><span>{t.day(smeta.days / 2)}</span><span>{t.day(smeta.days)} {t('sm_day')}</span></div>
              </div>
            </section>
          </div>

          <section className="card pad">
            <div className="section-title"><h3 style={{ fontSize: 20 }}>{t('sm_lines')}</h3><span className="muted small">{smeta.lines.length}</span></div>
            <ul className="lines">
              {smeta.lines.map((l, i) => {
                const on = open === i;
                return (
                  <li key={l.item_id} className={`line${on ? ' open' : ''}`}>
                    <button onClick={() => setOpen(on ? null : i)}>
                      <span className="n" style={{ background: TRADE[l.trade].color }}>{i + 1}</span>
                      <span className="grow">
                        <span className="w">{t.pick(l.name)}</span>
                        <span className="q tab" style={{ display: 'block' }}>{t.num(l.qty)} {t.unit(l.unit)} · {t.pick(prices.trades[l.trade])} · {t.span(l.start, l.end)}</span>
                      </span>
                      <span className="sum tab">{t.money(l.total)}</span>
                      <ChevronRight size={16} className="chev" />
                    </button>
                    {on && (
                      <div className="more">
                        <p className="why">{t.pick(l.why)}</p>
                        <table className="mats tab"><tbody>
                          <tr><td><b>{t('sm_labor')}</b></td><td>{t.num(l.qty)} × {t.money(l.labor_rate)}</td><td><b>{t.money(l.labor)}</b></td></tr>
                          {l.materials.map((mt, k) => (
                            <tr key={k}><td>{t.pick(mt.name)}</td><td>{t.num(mt.qty)} {t.unit(mt.unit)} × {t.money(mt.price)}</td><td>{t.money(mt.total)}</td></tr>
                          ))}
                        </tbody></table>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {project.plan.assumptions?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div className="label" style={{ marginBottom: 6 }}>{t('sm_assumptions')}</div>
                <ul className="notes">{project.plan.assumptions.map((x, i) => <li key={i} className="small">{t.pick(x)}</li>)}</ul>
              </div>
            )}
          </section>

          <section className="card pad no-print" id="render">
            <div className="section-title">
              <div>
                <h3 style={{ fontSize: 20 }}>{t('sm_render_t')}</h3>
                <p className="muted small" style={{ margin: '6px 0 0' }}>{t('sm_render_d')}</p>
              </div>
              <button className="btn dark" onClick={render} disabled={busy === 'render'}>
                {busy === 'render' ? <Loader2 size={17} className="spin" /> : <WandSparkles size={17} />}
                {busy === 'render' ? t('sm_rendering') : t('sm_render_btn')}
              </button>
            </div>
            {n > 1 && (
              <>
                <div className="label" style={{ marginBottom: 8 }}>{t('sm_pick_view')}</div>
                <div className="thumbs" style={{ marginBottom: 14 }}>
                  {thumbs.map(f => (
                    <button key={f} className={frame === f ? 'on' : ''} onClick={() => setFrame(f)}>
                      <img src={`/media/${project.id}/frames/${pad(f)}.jpg`} alt="" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {project.render
              ? <BeforeAfter before={`/media/${project.id}/${project.render.before}`} after={`/media/${project.id}/${project.render.after}`} />
              : busy === 'render' && <div className="skeleton" style={{ aspectRatio: '16/9' }} />}
            {project.renders?.length > 1 && (
              <>
                <div className="label" style={{ margin: '14px 0 8px' }}>{t('sm_versions')}</div>
                <div className="thumbs versions">
                  {project.renders.map((r, i) => (
                    <button key={r.after} className={project.render?.after === r.after ? 'on' : ''} title={r.change || r.style || ''}
                      onClick={async () => setProject(await patch(project.id, { render: r }))}>
                      <img src={`/media/${project.id}/${r.after}`} alt="" loading="lazy" />
                      <span className="v-n">{i + 1}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <button className="check-cta no-print" onClick={() => go('check')}>
            <span className="ic"><ScanText size={22} /></span>
            <span className="grow"><b>{t('ck_cta_t')}</b><span>{t('ck_cta_d')}</span></span>
            <ArrowRight size={20} />
          </button>

          <div className="sticky-cta">
            <button className="btn lg" onClick={() => go('jobs')}>{t('sm_next')}<ArrowRight size={18} /></button>
          </div>
        </>
      )}
    </main>
  );
}

function Row({ t, j, days, name, delay }) {
  const { color, Icon } = TRADE[j.trade];
  return (
    <>
      <div className="t"><Icon size={15} color={color} />{name}</div>
      <div className="track" style={{ '--d': `${100 / Math.max(1, days)}%` }}>
        {j.lines.map(l => (
          <div key={l.item_id} className="seg-bar" title={`${t.pick(l.name)} · ${t.span(l.start, l.end)}`}
            style={{ left: `${(l.start / days) * 100}%`, width: `${Math.max(1.5, ((l.end - l.start) / days) * 100)}%`, background: color, animationDelay: `${delay}s` }} />
        ))}
      </div>
    </>
  );
}
