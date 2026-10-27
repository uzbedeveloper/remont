// "Usta": talk to your renovation. Muse Spark 1.2 listens (it takes audio; 1.3 ignores it),
// Muse Spark 1.3 decides what to change, the server applies it.
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { post, outputText, sparkJSON } from './meta.mjs';
import { areas } from './estimate.mjs';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const EAR = process.env.SPARK_AUDIO_MODEL || 'muse-spark-1.2';

const tri = { type: 'object', additionalProperties: false, required: ['en', 'uz', 'ru'],
  properties: { en: { type: 'string' }, uz: { type: 'string' }, ru: { type: 'string' } } };

// Browser audio (webm/opus on Android and Chrome, mp4/aac on iPhone) → 16 kHz mono wav → text.
export async function transcribe(dir, audio, ext) {
  const src = join(dir, `voice_raw.${ext}`);
  const wav = join(dir, 'voice_in.wav');
  writeFileSync(src, audio);
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-ar', '16000', '-t', '60', wav], { stdio: ['ignore', 'ignore', 'pipe'] });
    const b64 = readFileSync(wav).toString('base64');
    const r = await post('/responses', {
      model: EAR,
      input: [{ role: 'user', content: [
        { type: 'input_text', text: 'Transcribe this voice note word for word, in the language and script it was spoken (Uzbek in Latin script, Russian in Cyrillic, English). It is a homeowner talking about renovating a room in Tashkent. Output only the transcript, nothing else. If there is no speech, output an empty line.' },
        { type: 'input_audio', input_audio: { data: b64, format: 'wav' } },
      ] }],
    });
    return outputText(r).trim().replace(/^["«]|["»]$/g, '');
  } finally {
    for (const f of [src, wav]) try { unlinkSync(f); } catch { /* gone */ }
  }
}

const CHOICES = {
  walls: ['paint', 'wallpaper', 'tiles', 'keep'],
  floor: ['laminate', 'tiles', 'linoleum', 'keep'],
  ceiling: ['stretch', 'paint', 'keep'],
  window: ['replace', 'keep'],
  door: ['replace', 'keep'],
  radiator: ['replace', 'keep'],
  electrics: ['rewire', 'points', 'keep'],
};

function schema(trades) {
  return {
    type: 'object', additionalProperties: false, required: ['reply', 'actions'],
    properties: {
      reply: { ...tri, description: 'what you say back: one or two short spoken sentences, warm, like a good usta' },
      actions: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['type', 'instruction', 'tier', 'length_m', 'width_m', 'height_m', 'choices', 'note', 'trade', 'step'],
        properties: {
          type: { type: 'string', enum: ['render', 'tier', 'size', 'smeta', 'ad', 'go'] },
          instruction: { type: 'string', description: 'render: the visual change, in English, concrete (colours, materials, fixtures). "" otherwise' },
          tier: { type: 'string', enum: ['', 'economy', 'standard', 'premium'] },
          length_m: { type: 'number', description: 'size: new value, 0 = unchanged' },
          width_m: { type: 'number' }, height_m: { type: 'number' },
          choices: { type: 'object', additionalProperties: false, required: Object.keys(CHOICES),
            properties: Object.fromEntries(Object.entries(CHOICES).map(([k, v]) => [k, { type: 'string', enum: ['', ...v] }])),
            description: 'smeta: finish per surface, "" = unchanged' },
          note: { type: 'string', description: 'smeta: extra wish for the estimator, "" if none' },
          trade: { type: 'string', enum: ['', ...trades] },
          step: { type: 'string', enum: ['', 'measure', 'smeta', 'jobs', 'hire'] },
        } } },
    },
  };
}

// Decide what the owner's words mean for this project. Returns { reply, actions }.
export async function decide(project, prices, said) {
  const m = project.measure;
  const a = areas(m);
  const ctx = {
    room: m && { type: m.room_type, length_m: m.length_m, width_m: m.width_m, height_m: m.height_m, floor_m2: a.floor, walls_m2: a.walls_net, condition: m.condition },
    tier: project.tier,
    choices: project.brief?.choices ?? null,
    has_smeta: Boolean(project.plan),
    has_render: Boolean(project.render),
    last_render_look: project.render?.style ?? null,
    trades_in_smeta: project.plan ? [...new Set(project.plan.works.map(w => prices.items.find(i => i.id === w.item_id)?.trade))] : [],
  };
  const history = (project.chat ?? []).slice(-6).map(c => `${c.who === 'me' ? 'OWNER' : 'YOU'}: ${c.who === 'me' ? c.text : c.reply?.en}`).join('\n');
  const prompt = `You are "Usta", the voice of Remont, a renovation app in Tashkent. The owner filmed a room; the app measured it, built a smeta (priced from a price base, never by you) and can repaint the room with Muse Image. The owner talks to you, often in Uzbek or Russian, short and casual. Turn what they say into actions on the project.

PROJECT: ${JSON.stringify(ctx)}
${history ? `RECENT TALK:\n${history}\n` : ''}
OWNER JUST SAID: "${said}"

Actions (zero or more, in order):
- render: change how the renovated room looks ("make the walls light grey", "add a wooden floor", "warmer light", "bigger window"). instruction = the concrete visual change in English. Each render edits the previous picture, so describe only the change.
- tier: switch price level ("cheaper", "arzonroq", "подешевле" → economy; "best quality" → premium).
- size: the owner corrects a dimension ("the room is 4 by 3.5", "potolok 2.7").
- smeta: change what work is done (finishes per surface, or a note like "keep the old door"), then the smeta is rebuilt. Also add a matching render when a finish change would look different.
- ad: write a job post for a trade ("find me a tiler", "kafelchi kerak"). Only for a trade in trades_in_smeta. If they want a trade the smeta doesn't have, don't add the ad; say so and offer to add that work (a smeta action) first.
- go: open a screen (measure, smeta, jobs, hire).
If they only ask a question (price, how long, what's included), answer it from PROJECT with no actions. Never invent prices: the app shows them. Keep "reply" short and spoken, and say what you're doing ("Devorlarni och kulrangga bo'yab ko'rsatyapman"). Uzbek in Latin script, the way people in Tashkent talk (plain ' apostrophe, no long dashes).`;
  return sparkJSON({ name: 'usta', schema: schema(Object.keys(prices.trades)), input: prompt });
}
