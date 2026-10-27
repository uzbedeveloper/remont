// Check an usta's quote: photograph it, Spark reads it, code compares it with the measured room.
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check as CheckIcon, Copy, Images, Loader2, MessageSquareText, ScanText, Send, TriangleAlert, X } from 'lucide-react';
import { useT } from '../i18n.js';
import { act } from '../api.js';
import { auditQuote } from '../../lib/estimate.mjs';

function sendPhoto(id, file) {
  const ext = (file.name.match(/\.\w+$/)?.[0] || '.jpg').toLowerCase();
  return fetch(`/api/project/${id}/quote_photo?name=q${ext}`, { method: 'POST', body: file })
    .then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`); return b.file; });
}

export default function Check({ project, setProject, config, go }) {
  const t = useT();
  const { prices } = config;
  const cam = useRef();
  const gal = useRef();
  const [files, setFiles] = useState(project.check?.files ?? []);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [lang, setLang] = useState(t.lang === 'ru' ? 'ru' : 'uz');
  const [copied, setCopied] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const audit = useMemo(() => project.check && auditQuote(project.check.read, project, prices), [project, prices]);
  const read = project.check?.read;
  const counter = project.check?.counter?.[lang];
  const fresh = project.check && files.join() !== project.check.files.join();

  const addPhotos = async e => {
    const list = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!list.length) return;
    setBusy('photo'); setError('');
    try {
      const added = [];
      for (const f of list.slice(0, 4 - files.length)) added.push(await sendPhoto(project.id, f));
      setFiles(fs => [...fs, ...added].slice(0, 4));
    } catch (err) { setError(err.message); }
    setBusy('');
  };
  const run = async (what, fn) => {
    setBusy(what); setError('');
    try { setProject(await fn()); } catch (e) { setError(e.message); }
    setBusy('');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(counter); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };
  const overpay = audit ? audit.extra + Math.max(0, audit.math_off) : 0;

  return (
    <main className="page stack">
      <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => go('smeta')}><ArrowLeft size={15} />{t('step_smeta')}</button>

      <section className="card pad stack">
        <div>
          <h2>{t('ck_title')}</h2>
          <p className="muted" style={{ margin: '8px 0 0' }}>{t('ck_sub')}</p>
        </div>
        <div className="row wrap">
          {files.map(f => (
            <div key={f} className="q-thumb">
              <img src={`/media/${project.id}/${f}`} alt="" />
              <button aria-label="remove" onClick={() => setFiles(fs => fs.filter(x => x !== f))}><X size={14} /></button>
            </div>
          ))}
          {files.length < 4 && (
            <>
              <button className="q-add" onClick={() => cam.current.click()} disabled={busy === 'photo'}>
                {busy === 'photo' ? <Loader2 size={22} className="spin" /> : <Camera size={22} />}<span>{t('home_photo')}</span>
              </button>
              <button className="q-add" onClick={() => gal.current.click()} disabled={busy === 'photo'}>
                <Images size={22} /><span>{t('home_gallery')}</span>
              </button>
            </>
          )}
          <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={addPhotos} />
          <input ref={gal} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
        </div>
        {files.length > 0 && (!project.check || fresh) && (
          <button className="btn lg" onClick={() => run('check', () => act(project.id, 'check', { files }))} disabled={!!busy}>
            {busy === 'check' ? <Loader2 size={18} className="spin" /> : <ScanText size={18} />}
            {busy === 'check' ? t('ck_reading') : t('ck_run')}
          </button>
        )}
        {busy === 'check' && <div className="stack">{[80, 60, 90, 50].map((w, i) => <div key={i} className="skeleton" style={{ height: 16, width: `${w}%` }} />)}</div>}
      </section>
      {error && <div className="err">{t('error', { e: error })}</div>}

      {audit && !fresh && (
        <>
          <section className="total-card rise">
            <div className="row" style={{ justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <span className="label" style={{ color: 'rgba(255,255,255,.6)' }}>{read.usta || t('ck_usta')}</span>
              <span className={`pill v-${audit.key}`}>{t(`v_${audit.key}`, { p: audit.ratio ? Math.round((audit.ratio - 1) * 100) : 0 })}</span>
            </div>
            {overpay > 0 ? (
              <>
                <div className="label" style={{ color: 'rgba(255,255,255,.6)', marginTop: 18, position: 'relative' }}>{t('ck_overpay')}</div>
                <div className="big tab" style={{ color: '#ff9b7a' }}>≈ {t.mln(overpay)}</div>
              </>
            ) : (
              <div className="big" style={{ fontSize: 34, marginTop: 14 }}><CheckIcon size={30} style={{ display: 'inline', verticalAlign: -4 }} /> {t('ck_fine')}</div>
            )}
            <div className="compare tab" style={{ position: 'relative' }}>
              <div style={{ background: 'rgba(255,255,255,.08)' }}><span className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>{t('ck_they')}</span><b>{t.money(audit.quoted)}</b></div>
              <div style={{ background: 'rgba(255,255,255,.08)' }}><span className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>{t('ck_fair')}</span><b>{t.money(audit.fair)}</b></div>
            </div>
            {(audit.math_off !== 0 || read.notes.length > 0) && (
              <ul className="flags light">
                {audit.math_off !== 0 && <li><TriangleAlert size={14} />{t('ck_math', { d: t.money(Math.abs(audit.math_off)) })}</li>}
                {read.notes.filter(n => !/arithmetic|sum|jami|итог/i.test(n.en)).map((n, i) => <li key={i}><TriangleAlert size={14} />{t.pick(n)}</li>)}
              </ul>
            )}
          </section>

          <section className="card pad">
            <div className="section-title"><h3 style={{ fontSize: 20 }}>{t('ck_lines')}</h3><span className="muted small">{audit.lines.length}</span></div>
            <ul className="q-lines">
              {audit.lines.map((l, i) => (
                <li key={i} className={l.extra > 0 ? 'bad' : l.flags.includes('unclear') ? 'vague' : 'ok'} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="hand">{l.text}</div>
                      <div className="muted tiny">{t.pick(l.meaning)}</div>
                    </div>
                    <div className="tab" style={{ textAlign: 'right', flex: 'none' }}>
                      <b>{t.money(l.total)}</b>
                      {l.extra > 0 && <div className="minus">+{t.money(l.extra)}</div>}
                    </div>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                    {l.flags.includes('qty_over') && <span className="pill v-very_high">{t('ck_qty', { q: t.num(l.qty), m: t.num(l.measured), u: t.unit(l.unit) })}</span>}
                    {l.flags.includes('price_high') && <span className="pill v-high">{t('ck_price', { p: t.money(l.unit_price), f: t.money(l.fair_unit), u: t.unit(l.unit) })}</span>}
                    {l.flags.includes('price_low') && <span className="pill v-low">{t('ck_low')}</span>}
                    {l.flags.includes('unclear') && <span className="pill v-vague">{t('ck_unclear')}</span>}
                    {!l.flags.length && <span className="pill v-fair"><CheckIcon size={12} strokeWidth={3} />{t('ck_ok')}</span>}
                    {l.includes_materials && <span className="badge">{t('hi_with_mat')}</span>}
                  </div>
                </li>
              ))}
            </ul>
            {audit.missing.length > 0 && (
              <div className="missing">
                <button className="btn sm ghost" onClick={() => setShowMissing(s => !s)}>
                  <TriangleAlert size={14} />{t('ck_missing', { n: audit.missing.length })}
                </button>
                {showMissing && (
                  <>
                    <p className="muted small">{t('ck_missing_d')}</p>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {audit.missing.map(m => <span key={m.item_id} className="badge">{t.pick(m.name)} · {t.num(m.qty)} {t.unit(m.unit)}</span>)}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="card pad stack">
            <div>
              <h3 style={{ fontSize: 20 }}>{t('ck_reply_t')}</h3>
              <p className="muted small" style={{ margin: '6px 0 0' }}>{t('ck_reply_d')}</p>
            </div>
            <button className="btn dark" onClick={() => run('counter', () => act(project.id, 'counter'))} disabled={busy === 'counter'}>
              {busy === 'counter' ? <Loader2 size={17} className="spin" /> : <MessageSquareText size={17} />}
              {busy === 'counter' ? t('hi_writing') : project.check.counter ? t('hi_rewrite') : t('ck_reply_btn')}
            </button>
            {project.check.counter && (
              <>
                <div className="tabs" style={{ alignSelf: 'flex-start' }}>
                  {['uz', 'ru'].map(l => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
                </div>
                <div className="tg-wall"><div className="bubble mine" key={lang}>{counter}</div></div>
                <div className="row wrap">
                  <button className="btn sm ghost" onClick={copy}>{copied ? <CheckIcon size={14} /> : <Copy size={14} />}{copied ? t('hi_copied') : t('hi_copy')}</button>
                  <a className="btn sm tg" href={`https://t.me/share/url?url=${encodeURIComponent(counter)}`} target="_blank" rel="noreferrer"><Send size={14} />{t('hi_share')}</a>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
