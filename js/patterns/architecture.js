/* Architecture — facades, mosaics and modernist surfaces (painted / gouache look).
 * One pattern card whose styles are registered by js/patterns/arch-*.js (loaded before this file):
 *
 *   PG.archModes.push({
 *     key: 'studs', label: 'Studded Facade', order: 2,
 *     glsl: `vec3 ar_studs(vec2 q) { ... }`,    // q = cell coordinates (size / stretch / slant already applied)
 *     common: `...`,                            // optional GLSL emitted once before all styles (helpers shared by a file)
 *     params: [ ... ],                          // optional extra params, ids prefixed with the key (e.g. studsDepth);
 *                                               // shown only for this style
 *     presets: [{ name, values: { colors: [...], size, stretch, ... } }],   // mode is filled in automatically
 *   });
 *
 * Name private helpers with a per-file prefix (arA_, arB_, arC_…): all styles are compiled into one shader.
 * Shared GLSL helpers:
 *   ar_px              pixel size in cell units
 *   ar_c(i)            palette colour i (wraps)
 *   ar_fill(d)         AA coverage of a signed distance d in cell units (negative inside)
 *   ar_seam(col, d)    draws the mortar / seam line (width u_gap, colour u_gapColor) at distance d from an edge
 *   ar_glass(t)        window-glass gradient colour at t (0..1)
 *   ar_light           unit 2D light direction (from the "Light direction" param, turning with "Sun sweep"; y up)
 * Shared animation (all off by default): Sun sweep (light turns), Color flow (ar_c slides through the palette),
 * Glass shimmer (reflection band in ar_glass), Color rain (ar_rain + ar_rainTile — colours cascade tile to tile down
 * the facade, Pour or Jacob's ladder). Styles may add their own motion params using u_time.
 *   ar_face(col, n)    shades a flat facet whose outward 2D normal is n (|n| ≤ 1; 0 = facing the viewer) by the light,
 *                      scaled by the "Relief" param — use it for bevels, chamfers, pyramid studs, ramps */
