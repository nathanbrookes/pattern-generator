/* Checkerboard — two-colour checks, from the "transparent PNG" grid to racing flags.
 * Reference implementation of the pattern contract (see docs/PATTERNS.md). */
(function () {
  PG.registerPattern({
    id: 'checker',
    name: 'Checkerboard',
    category: 'Geometric',
    description: 'Two-color checks: transparency grids, racing flags, harlequin diamonds.',
    params: [
      { id: 'size', label: 'Cell size', min: 0.01, max: 2, default: 0.16, step: 0.001, scale: 'log', random: [0.05, 0.5] },
      { id: 'ratio', label: 'Aspect', min: 0.25, max: 4, default: 1, step: 0.01, scale: 'log', random: [0.6, 1.8] },
      { id: 'shift', label: 'Row shift', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.5] },
      { id: 'diagonal', label: 'Diagonal', type: 'bool', default: false, random: 0.3 },
      { id: 'colorA', label: 'Color A', type: 'color', default: '#ffffff', random: 'light' },
      { id: 'colorB', label: 'Color B', type: 'color', default: '#cccccc', random: 'dark' },
      { id: 'border', label: 'Grid lines', min: 0, max: 0.3, default: 0, step: 0.001, random: false },
      { id: 'lineColor', label: 'Line color', type: 'color', default: '#000000', showIf: (v) => v.border > 0 },
    ],
    presets: [
      { name: 'Transparency', values: { size: 0.06, colorA: '#ffffff', colorB: '#cccccc' } },
      { name: 'Dark transparency', values: { size: 0.06, colorA: '#2b2b2b', colorB: '#3d3d3d' } },
      { name: 'Racing Flag', thumb: true, values: { size: 0.2, colorA: '#f4f4f4', colorB: '#111111' }, transform: { warp: 'waves', warpAmt: 0.35, warpFreq: 2.5 } },
      { name: 'Harlequin', values: { diagonal: true, ratio: 1.7, size: 0.2, colorA: '#c8102e', colorB: '#141414', border: 0.03, lineColor: '#d4af37' } },
      { name: 'Op-art Bulge', values: { size: 0.1, colorA: '#ffffff', colorB: '#000000' }, transform: { warp: 'bulge', warpAmt: 0.7, warpFreq: 4 } },
      { name: 'Graph paper', values: { size: 0.08, colorA: '#f7f9fc', colorB: '#f7f9fc', border: 0.04, lineColor: '#8fb3e8' } },
    ],
    glsl: /* glsl */ `
// Box-filtered checker (iq): w = filter width in cell units. Returns 0 or 1, soft at edges / far away.
float checkerAA(vec2 q, vec2 w) {
  vec2 i = 2.0 * (abs(fract((q - 0.5 * w) * 0.5) - 0.5) - abs(fract((q + 0.5 * w) * 0.5) - 0.5)) / w;
  return 0.5 - 0.5 * i.x * i.y;
}

vec4 pattern(vec2 p) {
  if (u_diagonal > 0.5) p = pg_rot(PG_PI * 0.25) * p;
  vec2 cell = vec2(u_size * u_ratio, u_size);
  vec2 q0 = p / cell;
  vec2 q = vec2(q0.x + u_shift * floor(q0.y), q0.y);

  float k = u_tf_aa > 0.5
    ? checkerAA(q, max(fwidth(q0), vec2(1e-4)))
    : mod(floor(q.x) + floor(q.y), 2.0);
  vec3 col = mix(u_colorA, u_colorB, k);

  if (u_border > 0.0) {
    vec2 f = abs(fract(q) - 0.5);
    float d = min((0.5 - f.x) * cell.x, (0.5 - f.y) * cell.y);
    col = mix(col, u_lineColor, pg_fill(d - 0.5 * u_border * u_size));
  }
  return vec4(col, 1.0);
}
`,
  });
})();
