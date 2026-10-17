/* Topographic — contour lines of an fbm height field: survey maps, night-vision terrain, blueprints,
 * hypsometric bands and psychedelic strata. Lines are anti-aliased in screen space (fwidth of the height),
 * so they keep a constant pixel width and fade out gracefully where they bunch up (e.g. near the horizon). */
(function () {
  const topoGradient = {
    stops: [[0, '#8fb98a'], [0.25, '#b9d29a'], [0.5, '#e6dfa9'], [0.72, '#d9b98c'], [0.88, '#c49a78'], [1, '#f3eee4']],
    mode: 'smooth',
  };
  const hasFill = (v) => v.fill !== 'none';

  PG.registerPattern({
    id: 'contour',
    name: 'Topographic',
    category: 'Organic',
    description: 'Contour lines of a fractal landscape, with index contours, hypsometric color bands and hillshading.',
    params: [
      { type: 'heading', label: 'Terrain' },
      { id: 'scale', label: 'Scale', min: 0.1, max: 6, default: 1.1, step: 0.01, scale: 'log', random: [0.8, 2] },
      { id: 'octaves', label: 'Detail', type: 'int', min: 1, max: 8, default: 4, random: [3, 6], help: 'Number of noise octaves' },
      { id: 'warp', label: 'Domain warp', min: 0, max: 2, default: 0.45, step: 0.01, random: [0, 1.3], help: 'Swirls the landscape into flowing, marbled shapes' },
      { id: 'ridged', label: 'Ridged', type: 'bool', default: false, random: 0.25, help: 'Sharp mountain ridges instead of rolling hills' },

      { type: 'heading', label: 'Contours' },
      { id: 'levels', label: 'Levels', type: 'int', min: 3, max: 120, default: 28, random: [16, 36], help: 'Number of contour intervals over the height range' },
      { id: 'lineWidth', label: 'Line width', min: 0, max: 6, default: 1.1, step: 0.05, unit: 'px', random: [0.7, 2] },
      { id: 'indexEvery', label: 'Index line every', type: 'int', min: 0, max: 10, default: 5, random: [3, 6], help: 'Every Nth contour is drawn thicker (0 = off)' },
      { id: 'indexWidth', label: 'Index width', min: 1, max: 5, default: 2.4, step: 0.05, unit: '×', random: [1.8, 3], showIf: (v) => v.indexEvery > 0 },
      { id: 'lineColor', label: 'Line color', type: 'color', default: '#8a5a33', random: false },
      { id: 'glow', label: 'Line glow', min: 0, max: 1, default: 0, step: 0.01, random: false },

      { type: 'heading', label: 'Fill' },
      { id: 'fill', label: 'Fill', type: 'select', options: [['none', 'None'], ['bands', 'Hypsometric bands'], ['smooth', 'Smooth gradient']], default: 'bands' },
      { id: 'gradient', label: 'Gradient', type: 'gradient', default: topoGradient, showIf: hasFill },
      { id: 'cycles', label: 'Color cycles', min: 1, max: 12, default: 1, step: 0.1, random: [1, 2], showIf: hasFill, help: 'Repeat the gradient over the height range' },
      { id: 'fillMix', label: 'Fill strength', min: 0, max: 1, default: 0.75, step: 0.01, random: [0.7, 1], showIf: hasFill },
      { id: 'bg', label: 'Paper color', type: 'color', default: '#f4ecd8', random: false, showIf: (v) => v.fill === 'none' || v.fillMix < 1 },

      { type: 'heading', label: 'Shading' },
      { id: 'shade', label: 'Hillshade', min: 0, max: 1, default: 0.4, step: 0.01, random: [0, 0.6] },
      { id: 'lightAngle', label: 'Light angle', min: -180, max: 180, default: 135, step: 1, unit: '°', random: [90, 180], showIf: (v) => v.shade > 0 },
    ],
    presets: [
      { name: 'Topo Map', thumb: true, values: {} },
      {
        name: 'Night Ops',
        values: { fill: 'none', bg: '#030805', lineColor: '#3dff6e', lineWidth: 1.2, levels: 30, indexEvery: 5, indexWidth: 2.2, glow: 0.6, shade: 0.5, warp: 0.4 },
      },
      {
        name: 'Blueprint',
        values: { fill: 'none', bg: '#123f86', lineColor: '#dbe8ff', lineWidth: 0.9, levels: 24, indexEvery: 4, indexWidth: 2.4, glow: 0, shade: 0.2, scale: 1.4, warp: 0.3, octaves: 4 },
      },
      {
        name: 'Psychedelic Contours',
        values: { fill: 'bands', gradient: 'Rainbow', cycles: 2, fillMix: 1, levels: 30, lineWidth: 1.4, lineColor: '#1a0f2e', indexEvery: 0, warp: 1.1, scale: 1.1, shade: 0.25, octaves: 4 },
      },
      {
        name: 'Sandstone Strata',
        values: {
          fill: 'smooth', cycles: 4, fillMix: 1, levels: 70, lineWidth: 0.6, lineColor: '#5a2410', indexEvery: 0, warp: 1.2, scale: 1.6, shade: 0.55, lightAngle: 120,
          gradient: { stops: [[0, '#7c2e14'], [0.2, '#b4532a'], [0.4, '#dc8c52'], [0.55, '#f1c48f'], [0.7, '#d27a45'], [0.85, '#a3441f'], [1, '#7c2e14']], mode: 'smooth' },
        },
      },
      {
        name: 'Minimal Lines',
        values: { fill: 'none', bg: '#fafaf7', lineColor: '#1d1d1f', lineWidth: 1, levels: 22, indexEvery: 0, shade: 0, warp: 0.5, octaves: 4 },
      },
      {
        name: 'Bathymetry',
        values: {
          fill: 'bands', fillMix: 1, levels: 18, lineWidth: 0.8, lineColor: '#e6f6ff', indexEvery: 3, indexWidth: 2, shade: 0.35, warp: 0.5,
          gradient: { stops: [[0, '#06213f'], [0.4, '#0b4f7c'], [0.75, '#2a9cc0'], [1, '#a9e4ef']], mode: 'smooth' },
        },
      },
      {
        name: 'Shaded Relief',
        values: {
          fill: 'bands', fillMix: 1, levels: 18, octaves: 5, scale: 1.3, warp: 0.3, lineWidth: 0.8, indexEvery: 0, shade: 0.75, lineColor: '#2b1d12',
          gradient: { stops: [[0, '#1d4a2c'], [0.3, '#4d7c3a'], [0.5, '#a8955e'], [0.68, '#7d5e43'], [0.84, '#c9c2b8'], [1, '#ffffff']], mode: 'smooth' },
        },
      },
    ],
    glsl: /* glsl */ `
// Fractal noise (same octave layout as pg_fbm), optionally ridged. Roughly [-1, 1].
// 'lod' is a fractional octave count: octaves finer than a few pixels fade out smoothly instead of sparkling.
float topoNoise(vec2 q, float lod) {
  const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  int oct = int(u_octaves);
  bool ridged = u_ridged > 0.5;
  float s = 0.0, a = 0.5, n = 0.0, rw = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float w = clamp(lod - float(i), 0.0, 1.0);
    float k = pg_noise(q);
    if (ridged) {                                    // ridged multifractal: detail gathers on the crests
      k = 1.0 - abs(k); k *= k * rw;
      rw = clamp(k * 1.6, 0.0, 1.0);
      k = mix(0.3, k, w);                            // faded octaves fall back to ~their mean
    } else {
      k *= w;
    }
    s += a * k; n += a;
    q = m * q + 17.13; a *= 0.5;
  }
  s /= n;
  return ridged ? (s - 0.5) / 0.9 : s;                 // ridged sum sits in ~0.1..0.9: centre it like fbm
}

// Normalised height, ~0..1 over the visible landscape. Drifts and morphs when animated.
float topoHeight(vec2 p) {
  float t = u_time * 0.05;
  vec2 q = p / u_scale + vec2(t, 0.6 * t);
  if (u_warp > 0.0) {
    vec2 w = vec2(pg_fbm(q * 0.6 + vec2(1.7, 9.2) + 0.5 * t, 3), pg_fbm(q * 0.6 + vec2(8.3, 2.8) - 0.4 * t, 3));
    q += u_warp * 1.4 * w;
  }
  float lod = log2(max(u_scale / (10.0 * pg_px), 1.0)) + 1.0;   // octave fades out as its lattice nears ~3-5 px
  return 0.5 + 0.9 * topoNoise(q, lod);
}

// Coverage (.x) and glow (.y) of the contour lines of v (one line per integer).
// Widths are in screen pixels; lines closer than ~2px fade out instead of filling the screen.
// typGap = typical gap between lines (px) for the terrain as a whole: once that gets tiny (far away),
// isolated features such as small peak rings fade too, instead of speckling the horizon.
vec2 topoLines(float v, float hwPx, float typGap) {
  float fw = max(fwidth(v), 1e-6);
  float d = abs(fract(v + 0.5) - 0.5) / fw;          // pixels to the nearest line
  float c = u_tf_aa > 0.5 ? clamp(hwPx + 0.5 - d, 0.0, 1.0) : step(d, hwPx);
  float fade = smoothstep(1.0, 3.0, min(1.0 / fw, typGap) - 2.0 * hwPx);   // gap between lines, px
  float g = exp(-max(d - hwPx, 0.0) / (5.0 * u_pxScale));
  return vec2(c, g) * fade;
}

// Fill colour for a normalised height. Capped just below the last cycle so peaks above the range keep
// the gradient's end colour instead of wrapping back to its start.
vec3 topoFill(float t) {
  return pg_gradWrap(u_gradient, min(clamp(t, 0.0, 1.0) * u_cycles, u_cycles - 1e-3));
}

vec4 pattern(vec2 p) {
  float h = topoHeight(p);
  float L = u_levels;
  float v = h * L;
  float fw = max(fwidth(v), 1e-6);

  // ---- fill
  vec3 col = u_bg;
  if (u_fill != FILL_NONE) {
    vec3 f;
    vec3 smoothCol = topoFill(h);
    if (u_fill == FILL_BANDS) {
      float k = floor(v + 0.5);                        // nearest contour → blend the two bands that meet there
      vec3 below = topoFill((k - 0.5) / L);
      vec3 above = topoFill((k + 0.5) / L);
      float s = u_tf_aa > 0.5 ? smoothstep(-0.5 * fw, 0.5 * fw, v - k) : step(k, v);
      f = mix(below, above, s);
      if (u_tf_aa > 0.5) f = mix(f, smoothCol, smoothstep(0.35, 0.8, fw));   // bands thinner than a pixel
    } else {
      f = smoothCol;
    }
    col = mix(u_bg, f, u_fillMix);
  }

  // ---- hillshade (finite differences, wider steps when a pixel covers more ground)
  if (u_shade > 0.0) {
    float e = max(0.004 * u_scale, pg_px);
    vec2 g = vec2(topoHeight(p + vec2(e, 0.0)) - h, topoHeight(p + vec2(0.0, e)) - h) * (u_scale / e);
    vec3 N = normalize(vec3(-0.3 * g, 1.0));
    float a = radians(u_lightAngle);
    vec3 Ld = normalize(vec3(cos(a), sin(a), 1.1));
    float s = dot(N, Ld) / Ld.z;                       // 1 on flat ground
    col *= mix(1.0, clamp(s, 0.25, 1.6), u_shade);
  }

  // ---- contour lines
  float hw = 0.5 * u_lineWidth * u_pxScale;
  float opx = max(length(dFdx(p)), length(dFdy(p)));   // one output pixel, pattern units
  float gap = u_scale / (L * 0.6 * (1.0 + 0.5 * u_warp) * max(opx, 1e-7));
  vec2 ln = u_lineWidth > 0.0 ? topoLines(v, hw, gap) : vec2(0.0);
  if (u_indexEvery > 0.5 && u_lineWidth > 0.0) {
    ln.x *= 0.8;                                       // minor lines a touch lighter than index lines
    vec2 ix = topoLines(v / u_indexEvery, hw * u_indexWidth, gap * u_indexEvery);
    ln = max(ln, ix);
  }
  col = mix(col, u_lineColor, ln.x);
  col += u_lineColor * u_glow * 0.45 * ln.y * (1.0 - ln.x);
  return vec4(col, 1.0);
}
`,
  });
})();
