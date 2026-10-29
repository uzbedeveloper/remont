import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, Check, Copy, ExternalLink, Image, Loader2, MapPin, MessageCircle, Package, Phone, Send, Sparkles, Star, TriangleAlert } from 'lucide-react';
import { DISTRICTS, useT } from '../i18n.js';
import { act, getUstas, patch } from '../api.js';
import { AgreeForm, Verdict as PlanVerdict } from './Plan.jsx';
import { cardOf } from '../../lib/board.mjs';
import { TRADE } from '../colors.js';
import { jobsFrom, matchUstas, priceSmeta, quote } from '../../lib/estimate.mjs';

const RANK = { fair: 0, high: 1, low: 2, very_high: 3, vague: 4 };

function Verdict({ v }) {
  const t = useT();
  const p = v.ratio ? Math.round((v.ratio - 1) * 100) : 0;
  return <span className={`pill v-${v.key}`}>{v.key === 'fair' && <Check size={12} strokeWidth={3} />}{t(`v_${v.key}`, { p })}</span>;
}

export default function Hire({ project, setProject, config, go, trade }) {
  const t = useT();
  const { prices, ustas } = config;
  const jobs = useMemo(() => jobsFrom(priceSmeta(project.plan.works, prices, project.tier), prices), [project, prices]);
  const job = jobs.find(j => j.trade === trade) ?? jobs[0];
  const { color, Icon } = TRADE[job.trade];

  const [district, setDistrict] = useState(project.district || 'Chilonzor');
  const [start, setStart] = useState('');
  const [materials, setMaterials] = useState('owner');
  const [adLang, setAdLang] = useState(t.lang === 'ru' ? 'ru' : 'uz');
  const [text, setText] = useState(project.replies?.[job.trade]?.text ?? '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [dir, setDir] = useState(null);
  const [tgNote, setTgNote] = useState('');
  useEffect(() => {
    if (!config.directory) return;
    let live = true;
    setDir(null);
    getUstas(job.trade, district).then(r => live && setDir(r)).catch(e => setError(e.message));
    return () => { live = false; };
  }, [job.trade, district, config.directory]);
  const more = async () => {
    setBusy('more');
    try { const r = await getUstas(job.trade, district, dir.ustas.length); setDir(d => ({ ...d, ustas: [...d.ustas, ...r.ustas] })); } catch (e) { setError(e.message); }
    setBusy('');
  };

  const ad = project.ads?.[job.trade];
  const adText = ad?.[adLang] ?? '';
  const matches = useMemo(() => matchUstas(job, ustas, district).slice(0, 5), [job, ustas, district]);
  const replies = useMemo(() => (project.replies?.[job.trade]?.items ?? [])
    .map(r => ({ ...r, q: quote(r, job) }))
    .sort((a, b) => RANK[a.q.key] - RANK[b.q.key] || Math.abs((a.q.ratio ?? 9) - 1) - Math.abs((b.q.ratio ?? 9) - 1)), [project.replies, job]);

  const run = async (what, fn) => {
    setBusy(what); setError('');
    try { setProject(await fn()); } catch (e) { setError(e.message); }
    setBusy('');
  };
  const pickDistrict = d => { setDistrict(d); patch(project.id, { district: d }).then(setProject); };
  // Opening an usta's Telegram: put the job post on the clipboard so it's one paste away.
  const copyForTg = async () => {
    const msg = ad?.[adLang] || `${t.pick(prices.trades[job.trade])}: ${job.lines.map(l => `${t.pick(l.name)} ${t.num(l.qty)} ${t.unit(l.unit)}`).join(', ')}. ${t.district(district)}.`;
    try { await navigator.clipboard.writeText(msg); setTgNote(t('hi_tg_copied')); setTimeout(() => setTgNote(''), 3500); } catch { /* blocked */ }
  };
  // After a call or a Telegram message, ask how it went and move the plan forward.
  const [asked, setAsked] = useState(null);   // the usta just contacted
  const [agreeWith, setAgreeWith] = useState(null);
  const contact = (u, viaTg) => {
    if (viaTg) copyForTg();
    setTimeout(() => setAsked(u), 1200); // the sheet waits under the dialer / Telegram
  };
  const card = cardOf(project.board, job.trade);
  const record = async (u, outcome, extra = {}) => {
    const board = { ...(project.board ?? {}) };
    const c = { ...cardOf(board, job.trade) };
    c.calls = [...(c.calls ?? []), { usta: u.id, name: u.name, outcome, at: new Date().toISOString() }].slice(-20);
    const who = { id: u.id, name: u.name, phone: u.phone, tg: u.tg };
    if (outcome === 'talked' && c.status === 'need') Object.assign(c, { status: 'talked', usta: who });
    if (outcome === 'agreed') Object.assign(c, { status: 'agreed', usta: who, ...extra });
    board[job.trade] = c;
    setProject(await patch(project.id, { board }));
    setAsked(null); setAgreeWith(null);
    if (outcome === 'agreed') go('jobs');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(adText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };
  const why = u => {
    const price = u.verdict.key === 'fair' ? t('hi_why_fair') : u.rate < 1 ? t('hi_why_cheap') : t('hi_why_pricey');
    return [price, t('hi_why_rating', { r: u.rating, n: u.jobs }), t('hi_why_near', { d: t.district(u.district) })].join(' · ');
  };

  return (
    <main className="page stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn sm ghost" onClick={() => go('jobs')}><ArrowLeft size={15} />{t('hi_back')}</button>
        <span className={`st-chip st-${card.status}`}>{t(`st_${card.status}`)}{card.usta?.name ? `: ${card.usta.name}` : ''}</span>
      </div>

      <section className="card pad">
        <div className="row wrap" style={{ gap: 16 }}>
          <span className="icon" style={{ background: color, width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', color: '#fff' }}><Icon size={26} /></span>
          <div className="grow">
            <h2 style={{ fontSize: 28 }}>{t.pick(prices.trades[job.trade])}</h2>
            <div className="muted small">{job.lines.map(l => `${t.pick(l.name)} ${t.num(l.qty)} ${t.unit(l.unit)}`).join(' · ')}</div>
          </div>
          <div>
            <div className="label">{t('jb_fair')}</div>
            <div className="tab" style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 22 }}>{t.range(job.fair)}</div>
          </div>
        </div>
        <div className="row wrap" style={{ marginTop: 16 }}>
          <MapPin size={16} /><b className="small">{t('hi_where')}</b>
          <select className="select" style={{ width: 'auto' }} value={district} onChange={e => pickDistrict(e.target.value)}>
            {DISTRICTS.map(d => <option key={d} value={d}>{t.district(d)}</option>)}
          </select>
        </div>
      </section>
      {error && <div className="err">{t('error', { e: error })}</div>}

      <div className="grid2">
        {config.directory ? (
          <section className="card pad">
            <div className="section-title" style={{ marginBottom: 4 }}>
              <h3 style={{ fontSize: 20 }}>{t('hi_real_t')}</h3>
              {dir && <span className="badge">{t('hi_real_n', { n: dir.total })}</span>}
            </div>
            <p className="muted small" style={{ margin: '0 0 6px' }}>{t('hi_real_d', { ads: config.directory.sources.telegram_ads.toLocaleString('ru-RU'), chats: config.directory.sources.telegram_chats })}</p>
            {!dir && <div className="stack" style={{ marginTop: 12 }}>{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 64 }} />)}</div>}
            {dir?.ustas.map((u, i) => <UstaCard key={u.id} u={u} i={i} t={t} onContact={contact} />)}
            {dir && dir.ustas.length < dir.total && (
              <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={more} disabled={busy === 'more'}>
                {busy === 'more' ? <Loader2 size={16} className="spin" /> : null}{t('hi_more', { n: dir.total - dir.ustas.length })}
              </button>
            )}
            {tgNote && <div className="toast">{tgNote}</div>}
            <p className="tiny muted" style={{ margin: '12px 0 0' }}><TriangleAlert size={12} style={{ display: 'inline', verticalAlign: -2 }} /> {t('hi_real_warn')}</p>
          </section>
        ) : (
        <section className="card pad">
          <div className="section-title" style={{ marginBottom: 4 }}>
            <h3 style={{ fontSize: 20 }}>{t('hi_match_t')}</h3>
            <span className="badge">{t('hi_sample')}</span>
          </div>
          {matches.map((u, i) => (
            <div key={u.id} className="usta" style={{ animationDelay: `${i * 0.05}s` }}>
              <span className="avatar" style={{ background: color }}>{u.name.split(' ').map(w => w[0]).join('')}</span>
              <div style={{ minWidth: 0 }}>
                <div className="name">{u.name}</div>
                <div className="meta">
                  <span className="row" style={{ gap: 3 }}><Star size={12} fill="#f5a524" color="#f5a524" />{u.rating}</span>
                  <span>{t('hi_years', { n: u.years })}</span>
                  <span>{t('hi_jobs', { n: u.jobs })}</span>
                  <span className="row" style={{ gap: 3 }}><MapPin size={12} />{t.district(u.district)}</span>
                  {u.near && <span className="pill v-fair" style={{ padding: '1px 8px' }}>{t('hi_near')}</span>}
                </div>
                <div className="why">{why(u)}</div>
              </div>
              <div className="price">
                <div className="muted tiny">{t('hi_their_price')}</div>
                <div className="v tab">{t.mln(u.price)}</div>
                <div style={{ margin: '4px 0 8px' }}><Verdict v={u.verdict} /></div>
                <button className="btn sm ghost" disabled title={t('hi_message_off')}><MessageCircle size={14} />{t('hi_message')}</button>
              </div>
            </div>
          ))}
        </section>
        )}

        <div className="stack">
          <section className="card pad stack">
            <div>
              <h3 style={{ fontSize: 20 }}>{t('hi_post_t')}</h3>
              <p className="muted small" style={{ margin: '6px 0 0' }}>{t('hi_post_d')}</p>
            </div>
            <div className="row wrap">
              <input className="input grow" style={{ minWidth: 160 }} value={start} onChange={e => setStart(e.target.value)} placeholder={`${t('hi_start')}: ${t('hi_start_ph')}`} />
              <div className="seg">
                <button className={materials === 'owner' ? 'on' : ''} onClick={() => setMaterials('owner')}>{t('hi_mat_owner')}</button>
                <button className={materials === 'usta' ? 'on' : ''} onClick={() => setMaterials('usta')}>{t('hi_mat_usta')}</button>
              </div>
            </div>
            <button className="btn" onClick={() => run('ad', () => act(project.id, 'ad', { trade: job.trade, district, start: start || undefined, materials }))} disabled={busy === 'ad'}>
              {busy === 'ad' ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />}
              {busy === 'ad' ? t('hi_writing') : ad ? t('hi_rewrite') : t('hi_write')}
            </button>
            {ad && (
              <>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="tabs">
                    {['uz', 'ru'].map(l => <button key={l} className={adLang === l ? 'on' : ''} onClick={() => setAdLang(l)}>{l.toUpperCase()}</button>)}
                  </div>
                  {ad.posted && <span className="pill v-fair"><Check size={12} />{t('hi_posted')}</span>}
                </div>
                <div className="tg-wall">
                  <div className="bubble" key={adLang}>
                    <div className="from">Remont</div>
                    {adText}
                    <div className="time">{new Date(ad.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
                <div className="row wrap">
                  <button className="btn sm ghost" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t('hi_copied') : t('hi_copy')}</button>
                  <a className="btn sm tg" href={`https://t.me/share/url?url=${encodeURIComponent(adText)}`} target="_blank" rel="noreferrer"><Send size={14} />{t('hi_share')}</a>
                  {config.telegram && (
                    <button className="btn sm dark" disabled={busy === 'tg'} onClick={() => run('tg', () => act(project.id, 'telegram', { trade: job.trade, lang: adLang }))}>
                      {busy === 'tg' ? <Loader2 size={14} className="spin" /> : <Send size={14} />}{t('hi_post_group')}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="card pad stack">
            <div>
              <h3 style={{ fontSize: 20 }}>{t('hi_replies_t')}</h3>
              <p className="muted small" style={{ margin: '6px 0 0' }}>{t('hi_replies_d')}</p>
            </div>
            <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder={t('hi_replies_ph')} />
            <button className="btn dark" disabled={!text.trim() || busy === 'replies'} onClick={() => run('replies', () => act(project.id, 'replies', { trade: job.trade, text }))}>
              {busy === 'replies' ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />}
              {busy === 'replies' ? t('hi_reading') : t('hi_read')}
            </button>
            {replies.length > 0 && (
              <div>
                {replies.map((r, i) => (
                  <div key={i} className={`reply${i === 0 && r.q.key === 'fair' ? ' best' : ''}`} style={{ animationDelay: `${i * 0.07}s` }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <b>{r.name || t('hi_anon')}</b>
                        {r.contact && r.contact !== r.name && <span className="muted small"> · {r.contact}</span>}
                      </div>
                      <Verdict v={r.q} />
                    </div>
                    <div className="small" style={{ marginTop: 6 }}>{t.pick(r.summary)}</div>
                    {r.q.quoted > 0 && (
                      <div className="compare tab">
                        <div><span className="muted tiny">{t('hi_quoted')}</span><b>{t.mln(r.q.quoted)}</b></div>
                        <div>
                          <span className="muted tiny">{t('hi_fair_lbl')}</span>
                          <b>{t.mln(r.q.fair)}</b>
                        </div>
                      </div>
                    )}
                    <div className="row wrap muted tiny" style={{ marginTop: 8, gap: 12 }}>
                      {r.start && <span>{t('hi_starts', { s: r.start })}</span>}
                      {r.experience_years > 0 && <span>{t('hi_exp', { n: r.experience_years })}</span>}
                      {r.has_photos && <span className="row" style={{ gap: 4 }}><Camera size={12} />{t('hi_photos')}</span>}
                      {r.q.partial && <span>{t('hi_partial')}</span>}
                      {r.offers?.some(o => o.includes_materials) && <span>{t('hi_with_mat')}</span>}
                    </div>
                    {r.flags?.length > 0 && (
                      <ul className="flags">{r.flags.map((f, k) => <li key={k}><TriangleAlert size={14} style={{ flex: 'none', marginTop: 2 }} />{t.pick(f)}</li>)}</ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      {asked && (
        <div className="sheet-back" onClick={() => { setAsked(null); setAgreeWith(null); }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20 }}>{t('cs_title', { name: asked.name || t('hi_noname') })}</h3>
            {agreeWith ? (
              <AgreeForm t={t} card={card} job={job} onCancel={() => setAgreeWith(null)} onSave={(price, start) => record(asked, 'agreed', { price, start })} />
            ) : (
              <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                <button className="btn dark lg" onClick={() => setAgreeWith(asked)}>{t('cs_agreed')}</button>
                <button className="btn ghost" onClick={() => record(asked, 'talked')}>{t('cs_talked')}</button>
                <button className="btn ghost" onClick={() => record(asked, 'none')}>{t('cs_none')}</button>
                <button className="btn sm ghost" style={{ alignSelf: 'center' }} onClick={() => setAsked(null)}>{t('cs_later')}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function ago(t, date) {
  const d = Math.max(0, Math.round((Date.now() - Date.parse(date)) / 86400000));
  return d === 0 ? t('hi_today') : t('hi_days_ago', { n: d });
}

// Soft avatar colours picked from the id, so a list of many «Usta» does not look like one person.
const TINTS = [['#fde7dc', '#c2410c'], ['#dcf2e6', '#15803d'], ['#e0ecfb', '#1d4ed8'], ['#f1e4fb', '#7e22ce'], ['#fdf1d3', '#a16207'], ['#dff5f4', '#0f766e']];
const tint = id => TINTS[[...String(id)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % TINTS.length];

function UstaCard({ u, i, t, onContact }) {
  const initials = (u.name || 'U').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const where = u.districts.includes('all') ? t('hi_all_city') : u.districts.length ? u.districts.map(d => t.district(d)).join(', ') : u.city === 'tashkent_region' ? t('hi_region') : t('hi_city');
  return (
    <div className="usta real" style={{ animationDelay: `${i * 0.04}s` }}>
      <span className="avatar" style={{ background: tint(u.id)[0], color: tint(u.id)[1] }}>{initials}</span>
      <div style={{ minWidth: 0 }}>
        <div className="name">{u.name || t('hi_noname')}</div>
        <div className="why" style={{ marginTop: 2 }}>{t.pick(u.about)}</div>
        <div className="meta" style={{ marginTop: 6 }}>
          <span className="row" style={{ gap: 3 }}><MapPin size={12} />{where}</span>
          {u.near && <span className="pill v-fair" style={{ padding: '1px 8px' }}>{t('hi_near')}</span>}
          <span>{t('hi_last_ad', { d: ago(t, u.last_seen) })}</span>
          {u.posts > 1 && <span>{t('hi_posts', { n: u.posts })}</span>}
          {u.years > 0 && <span>{t('hi_years', { n: u.years })}</span>}
          {u.materials && <span className="row" style={{ gap: 3 }}><Package size={12} />{t('hi_brings_mat')}</span>}
          {u.photos && <span className="row" style={{ gap: 3 }}><Image size={12} />{t('hi_has_photos')}</span>}
        </div>
      </div>
      <div className="contact">
        {u.phone && <a className="btn sm call" href={`tel:+${u.phone}`} onClick={() => onContact(u, false)}><Phone size={14} />{t('hi_call')}</a>}
        {u.tg && <a className="btn sm tg" href={`https://t.me/${u.tg.slice(1)}`} target="_blank" rel="noreferrer" onClick={() => onContact(u, true)}><Send size={14} />Telegram</a>}
        {u.ads[0] && <a className="tiny muted ad-link" href={u.ads[0]} target="_blank" rel="noreferrer"><ExternalLink size={11} />{t('hi_see_ad')}</a>}
      </div>
    </div>
  );
}
