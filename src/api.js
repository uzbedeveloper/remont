// Small fetch helpers for the Remont API.
async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export const getConfig = () => fetch('/api/config').then(json);
export const getProject = id => fetch(`/api/project/${id}`).then(json);
export const openSample = () => fetch('/api/sample', { method: 'POST', body: '{"name":"demo"}' }).then(json);
export const patch = (id, body) => fetch(`/api/project/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(json);
export const act = (id, action, body = {}) =>
  fetch(`/api/project/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json);

// Camera captures sometimes arrive without an extension; fall back to the MIME type.
const EXT = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const fileName = f => (/\.\w{2,4}$/.test(f.name) ? f.name : `${f.name || 'capture'}${EXT[f.type] ?? ''}`);

export function upload(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload?name=${encodeURIComponent(fileName(file))}`);
    xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* keep {} */ }
      xhr.status < 300 ? resolve(body) : reject(new Error(body.error || `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(file);
  });
}

// POST that streams back NDJSON events (the analyze pipeline).
export async function stream(id, action, body, onEvent) {
  const res = await fetch(`/api/project/${id}/${action}`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}

// Talk to the project: a recorded Blob (audio) or a string.
export function talk(id, what) {
  const audio = what instanceof Blob;
  return fetch(`/api/project/${id}/talk`, {
    method: 'POST',
    headers: { 'Content-Type': audio ? (what.type.split(';')[0] || 'audio/webm') : 'application/json' },
    body: audio ? what : JSON.stringify({ text: what }),
  }).then(json);
}
