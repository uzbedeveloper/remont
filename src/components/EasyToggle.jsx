// Easy mode, for parents and anyone who wants it simple: the "large" text size (bigger text and
// buttons, fewer details). Same setting as the Aa button in the header.
import { Type } from 'lucide-react';
import { useT } from '../i18n.js';
import { useSize } from '../textsize.js';

export default function EasyToggle() {
  const t = useT();
  const [size, setSize] = useSize();
  const on = size === 'l';
  return (
    <button className={`easy-toggle${on ? ' on' : ''}`} onClick={() => setSize(on ? 'm' : 'l')} aria-pressed={on}>
      <Type size={18} />
      <span className="grow"><b>{t('easy_t')}</b><span className="tiny">{t('easy_d')}</span></span>
      <span className="switch"><i /></span>
    </button>
  );
}
