// The projects this browser opened, so the home screen can bring them back. Projects live on the server;
// this only remembers their ids and the last screen, newest first.
const KEY = 'mine';

export function mine() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function remember(id, step) {
  try {
    const list = [{ id, step, at: Date.now() }, ...mine().filter(m => m.id !== id)].slice(0, 6);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* private mode */ }
}

export function forget(id) {
  try { localStorage.setItem(KEY, JSON.stringify(mine().filter(m => m.id !== id))); } catch { /* private mode */ }
}
