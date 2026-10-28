// What the renovated room should look like: finishes per surface, a style and a main colour.
// Shared by the Smeta screen and the server (which paints a first picture right after measuring).

export const OPTIONS = {
  walls: ['paint', 'wallpaper', 'tiles', 'keep'],
  floor: ['laminate', 'tiles', 'linoleum', 'keep'],
  ceiling: ['stretch', 'paint', 'keep'],
  window: ['replace', 'keep'],
  door: ['replace', 'keep'],
  radiator: ['replace', 'keep'],
  electrics: ['rewire', 'points', 'keep'],
};

export function defaults(m) {
  const bath = m.room_type === 'bathroom';
  const tired = c => c === 'worn' || c === 'poor';
  return {
    walls: bath ? 'tiles' : tired(m.condition.walls) ? 'paint' : 'keep',
    floor: bath ? 'tiles' : tired(m.condition.floor) ? 'laminate' : 'keep',
    ceiling: m.condition.ceiling === 'poor' ? 'stretch' : tired(m.condition.ceiling) ? 'paint' : 'keep',
    window: tired(m.condition.window) ? 'replace' : 'keep',
    door: 'replace',
    radiator: m.radiators ? 'replace' : 'keep',
    electrics: 'points',
  };
}

// The starting choices for a project: sensible defaults, overridden by what the owner said while filming.
export function startChoices(p) {
  const spoken = p.voice ? Object.fromEntries(Object.entries(p.voice.choices).filter(([, v]) => v)) : {};
  return { ...defaults(p.measure), ...spoken };
}

// palette: four swatches for the card (walls, accent, wood, textile).
export const STYLES = {
  modern: { palette: ['#e9e6e1', '#3c3f44', '#b08a63', '#8a9aa6'], prompt: 'modern style: clean lines, simple handle-less furniture, a few dark metal accents, warm hidden lighting' },
  scandi: { palette: ['#f4f2ee', '#d9cbb5', '#c9a77c', '#9fb1a3'], prompt: 'Scandinavian style: bright and airy, pale oak wood, white and soft beige, linen textiles, green plants' },
  classic: { palette: ['#efe6d8', '#c8b08a', '#7a5a3a', '#7d8f7a'], prompt: 'classic style: warm cream walls with wall mouldings, wooden furniture, a soft rug, brass light fittings' },
  loft: { palette: ['#8b8580', '#2f2f2f', '#9a5b3c', '#c7b9a6'], prompt: 'loft style: one wall of exposed red brick, black metal details, concrete-grey tones, Edison bulbs' },
  minimal: { palette: ['#ffffff', '#e5e5e3', '#cfc8bd', '#1f1f1f'], prompt: 'minimalist style: almost empty, white and very light grey, built-in storage, no decor clutter' },
  sharq: { palette: ['#f1e6d2', '#1f5f8b', '#b5482f', '#c9a227'], prompt: 'modern Uzbek style: warm walls, a carved wooden panel or door detail, an ikat-pattern cushion or rug, blue and terracotta accents, kept modern and light' },
};

export const COLORS = {
  white: { hex: '#f7f6f2', prompt: 'warm white' },
  beige: { hex: '#e7dcc8', prompt: 'soft warm beige' },
  grey: { hex: '#d3d3d0', prompt: 'light grey' },
  sage: { hex: '#b9c4ad', prompt: 'muted sage green' },
  blue: { hex: '#b9cad8', prompt: 'soft dusty blue' },
  terra: { hex: '#d7a98c', prompt: 'warm terracotta' },
};

const FINISH = {
  walls: { paint: 'smooth painted walls', wallpaper: 'light, subtly textured wallpaper', tiles: 'large-format wall tiles' },
  floor: { laminate: 'natural oak laminate floor', tiles: 'light grey porcelain floor tiles', linoleum: 'neat light wood-look linoleum' },
  ceiling: { stretch: 'flat white matte stretch ceiling with small spot lights', paint: 'smooth white painted ceiling' },
  window: { replace: 'new white PVC window with a white sill' },
  door: { replace: 'new interior door' },
  radiator: { replace: 'slim modern white radiator' },
};

// One prompt line for Muse Image. The finishes match the smeta; style and colour only dress them.
export function lookFor(choices, tier, note, look = {}) {
  const parts = Object.entries(FINISH).map(([k, v]) => v[choices[k]]).filter(Boolean);
  const level = { economy: 'simple, affordable finishes', standard: 'good-quality finishes', premium: 'premium finishes, refined details' }[tier];
  const color = COLORS[look.color] && `main wall colour ${COLORS[look.color].prompt}`;
  const style = STYLES[look.style]?.prompt ?? (look.style ? '' : 'modern, warm style');
  return [style, level, ...parts, color, note].filter(Boolean).join(', ');
}
