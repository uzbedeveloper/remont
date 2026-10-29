import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Ear, Film, Loader2, Ruler, TriangleAlert } from 'lucide-react';
import { useT } from '../i18n.js';
import { stream } from '../api.js';

function Status({ s }) {
  if (s === 'done') return <span className="ic ok"><Check size={16} strokeWidth={3} /></span>;
  if (s === 'error') return <span className="ic err"><TriangleAlert size={16} /></span>;
  return <span className="ic"><Loader2 size={16} className="spin" /></span>;
}

export default function Analyze({ project, setProject, go }) {
  const t = useT();
  const [hint, setHint] = useState('');
  const [ev, setEv] = useState(null);
  const [error, setError] = useState('');
  const isVideo = /\.(mp4|mov|m4v|webm)$/i.test(project.media.original);
  const src = `/media/${project.id}/${project.media.original}`;

  const run = async () => {
    setError('');
    setEv({ sam: {} });
    try {
      await stream(project.id, 'analyze', { hint }, e => {
        if (e.step === 'error') return setError(e.error);
        if (e.step === 'done') { setProject(e.project); setTimeout(() => go('measure'), 500); }
        setEv(s => e.step === 'sam'
          ? s // SAM tracks in the background; the Measure screen shows it
          : { ...s, [e.step]: e });
      });
    } catch (e) { setError(e.message); }
  };

  // A fresh upload starts right away: no extra button between filming and results.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || project.measure || project.stage !== 'uploaded') return;
    started.current = true;
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const running = ev && !ev.done && !error;
  const total = 2 + (isVideo ? 1 : 0);
  const finished = [ev?.prep?.status === 'done', ev?.measure?.status === 'done', ev?.listen?.status === 'done'].filter(Boolean).length;
  const m = ev?.measure?.measure;

  return (
    <main className="page">
      <div className="section-title"><h2>{t('an_title')}</h2></div>
      <div className="grid2">
        <div className="preview card" style={{ padding: 0 }}>
          {isVideo ? <video src={src} controls muted autoPlay loop playsInline /> : <img src={src} alt="" />}
        </div>

        <div className="card pad stack">
          {!ev && (
            <>
              <label className="label" htmlFor="hint">{t('an_hint_label')}</label>
              <input id="hint" className="input" value={hint} onChange={e => setHint(e.target.value)} placeholder={t('an_hint_ph')} />
              {/* Already measured: going on is the main action, measuring again the second one. */}
              {project.measure ? (
                <>
                  <button className="btn lg" style={{ width: '100%' }} onClick={() => go('measure')}>{t('step_measure')} <ArrowRight size={18} /></button>
                  <button className="btn ghost" style={{ width: '100%' }} onClick={run}><Ruler size={16} />{t('an_again')}</button>
                </>
              ) : (
                <button className="btn lg" style={{ width: '100%' }} onClick={run}><Ruler size={18} />{t('an_start')}</button>
              )}
            </>
          )}

          {ev && (
            <>
              <ul className="checks">
                <li>
                  <Status s={ev.prep?.status} />
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}><Film size={14} style={{ display: 'inline', verticalAlign: -2 }} /> {t('an_prep')}</div>
                    {ev.prep?.media && <div className="muted small">{t('an_prep_done', { n: ev.prep.media.frames, fps: ev.prep.media.fps || 1 })}</div>}
                  </div>
                </li>
                {isVideo && ev.prep?.status === 'done' && (
                  <li>
                    <Status s={ev.listen?.status} />
                    <div className="grow">
                      <div style={{ fontWeight: 700 }}><Ear size={14} style={{ display: 'inline', verticalAlign: -2 }} /> {t('an_listen')}</div>
                      {ev.listen?.status === 'done' && (ev.listen.said
                        ? <div className="said">«{ev.listen.said}»</div>
                        : <div className="muted small">{t('an_listen_none')}</div>)}
                      {ev.wishes?.voice && <div className="chips"><span className="chip">{t.pick(ev.wishes.voice.heard)}</span></div>}
                    </div>
                  </li>
                )}
                {ev.prep?.status === 'done' && (
                  <li>
                    <Status s={ev.measure?.status} />
                    <div className="grow">
                      <div style={{ fontWeight: 700 }}>{t('an_measure')}</div>
                      {m && <div className="muted small tab">{t.num(m.length_m)} × {t.num(m.width_m)} × {t.num(m.height_m)} m</div>}
                    </div>
                  </li>
                )}
              </ul>
              {running && (
                <div>
                  <div className="upload-progress"><div style={{ width: `${Math.max(6, (finished / total) * 100)}%` }} /></div>
                  <p className="muted small" style={{ marginBottom: 0 }}>{t('an_wait')}</p>
                </div>
              )}
              {ev.done && <button className="btn lg" style={{ width: '100%' }} onClick={() => go('measure')}>{t('step_measure')} <ArrowRight size={18} /></button>}
            </>
          )}
          {error && (
            <>
              <div className="err">{t('error', { e: error })}</div>
              <button className="btn ghost" onClick={run}>{t('retry')}</button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
