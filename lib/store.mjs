// Projects live on disk: .data/projects/<id>/project.json + media files.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';

export const DATA = resolve(process.env.DATA_DIR || '.data/projects');
export const SAMPLES = resolve('samples');

const ID = /^[a-z0-9-]{4,40}$/;

export function projectDir(id) {
  if (!ID.test(id)) throw Object.assign(new Error('bad project id'), { status: 400 });
  return join(DATA, id);
}

export function newId() {
  return randomBytes(5).toString('hex');
}

export function createProject(fields) {
  const id = newId();
  mkdirSync(projectDir(id), { recursive: true });
  const p = { id, created: new Date().toISOString(), ...fields };
  save(p);
  return p;
}

export function load(id) {
  const f = join(projectDir(id), 'project.json');
  if (!existsSync(f)) throw Object.assign(new Error('project not found'), { status: 404 });
  return JSON.parse(readFileSync(f, 'utf8'));
}

export function save(p) {
  p.updated = new Date().toISOString();
  writeFileSync(join(projectDir(p.id), 'project.json'), JSON.stringify(p, null, 2));
  return p;
}

export function update(id, fn) {
  const p = load(id);
  fn(p);
  return save(p);
}

// A sample is a finished project folder committed to the repo; opening it makes a private copy.
export function cloneSample(name) {
  if (!ID.test(name)) throw Object.assign(new Error('bad sample'), { status: 400 });
  const src = join(SAMPLES, name);
  if (!existsSync(join(src, 'project.json'))) throw Object.assign(new Error('sample not found'), { status: 404 });
  const id = newId();
  cpSync(src, projectDir(id), { recursive: true });
  return update(id, p => { p.id = id; p.sample = name; p.created = new Date().toISOString(); });
}
