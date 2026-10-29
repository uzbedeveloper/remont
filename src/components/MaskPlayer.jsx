// Plays the room frame by frame with SAM 3.1's tracked masks drawn on top.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Layers, Pause, Play, Pointer } from 'lucide-react';
import { SURFACE } from '../colors.js';
import { useT } from '../i18n.js';

const pad = i => String(i + 1).padStart(4, '0');
const AUTO_MS = 2200;

export default function MaskPlayer({ base, media, compact = false, speed = 2, onFrame, counts, ready }) {
  const t = useT();
  const [overlays, setOverlays] = useState(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [only, setOnly] = useState(null); // one surface picked from the chips, or all of them
  const [auto, setAuto] = useState(true); // walks through the surfaces by itself until the owner taps a chip
  const timer = useRef();
  const n = media?.frames || 1;

  useEffect(() => {
    let live = true;
    // ready changes when SAM finishes in the background; '0' = still tracking, don't cache a 404.
    if (ready !== 0) fetch(`${base}/overlays.json?v=${ready ?? ''}`).then(r => (r.ok ? r.json() : null)).then(o => live && setOverlays(o)).catch(() => {});
    return () => { live = false; };
  }, [base, ready]);
  useEffect(() => {
    // Warm the cache so playback doesn't stutter.
    for (let i = 0; i < n; i++) new Image().src = `${base}/frames/${pad(i)}.jpg`;
  }, [base, n]);

  useEffect(() => {
    if (!playing || n < 2) return;
    const fps = (media.fps || 3) * speed;
    timer.current = setInterval(() => setFrame(f => (f + 1) % n), 1000 / fps);
    return () => clearInterval(timer.current);
  }, [playing, n, media?.fps, speed]);

  useEffect(() => { onFrame?.(frame); }, [frame, onFrame]);

  // frame index → masks for that frame, grouped by label
  const byFrame = useMemo(() => {
    const m = {};
    if (!overlays) return m;
    for (const [label, masks] of Object.entries(overlays.labels)) {
      for (const [f, id, d, x, y] of masks) (m[f] ??= []).push({ label, id, d, x, y });
    }
    return m;
  }, [overlays]);

  const labels = overlays ? Object.keys(SURFACE).filter(k => overlays.labels[k]?.length) : [];
  const w = media?.w || overlays?.w || 1280, h = media?.h || overlays?.h || 720;
  // Big surfaces first so doors and windows sit on top of walls.
  const order = ['ceiling', 'floor', 'wall', 'radiator', 'window', 'door'];
  const masks = (byFrame[frame] ?? []).filter(m => !only || m.label === only).sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

  // All → walls → floor → … → all again, so people see what the chips do without being told.
  const cycle = labels.join();
  useEffect(() => {
    if (!auto || !labels.length) return;
    const steps = [null, ...labels];
    const id = setInterval(() => setOnly(o => steps[(steps.indexOf(o) + 1) % steps.length]), AUTO_MS);
    return () => clearInterval(id);
  }, [auto, cycle]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = k => { setAuto(false); setOnly(k); };

  const seek = e => {
    const r = e.currentTarget.getBoundingClientRect();
    setFrame(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };

  return (
    <div>
      <div className="player">
        <svg viewBox={`0 0 ${w} ${h}`}>
          <image href={`${base}/frames/${pad(frame)}.jpg`} width={w} height={h} />
          {masks.map(m => (
            <path key={`${m.label}-${m.id}`} transform={`translate(${m.x} ${m.y})`} d={m.d}
              fill={SURFACE[m.label]} fillOpacity={only ? '.55' : '.34'} stroke={SURFACE[m.label]} strokeWidth={only ? 5 : compact ? 3 : 2.5} strokeLinejoin="round" />
          ))}
        </svg>
        {!overlays && <div className="scan" />}
        {only && (
          <button className="only-tag" onClick={() => pick(null)}>
            <i style={{ background: SURFACE[only] }} />{t(only)}<span>×</span>
          </button>
        )}
        {n > 1 && (
          <div className="bar">
            <button className="playbtn" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'pause' : 'play'}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="scrub" onClick={seek}><div style={{ width: `${((frame + 1) / n) * 100}%` }} /></div>
            <span className="frameno tab">{frame + 1}/{n}</span>
          </div>
        )}
      </div>
      {labels.length > 0 && (
        <div className="legend">
          <p className="legend-hint"><Pointer size={14} />{t('mask_hint')}</p>
          <button className={`surf${only ? '' : ' on'}${auto ? ' auto' : ''}`} onClick={() => pick(null)}>
            <Layers size={14} />{t('mask_all')}
          </button>
          {labels.map(k => (
            <button key={`${k}${only === k}`} className={`surf${only === k ? ' on' : ''}${auto ? ' auto' : ''}`} style={{ '--c': SURFACE[k] }}
              onClick={() => pick(only === k && !auto ? null : k)} aria-pressed={only === k}>
              {only === k ? <Check size={14} strokeWidth={3} /> : <i />}{t(k)}{counts?.[k] ? <b>{counts[k]}</b> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
