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

const PROMPT_EAR = 'Transcribe this voice note word for word, in the language and script it was spoken (Uzbek in Latin script, Russian in Cyrillic, English). It is a homeowner talking about renovating a room in Tashkent. Output only the transcript, nothing else. If there is no speech, output an empty line.';

function ffmpeg(args) {
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
}

async function hear(wav, prompt = PROMPT_EAR) {
  const r = await post('/responses', {
    model: EAR,
    input: [{ role: 'user', content: [
      { type: 'input_text', text: prompt },
      { type: 'input_audio', input_audio: { data: readFileSync(wav).toString('base64'), format: 'wav' } },
    ] }],
  });
  const text = outputText(r).trim().replace(/^["«]|["»]$/g, '');
  return /^(\(.*\)|\[.*\]|no speech\.?|)$/i.test(text) ? '' : text;
}

// Browser audio (webm/opus on Android and Chrome, mp4/aac on iPhone) → 16 kHz mono wav → text.
export async function transcribe(dir, audio, ext) {
  const src = join(dir, `voice_raw.${ext}`);
  const wav = join(dir, 'voice_in.wav');
  writeFileSync(src, audio);
  try {
    ffmpeg(['-i', src, '-ac', '1', '-ar', '16000', '-t', '60', wav]);
    return await hear(wav);
  } finally {
    for (const f of [src, wav]) try { unlinkSync(f); } catch { /* gone */ }
  }
}

// What the owner said while filming. '' when the clip has no sound track or nobody talks.
export async function listenToVideo(dir, video, seconds = 40) {
  const wav = join(dir, 'video_voice.wav');
  try {
    ffmpeg(['-i', video, '-vn', '-ac', '1', '-ar', '16000', '-t', String(seconds), wav]);
  } catch {
    return ''; // no audio stream
  }
  try {
    return await hear(wav, PROMPT_EAR.replace('voice note', 'video sound track (the owner films the room and talks)'));
  } finally {
    try { unlinkSync(wav); } catch { /* gone */ }
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
        required: ['type', 'instruction', 'tier', 'length_m', 'width_m', 'height_m', 'choices', 'note', 'trade', 'step', 'status', 'price_uzs', 'usta_name'],
        properties: {
          type: { type: 'string', enum: ['render', 'tier', 'size', 'smeta', 'ad', 'go', 'deal'] },
          instruction: { type: 'string', description: 'render: the visual change, in English, concrete (colours, materials, fixtures). "" otherwise' },
          tier: { type: 'string', enum: ['', 'economy', 'standard', 'premium'] },
          length_m: { type: 'number', description: 'size: new value, 0 = unchanged' },
          width_m: { type: 'number' }, height_m: { type: 'number' },
          choices: { type: 'object', additionalProperties: false, required: Object.keys(CHOICES),
            properties: Object.fromEntries(Object.entries(CHOICES).map(([k, v]) => [k, { type: 'string', enum: ['', ...v] }])),
            description: 'smeta: finish per surface, "" = unchanged' },
          note: { type: 'string', description: 'smeta: extra wish for the estimator, "" if none' },
          trade: { type: 'string', enum: ['', ...trades] },
          step: { type: 'string', enum: ['', 'measure', 'smeta', 'jobs', 'hire', 'check'] },
          status: { type: 'string', enum: ['', 'need', 'talked', 'agreed', 'working', 'done'], description: 'deal: where that trade now stands' },
          price_uzs: { type: 'number', description: 'deal: agreed labor price in UZS ("1.5 mln" = 1500000), 0 if not said' },
          usta_name: { type: 'string', description: 'deal: the usta name if said, else ""' },
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
    plan_board: Object.fromEntries(Object.entries(project.board ?? {}).map(([k, v]) => [k, { status: v.status, usta: v.usta?.name ?? null, price: v.price ?? 0 }])),
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
- deal: progress on hiring or the work for one trade in trades_in_smeta ("Bobur bilan 1.5 mlnga kelishdim" = agreed, price 1500000, usta Bobur; "kafelchi ishni boshladi" = working; "elektrik tugatdi" = done; "santexnik bilan gaplashdim" = talked).
- go: open a screen (measure, smeta, jobs = the renovation plan with every trade's status, hire, or check = photograph and check an usta's quote: "ustaning smetasini tekshir", "проверь смету").
If they only ask a question (price, how long, what's included), answer it from PROJECT with no actions. Never invent prices: the app shows them. Keep "reply" short and spoken, and say what you're doing ("Devorlarni och kulrangga bo'yab ko'rsatyapman"). Uzbek in Latin script, the way people in Tashkent talk (plain ' apostrophe, no long dashes).`;
  return sparkJSON({ name: 'usta', schema: schema(Object.keys(prices.trades)), input: prompt });
}

// Turn what was said while filming into a starting brief: finishes, price level, a note.
export async function wishes(said) {
  const sch = {
    type: 'object', additionalProperties: false, required: ['choices', 'tier', 'note', 'length_m', 'width_m', 'height_m', 'heard'],
    properties: {
      choices: { type: 'object', additionalProperties: false, required: Object.keys(CHOICES),
        properties: Object.fromEntries(Object.entries(CHOICES).map(([k, v]) => [k, { type: 'string', enum: ['', ...v] }])),
        description: 'finish per surface the owner asked for; "" if they did not say' },
      tier: { type: 'string', enum: ['', 'economy', 'standard', 'premium'] },
      note: { type: 'string', description: 'other wishes for the estimator in English (colours, keep this, budget, deadline), "" if none' },
      length_m: { type: 'number', description: 'room length in metres if they said it, else 0' },
      width_m: { type: 'number', description: 'room width in metres if they said it, else 0' },
      height_m: { type: 'number', description: 'ceiling height in metres if they said it ("potolok 2.7", "высота 2,6"), else 0' },
      heard: { ...tri, description: 'one short line: what you understood, as a checklist ("white walls, laminate, cheaper")' },
    },
  };
  return sparkJSON({ name: 'wishes', schema: sch, input: `A homeowner in Tashkent filmed a room for a renovation estimate and talked while filming. What they said:
"${said}"
Pull out their wishes and any room sizes they state ("xona 4 ga 3.5" = length 4, width 3.5; "potolok 2.70" = height 2.7; sizes in cm → metres). Map finishes to the options; leave "" for anything they did not mention. "arzon / arzonroq / подешевле / budget" means economy, "eng yaxshi / premium / лучшее" means premium. Uzbek in Latin script, plain ' apostrophe, no long dashes.` });
}
