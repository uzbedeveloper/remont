import { useMemo, useState } from 'react';
import { ArrowLeft, Camera, Check, Copy, Loader2, MapPin, MessageCircle, Send, Sparkles, Star, TriangleAlert } from 'lucide-react';
import { DISTRICTS, useT } from '../i18n.js';
import { act, patch } from '../api.js';
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
  const copy = async () => {
    try { await navigator.clipboard.writeText(adText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };
  const why = u => {
    const price = u.verdict.key === 'fair' ? t('hi_why_fair') : u.rate < 1 ? t('hi_why_cheap') : t('hi_why_pricey');
    return [price, t('hi_why_rating', { r: u.rating, n: u.jobs }), t('hi_why_near', { d: t.district(u.district) })].join(' · ');
  };

  return (
    <main className="page stack">
      <button className="btn sm ghost" onClick={() => go('jobs')}><ArrowLeft size={15} />{t('hi_back')}</button>

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
    </main>
  );
}
