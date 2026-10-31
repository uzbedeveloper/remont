// Text size for the whole app: small, medium (default) or large. Large is "easy mode": bigger text,
// fewer details. Remembered on this device; classes on <html> do the rest (styles.css).
import { useEffect, useState } from 'react';

export const SIZES = ['s', 'm', 'l'];
export function readSize() {
  try {
    const v = localStorage.getItem('fs');
    if (SIZES.includes(v)) return v;
    return localStorage.getItem('easy') === '1' ? 'l' : 'm'; // easy mode from before the size control
  } catch { return 'm'; }
}
export function applySize(s = readSize()) {
  const c = document.documentElement.classList;
  c.toggle('fs-s', s === 's'); c.toggle('fs-l', s === 'l'); c.toggle('easy', s === 'l');
}
export function setSize(s) {
  try { localStorage.setItem('fs', s); localStorage.setItem('easy', s === 'l' ? '1' : '0'); } catch { /* private mode */ }
  applySize(s);
  dispatchEvent(new CustomEvent('textsize', { detail: s }));
}
export function useSize() {
  const [s, set] = useState(readSize);
  useEffect(() => {
    const on = e => set(e.detail);
    addEventListener('textsize', on);
    return () => removeEventListener('textsize', on);
  }, []);
  return [s, setSize];
}
