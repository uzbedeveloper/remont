// "Usta": a dock at the bottom of every project screen. Hold the mic and talk (release to send),
// or tap it once and talk: it sends by itself when you stop. Muse Spark hears it, decides what
// to change, and the project updates.
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, MessageCircle, Mic, Square, Volume2, VolumeX, X } from 'lucide-react';
import { useT } from '../i18n.js';
import { talk } from '../api.js';

const MAX_SECONDS = 30;
const HOLD_MS = 450;     // pressed longer than this = walkie-talkie: release sends
const SILENCE_MS = 1600; // tap mode: this long quiet after speaking sends
const LOUD = 0.16, QUIET = 0.08;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported(m)) ?? '';
}

function stored(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch { return fallback; }
}

// Browsers ship Russian and English voices; Uzbek is rare, so stay quiet rather than mispronounce it.
function say(text, lang) {
  if (!('speechSynthesis' in window) || !text) return;
  const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(lang));
  if (!voice) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice; u.lang = voice.lang;
  speechSynthesis.speak(u);
}

export default function Talk({ project, setProject, go, step }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | rec | busy
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [pending, setPending] = useState(null); // what the owner just sent, shown until the answer lands
  const [note, setNote] = useState('');
  const [slow, setSlow] = useState(false); // still thinking after 8 s
  const [speak, setSpeak] = useState(() => stored('speak', true));
  const [held, setHeld] = useState(false); // walkie-talkie mode while the finger is down
  const [used, setUsed] = useState(() => stored('talked', false)); // the mic pulses until the first go
  const [bubble, setBubble] = useState(true); // the "hold and talk" bubble shows for a few seconds
  const rec = useRef(null);
  const down = useRef(0);
  const list = useRef();
  const chat = project.chat ?? [];

  useEffect(() => { try { localStorage.setItem('speak', speak ? '1' : '0'); } catch { /* private mode */ } }, [speak]);
  useEffect(() => { if (used) try { localStorage.setItem('talked', '1'); } catch { /* private mode */ } }, [used]);
  useEffect(() => {
    // Gone after 7 s or as soon as the owner scrolls: it sits over the page buttons.
    const hide = () => setBubble(false);
    const id = setTimeout(hide, 7000);
    addEventListener('scroll', hide, { once: true, passive: true });
    return () => { clearTimeout(id); removeEventListener('scroll', hide); };
  }, []);
  const tries = t(t.has(`talk_try_${step}`) ? `talk_try_${step}` : 'talk_try');
  const canSay = lang => 'speechSynthesis' in window && speechSynthesis.getVoices().some(v => v.lang.toLowerCase().startsWith(lang));
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [chat.length, pending, open]);
  useEffect(() => () => rec.current?.stop(true), []);
  useEffect(() => {
    setSlow(false);
    if (state !== 'busy') return;
    const id = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(id);
  }, [state]);

  const send = async what => {
    setState('busy'); setNote(''); setOpen(true); setUsed(true);
    setPending(what instanceof Blob ? { voice: true } : { text: what });
    let spoke = false;
    try {
      const r = await talk(project.id, what, e => {
        if (e.step === 'heard') setPending(p => ({ ...p, said: e.said }));
        if (e.step === 'reply') {
          setPending(p => ({ ...p, reply: e.reply, painting: e.actions.includes('render') }));
          if (speak) say(t.pick(e.reply), t.lang);
          spoke = true;
        }
        if (e.step === 'project') setProject(e.project);
      });
      setProject(r.project);
      if (!r.heard) setNote(t('talk_not_heard'));
      else {
        if (speak && !spoke) say(t.pick(r.reply), t.lang);
        if (r.go) {
          const [step, trade] = r.go.split('/');
          go(step, trade);
          if (r.actions.some(a => a.type === 'render')) setTimeout(() => document.getElementById('render')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
        }
      }
    } catch (e) { setNote(t('error', { e: e.message })); }
    setPending(null); setState('idle');
  };

  const start = async () => {
    setNote('');
    if (!navigator.mediaDevices?.getUserMedia) { setOpen(true); setNote(t('talk_mic_https')); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setOpen(true); setNote(t('talk_mic_denied')); return; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();

    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);

    // A live level meter so it's obvious the phone is hearing you.
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const an = ac.createAnalyser(); an.fftSize = 256;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    let raf, loudFor = 0, quietSince = 0, last = performance.now();
    const meter = () => {
      an.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      const lvl = Math.min(1, peak / 60);
      setLevel(lvl);
      // Tap mode: once they have said something, a pause sends it. Holding the button keeps it open.
      const now = performance.now();
      if (lvl > LOUD) { loudFor += now - last; quietSince = 0; }
      else if (lvl < QUIET && loudFor > 300) quietSince ||= now;
      last = now;
      if (quietSince && now - quietSince > SILENCE_MS && !down.current) { rec.current?.stop(); return; }
      raf = requestAnimationFrame(meter);
    };
    meter();

    const t0 = Date.now();
    const tick = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setSecs(s);
      if (s >= MAX_SECONDS) rec.current?.stop();
    }, 200);

    let cancelled = false;
    mr.onstop = () => {
      clearInterval(tick); cancelAnimationFrame(raf); ac.close(); setHeld(false);
      stream.getTracks().forEach(tr => tr.stop());
      rec.current = null; setLevel(0);
      const blob = new Blob(chunks, { type: (mr.mimeType || mime || 'audio/webm').split(';')[0] });
      if (cancelled || Date.now() - t0 < 600 || !blob.size) { setState('idle'); return; }
      send(blob);
    };
    rec.current = { stop: (cancel = false) => { cancelled = cancel; if (mr.state !== 'inactive') mr.stop(); } };
    mr.start();
    navigator.vibrate?.(30);
    setSecs(0); setState('rec');
  };

  // Press: start listening. Release after a long press: send. A short tap leaves it listening
  // until the owner goes quiet (or taps again).
  const press = e => {
    if (e.button > 0 || state === 'busy') return;
    e.preventDefault();
    if (state === 'rec') { rec.current?.stop(); return; }
    down.current = Date.now();
    start();
  };
  const release = () => {
    if (!down.current) return;
    const long = Date.now() - down.current > HOLD_MS;
    down.current = 0;
    if (long) rec.current?.stop();
  };
  useEffect(() => {
    if (state !== 'rec' || !down.current) return;
    const id = setTimeout(() => down.current && setHeld(true), HOLD_MS);
    return () => clearTimeout(id);
  }, [state]);

  const submit = e => {
    e.preventDefault();
    const v = text.trim();
    if (!v || state !== 'idle') return;
    setText('');
    send(v);
  };

  return (
    <div className={`talk${open ? ' open' : ''}`}>
      {open && (
        <div className="talk-sheet">
          <div className="talk-head">
            <span className="talk-avatar">U</span>
            <b>{t('talk_name')}</b>
            <span className="grow" />
            <button className="icon-btn" onClick={() => setSpeak(s => !s)} title={t('talk_speak')} aria-label={t('talk_speak')}>
              {speak ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="close"><X size={18} /></button>
          </div>
          <div className="talk-list" ref={list}>
            <div className="msg ai">{t('talk_hello')}</div>
            {chat.length === 0 && !pending && (
              <div className="try">
                {tries.map(x => <button key={x} disabled={state !== 'idle'} onClick={() => send(x)}>{x}</button>)}
              </div>
            )}
            {chat.map((c, i) => c.who === 'me'
              ? <div key={i} className="msg me">{c.text}</div>
              : (
                <div key={i} className="msg ai">
                  {t.pick(c.reply)}
                  {canSay(t.lang) && <button className="replay" onClick={() => say(t.pick(c.reply), t.lang)} aria-label={t('talk_speak')}><Volume2 size={14} /></button>}
                  {(c.actions?.length > 0 || c.failed?.length > 0) && (
                    <div className="chips">
                      {[...new Set(c.actions)].map(a => <span key={a} className="chip">{t(`act_${a}`)}</span>)}
                      {c.failed?.map((f, k) => <span key={`f${k}`} className="chip bad" title={f.error}>{t('talk_failed')}: {t(`what_${f.type}`)}</span>)}
                    </div>
                  )}
                  {c.image && (
                    <button className="msg-img" onClick={() => { go('smeta'); setTimeout(() => document.getElementById('render')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400); }}>
                      <img src={`/media/${project.id}/${c.image}`} alt="" loading="lazy" />
                    </button>
                  )}
                </div>
              ))}
            {pending && <div className="msg me">{pending.said || pending.text || <span className="row" style={{ gap: 6 }}><Mic size={14} />{t('talk_voice')}</span>}</div>}
            {pending?.reply && <div className="msg ai">{t.pick(pending.reply)}</div>}
            {pending && (!pending.reply || pending.painting) && (
              <div className="msg ai thinking"><Loader2 size={15} className="spin" />{t(pending.painting ? 'talk_paint' : slow ? 'talk_slow' : 'talk_think')}</div>
            )}
            {note && <div className="msg ai warn">{note}</div>}
          </div>
          {chat.length > 0 && state === 'idle' && (
            <div className="try quick">
              {tries.map(x => <button key={x} onClick={() => send(x)}>{x}</button>)}
            </div>
          )}
        </div>
      )}

      {!used && bubble && !open && state === 'idle' && (
        <button type="button" className="talk-hint" onClick={() => setBubble(false)}>
          <b>{t('talk_hint_t')}</b>
          <span>«{tries[0]}»</span>
        </button>
      )}
      <form className="talk-bar" onSubmit={submit}>
        {state === 'rec' ? (
          <>
            <button type="button" className="icon-btn" onClick={() => rec.current?.stop(true)} aria-label="cancel"><X size={20} /></button>
            <div className="rec-meter grow">
              <span className="rec-dot" />
              <span className="tab">{Math.floor(secs)}s</span>
              <div className="bars">{Array.from({ length: 18 }, (_, i) => (
                <i key={i} style={{ height: `${12 + Math.max(0, level * 100 - Math.abs(i - 9) * 7)}%` }} />
              ))}</div>
              <span className="small muted">{t(held ? 'talk_release' : 'talk_listen')}</span>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="icon-btn" onClick={() => setOpen(o => !o)} aria-label={t('talk_open')}>
              <MessageCircle size={20} />
              {chat.length > 0 && !open && <span className="dot-count">{Math.ceil(chat.length / 2)}</span>}
            </button>
            <input className="talk-input grow" value={text} onChange={e => setText(e.target.value)} placeholder={t('talk_ph')}
              disabled={state === 'busy'} onFocus={() => setOpen(true)} enterKeyHint="send" />
            {text.trim() && state === 'idle' && <button className="icon-btn send" aria-label="send"><ArrowUp size={20} /></button>}
          </>
        )}
        <button type="button" className={`mic ${state}${!used && state === 'idle' ? ' hint' : ''}`} disabled={state === 'busy'}
          onPointerDown={press} onPointerUp={release} onPointerCancel={release} onContextMenu={e => e.preventDefault()}
          onClick={e => { if (e.detail === 0) (state === 'rec' ? rec.current?.stop() : start()); }}
          aria-label={state === 'rec' ? 'send' : 'talk'} style={state === 'rec' ? { '--lvl': level } : undefined}>
          {state === 'busy' ? <Loader2 size={24} className="spin" /> : state === 'rec' ? <Square size={20} fill="currentColor" /> : <Mic size={24} />}
        </button>
      </form>
    </div>
  );
}
