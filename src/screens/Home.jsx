import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Images, Loader2, Ruler, ReceiptText, Upload, Users, Video } from 'lucide-react';
import { useT } from '../i18n.js';
import { openSample, upload } from '../api.js';
import { areas } from '../../lib/estimate.mjs';
import MaskPlayer from '../components/MaskPlayer.jsx';

export default function Home({ open }) {
  const t = useT();
  const file = useRef();
  const film = useRef();
  const photo = useRef();
  const [sample, setSample] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetch('/sample/demo/project.json').then(r => r.ok && r.json()).then(setSample).catch(() => {}); }, []);

  const onFile = async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(''); setProgress(0);
    try { open(await upload(f, setProgress), 'analyze'); } catch (err) { setError(err.message); setProgress(null); }
  };
  const onSample = async () => {
    setBusy(true); setError('');
    try { open(await openSample(), 'measure'); } catch (err) { setError(err.message); setBusy(false); }
  };
  const a = sample?.measure && areas(sample.measure);

  return (
    <main className="page">
      <section className="hero">
        <div className="rise">
          <span className="kicker"><span className="pulse" />{t('home_kicker')}</span>
          <h1>
            <span>{t('home_title_1')}</span>
            <span>{t('home_title_2')}</span>
            <span className="hl">{t('home_title_3')}</span>
          </h1>
          <p className="sub">{t('home_sub')}</p>
          {/* On a phone: straight to the camera. On a computer: pick a file. */}
          <div className="ctas only-touch">
            <button className="btn lg cam" onClick={() => film.current.click()} disabled={progress !== null}>
              {progress !== null ? <Loader2 size={20} className="spin" /> : <Video size={20} />}
              {progress !== null ? t('an_uploading', { p: Math.round(progress * 100) }) : t('home_film')}
            </button>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn ghost grow" onClick={() => photo.current.click()} disabled={progress !== null}><Camera size={18} />{t('home_photo')}</button>
              <button className="btn ghost grow" onClick={() => file.current.click()} disabled={progress !== null}><Images size={18} />{t('home_gallery')}</button>
            </div>
            <button className="btn ghost" onClick={onSample} disabled={busy}>
              {busy ? <Loader2 size={18} className="spin" /> : null}{t('home_sample')} <ArrowRight size={18} />
            </button>
          </div>
          <div className="ctas only-mouse">
            <button className="btn lg" onClick={() => file.current.click()} disabled={progress !== null}>
              {progress !== null ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
              {progress !== null ? t('an_uploading', { p: Math.round(progress * 100) }) : t('home_upload')}
            </button>
            <button className="btn lg ghost" onClick={onSample} disabled={busy}>
              {busy ? <Loader2 size={18} className="spin" /> : null}{t('home_sample')} <ArrowRight size={18} />
            </button>
          </div>
          <input ref={file} type="file" accept="video/*,image/*" hidden onChange={onFile} />
          <input ref={film} type="file" accept="video/*" capture="environment" hidden onChange={onFile} />
          <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          {progress !== null && <div className="upload-progress"><div style={{ width: `${progress * 100}%` }} /></div>}
          <p className="muted small" style={{ marginTop: 14 }}>{t('home_upload_hint')}</p>
          {error && <div className="err" style={{ marginTop: 12 }}>{t('error', { e: error })}</div>}
        </div>

        <div className="device rise" style={{ animationDelay: '.15s' }}>
          <div className="screen">
            {sample ? <MaskPlayer base="/sample/demo" media={sample.media} compact /> : <div className="skeleton" style={{ aspectRatio: '16/9' }} />}
          </div>
          {a && (
            <>
              <div className="float a">
                <div className="label">{t('walls')}</div>
                <div className="big tab">{t.num(a.walls_net)} m²</div>
              </div>
              <div className="float b">
                <div className="label">{t('floor')}</div>
                <div className="big tab">{t.num(a.floor)} m²</div>
              </div>
            </>
          )}
          <p className="muted tiny" style={{ textAlign: 'center', marginTop: 10 }}>{t('hero_caption')}</p>
        </div>
      </section>

      <section>
        <div className="section-title"><h2>{t('how_title')}</h2></div>
        <div className="how">
          {[[Ruler, 'how1'], [ReceiptText, 'how2'], [Users, 'how3']].map(([Icon, k], i) => (
            <div key={k} className="card rise" style={{ animationDelay: `${0.1 * i}s` }}>
              <div className="n"><Icon size={20} /></div>
              <h3>{t(`${k}_t`)}</h3>
              <p>{t(`${k}_d`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pitch">
        <blockquote>{t('pitch')}</blockquote>
        <div>
          <div className="label" style={{ color: 'rgba(255,255,255,.6)' }}>{t('built_with')}</div>
          <div className="models"><span>SAM 3.1</span><span>Muse Spark</span><span>Muse Image</span></div>
        </div>
      </section>
    </main>
  );
}