(function () {
  'use strict';
  const modes = (PG.archModes || []).filter((m) => m && m.key && typeof m.glsl === 'string').sort((a, b) => (a.order || 99) - (b.order || 99));
  if (!modes.length) return;
  const isMode = (k) => (v) => v.mode === k;

  const ARCH_PALETTES = [
    ['#a9b9dc', '#eef0f6', '#f6d6a8', '#b29a8a', '#7a6670', '#3f5a43', '#7f9a86'],
    ['#8d8a90', '#b9b6bc', '#5f5c63', '#e8a6ae', '#2c5fa8'],
    ['#3a3f5c', '#5a6385', '#8a93b3', '#c3c9de'],
    ['#e6dff0', '#2e5fb0', '#8ea9d8', '#c7d8e8', '#e8c9d3'],
    ['#2f6a4f', '#3fb0b3', '#1e4f63', '#9fd0c4', '#b9a3b3'],
    ['#14223a', '#1c5876', '#2c8fb3', '#0b1220'],
    ['#d9cfc0', '#a68f73', '#5c4a3a', '#efe7da', '#2d2a26'],
    ['#ece6dc', '#c9472d', '#2f3e57', '#e3b04b'],
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
  const thumb = presets.find((p) => p.values.mode === 'frames') || presets[0];
  presets.forEach((p) => (p.thumb = p === thumb));

  const dispatch = modes.map((m) => `  if (u_mode == MODE_${m.key.toUpperCase()}) col = ar_${m.key}(q);`).join('\n');

  PG.registerPattern({
    id: 'architecture',
    name: 'Architecture',
    category: 'Architecture',
    description: 'Facades and building surfaces in a painted, modernist style — tile mosaics, studded walls, shingles, bevelled windows and more.',
    params: [
      { id: 'mode', label: 'Style', type: 'select', options: modes.map((m) => [m.key, m.label]), default: modes[0].key },
      { type: 'heading', label: 'Shape' },
      { id: 'size', label: 'Size', min: 0.03, max: 2, default: 0.2, step: 0.001, scale: 'log', random: [0.12, 0.36] },
      { id: 'stretch', label: 'Stretch', min: 0.3, max: 4, default: 1, step: 0.01, scale: 'log', random: [0.8, 1.5], help: 'Vertical elongation' },
      { id: 'slant', label: 'Slant', min: -45, max: 45, default: 0, step: 0.5, unit: '°', random: [-8, 8], help: 'Shear the grid sideways' },
      ...extra,
      { type: 'heading', label: 'Light' },
      { id: 'light', label: 'Light direction', min: -180, max: 180, default: 115, step: 1, unit: '°', random: [60, 150], help: 'Where light comes from (90° = from above)' },
      { id: 'relief', label: 'Relief', min: 0, max: 1, default: 0.6, step: 0.01, random: [0.35, 0.85], help: 'How strongly bevels, studs and ramps are shaded' },
      { type: 'heading', label: 'Color' },
      { id: 'colors', label: 'Colors', type: 'palette', min: 2, max: 10, default: ARCH_PALETTES[0], random: ARCH_PALETTES },
      { id: 'glass', label: 'Glass', type: 'gradient', default: { stops: [[0, '#c9e7e0'], [0.5, '#9fb3c9'], [1, '#e7c9d3']], mode: 'smooth' }, help: 'Gradient used for window panes' },
      { id: 'gap', label: 'Mortar width', min: 0, max: 0.08, default: 0.01, step: 0.001, random: [0, 0.02], help: 'Thin lines between tiles / panels' },
      { id: 'gapColor', label: 'Mortar color', type: 'color', default: '#2a2a2e', random: 'dark', showIf: (v) => v.gap > 0 },
      { id: 'paint', label: 'Paint texture', min: 0, max: 1, default: 0.4, step: 0.01, random: [0.15, 0.6], help: 'Brushy gouache texture and uneven pigment, like a painted study' },
      { type: 'heading', label: 'Animation' },
      { id: 'sunSpeed', label: 'Sun sweep', min: -1, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, the light travels round (1 = a full turn every 8 s) — bevels, studs and ramps re-shade like the sun crossing a building' },
      { id: 'flow', label: 'Color flow', min: -2, max: 2, default: 0, step: 0.01, random: false, help: 'With Animate on, colours slide smoothly through the palette (palette steps per second)' },
      { id: 'shimmer', label: 'Glass shimmer', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, a reflection glides down the window panes' },
      { id: 'rain', label: 'Color rain', min: -4, max: 4, default: 0, step: 0.01, random: false, help: "With Animate on, colours cascade through the tiles: each tile takes the colour of the one above it (rows per second; negative = upward)" },
      { id: 'rainStyle', label: 'Rain style', type: 'select', options: [['pour', 'Pour'], ['ladder', "Jacob's ladder"]], default: 'pour', random: false, showIf: (v) => v.rain !== 0, help: "Pour: colours flow down continuously. Jacob's ladder: waves of flipping tiles run down, with still moments between them" },
      { id: 'rainGap', label: 'Wave gap', min: 1, max: 16, default: 5, step: 0.5, random: false, showIf: (v) => v.rain !== 0 && v.rainStyle === 'ladder', help: 'Rows between one cascade wave and the next' },
      { id: 'rainScatter', label: 'Scatter', min: 0, max: 1, default: 0.6, step: 0.01, random: false, showIf: (v) => v.rain !== 0 && v.rainStyle === 'ladder', help: 'Each column starts its cascade at its own moment, so the flips trickle down like rain instead of moving in rows' },
      { id: 'rainStagger', label: 'Stagger', min: 0, max: 1, default: 0, step: 0.01, random: false, showIf: (v) => v.rain !== 0, help: 'Offsets each column so the rain falls on a diagonal' },
    ],
    presets,
    glsl:
      /* glsl */ `
float ar_px = 0.001;
vec2 ar_light = vec2(0.0, 1.0);
vec3 ar_c(int i) {
  if (u_flow == 0.0) return u_colors[pg_wrapi(i, u_colors_count)];
  // Color flow: every colour slides smoothly to the next one in the palette
  float f = u_time * u_flow;
  int k = int(floor(f));
  return mix(u_colors[pg_wrapi(i + k, u_colors_count)], u_colors[pg_wrapi(i + k + 1, u_colors_count)], smoothstep(0.0, 1.0, fract(f)));
}
float ar_fill(float d) { return u_tf_aa > 0.5 ? clamp(0.5 - d / max(ar_px, 1e-6), 0.0, 1.0) : step(d, 0.0); }
vec3 ar_seam(vec3 col, float d) {
  if (u_gap <= 0.0) return col;
  float w = 0.5 * u_gap;
  float ww = u_tf_aa > 0.5 ? max(w, 0.5 * ar_px) : w;
  return mix(col, u_gapColor, ar_fill(abs(d) - ww) * (w / ww));
}
// Color rain (Jacob's ladder): for a tile at integer coords (column, row — row counting DOWN the facade) returns
// vec2(steps, wipe): colours have moved 'steps' tiles downward so far (so this tile now shows the colour of the tile
// 'steps' rows above it) and 'wipe' (0..1) is how far the NEXT colour (from the tile above) has wiped in from the top.
// Both are 0 when Color rain is off. Negative Color rain runs upward (rows are flipped for you).
vec2 ar_rain(vec2 tile) {
  if (u_rain == 0.0) return vec2(0.0);
  if (u_rain < 0.0) tile.y = -tile.y;
  float t = u_time * abs(u_rain);
  if (u_rainStyle == RAINSTYLE_POUR) {
    // Pour: a steady glide — linear in time, so every colour slides down at a constant speed (no pulsing)
    float s = t - u_rainStagger * tile.x;
    return vec2(floor(s), fract(s));
  }
  // Jacob's ladder: a wave front races down the column (Wave gap rows apart, so colours still move |rain| rows/s on
  // average), then everything rests until the next wave. Each tile tumbles over in a fixed, quick flip once the front
  // reaches it, so a short band of tiles at different stages of their turn rolls down the facade.
  float gap = max(u_rainGap, 1.0);
  float V = abs(u_rain) * gap;                               // front speed, rows / s
  float D = min(0.42, 0.8 / abs(u_rain));                    // seconds one tile takes to turn over
  float col = floor(tile.x + 0.5);
  float ph = V * u_time - tile.y - (u_rainStagger * tile.x + u_rainScatter * pg_hash12(vec2(col, 913.0))) * gap;
  float k = floor(ph / gap);
  float since = (ph - k * gap) / V;                          // seconds since the front passed this tile
  return vec2(k, clamp(since / D, 0.0, 1.0));
}
// How a tile looks while its colour changes (wipe 0 → 1, from → to). v = position down the tile (0 top … 1 bottom),
// aa = anti-aliasing width in v units (about one sample).
//   Pour: a plain, even cross-fade — with ar_rain's linear timing the colours glide down smoothly, no edges.
//   Jacob's ladder: the tile tumbles over its horizontal axis — the face shrinks edge-on (darkening as it turns away),
//   a dark gap shows behind it, then the face opens again showing the new colour.
vec3 ar_rainLook(vec3 from, vec3 to, float wipe, float v, float aa) {
  if (wipe <= 0.0) return from;
  if (wipe >= 1.0) return to;
  if (u_rainStyle == RAINSTYLE_POUR) return mix(from, to, wipe);
  aa = u_tf_aa > 0.5 ? max(aa, 1e-4) : 1e-4;
  // the block tumbles over its horizontal axis (eased): the old face tips back towards the light (brightening), goes
  // edge-on over a dark gap, and the new face swings up out of shadow into place. Rims catch a highlight.
  float w = wipe * wipe * (3.0 - 2.0 * wipe);
  float ca = cos(PG_PI * w), sa = sin(PG_PI * w);
  float hh = 0.5 * max(abs(ca), 0.04);                       // half-height of the visible face
  float d = abs(v - 0.5);
  float cov = clamp((hh - d) / (2.0 * aa) + 0.5, 0.0, 1.0);
  bool oldFace = ca > 0.0;
  // one clean band per tile: the face squashes to its middle and swings open again, shading as it turns away
  vec3 face = (oldFace ? from : to) * (0.5 + 0.5 * abs(ca) + (oldFace ? 0.12 : -0.08) * sa);
  vec3 back = mix(from, to, 0.5) * 0.42;                     // the shadowed gap behind the block
  vec3 col = mix(back, face, cov);
  // tiny / far tiles: their average instead (no shimmer)
  return mix(col, mix(back, face, 2.0 * hh), smoothstep(0.08, 0.3, aa * pg_ss));
}
vec3 ar_rainTile(vec3 from, vec3 to, float wipe, float v) { return ar_rainLook(from, to, wipe, v, fwidth(v)); }
vec3 ar_glass(float t) {
  vec3 c = pg_grad(u_glass, t);
  if (u_shimmer > 0.0) {
    // Glass shimmer: a soft reflection band sweeping down the pane
    float d = t - (1.3 - fract(u_time * 0.35) * 1.6);
    c = mix(c, vec3(1.0), u_shimmer * 0.55 * exp(-d * d * 90.0));
  }
  return c;
}
vec3 ar_face(vec3 col, vec2 n) {
  float k = dot(n, ar_light);                       // −1 (facing away) … +1 (facing the light)
  return col * (1.0 + u_relief * 0.55 * k) + u_relief * 0.12 * max(k, 0.0);
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
  ar_px = pg_px / u_size * max(1.0, 1.0 / u_stretch) * (1.0 + abs(sl));
  float la = radians(u_light + u_time * u_sunSpeed * 45.0);   // Sun sweep
  ar_light = vec2(cos(la), sin(la));
  vec3 col = ar_c(0);
${dispatch}
  float fade = clamp(1.0 - ar_px * 6.0, 0.0, 1.0);
  if (u_paint > 0.0 && fade > 0.0) {
    // gouache: brush streaks along the cell's vertical, pooled pigment, fine paper tooth
    vec2 g = p / u_size;
    float streak = pg_fbm(vec2(g.x * 9.0, g.y * 1.3), 3);
    float pool = pg_fbm(g * 1.4 + 7.3, 3);
    float tooth = pg_vnoise(g * 70.0) - 0.5;
    col *= 1.0 + u_paint * fade * (0.06 * streak + 0.05 * pool + 0.06 * tooth);
  }
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
  });
})();
