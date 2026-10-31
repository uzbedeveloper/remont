// Header tools: the Aa text size picker, and on a phone one menu for language and projects,
// so the header fits in one slim row.
import { useEffect, useRef, useState } from 'react';
import { Check, FolderOpen, Menu, X } from 'lucide-react';
import { LANGS, useT } from '../i18n.js';
import { SIZES, useSize } from '../textsize.js';

// A small popover that closes on a tap outside or Escape.
function usePop() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return { open, setOpen, ref };
}

const PX = { s: 13, m: 16, l: 20 };

export function TextSize() {
  const t = useT();
  const [size, setSize] = useSize();
  const { open, setOpen, ref } = usePop();
  return (
    <div className="pop-wrap" ref={ref}>
      <button className={`hd-btn aa${open ? ' on' : ''}`} onClick={() => setOpen(o => !o)} aria-label={t('fs_title')} aria-expanded={open}>
        <span style={{ fontSize: 12 }}>A</span><span style={{ fontSize: 17 }}>a</span>
      </button>
      {open && (
        <div className="pop">
          <div className="label">{t('fs_title')}</div>
          <div className="fs-opts">
            {SIZES.map(s => (
              <button key={s} className={s === size ? 'on' : ''} onClick={() => setSize(s)} aria-pressed={s === size}>
                <span className="fs-a" style={{ fontSize: PX[s] + 6 }}>A</span>
                <span>{t(`fs_${s}`)}</span>
              </button>
            ))}
          </div>
          <p className="tiny muted" style={{ margin: '10px 2px 0' }}>{t('fs_note')}</p>
        </div>
      )}
    </div>
  );
}

export function PhoneMenu({ lang, setLang, count, onProjects }) {
  const t = useT();
  const { open, setOpen, ref } = usePop();
  return (
    <div className="pop-wrap only-sm" ref={ref}>
      <button className={`hd-btn${open ? ' on' : ''}`} onClick={() => setOpen(o => !o)} aria-label={t('menu')} aria-expanded={open}>
        {open ? <X size={19} /> : <Menu size={19} />}
        {count > 0 && !open && <b className="hd-dot" />}
      </button>
      {open && (
        <div className="pop">
          <a className="pop-row" href="#/projects" onClick={() => { setOpen(false); onProjects?.(); }}>
            <FolderOpen size={18} /><span className="grow">{t('mine_title')}</span>{count > 0 && <b className="pop-count">{count}</b>}
          </a>
          <div className="label" style={{ marginTop: 12 }}>{t('lang_title')}</div>
          {LANGS.map(l => (
            <button key={l} className="pop-row" onClick={() => { setLang(l); setOpen(false); }}>
              <span className="grow">{{ uz: "O'zbekcha", ru: 'Русский', en: 'English' }[l]}</span>
              {l === lang && <Check size={18} color="var(--accent)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
