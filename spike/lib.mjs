// Shared helpers for the Remont feasibility spike.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

export const BASE = 'https://api.meta.ai/v1';

// setx writes the key to the user registry; processes started before that
// (like this Claude Code session) don't see it in process.env, so fall back to reg.
export function apiKey() {
  if (process.env.MODEL_API_KEY) return process.env.MODEL_API_KEY;
  const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'MODEL_API_KEY'], { encoding: 'utf8' });
  const m = out.match(/MODEL_API_KEY\s+REG_\w+\s+(\S+)/);
  if (!m) throw new Error('MODEL_API_KEY not found in env or HKCU\\Environment');
  return m[1];
}

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};

export function dataUrl(path) {
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error(`unknown file type: ${path}`);
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

export async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 2000)}`);
  return JSON.parse(text);
}

// POST /responses with stream:true and yield the parsed SSE events.
export async function* streamResponses(body) {
  const res = await fetch(BASE + '/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok) throw new Error(`/responses ${res.status}: ${(await res.text()).slice(0, 2000)}`);
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
      if (!data || data === '[DONE]') continue;
      yield JSON.parse(data);
    }
  }
}

// Concatenated output_text of a non-streamed /responses result.
export function outputText(resp) {
  return resp.output
    .filter(o => o.type === 'message')
    .flatMap(o => o.content)
    .filter(c => c.type === 'output_text')
    .map(c => c.text)
    .join('');
}

export function ffmpeg(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}
