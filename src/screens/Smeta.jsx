import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, Loader2, Printer, RefreshCw, ScanText, Share2, Sparkles, WandSparkles } from 'lucide-react';
import { useT } from '../i18n.js';
import { act, patch } from '../api.js';
import { TRADE } from '../colors.js';
import { TIERS, jobsFrom, priceSmeta } from '../../lib/estimate.mjs';
import { COLORS, OPTIONS, STYLES, lookFor, startChoices } from '../../lib/look.mjs';
import BeforeAfter from '../components/BeforeAfter.jsx';

// The works list shows this many until asked for all of them (print shows all).
const SHORT = 5;

export default function Smeta({ project, setProject, config, go }) {
  const t = useT();
  const { prices } = config;
  // Start from what the owner said while filming, filled in with sensible defaults.
  const [choices, setChoices] = useState(project.brief?.choices ?? startChoices(project));
  const [note, setNote] = useState(project.brief?.text ?? project.voice?.note ?? '');
  const [tier, setTier] = useState(project.tier || 'standard');
  const [editing, setEditing] = useState(!project.plan);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [frame, setFrame] = useState(project.render?.frame ?? project.hero_frame ?? 0);
  const [look, setLook] = useState(project.look ?? {});
  const [allLines, setAllLines] = useState(false);

  // Usta (voice) and the background smeta change things behind our back: follow them.
  // Keyed by content, not identity: polling hands us a new object every few seconds.
  const briefKey = JSON.stringify(project.brief ?? null);
  const planKey = project.plan ? JSON.stringify(project.plan.works) : '';
  useEffect(() => { setTier(project.tier || 'standard'); }, [project.tier]);
  useEffect(() => {
    if (project.brief?.choices) setChoices(project.brief.choices);
    setNote(project.brief?.text ?? '');
    if (project.plan) setEditing(false);
  }, [briefKey, planKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (project.render) setFrame(project.render.frame); }, [project.render?.after]); // eslint-disable-line react-hooks/exhaustive-deps

  const fresh = at => Boolean(at) && Date.now() - Date.parse(at) < 180000;
  const autoPlan = !project.plan && project.bg?.plan && fresh(project.bg.at);
  const autoRender = !project.render && project.bg?.render && fresh(project.bg.at);

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
  const render = async (l = look) => {
    setBusy('render'); setError('');
    try { setProject(await act(project.id, 'render', { frame, style: lookFor(choices, tier, note, l) })); }
    catch (e) { setError(e.message); }
    setBusy('');
  };
  // Tap a style or a colour: remember it and paint the room in it right away.
  const pickLook = (k, v) => {
    if (busy === 'render') return;
    const next = { ...look, [k]: look[k] === v ? undefined : v };
    setLook(next);
    patch(project.id, { look: next }).catch(() => {});
    render(next);
  };

  const share = async () => {
    const lines = smeta.lines.map(l => `- ${t.pick(l.name)}: ${t.num(l.qty)} ${t.unit(l.unit)}, ${t.money(l.total)}`).join('\n');
    const text = `${t('sm_share_text', { room: t(`room_${project.measure.room_type}`), area: t.num(project.measure.length_m * project.measure.width_m), total: t.money(smeta.total), days: t.day(smeta.days) })}\n\n${lines}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Remont', text });
      else window.open(`https://t.me/share/url?url=${encodeURIComponent(text)}`, '_blank');
    } catch { /* cancelled */ }
  };

  const n = project.media.frames;
  const thumbs = Array.from({ length: Math.min(8, n) }, (_, i) => Math.round((i * (n - 1)) / Math.max(1, Math.min(8, n) - 1)));
  const pad = i => String(i + 1).padStart(4, '0');

  return (
    <main className="page stack">
      {autoPlan ? (
        <section className="card pad no-print">
          <div className="section-title"><h2>{t('sm_title')}</h2></div>
          {project.voice?.said && (
            <div className="said-card">
              <div className="label">{t('sm_from_video')}</div>
              <div className="said">«{project.voice.said}»</div>
              <div className="chips"><span className="chip">{t.pick(project.voice.heard)}</span></div>
            </div>
          )}
          <p className="row muted" style={{ gap: 8 }}><Loader2 size={16} className="spin" />{t('sm_auto')}</p>
          <div className="stack">{[70, 55, 85, 40].map((w, i) => <div key={i} className="skeleton" style={{ height: 18, width: `${w}%` }} />)}</div>
        </section>
      ) : (editing || !project.plan) ? (
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
          <section className="card pad no-print" id="render">
            <div className="section-title">
              <div>
                <h3 style={{ fontSize: 20 }}>{t('sm_render_t')}</h3>
                <p className="muted small" style={{ margin: '6px 0 0' }}>{t('sm_render_d')}</p>
              </div>
              <button className="btn dark" onClick={() => render()} disabled={busy === 'render' || autoRender}>
                {busy === 'render' ? <Loader2 size={17} className="spin" /> : <WandSparkles size={17} />}
                {busy === 'render' ? t('sm_rendering') : t('sm_render_btn')}
              </button>
            </div>
            {project.render ? (
              <div className="ba-wrap">
                <BeforeAfter before={`/media/${project.id}/${project.render.before}`} after={`/media/${project.id}/${project.render.after}`} />
                {(busy === 'render' || autoRender) && <div className="painting"><Loader2 size={22} className="spin" />{t('sm_rendering_d')}</div>}
              </div>
            ) : (busy === 'render' || autoRender) && (
              <div className="ba-wrap">
                <div className="skeleton" style={{ aspectRatio: '16/9' }} />
                <div className="painting"><Loader2 size={22} className="spin" />{t(autoRender ? 'sm_first_render' : 'sm_rendering_d')}</div>
              </div>
            )}
            <div className="label" style={{ margin: '16px 0 8px' }}>{t('st_title')}</div>
            <div className="styles">
              {Object.entries(STYLES).map(([k, st]) => (
                <button key={k} className={look.style === k ? 'on' : ''} disabled={busy === 'render' || autoRender} onClick={() => pickLook('style', k)}>
                  <img src={`/styles/${k}.webp`} alt="" loading="lazy" />
                  <span className="st-name">{look.style === k && (busy === 'render' || autoRender) ? <Loader2 size={13} className="spin" /> : look.style === k && <Check size={13} strokeWidth={3} />}<b>{t(`st_${k}`)}</b></span>
                  <span className="tiny muted">{t(`st_${k}_d`)}</span>
                </button>
              ))}
            </div>
            <div className="label" style={{ margin: '14px 0 8px' }}>{t('st_color')}</div>
            <div className="swatches">
              {Object.entries(COLORS).map(([k, c]) => (
                <button key={k} className={look.color === k ? 'on' : ''} disabled={busy === 'render' || autoRender} onClick={() => pickLook('color', k)}
                  title={t(`c_${k}`)} aria-label={t(`c_${k}`)}>
                  <i style={{ background: c.hex }} /><span className="tiny">{t(`c_${k}`)}</span>
                </button>
              ))}
            </div>
            {n > 1 && (
              <>
                <div className="label" style={{ margin: '14px 0 8px' }}>{t('sm_pick_view')}</div>
                <div className="thumbs">
                  {thumbs.map(f => (
                    <button key={f} className={frame === f ? 'on' : ''} onClick={() => setFrame(f)}>
                      <img src={`/media/${project.id}/frames/${pad(f)}.jpg`} alt="" />
                    </button>
                  ))}
                </div>
              </>
            )}
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
                  <button className="btn sm ghost" onClick={share} aria-label={t('sm_share')}><Share2 size={15} /></button>
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
                  <li key={l.item_id} className={`line${on ? ' open' : ''}${!allLines && i >= SHORT ? ' extra' : ''}`}>
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
            {!allLines && smeta.lines.length > SHORT && (
              <button className="btn ghost show-all no-print" onClick={() => setAllLines(true)}>
                {t('sm_all_lines', { n: smeta.lines.length })}<ChevronDown size={16} />
              </button>
            )}
            {project.plan.assumptions?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div className="label" style={{ marginBottom: 6 }}>{t('sm_assumptions')}</div>
                <ul className="notes">{project.plan.assumptions.map((x, i) => <li key={i} className="small">{t.pick(x)}</li>)}</ul>
              </div>
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
