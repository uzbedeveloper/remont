// Step 4, the renovation plan: one card per trade in work order. Find an usta, agree a price,
// mark the work started and done. The bar on top always says where things stand and what's next.
import { useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Camera, Check, ChevronDown, Hammer, Loader2, Phone, PartyPopper, RotateCcw, Send } from 'lucide-react';
import { useT } from '../i18n.js';
import { patch } from '../api.js';
import { TRADE } from '../colors.js';
import { jobsFrom, priceSmeta, verdict } from '../../lib/estimate.mjs';
import { STATES, cardOf, parseSum, progress } from '../../lib/board.mjs';
import { checksDone, paidOf } from '../../lib/checks.mjs';
import TradeTools from '../components/TradeTools.jsx';

export function Verdict({ v }) {
  const t = useT();
  if (!v) return null;
  const p = v.ratio ? Math.round((v.ratio - 1) * 100) : 0;
  return <span className={`pill v-${v.key}`}>{v.key === 'fair' && <Check size={12} strokeWidth={3} />}{t(`v_${v.key}`, { p })}</span>;
}

export function nextLine(t, prices, pr) {
  if (pr.next.what === 'all_done') return t('pl_next_all_done');
  return t(`pl_next_${pr.next.what}`, { trade: t.pick(prices.trades[pr.next.trade]) });
}

