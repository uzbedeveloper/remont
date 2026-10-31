// Thin client for the Meta Model API (Muse Spark, Muse Image, SAM 3.1).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { spend } from './guard.mjs';

export const BASE = process.env.META_API_BASE || 'https://api.meta.ai/v1';
export const SPARK = process.env.SPARK_MODEL || 'muse-spark-1.3';

// Load .env once (no dependency); real env vars win.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// setx writes the key to the user registry; processes started before that
// don't see it in process.env, so fall back to reg on Windows.
let cachedKey;
export function apiKey() {
  if (cachedKey) return cachedKey;
  if (process.env.MODEL_API_KEY) return (cachedKey = process.env.MODEL_API_KEY);
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'MODEL_API_KEY'], { encoding: 'utf8' });
      const m = out.match(/MODEL_API_KEY\s+REG_\w+\s+(\S+)/);
      if (m) return (cachedKey = m[1]);
    } catch { /* not set */ }
  }
  throw new Error('MODEL_API_KEY is not set (put it in .env)');
}

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime',
};

export function dataUrl(path) {
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error(`unknown file type: ${path}`);
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

export async function post(path, body) {
  spend();
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

// POST /responses with stream:true and yield the parsed SSE events.
export async function* streamResponses(body) {
  spend();
  const res = await fetch(BASE + '/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok) throw new Error(`/responses ${res.status}: ${(await res.text()).slice(0, 600)}`);
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

// Text of the last assistant message (Spark may post progress messages first).
export function outputText(resp) {
  const msgs = resp.output.filter(o => o.type === 'message');
  return (msgs.at(-1)?.content ?? []).filter(c => c.type === 'output_text').map(c => c.text).join('');
}

// Spark call with a strict JSON schema; returns the parsed object.
// Most of Spark's time is hidden reasoning. 'minimal' answered our prompts as well at a third of the time
// (27 Oct: smeta 24 s → 9 s, same works); measuring and quote reading use 'low'. '' = the model's default.
export const EFFORT = process.env.SPARK_EFFORT ?? 'minimal';
export async function sparkJSON({ input, schema, name, tools, effort = EFFORT }) {
  const r = await post('/responses', {
    model: SPARK,
    input,
    ...(effort ? { reasoning: { effort } } : {}),
    ...(tools ? { tools } : {}),
    text: { format: { type: 'json_schema', name, schema, strict: true } },
  });
  const text = outputText(r);
  try {
    return JSON.parse(text);
  } catch {
    // Some replies wrap the JSON in prose or a code fence.
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`Spark returned no JSON: ${text.slice(0, 300)}`);
  }
}
