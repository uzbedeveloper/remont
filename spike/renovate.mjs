// Test 2: can Muse Image renovate *this* room (same geometry, new finishes)?
// usage: node renovate.mjs <photo> ["style brief"]
import { writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { post, dataUrl } from './lib.mjs';

const [file, brief = 'modern, warm and affordable: smooth light-grey painted walls, laminate oak floor, new white PVC window, white door, simple LED ceiling lights'] = process.argv.slice(2);
if (!file) { console.error('usage: node renovate.mjs <photo> ["style brief"]'); process.exit(1); }

const t0 = Date.now();
const r = await post('/images/edits', {
  model: 'muse-image-1.0',
  n: 1,
  images: [{ image_url: dataUrl(file) }],
  prompt: `Show this exact same room after a full renovation. Keep the camera angle, room shape, wall positions, door and window positions and sizes exactly the same; only change finishes and fixtures. Remove clutter and damage. Renovation style: ${brief}. Photorealistic, natural daylight.`,
});
const out = join('out', `${basename(file, extname(file))}_renovated.${r.output_format ?? 'webp'}`);
writeFileSync(out, Buffer.from(r.data[0].b64_json, 'base64'));
console.log(`saved ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
