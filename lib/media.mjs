// Video/photo prep with ffmpeg: small copies for the models, frames for the viewer.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
export const SAM_FPS = 3;      // SAM bills per frame; 3 fps is plenty for a slow walk-around
export const MAX_SECONDS = 40; // longer clips are trimmed

function ffmpeg(args) {
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
}

function size(file) {
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    // ffmpeg with no output exits 1 but prints the stream info we want.
    const m = String(e.stderr).match(/Video:.*?(\d{2,5})x(\d{2,5})/);
    if (m) return { w: +m[1], h: +m[2] };
  }
  return null;
}

// dir/original.* → dir/sam.mp4 (3 fps, 720p), dir/spark.mp4 (2 fps, 480p, no sound), dir/frames/0001.jpg…
// Spark measured as well from the light copy (28 Oct, 2 rooms: same doors and windows, sizes within
// 0.3 m) and it encodes in 0.8 s instead of 4.4 s. Speech is read from the original.
export function prepVideo(dir, original) {
  const sam = join(dir, 'sam.mp4');
  const spark = join(dir, 'spark.mp4');
  const frames = join(dir, 'frames');
  mkdirSync(frames, { recursive: true });
  // One decode, two outputs: decoding a phone video (often 1080p HEVC) is most of the work on a small server.
  ffmpeg(['-t', String(MAX_SECONDS), '-i', original, '-filter_complex', `[0:v]fps=6,split=2[a][b];[a]fps=${SAM_FPS},scale=-2:720[sam];[b]fps=2,scale=-2:480[spark]`,
    '-map', '[sam]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-crf', '28', sam,
    '-map', '[spark]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-crf', '30', spark]);
  ffmpeg(['-i', sam, '-q:v', '4', join(frames, '%04d.jpg')]);
  const count = readdirSync(frames).filter(f => f.endsWith('.jpg')).length;
  return { kind: 'video', fps: SAM_FPS, frames: count, ...size(sam) };
}

export function prepPhoto(dir, original) {
  const frames = join(dir, 'frames');
  mkdirSync(frames, { recursive: true });
  ffmpeg(['-i', original, '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', join(frames, '0001.jpg')]);
  return { kind: 'photo', fps: 0, frames: 1, ...size(join(frames, '0001.jpg')) };
}

// A sharper, larger still for Muse Image, taken from the original at frame index i.
export function heroFrame(dir, media, i, out) {
  if (media.kind === 'photo') {
    ffmpeg(['-i', join(dir, media.original), '-vf', "scale='min(1600,iw)':-2", '-q:v', '2', out]);
  } else {
    const t = (i + 0.5) / media.fps;
    ffmpeg(['-ss', t.toFixed(2), '-i', join(dir, media.original), '-frames:v', '1', '-vf', "scale='min(1600,iw)':-2", '-q:v', '2', out]);
  }
  return out;
}

// Any photo → a jpg no wider than max px (phone photos are 4000+ px and 5+ MB).
export function shrinkPhoto(src, out, max = 1800) {
  ffmpeg(['-i', src, '-vf', `scale='min(${max},iw)':-2`, '-q:v', '3', out]);
  return out;
}
