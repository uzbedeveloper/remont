// One-off: generate a stand-in "old Tashkent apartment room" photo until the real one arrives.
import { writeFileSync } from 'node:fs';
import { post } from './lib.mjs';
const r = await post('/images/generations', {
  model: 'muse-image-1.0', n: 1, size: '1536x1024', output_format: 'jpeg',
  prompt: 'realistic smartphone photo of a tired old Soviet-era apartment living room in Tashkent, faded wallpaper, worn linoleum floor, white wooden door, one window with old radiator under it, ceiling light, no people, eye-level, slightly wide angle',
});
writeFileSync('out/standin_room.jpg', Buffer.from(r.data[0].b64_json, 'base64'));
console.log('saved out/standin_room.jpg', r.output_format ?? '', JSON.stringify(r.usage ?? {}));
