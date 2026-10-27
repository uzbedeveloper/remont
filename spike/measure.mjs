// Test 3: can Muse Spark turn a room (photo or video) into real-world dimensions?
// Uses the Soviet-standard door (~2.0 x 0.8 m) as the ruler, plus an optional size the user states.
// usage: node measure.mjs <photo|video> ["user hint, e.g. the window wall is 3.2 m"]
import { writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { post, outputText, dataUrl, ffmpeg } from './lib.mjs';

const [file, hint = ''] = process.argv.slice(2);
if (!file) { console.error('usage: node measure.mjs <photo|video> ["hint"]'); process.exit(1); }
const isVideo = ['.mp4', '.mov', '.m4v'].includes(extname(file).toLowerCase());
const name = basename(file, extname(file));

let media = file;
if (isVideo) {
  media = join('out', `${name}_spark.mp4`);
  ffmpeg(['-i', file, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-crf', '28', '-c:a', 'aac', '-b:a', '64k', media]);
}
const part = isVideo
  ? { type: 'input_video', video_url: dataUrl(media) }
  : { type: 'input_image', image_url: dataUrl(media) };

const prompt = `You are a renovation estimator in Tashkent, Uzbekistan. Measure this room.
Reference scale: interior doors in Soviet-era apartments are standard, about 2.00 m tall and 0.80 m wide (leaf). Ceilings are usually 2.50-2.70 m. Use the door (and any other standard objects: radiator sections ~0.5-0.6 m tall, sockets, tiles) as rulers, and correct for perspective.
${hint ? `The owner says: "${hint}". Treat this as ground truth.` : ''}
Reply with ONLY a JSON object:
{"length_m":n,"width_m":n,"height_m":n,"floor_area_m2":n,"wall_area_net_m2":n,"ceiling_area_m2":n,
 "openings":[{"type":"door|window","width_m":n,"height_m":n}],
 "radiators":n,"confidence":"low|medium|high","method":"one short paragraph on how you measured"}
wall_area_net_m2 = perimeter*height minus openings.`;

const t0 = Date.now();
const r = await post('/responses', {
  model: 'muse-spark-1.3',
  input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, part] }],
});
const text = outputText(r);
writeFileSync(join('out', `${name}_measure.json`), text);
console.log(text);
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s, tokens in/out: ${r.usage?.input_tokens}/${r.usage?.output_tokens}`);
