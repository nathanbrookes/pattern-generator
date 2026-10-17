/* Art Deco — 1920s ornament and lattices drawn as crisp parallel line art.
 * Motifs: overlapping seigaiha fans (optionally ribbed), sunburst arches, nested Gatsby arches, stepped ziggurat
 * chevrons, Gatsby diamonds, the Moroccan trellis, the ogee (onion) lattice and peacock-feather fans.
 * Every motif provides an inner distance from its outline, so the nested lines are true offset curves; overlapping
 * fans are composited front-to-back with anti-aliased coverage. Optional metallic sheen comes from a gradient. */
(function () {
  const is = (...modes) => (v) => modes.includes(v.mode);
  const metal = (v) => v.finish === 'metal';

  const GOLD = { stops: [[0, '#3b2606'], [0.28, '#8d6416'], [0.5, '#d9ad4b'], [0.66, '#fbe8a6'], [0.8, '#c9952f'], [1, '#6b4708']], mode: 'smooth' };
  const SILVER = { stops: [[0, '#2c3036'], [0.3, '#7d848d'], [0.52, '#c9ced4'], [0.66, '#ffffff'], [0.8, '#a7adb5'], [1, '#4a4f57']], mode: 'smooth' };
  const BRONZE = { stops: [[0, '#2e170a'], [0.3, '#7a4422'], [0.52, '#c27a45'], [0.66, '#f3c491'], [0.8, '#a5612f'], [1, '#4a250f']], mode: 'smooth' };

  PG.registerPattern({
    id: 'deco',
    name: 'Art Deco',
    category: 'Geometric',
    description: '1920s ornament: seigaiha fans, sunbursts, Gatsby arches and diamonds, ziggurats, Moroccan trellis, ogee and peacock fans.',
    params: [
      { type: 'heading', label: 'Motif' },
      {
        id: 'mode',
        label: 'Motif',
        type: 'select',
        options: [
          ['fans', 'Fans / seigaiha'],
          ['sunburst', 'Sunburst arches'],
          ['arches', 'Gatsby arches'],
          ['ziggurat', 'Ziggurat steps'],
          ['diamonds', 'Gatsby diamonds'],
          ['trellis', 'Moroccan trellis'],
          ['ogee', 'Ogee lattice'],
          ['peacock', 'Peacock fans'],
        ],
        default: 'fans',
      },
      { id: 'size', label: 'Size', min: 0.05, max: 1.5, default: 0.44, step: 0.001, scale: 'log', random: [0.25, 0.6] },
      { id: 'prop', label: 'Proportion', min: 0.5, max: 2, default: 1, step: 0.01, random: [0.8, 1.4], help: 'Row spacing / height of the motif (1 = classic)' },
      { id: 'stagger', label: 'Stagger', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.5, 0.5], showIf: is('fans', 'sunburst', 'arches', 'peacock'), help: 'Sideways shift of each row. 0.5 = half-drop, 0 = straight columns' },
      { id: 'steps', label: 'Steps', type: 'int', min: 1, max: 6, default: 3, random: [2, 4], showIf: is('ziggurat'), help: 'Steps on each side of a chevron' },

      { type: 'heading', label: 'Lines' },
      { id: 'lines', label: 'Line count', type: 'int', min: 1, max: 16, default: 5, random: [3, 8], help: 'Nested lines per motif (ziggurat: lines per stepped band)' },
      { id: 'weight', label: 'Line weight', min: 0.05, max: 0.9, default: 0.26, step: 0.01, random: [0.18, 0.45], help: 'Share of the line spacing' },
      { id: 'rays', label: 'Rays', type: 'int', min: 0, max: 48, default: 16, random: [10, 24], showIf: is('fans', 'sunburst', 'peacock'), help: 'Fans: ribs in the centre (0 = rings only). Sunburst / peacock: rays per motif' },
      { id: 'fill', label: 'Fill', type: 'select', options: [['none', 'Lines only'], ['alternate', 'Alternating motifs'], ['bands', 'Banded']], default: 'none' },
      { id: 'accents', label: 'Accents', type: 'bool', default: true, random: 0.75, help: 'Jewels, sun discs and cores in the accent colour' },

      { type: 'heading', label: 'Color' },
      { id: 'finish', label: 'Line finish', type: 'select', options: [['flat', 'Flat color'], ['metal', 'Metallic sheen']], default: 'metal' },
      { id: 'lineColor', label: 'Lines', type: 'color', default: '#e9c46a', random: 'light', showIf: (v) => !metal(v) },
      { id: 'metal', label: 'Metal', type: 'gradient', default: GOLD, random: false, showIf: metal, help: 'Dark → highlight → dark: sampled across each motif for a polished-metal look' },
      { id: 'bgColor', label: 'Background', type: 'color', default: '#0c0b0a', random: 'dark' },
      { id: 'fillColor', label: 'Fill color', type: 'color', default: '#1d2a26', random: 'mid', showIf: (v) => v.fill !== 'none' },
      { id: 'accentColor', label: 'Accent', type: 'color', default: '#c8963e', random: 'mid', showIf: (v) => v.accents },
      { id: 'variation', label: 'Variation', min: 0, max: 1, default: 0.35, step: 0.01, random: [0, 0.6], help: 'Random sheen and tone per motif (changes with Seed)' },

      { type: 'heading', label: 'Animation' },
      { id: 'flow', label: 'Line flow', min: -2, max: 2, default: 0.5, step: 0.01, random: [-0.8, 0.8], help: 'Nested lines drift through each motif while Animate is on. Repeats every 4 / flow seconds (8 s at 0.5), so videos loop seamlessly' },
      { id: 'shimmer', label: 'Shimmer', min: 0, max: 2, default: 0.5, step: 0.01, random: [0, 1], showIf: metal, help: 'A glint sweeping across the metal. Repeats every 4 / shimmer seconds' },
    ],
    presets: [
      { name: 'Gatsby Gold', thumb: true, values: {} },
      {
        name: 'Seigaiha Waves',
        values: { mode: 'fans', size: 0.34, prop: 1, rays: 0, lines: 6, weight: 0.32, fill: 'bands', accents: false, finish: 'flat', lineColor: '#f3efe4', bgColor: '#173a6a', fillColor: '#23508f', variation: 0 },
      },
      {
        name: 'Emerald Fans',
        values: { mode: 'peacock', size: 0.44, prop: 1, stagger: 0.5, rays: 22, lines: 3, weight: 0.3, fill: 'bands', accents: true, finish: 'metal', metal: GOLD, bgColor: '#08291f', fillColor: '#138065', accentColor: '#1d3f8f', variation: 0.3 },
      },
      {
        name: 'Gatsby Arches',
        values: { mode: 'arches', size: 0.3, prop: 1, stagger: 0.5, lines: 5, weight: 0.3, fill: 'none', accents: true, finish: 'metal', metal: GOLD, bgColor: '#0b0c10', accentColor: '#142530', variation: 0.25 },
      },
      {
        name: 'Moroccan Trellis',
        values: { mode: 'trellis', size: 0.42, prop: 1, lines: 3, weight: 0.32, fill: 'alternate', accents: false, finish: 'flat', lineColor: '#fbf8f1', bgColor: '#2f6f73', fillColor: '#3b8a8c', variation: 0 },
      },
      {
        name: 'Ogee Lattice',
        values: { mode: 'ogee', size: 0.4, prop: 1, lines: 4, weight: 0.3, fill: 'alternate', accents: true, finish: 'flat', lineColor: '#f2e6cf', bgColor: '#9c3d2a', fillColor: '#b8553a', accentColor: '#2c3e50', variation: 0.15 },
      },
      {
        name: 'Sunburst',
        values: { mode: 'sunburst', size: 0.44, prop: 1, stagger: 0.5, rays: 18, lines: 4, weight: 0.3, fill: 'none', accents: true, finish: 'metal', metal: BRONZE, bgColor: '#13213a', accentColor: '#d98e4a', variation: 0.3 },
      },
      {
        name: 'Ziggurat Steps',
        values: { mode: 'ziggurat', size: 0.62, prop: 1, steps: 2, lines: 3, weight: 0.36, fill: 'alternate', accents: true, finish: 'metal', metal: GOLD, bgColor: '#0d0d0d', fillColor: '#4a1912', accentColor: '#e8dcc0', variation: 0.2 },
      },
      {
        name: 'Silver Diamonds',
        values: { mode: 'diamonds', size: 0.3, prop: 1, lines: 5, weight: 0.28, fill: 'alternate', accents: true, finish: 'metal', metal: SILVER, bgColor: '#121418', fillColor: '#242a35', accentColor: '#6d8fb8', variation: 0.3 },
      },
    ],
    glsl: /* glsl */ `
float dc_phase = 0.0;                       // Line flow phase in lines (set in pattern())
vec2 dc_jx = vec2(0.0), dc_jy = vec2(0.0);  // change of p per output pixel along screen x / y (set in pattern())

float dc_hw(float pitch) { return 0.5 * u_weight * pitch; }

vec2 dc_unit(vec2 v) { float l = length(v); return l > 1e-9 ? v / l : vec2(0.70710678); }

// Pattern units per output pixel measured across lines with unit normal n. Under perspective, lines running towards
// the horizon are much further apart on screen than pg_px (the worst-case footprint) suggests, so they keep their
// detail instead of fading early. Clamped: derivatives mean little across symmetry folds, and nothing with floor pixels.
float dc_foot(vec2 n) {
  float iso = pg_px * pg_ss;
  if (u_tf_snap > 0.0) return iso;
  return clamp(length(vec2(dot(dc_jx, n), dot(dc_jy, n))), 0.25 * iso, 1.5 * iso);
}
// Unit normal of the level lines of s from its screen derivatives (for fields without an analytic gradient).
// Call in uniform control flow only.
vec2 dc_levelNormal(float s) {
  vec2 g = vec2(dFdx(s), dFdy(s));
  return dc_unit(vec2(dc_jy.y * g.x - dc_jx.y * g.y, dc_jx.x * g.y - dc_jy.x * g.x));
}
// Box-filter width, in lines, of one sample across lines of the given pitch and normal.
float dc_fw(float pitch, vec2 n) { return dc_foot(n) / (pg_ss * pitch); }

// 1 once neighbouring lines (normal n) are packed tighter than ~1.5 output pixels: blend to their mean ink instead of moiré.
float dc_dense(float pitch, vec2 n) {
  if (u_tf_aa < 0.5) return 0.0;
  return 1.0 - smoothstep(1.5, 3.0, pitch / dc_foot(n));
}

// Box-filtered square wave: 0 on even, 1 on odd unit intervals of x. fw = filter width in x units.
float dc_parity(float x, float fw) {
  if (u_tf_aa < 0.5) return mod(floor(x), 2.0);
  fw = max(fw, 1e-4);
  float i = 2.0 * (abs(fract((x - 0.5 * fw) * 0.5) - 0.5) - abs(fract((x + 0.5 * fw) * 0.5) - 0.5)) / fw;
  return clamp(0.5 - 0.5 * i, 0.0, 1.0);
}

// A static line at distance d.
float dc_line(float d, float pitch) { return pg_line(d, dc_hw(pitch)); }

// Infinite family of parallel lines at integer x (x = distance / pitch, nrm = their unit normal in pattern space).
float dc_lines(float x, float pitch, vec2 nrm) {
  float hw = dc_hw(pitch);
  float cov = pg_line(abs(x - floor(x + 0.5)) * pitch, hw);
  return mix(cov, min(2.0 * hw / pitch, 1.0), dc_dense(pitch, nrm));
}

// n nested lines inside a motif (x = inner distance from the outline / pitch): the outline (x = 0, drawn by the
// caller so neighbours can share it) and the core ring (x = n - 1) stay put; the lines between drift inward with
// Line flow, peeling off the outline and merging into the core ring, so the loop is seamless.
float dc_nest(float x, float pitch, float n, vec2 nrm) {
  float c = max(n - 1.0, 0.0);
  float hw = dc_hw(pitch);
  float cov = pg_line(abs(x - c) * pitch, hw);
  if (c >= 1.0) {
    float f = fract(dc_phase);
    float xk = clamp(floor(x - f + 0.5), 0.0, c - 1.0) + f;
    cov = max(cov, pg_line(abs(x - xk) * pitch, hw));
  }
  float inside = step(0.0, x) * step(x, c + 0.5);
  return mix(cov, min(2.0 * hw / pitch, 1.0) * inside, dc_dense(pitch, nrm));
}

// Parity of the band between nested lines for the 'Banded' fill (moves with the lines; the core is one colour).
float dc_band(float x, float pitch, float n, vec2 nrm) {
  float c = max(n - 1.0, 0.0);
  float fw = dc_fw(pitch, nrm);
  return mix(dc_parity(x - dc_phase, fw), mod(c, 2.0), clamp((x - c) / fw + 0.5, 0.0, 1.0));
}

// Line colour: flat, or a polished-metal gradient lit from the upper left with a per-motif twist and a sweeping glint.
vec3 dc_ink(vec2 p, vec2 local, float h) {
  if (u_finish == FINISH_FLAT) return u_lineColor;
  float t = 0.52 + 0.22 * dot(clamp(local, -1.2, 1.2), vec2(-0.6, 0.8)) + (h - 0.5) * u_variation * 0.35;
  vec3 c = pg_grad(u_metal, t);
  if (u_shimmer > 0.0) {                                   // glint: blend towards the highlight (stop ~0.66)
    float b = fract(dot(p, vec2(0.8, 0.6)) * 0.35 - u_time * u_shimmer * 0.25) - 0.5;
    c = mix(c, min(pg_grad(u_metal, 0.66) * 1.15, 1.0), 0.8 * exp(-b * b * 60.0));
  }
  return c;
}

// Colour between the lines. alt = alternating-motif parity, band = banded parity, h = motif hash.
vec3 dc_base(float alt, float band, float h) {
  vec3 fillc = u_fillColor * (1.0 + (h - 0.5) * u_variation * 0.35);
  if (u_fill == FILL_ALTERNATE) return mix(u_bgColor, fillc, alt);
  if (u_fill == FILL_BANDS) return mix(u_bgColor, fillc, band);
  return u_bgColor;
}

// Rays from the origin of q at angles k·seg from 'up' (atan(q.x, q.y)); returns (coverage, wedge parity).
vec2 dc_rays(vec2 q, float seg, float pitch) {
  float r = length(q);
  float a = atan(q.x, q.y);
  float ai = floor(a / seg + 0.5) * seg;
  float spacing = max(r * seg, 1e-6);
  float hw = dc_hw(pitch);
  vec2 nrm = dc_unit(vec2(-q.y, q.x));                      // across the rays
  float cov = pg_line(r * abs(sin(a - ai)), hw);
  cov = mix(cov, min(2.0 * hw / spacing, 1.0), dc_dense(spacing, nrm));
  return vec2(cov, dc_parity(a / seg + 0.5, dc_fw(spacing, nrm)));
}

// ---------------------------------------------------------------- fans (seigaiha) & peacock: one motif
vec3 dc_fan(vec2 p, vec2 q, float R, vec2 id) {
  float h = pg_hash12(id);
  float alt = mod(id.x + id.y, 2.0);
  float r = length(q);
  float n = u_lines;
  bool ribbed = u_rays > 0.5;
  float core = ribbed ? 0.36 * R : 0.0;
  float pitch = (R - core) / n;
  float x = (R - r) / pitch - 0.5 * u_weight;            // the rim line sits just inside the edge
  vec2 nrm = dc_unit(q);
  vec3 col = dc_base(alt, dc_band(x, pitch, n, nrm), h);
  float ink = max(dc_line(abs(x) * pitch, pitch), dc_nest(x, pitch, n, nrm));
  float jr = ribbed ? 0.3 * core : 0.55 * pitch;
  if (ribbed) {
    float inCore = pg_fill(r - core);
    vec2 ry = dc_rays(q, PG_TAU / u_rays, pitch);
    col = mix(col, dc_base(alt, ry.y, h), inCore);
    ink = max(max(ink * (1.0 - inCore), ry.x * inCore), dc_line(abs(r - core), pitch));
  }
  if (u_accents > 0.5) {
    float jw = pg_fill(r - jr);
    col = mix(col, u_accentColor, jw);
    ink = max(ink * (1.0 - jw), dc_line(abs(r - jr), pitch));
  }
  return mix(col, dc_ink(p, q / R, h), ink);
}

vec3 dc_peacockFan(vec2 p, vec2 q, float R, vec2 id) {
  float h = pg_hash12(id);
  float alt = mod(id.x + id.y, 2.0);
  float r = length(q);
  float rp = 0.07 * R;                                     // rim: two lines just inside the edge
  float xr = (R - r) / rp - 0.5 * u_weight;
  float ink = max(dc_line(abs(xr) * rp, rp), dc_line(abs(xr - 1.0) * rp, rp));
  vec3 col = dc_base(alt, 0.0, h);

  // eye: an egg of nested rings near the top
  vec2 e = q - vec2(0.0, 0.3 * R);
  vec2 rad = vec2(0.3, 0.4) * R;
  float ke = length(e / rad);
  float de = (ke - 1.0) * ke / max(length(e / (rad * rad)), 1e-6);
  float n = u_lines;
  float pe = 0.27 * R / n;
  float xe = -de / pe;
  vec2 ne = dc_unit(e / (rad * rad));                      // ellipse normal
  float inEye = pg_fill(de);
  float eyeBand = u_fill == FILL_NONE ? 0.0 : 1.0 - dc_band(xe, pe, n, ne);
  vec3 eyeCol = mix(u_bgColor, u_fillColor * (1.0 + (h - 0.5) * u_variation * 0.35), eyeBand);
  float coreW = u_accents > 0.5 ? pg_fill((n - 1.0 - xe) * pe) : 0.0;
  eyeCol = mix(eyeCol, u_accentColor, coreW);
  col = mix(col, eyeCol, inEye);
  float eyeInk = max(dc_line(abs(de), pe), dc_nest(xe, pe, n, ne));

  // barbs: rays fanning up from a pivot below the scale, stopped by the rim and the eye
  vec2 ry = dc_rays(q - vec2(0.0, -0.9 * R), PG_PI / max(u_rays, 2.0), 0.05 * R);
  float barbMask = pg_fill(1.5 - xr) * pg_fill(-de - 0.06 * R);
  ink = max(ink, max(ry.x * barbMask, eyeInk));
  return mix(col, dc_ink(p, q / R, h), ink);
}

// Overlapping rows of circular motifs, composited front (lower rows) to back with anti-aliased coverage.
vec3 dc_scales(vec2 p, bool peacock) {
  float W = u_size, R = 0.5 * W;
  float rowH = R * (peacock ? 0.85 : u_rays > 0.5 ? 0.7 : 0.5) * u_prop;   // ribbed fans show more of the centre
  float jLo = ceil((p.y - R) / rowH), jHi = floor((p.y + R) / rowH);
  vec3 acc = vec3(0.0);
  float al = 0.0;
  for (int i = 0; i < 16; i++) {
    float j = jLo + float(i);
    if (j > jHi) break;
    float off = j * u_stagger * W;
    float ci = floor((p.x - off) / W + 0.5);
    vec2 q = p - vec2(ci * W + off, j * rowH);
    float cov = pg_fill(length(q) - R);
    if (cov <= 0.0) continue;
    vec3 c = peacock ? dc_peacockFan(p, q, R, vec2(ci, j)) : dc_fan(p, q, R, vec2(ci, j));
    acc += (1.0 - al) * cov * c;
    al += (1.0 - al) * cov;
    if (al > 0.999) break;
  }
  return acc + (1.0 - al) * u_bgColor;
}

// ---------------------------------------------------------------- brick rows shared by sunburst + arches
// Returns local position in the row cell (x centred, y from the row's baseline) and the cell id.
vec2 dc_brick(vec2 p, float W, float H, out vec2 id) {
  float j = floor(p.y / H);
  float off = j * u_stagger * W;
  float ci = floor((p.x - off) / W + 0.5);
  id = vec2(ci, j);
  return p - vec2(ci * W + off, j * H);
}

// Spandrel between two neighbouring arches: fill + vertical pinstripes measured from the shared cell edge, already
// inked (with its own hash and sheen frame so both halves match across the cell edge).
vec3 dc_spandrel(vec2 p, vec2 q, vec2 id, float a, float H, float pitch) {
  float side = q.x > 0.0 ? 1.0 : -1.0;
  float e = q.x - side * a;
  float h = pg_hash12(vec2(id.x * 2.0 + side, id.y));
  vec3 c = u_fill == FILL_NONE ? u_bgColor : u_fillColor;
  return mix(c, dc_ink(p, vec2(e / a * 2.0, q.y / H * 2.0 - 1.0), h), dc_lines(e / pitch, pitch, vec2(1.0, 0.0)));
}

vec3 dc_sunburst(vec2 p) {
  float W = u_size, R = 0.5 * W;
  float H = R * max(u_prop, 1.0);
  vec2 id;
  vec2 q = dc_brick(p, W, H, id);
  float h = pg_hash12(id);
  float alt = mod(id.x + id.y, 2.0);
  float r = length(q);
  float n = u_lines;
  float pitch = R * min(0.08, 0.5 / n);
  float rIn = R - n * pitch;                                 // inner edge of the rim band
  float core = 0.3 * R;
  float x = (R - r) / pitch;
  vec2 nrm = dc_unit(q);

  // rim band, rays, sun
  float inRim = pg_fill(rIn - r);
  vec2 ry = dc_rays(q, PG_PI / max(u_rays, 2.0), pitch);
  vec3 arch = mix(dc_base(alt, ry.y, h), dc_base(alt, dc_band(x, pitch, n, nrm), h), inRim);
  float ink = max(dc_nest(x, pitch, n, nrm) * inRim, dc_line(abs(r - rIn), pitch));
  ink = max(ink, ry.x * (1.0 - inRim) * pg_fill(core - r));
  ink = max(ink, dc_line(abs(r - core), pitch));
  if (u_accents > 0.5) {
    float sun = pg_fill(r - core);
    arch = mix(arch, u_accentColor, sun);
    ink = max(ink * (1.0 - sun), dc_line(abs(r - 0.55 * core), pitch) * sun);
  }
  vec3 archInk = dc_ink(p, (q - vec2(0.0, 0.5 * R)) / R, h);
  vec3 col = mix(dc_spandrel(p, q, id, R, H, pitch * 1.4), mix(arch, archInk, ink), pg_fill(r - R));
  col = mix(col, archInk, dc_line(abs(r - R), pitch));                         // arch outline
  return mix(col, archInk, dc_line(min(q.y, H - q.y), pitch));                 // baseline
}

// ---------------------------------------------------------------- nested Gatsby arches
vec3 dc_arches(vec2 p) {
  float W = u_size, a = 0.5 * W;
  float H = max(W * 1.3 * u_prop, a * 1.15);
  vec2 id;
  vec2 q = dc_brick(p, W, H, id);
  float h = pg_hash12(id);
  float alt = mod(id.x + id.y, 2.0);
  float yc = H - a;
  vec2 qc = q - vec2(0.0, yc);
  float s = qc.y > 0.0 ? a - length(qc) : a - abs(q.x);     // inner distance to the arch outline
  float n = u_lines;
  float pitch = 0.84 * a / n;
  float x = s / pitch;
  vec2 nrm = qc.y > 0.0 ? dc_unit(qc) : vec2(1.0, 0.0);
  vec3 col = dc_base(alt, dc_band(x, pitch, n, nrm), h);
  if (u_accents > 0.5) col = mix(col, u_accentColor, pg_fill((n - 1.0) * pitch - s));   // doorway
  vec3 archInk = dc_ink(p, (q - vec2(0.0, 0.5 * H)) / a, h);
  col = mix(col, archInk, dc_nest(x, pitch, n, nrm));
  col = mix(col, dc_spandrel(p, q, id, a, H, pitch), pg_fill(s));
  col = mix(col, archInk, dc_line(abs(s), pitch));                             // arch outline (shared legs)
  return mix(col, archInk, dc_line(min(q.y, H - q.y), pitch));                 // cornice
}

// ---------------------------------------------------------------- ziggurat: stepped chevrons
// Nested staircases on a d×dv grid: horizontal treads and vertical risers alternate along the diagonal with period
// 2M. L is a level field (|grad| = 1 grid unit) whose integer contours are parallel staircases, mirrored at the
// chevron axis and valley (half-integer columns, so they always cross a tread). Lines come in bands of N = 'Line
// count' followed by a gap of N (M = 2N): the staircases that would pinch into narrow fingers at an apex or valley
// fall in the gap (the valley sits N columns off the step rhythm so both ends get the wide treads).
vec3 dc_ziggurat(vec2 p) {
  float N = u_lines, M = 2.0 * N;
  float d = 0.045 * u_size;                                   // line pitch; the chevron grows with steps × lines
  float W = 2.0 * d * (u_steps * M + N);
  float dv = d * u_prop;
  float xm = mod(p.x + 0.5 * W, W) - 0.5 * W;
  float u = abs(xm) / d + 0.5;
  float v = -p.y / dv;
  float w = u + v;
  float mm = floor(w / (2.0 * M));
  bool tread = w - mm * 2.0 * M < M;
  float L = tread ? v - mm * M : (mm + 1.0) * M - u;
  float unit = tread ? dv : d;
  float X = L - dc_phase * M;                                 // flow moves whole bands: same 4/flow s loop
  float k = floor(X + 0.5);
  float i = mod(k, M);                                         // line index within its band + gap
  float hw = dc_hw(min(d, dv));
  vec2 nrm = tread ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
  float fw = dc_fw(unit, nrm);
  float lc = pg_line(abs(X - k) * unit, hw) * step(i, N - 0.5);
  float band = 1.0 - dc_parity((X + 0.5) / N, fw / N);      // 1 across the N lines of a band, 0 in the gap
  lc = mix(lc, min(2.0 * hw / unit, 1.0) * band, dc_dense(unit, nrm));

  float h = pg_hash12(vec2(mod(floor(X / M), 2.0), 7.0));   // per band parity: bands run unbroken and flow loops
  // every other gap between bands; its edges sit on line centres (folds put X extremes on half-integers)
  float hg = 0.5 * (M - N + 1.0);
  float dg = abs(mod(X - 0.5 * (N - 1.0), M) - 0.5 * M);       // distance from the gap centre
  float alt = clamp((hg - dg) / fw + 0.5, 0.0, 1.0) * mod(floor((X - N + 1.0) / M), 2.0);
  vec3 col = dc_base(alt, dc_parity(X, fw), h);
  vec2 local = vec2(abs(xm) / (0.25 * W) - 1.0, sin(PG_PI * X / M));
  vec3 ink = dc_ink(p, local, h);
  if (u_accents > 0.5 && i < 0.5) ink = mix(ink, u_accentColor, 0.85);
  return mix(col, ink, lc);
}

// ---------------------------------------------------------------- Gatsby diamonds
vec3 dc_diamonds(vec2 p) {
  float W = u_size, H = W * 1.6 * u_prop;
  vec2 ab = vec2(p.x / W + p.y / H, p.x / W - p.y / H);    // rhombic lattice → unit squares
  vec2 id = floor(ab);
  vec2 f = ab - id;
  float g = 1.0 / length(vec2(1.0 / W, 1.0 / H));          // pattern units per lattice unit, across an edge
  vec2 e = min(f, 1.0 - f);
  float s = min(e.x, e.y) * g;
  float n = u_lines;
  float pitch = 0.4 * g / n;
  float x = s / pitch;
  vec2 nrm = normalize(e.x < e.y ? vec2(1.0 / W, 1.0 / H) : vec2(1.0 / W, -1.0 / H));   // nearest edge's normal
  float h = pg_hash12(id);
  vec3 col = dc_base(mod(id.x + id.y, 2.0), dc_band(x, pitch, n, nrm), h);
  float ink = max(dc_line(abs(s), pitch), dc_nest(x, pitch, n, nrm));
  if (u_accents > 0.5) {
    float core = pg_fill((n - 1.0) * pitch - s);
    col = mix(col, u_accentColor, core);
    vec2 dvx = ab - floor(ab + 0.5);                         // vertex jewels
    float dj = max(abs(dvx.x), abs(dvx.y)) * g - 0.75 * pitch;
    float jw = pg_fill(dj);
    col = mix(col, u_accentColor, jw);
    ink = max(ink * (1.0 - jw), dc_line(abs(dj), pitch));
  }
  vec2 c = vec2((id.x + id.y + 1.0) * 0.5 * W, (id.x - id.y) * 0.5 * H);
  return mix(col, dc_ink(p, (p - c) / vec2(0.5 * W, 0.5 * H), h), ink);
}

// ---------------------------------------------------------------- two-family lattices: Moroccan trellis + ogee
// Lines are the curves x = w(y) + kP and x = -w(y) + kP + P/2 = w(y + T/2) + kP + P/2 (w glide-symmetric).
// Trellis: w is a chain of quarter arcs (radius r = P/4) and straight necks, so the two families share the necks
// and enclose lantern cells. Ogee: w is a zigzag of S-curves with amplitude P/4, so the families touch at the
// corners like a diamond lattice with curved sides (onion cells, pointed top and bottom).

float dc_arcQ(vec2 v, float r, vec2 sg) {                  // distance to a quarter circle (quadrant sg) of radius r
  vec2 a = v * sg;
  if (a.x >= 0.0 && a.y >= 0.0) return abs(length(a) - r);
  return min(length(a - vec2(r, 0.0)), length(a - vec2(0.0, r)));
}
float dc_trellisW(float y, float r, float nk) {
  float T = 4.0 * r + 2.0 * nk;
  float yl = mod(y, T);
  float sg = 1.0;
  if (yl >= 0.5 * T) { yl -= 0.5 * T; sg = -1.0; }
  float dy = yl < r ? yl - r : (yl < r + nk ? 0.0 : yl - r - nk);
  return sg * sqrt(max(r * r - dy * dy, 0.0));
}
float dc_halfChain(vec2 q, float r, float nk) {           // pieces for y in [0, T/2]: arc, neck, arc
  float d = dc_arcQ(q - vec2(0.0, r), r, vec2(1.0, -1.0));
  d = min(d, pg_sdSegment(q, vec2(r, r), vec2(r, r + nk)));
  return min(d, dc_arcQ(q - vec2(0.0, r + nk), r, vec2(1.0, 1.0)));
}
float dc_chain(vec2 q, float r, float nk) {
  float T = 4.0 * r + 2.0 * nk, Th = 0.5 * T;
  float yl = mod(q.y, T);
  float d = dc_halfChain(vec2(q.x, yl), r, nk);
  d = min(d, dc_halfChain(vec2(-q.x, yl - Th), r, nk));
  d = min(d, dc_halfChain(vec2(-q.x, yl + Th), r, nk));
  return min(d, dc_halfChain(vec2(q.x, yl - T), r, nk));
}
// Ogee S-curve over one half period (t: 0 → 1) from the right corner (+1) to the left corner (-1). The sine term
// bends the straight diagonal into an S, so cells flare out of pointed tips into onions.
#define DC_OGEE 0.24
float dc_ogeeG(float t) { return 1.0 - 2.0 * t + DC_OGEE * sin(PG_TAU * t); }
float dc_ogeeW(float y, float A, float Y) {
  float yl = mod(y, 2.0 * Y);
  return A * dc_ogeeG((yl > Y ? 2.0 * Y - yl : yl) / Y);
}
// Distance to x = A·G(y): fold onto one S segment (mirror lines through the corners), coarse search, then Newton.
float dc_ogeeDist(vec2 q, float A, float Y) {
  float yl = mod(q.y, 2.0 * Y);
  yl = yl > Y ? 2.0 * Y - yl : yl;
  float bt = 0.0, bd = 1e9;
  for (int i = 0; i <= 4; i++) {
    float t = float(i) * 0.25;
    vec2 dv = vec2(A * dc_ogeeG(t) - q.x, t * Y - yl);
    float dd = dot(dv, dv);
    if (dd < bd) { bd = dd; bt = t; }
  }
  float t = bt;
  for (int i = 0; i < 4; i++) {
    float sn = sin(PG_TAU * t), cs = cos(PG_TAU * t);
    float fx = A * (1.0 - 2.0 * t + DC_OGEE * sn) - q.x;
    float dx = A * (DC_OGEE * PG_TAU * cs - 2.0);
    float ddx = -A * DC_OGEE * PG_TAU * PG_TAU * sn;
    float gp = dx * dx + fx * ddx + Y * Y;
    t = clamp(t - (fx * dx + (t * Y - yl) * Y) / max(gp, 0.25 * Y * Y), 0.0, 1.0);
  }
  vec2 dv = vec2(A * dc_ogeeG(t) - q.x, t * Y - yl);
  return sqrt(min(dot(dv, dv), bd));
}
float dc_curve(vec2 q, bool ogee, float P, float T, float r, float nk) {
  return ogee ? dc_ogeeDist(q, 0.25 * P, 0.5 * T) : dc_chain(q, r, nk);
}
float dc_wave(float y, bool ogee, float P, float T, float r, float nk) {
  return ogee ? dc_ogeeW(y, 0.25 * P, 0.5 * T) : dc_trellisW(y, r, nk);
}
float dc_family(vec2 p, bool ogee, float P, float T, float r, float nk) {
  float k = floor(p.x / P);
  return min(dc_curve(p - vec2(k * P, 0.0), ogee, P, T, r, nk), dc_curve(p - vec2((k + 1.0) * P, 0.0), ogee, P, T, r, nk));
}

vec3 dc_lattice(vec2 p, bool ogee) {
  float P = u_size;
  float r = 0.25 * P;
  float nk = 0.5 * r * u_prop;
  float T = ogee ? P * 1.55 * u_prop : 4.0 * r + 2.0 * nk;
  vec2 sh = vec2(-0.5 * P, 0.5 * T);                       // family 2 = family 1 moved by -sh
  float s = min(dc_family(p, ogee, P, T, r, nk), dc_family(p + sh, ogee, P, T, r, nk));

  // which cell: the one to the right of the nearest curve on the left (type 0 = family 1, 1 = family 2)
  float w1 = dc_wave(p.y, ogee, P, T, r, nk);
  float w2 = dc_wave(p.y + 0.5 * T, ogee, P, T, r, nk) + 0.5 * P;
  // (where both families coincide — trellis necks/walls, ogee corners — the cell with positive width wins)
  float type = mod(p.x - w1, P) + 4e-4 * w1 < mod(p.x - w2, P) ? 0.0 : 1.0;
  vec2 pa = type > 0.5 ? p + sh : p;                       // cell of type 0 in these coordinates
  float kx = floor((pa.x - dc_wave(pa.y, ogee, P, T, r, nk)) / P);
  float cy0 = ogee ? 0.5 * T : r + 0.5 * nk + 0.5 * T;
  float ky = floor((pa.y - cy0) / T + 0.5);
  vec2 c = vec2(kx * P + 0.25 * P, cy0 + ky * T);
  float h = pg_hash12(vec2(kx * 2.0 + type, ky));

  float n = u_lines;
  float pitch = (ogee ? 0.3 : 0.27) * P / n;
  float x = s / pitch;
  vec2 nrm = dc_levelNormal(s);
  vec3 col = dc_base(type, dc_band(x, pitch, n, nrm), h);
  float ink = max(dc_line(abs(s), pitch), dc_nest(x, pitch, n, nrm));
  if (u_accents > 0.5) col = mix(col, u_accentColor, pg_fill((n - 1.0) * pitch - s));
  return mix(col, dc_ink(p, (pa - c) / (0.5 * P), h), ink);
}

vec4 pattern(vec2 p) {
  dc_phase = u_time * u_flow * 0.5;
  dc_jx = dFdx(p);
  dc_jy = dFdy(p);
  vec3 col;
  if (u_mode == MODE_FANS) col = dc_scales(p, false);
  else if (u_mode == MODE_PEACOCK) col = dc_scales(p, true);
  else if (u_mode == MODE_SUNBURST) col = dc_sunburst(p);
  else if (u_mode == MODE_ARCHES) col = dc_arches(p);
  else if (u_mode == MODE_ZIGGURAT) col = dc_ziggurat(p);
  else if (u_mode == MODE_DIAMONDS) col = dc_diamonds(p);
  else col = dc_lattice(p, u_mode == MODE_OGEE);
  return vec4(col, 1.0);
}
`,
  });
})();
