// Drag to compare the room today with Muse Image's renovated version.
import { useRef, useState } from 'react';
import { useT } from '../i18n.js';

export default function BeforeAfter({ before, after }) {
  const t = useT();
  const [x, setX] = useState(50);
  const box = useRef();
  const move = e => {
    const r = box.current.getBoundingClientRect();
    setX(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };
  return (
    <div className="ba" ref={box}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={e => e.buttons && move(e)}>
      <img src={before} alt={t('before')} draggable="false" />
      <div className="after" style={{ clipPath: `inset(0 0 0 ${x}%)` }}>
        <img src={after} alt={t('after')} draggable="false" />
      </div>
      <div className="handle" style={{ left: `${x}%` }} />
      <span className="tag" style={{ left: 12 }}>{t('before')}</span>
      <span className="tag" style={{ right: 12 }}>{t('after')}</span>
    </div>
  );
}