export default function Plan({ project, setProject, config, go }) {
  const t = useT();
  const { prices } = config;
  const jobs = useMemo(() => jobsFrom(priceSmeta(project.plan.works, prices, project.tier), prices), [project.plan, project.tier, prices]);
  const pr = progress(project.board, jobs);
  const [open, setOpen] = useState(null);
  const [agreeing, setAgreeing] = useState(null); // trade whose price form is open
  const [tabs, setTabs] = useState({}); // trade → open tab in its card
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const photo = useRef();
  const photoFor = useRef(null);

  const save = async (trade, fn) => {
    const board = { ...(project.board ?? {}) };
    board[trade] = fn({ ...cardOf(board, trade) });
    setProject(await patch(project.id, { board }));
  };
  // Done means checked: until every check passes, "done" opens the checklist instead.
  const finish = trade => {
    if (checksDone(cardOf(project.board, trade), trade).all) return setStatus(trade, 'done');
    setTabs(x => ({ ...x, [trade]: 'check' }));
  };
  const paidAll = jobs.reduce((s, j) => s + paidOf(cardOf(project.board, j.trade)), 0);
  const setStatus = (trade, status) => save(trade, c => ({ ...c, status, ...(status === 'need' ? { usta: null, price: 0, start: '' } : {}) }));

  const sendPhoto = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    const trade = photoFor.current;
    if (!f || !trade) return;
    setBusy(`photo_${trade}`); setError('');
    try {
      const ext = (f.name.match(/\.\w+$/)?.[0] || '.jpg').toLowerCase();
      const r = await fetch(`/api/project/${project.id}/done_photo?trade=${trade}&name=p${ext}`, { method: 'POST', body: f });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`);
      setProject(b);
    } catch (err) { setError(err.message); }
    setBusy('');
  };

  const nextJob = jobs.find(j => j.trade === pr.next.trade);
  const nextAction = () => {
    if (!nextJob) return;
    if (pr.next.what === 'find') go('hire', nextJob.trade);
    else { setOpen(nextJob.trade); setTimeout(() => document.getElementById(`job-${nextJob.trade}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }
  };

  return (
    <main className="page stack">
      <section className="total-card rise plan-top">
        <div className="row" style={{ justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <span className="label" style={{ color: 'rgba(255,255,255,.6)' }}>{t('pl_title')}</span>
          <span className="badge" style={{ background: 'rgba(255,255,255,.1)', color: '#fff' }}>{t('pl_found', { n: pr.hired, t: pr.total })}</span>
        </div>
        <div className="plan-bar"><div style={{ width: `${Math.max(3, pr.score * 100)}%` }} /></div>
        <div className="row wrap" style={{ gap: 18, position: 'relative' }}>
          <div><div className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>{t('pl_done_n')}</div><b className="tab">{pr.done} / {pr.total}</b></div>
          <div><div className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>{t('pl_agreed')}</div><b className="tab">{pr.agreed ? t.money(pr.agreed) : '—'}</b></div>
          {pr.fair > 0 && <div><div className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>{t('pl_fair_for')}</div><b className="tab">{t.money(pr.fair)}</b></div>}
          {paidAll > 0 && <div><div className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>{t('pay_paid')}</div><b className="tab">{t.money(paidAll)}</b></div>}
          {pr.verdict && <Verdict v={pr.verdict} />}
        </div>
        <div className="plan-next">
          <div className="grow">
            <div className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>{t('pl_next')}</div>
            <b>{nextLine(t, prices, pr)}</b>
          </div>
          {nextJob && <button className="btn" onClick={nextAction}>{t(`pl_go_${pr.next.what}`)}<ArrowRight size={17} /></button>}
        </div>
      </section>
      {error && <div className="err">{t('error', { e: error })}</div>}

      {pr.next.what === 'all_done' && <Finish project={project} jobs={jobs} pr={pr} t={t} />}

      <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={sendPhoto} />
      <ol className="plan-list">
        {jobs.map((j, i) => {
          const c = cardOf(project.board, j.trade);
          const { color, Icon } = TRADE[j.trade];
          const step = STATES.indexOf(c.status);
          const isOpen = open === j.trade;
          const v = c.price ? verdict(c.price, j.labor) : null;
          return (
            <li key={j.trade} id={`job-${j.trade}`} className={`plan-card card st-${c.status}${pr.next.trade === j.trade ? ' is-next' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="plan-head" onClick={() => setOpen(isOpen ? null : j.trade)}>
                <span className="plan-n" style={{ background: c.status === 'done' ? 'var(--good, #1f9d55)' : color }}>
                  {c.status === 'done' ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
                    <b className="plan-trade">{t.pick(prices.trades[j.trade])}</b>
                    <span className={`st-chip st-${c.status}`}>{t(`st_${c.status}`)}</span>
                  </div>
                  <div className="muted tiny row" style={{ gap: 6, marginTop: 3 }}>
                    <CalendarDays size={12} />{t.span(j.start, j.end)}
                    <span>·</span>
                    <span className="tab">{c.price ? t.money(c.price) : t.range(j.fair)}</span>
                    {c.usta?.name && <><span>·</span><span>{c.usta.name}</span></>}
                  </div>
                  <div className="dots">{STATES.slice(1).map((s, k) => <i key={s} className={k < step ? 'on' : ''} />)}</div>
                </div>
                <ChevronDown size={18} className={`chev${isOpen ? ' up' : ''}`} />
              </div>

              {isOpen && (
                <div className="plan-body">
                  <TradeTools project={project} job={j} card={c} prices={prices} save={fn => save(j.trade, fn)}
                    tab={tabs[j.trade] ?? 'scope'} setTab={k => setTabs(x => ({ ...x, [j.trade]: k }))}
                    scope={<>
                      <ul className="scope">
                        {j.lines.map(l => <li key={l.item_id}><span>{t.pick(l.name)}</span><span className="tab">{t.num(l.qty)} {t.unit(l.unit)}</span></li>)}
                      </ul>
                      <div className="row wrap" style={{ gap: 8 }}>
                        <span className="label" style={{ margin: 0 }}>{t('jb_fair')}</span><b className="tab">{t.range(j.fair)}</b>
                        {v && <Verdict v={v} />}
                      </div>
                    </>} />

                  {c.usta && (
                    <div className="plan-usta">
                      <b>{c.usta.name || t('hi_noname')}</b>
                      {c.start && <span className="muted small">· {t('pl_starts', { d: c.start })}</span>}
                      <span className="grow" />
                      {c.usta.phone && <a className="btn sm call" href={`tel:+${c.usta.phone}`}><Phone size={14} />{t('hi_call')}</a>}
                      {c.usta.tg && <a className="btn sm tg" href={`https://t.me/${c.usta.tg.slice(1)}`} target="_blank" rel="noreferrer"><Send size={14} /></a>}
                    </div>
                  )}

                  {agreeing === j.trade ? (
                    <AgreeForm t={t} card={c} job={j} onCancel={() => setAgreeing(null)}
                      onSave={async (price, start) => { await save(j.trade, x => ({ ...x, status: 'agreed', price, start })); setAgreeing(null); }} />
                  ) : (
                    <div className="row wrap" style={{ gap: 8 }}>
                      {c.status === 'need' && <button className="btn dark" onClick={() => go('hire', j.trade)}><Hammer size={16} />{t('jb_find')}</button>}
                      {c.status === 'talked' && <>
                        <button className="btn dark" onClick={() => setAgreeing(j.trade)}><Check size={16} />{t('pl_agree_btn')}</button>
                        <button className="btn ghost" onClick={() => go('hire', j.trade)}>{t('pl_other')}</button>
                      </>}
                      {c.status === 'agreed' && <>
                        <button className="btn dark" onClick={() => setStatus(j.trade, 'working')}><Hammer size={16} />{t('pl_start_btn')}</button>
                        <button className="btn ghost" onClick={() => setAgreeing(j.trade)}>{t('pl_edit_price')}</button>
                      </>}
                      {c.status === 'working' && (
                        <button className="btn dark" onClick={() => finish(j.trade)}><Check size={16} />{t('pl_done_btn')}</button>
                      )}
                      {['working', 'done'].includes(c.status) && (
                        <button className="btn ghost" disabled={busy === `photo_${j.trade}`} onClick={() => { photoFor.current = j.trade; photo.current.click(); }}>
                          {busy === `photo_${j.trade}` ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}{c.photo ? t('pl_photo_again') : t('pl_photo')}
                        </button>
                      )}
                      {c.status !== 'need' && (
                        <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setStatus(j.trade, 'need')} title={t('pl_reset')}><RotateCcw size={14} />{t('pl_reset')}</button>
                      )}
                    </div>
                  )}
                  {c.photo && <img className="plan-photo" src={`/media/${project.id}/${c.photo}`} alt="" />}
                  {c.calls?.length > 0 && (
                    <div className="tiny muted adv">{t('pl_calls')}: {c.calls.slice(-4).map(x => `${x.name || t('hi_noname')} (${t(`cs_${x.outcome}`)})`).join(', ')}</div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}

export function AgreeForm({ t, card, job, onSave, onCancel }) {
  const [price, setPrice] = useState(card.price ? String(card.price) : '');
  const [start, setStart] = useState(card.start || '');
  const [busy, setBusy] = useState(false);
  const sum = parseSum(price);
  const v = sum ? verdict(sum, job.labor) : null;
  return (
    <form className="agree" onSubmit={async e => { e.preventDefault(); if (!sum) return; setBusy(true); await onSave(sum, start); setBusy(false); }}>
      <label className="label">{t('cs_price')}</label>
      <div className="row" style={{ gap: 8 }}>
        <input className="input grow" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder={t('cs_price_ph')} autoFocus />
        {sum > 0 && <span className="tab small" style={{ whiteSpace: 'nowrap' }}>{t.money(sum)}</span>}
      </div>
      {v && <div className="row" style={{ gap: 8 }}><Verdict v={v} /><span className="tiny muted">{t('jb_fair')}: {t.range(job.fair)}</span></div>}
      <label className="label">{t('cs_start')}</label>
      <input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} />
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>{t('cs_later')}</button>}
        <button className="btn dark" disabled={!sum || busy}>{busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />}{t('cs_save')}</button>
      </div>
    </form>
  );
}

function Finish({ project, jobs, pr, t }) {
  const pad = i => String(i + 1).padStart(4, '0');
  const before = project.render?.before ? `/media/${project.id}/${project.render.before}` : `/media/${project.id}/frames/${pad(project.hero_frame ?? 0)}.jpg`;
  const real = jobs.map(j => project.board?.[j.trade]?.photo).filter(Boolean);
  return (
    <section className="card pad finish rise">
      <div className="row" style={{ gap: 10 }}><PartyPopper size={26} color="var(--accent)" /><h2 style={{ fontSize: 26 }}>{t('fin_title')}</h2></div>
      <p className="muted">{t('fin_sub', { a: t.money(pr.agreed), f: t.money(pr.fair) })}</p>
      <div className="finish-grid">
        <figure><img src={before} alt="" /><figcaption>{t('before')}</figcaption></figure>
        {project.render && <figure><img src={`/media/${project.id}/${project.render.after}`} alt="" /><figcaption>{t('fin_render')}</figcaption></figure>}
        {real.map(f => <figure key={f}><img src={`/media/${project.id}/${f}`} alt="" /><figcaption>{t('fin_real')}</figcaption></figure>)}
      </div>
    </section>
  );
}
