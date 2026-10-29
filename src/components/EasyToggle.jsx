// Easy mode, for parents and anyone who wants it simple: bigger text and buttons, fewer details.
// Remembered on this device; the class on <html> does the rest (styles.css, .easy).
import { useEffect, useState } from 'react';
import { Type } from 'lucide-react';
import { useT } from '../i18n.js';

const read = () => { try { return localStorage.getItem('easy') === '1'; } catch { return false; } };
export const applyEasy = (on = read()) => document.documentElement.classList.toggle('easy', on);

export default function EasyToggle() {
  const t = useT();
  const [on, setOn] = useState(read);
  useEffect(() => {
    applyEasy(on);
    try { localStorage.setItem('easy', on ? '1' : '0'); } catch { /* private mode */ }
  }, [on]);
  return (
    <button className={`easy-toggle${on ? ' on' : ''}`} onClick={() => setOn(v => !v)} aria-pressed={on}>
      <Type size={18} />
      <span className="grow"><b>{t('easy_t')}</b><span className="tiny">{t('easy_d')}</span></span>
      <span className="switch"><i /></span>
    </button>
  );
}
