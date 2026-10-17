/* Retro — 1970s geometric wallpaper prints.
 * One pattern card whose styles are registered by js/patterns/retro-*.js (loaded before this file):
 *
 *   PG.retroModes.push({
 *     key: 'blocks', label: 'Stair Blocks', order: 2,
 *     glsl: `vec3 rt_blocks(vec2 q) { ... }`,   // q = cell coordinates (size / stretch / slant already applied)
 *     params: [ ... ],                           // optional extra params, ids prefixed with the key (e.g. blocksDepth);
 *                                                // they are shown only for this style
 *     presets: [{ name, values: { colors: [...], size, stretch, ... } }],   // mode is filled in automatically
 *   });
 *
 * A style may also set \`common\` (GLSL emitted once, before every style — for helpers shared by a file's styles).
 * Name private helpers with a per-file prefix (rtA_, rtB_, rtC_…): all styles are compiled into one shader.
 * Shared GLSL helpers for styles: rt_px (pixel size in cell units), rt_c(i) (palette colour i, wraps),
 * rt_fill(d) (AA coverage of signed distance d in cell units), rt_seam(col, d) (draws the seam line of width
 * u_gap in u_gapColor where d = distance to the nearest shape edge in cell units). */
(function () {
  'use strict';
  const modes = (PG.retroModes || []).filter((m) => m && m.key && typeof m.glsl === 'string').sort((a, b) => (a.order || 99) - (b.order || 99));
  if (!modes.length) return;
  const isMode = (k) => (v) => v.mode === k;

  const RETRO_PALETTES = [
    ['#f6d79a', '#ee7a1c', '#1d4a1c'],
    ['#f4ead2', '#e8230f', '#151313'],
    ['#ff2d55', '#1b6e8f', '#5cae2b'],
    ['#e9f0c6', '#2f5d2a', '#a07c1c'],
    ['#f3e3a3', '#c3961b', '#2e1d14'],
    ['#f2e6c0', '#c8231c', '#4f9a25'],
    ['#f7d046', '#e8871e', '#7a3b12'],
    ['#f4d4c4', '#d9a520', '#7a0e14'],
    ['#f2d58a', '#7a1f12', '#1b1410'],
    ['#efe4cf', '#2f6f73', '#e0a23a', '#c4532d'],
  ];

  const extra = [];
  for (const m of modes) {
    for (const p of m.params || []) {
      const own = p.showIf;
      extra.push(Object.assign({}, p, { showIf: own ? (v) => v.mode === m.key && own(v) : isMode(m.key) }));
    }
  }

  const presets = [];
  for (const m of modes) for (const pr of m.presets || []) presets.push(Object.assign({}, pr, { values: Object.assign({ mode: m.key }, pr.values || {}) }));
  const thumb = presets.find((p) => p.values.mode === 'blocks') || presets[0];
  presets.forEach((p) => (p.thumb = p === thumb));

  const dispatch = modes.map((m) => `  if (u_mode == MODE_${m.key.toUpperCase()}) col = rt_${m.key}(q);`).join('\n');

  PG.registerPattern({
    id: 'retro',
    name: 'Retro',
    category: 'Retro',
    description: '1970s geometric wallpaper prints — tall triangles, stair blocks, hexagon stripes, harlequins, pills, scallops and more.',
    params: [
      { id: 'mode', label: 'Style', type: 'select', options: modes.map((m) => [m.key, m.label]), default: modes[0].key },
      { type: 'heading', label: 'Shape' },
      { id: 'size', label: 'Size', min: 0.03, max: 2, default: 0.22, step: 0.001, scale: 'log', random: [0.12, 0.4] },
      { id: 'stretch', label: 'Stretch', min: 0.3, max: 4, default: 1, step: 0.01, scale: 'log', random: [0.8, 1.6], help: 'Vertical elongation' },
      { id: 'slant', label: 'Slant', min: -45, max: 45, default: 0, step: 0.5, unit: '°', random: [-12, 12], help: 'Shear the grid sideways' },
      ...extra,
      { type: 'heading', label: 'Color' },
      { id: 'colors', label: 'Colors', type: 'palette', min: 2, max: 6, default: ['#f6d79a', '#ee7a1c', '#1d4a1c'], random: RETRO_PALETTES },
      { id: 'gap', label: 'Seam width', min: 0, max: 0.08, default: 0.012, step: 0.001, random: [0, 0.025], help: 'Thin lines between shapes' },
      { id: 'gapColor', label: 'Seam color', type: 'color', default: '#f3e3bf', random: 'light', showIf: (v) => v.gap > 0 },
      { id: 'print', label: 'Print texture', min: 0, max: 1, default: 0.35, step: 0.01, random: [0.1, 0.6], help: 'Paper grain and uneven ink, like an old wallpaper print' },
    ],
    presets,
    glsl:
      /* glsl */ `
float rt_px = 0.001;
vec3 rt_c(int i) { return u_colors[pg_wrapi(i, u_colors_count)]; }
float rt_fill(float d) { return u_tf_aa > 0.5 ? clamp(0.5 - d / max(rt_px, 1e-6), 0.0, 1.0) : step(d, 0.0); }
// seams thinner than a pixel get fainter instead of heavier (energy-conserving, like pg_line)
vec3 rt_seam(vec3 col, float d) {
  if (u_gap <= 0.0) return col;
  float w = 0.5 * u_gap;
  float ww = u_tf_aa > 0.5 ? max(w, 0.5 * rt_px) : w;
  return mix(col, u_gapColor, rt_fill(abs(d) - ww) * (w / ww));
}
` +
      [...new Set(modes.map((m) => m.common).filter(Boolean))].join('\n') +
      modes.map((m) => m.glsl).join('\n') +
      /* glsl */ `
vec4 pattern(vec2 p) {
  float sl = tan(radians(u_slant));
  vec2 q = p / u_size;
  q.y /= u_stretch;
  q.x -= q.y * sl;
  rt_px = pg_px / u_size * max(1.0, 1.0 / u_stretch) * (1.0 + abs(sl));
  vec3 col = rt_c(0);
${dispatch}
  float fade = clamp(1.0 - rt_px * 6.0, 0.0, 1.0);
  if (u_print > 0.0 && fade > 0.0) {
    // paper grain + uneven ink, sized to the print, fading out when smaller than a pixel
    vec2 g = p / u_size;
    float mott = pg_fbm(g * 1.7, 3);
    float grain = pg_vnoise(g * 60.0) - 0.5;
    col *= 1.0 + u_print * fade * (0.07 * mott + 0.10 * grain);
    col = mix(col, col * vec3(1.02, 0.99, 0.94), u_print * 0.35);
  }
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
  });
})();
