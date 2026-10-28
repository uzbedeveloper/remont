// One picture per style for the style cards: the sample room, renovated in each style by Muse Image.
// Made once and shipped in public/styles/, so picking a style shows what it looks like before you spend a render.
//   node scripts/style_previews.mjs [style ...]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { renovate } from '../lib/agents.mjs';
import { STYLES, lookFor, startChoices } from '../lib/look.mjs';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const sample = JSON.parse(readFileSync('samples/demo/project.json', 'utf8'));
const hero = `samples/demo/${sample.render.before}`;
const choices = sample.brief?.choices ?? startChoices(sample);
const todo = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(STYLES);
mkdirSync('public/styles', { recursive: true });

await Promise.all(todo.map(async k => {
  const t = Date.now();
  const raw = await renovate(hero, `public/styles/${k}_raw`, lookFor(choices, 'standard', '', { style: k }));
  // Small enough for a card: 480 px wide webp.
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-vf', 'scale=480:-2', '-quality', '78', `public/styles/${k}.webp`]);
  unlinkSync(raw);
  console.log(k, `${((Date.now() - t) / 1000).toFixed(1)} s`);
}));
