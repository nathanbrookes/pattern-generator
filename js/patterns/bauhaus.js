/* Bauhaus Tiles + Memphis — two mid-century / 80s geometric patterns.
 *
 * bauhaus: a grid of square tiles, each with one motif (quarter circle, half circle, leaf, rainbow arcs, arch,
 *   circle, ring, dot, triangle, diagonal split, stripes, inset square) turned by a random quarter. Tile and motif
 *   colours come from a palette; neighbouring tiles are coloured so their backgrounds differ whenever the palette
 *   allows (checkerboard constraint: odd tiles avoid their even neighbours). Optional 2×2 big tiles, gutters,
 *   rounded tiles, motif padding and a subtle screen-print texture. Tiles turn one by one when animated.
 *
 * memphis: 1980s Memphis Group confetti — squiggles, zigzags, sticks, crosses, triangles, half circles, discs,
 *   rings, arcs, dots and dot grids, scattered on a jittered grid (3×3 neighbour search). Every shape is sized to
 *   half the distance to its nearest neighbour, so up to Shape size 1 shapes never overlap, and they are never
 *   clipped at cell borders. Bold outlines, offset shadows and a patterned background are optional. */
(function () {
  'use strict';

  /* ======================================================================= Bauhaus Tiles */
  const gut = (v) => v.gutter > 0;

  PG.registerPattern({
    id: 'bauhaus',
    name: 'Bauhaus Tiles',
    category: 'Geometric',
    description: 'Mid-century geometric tiles: quarter circles, arches, rings, triangles and stripes in a bold palette.',
    params: [
      { type: 'heading', label: 'Grid' },
      { id: 'size', label: 'Tile size', min: 0.03, max: 1.5, default: 0.22, step: 0.001, scale: 'log', random: [0.13, 0.36] },
      { id: 'big', label: 'Big tiles', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.45], help: 'Share of 2×2 blocks merged into one big tile' },
      { id: 'gutter', label: 'Gutter', min: 0, max: 0.3, default: 0, step: 0.005, random: [-0.07, 0.08], help: 'Gap between tiles, as a share of the tile size' }, // ~half of random picks clamp to 0 (no gutter)
      { id: 'round', label: 'Tile rounding', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.35], showIf: gut },

      { type: 'heading', label: 'Motifs' },
      { id: 'wCurves', label: 'Curves & arches', min: 0, max: 1, default: 1, step: 0.01, random: [0.35, 1], help: 'Quarter circles, half circles, leaves, rainbow arcs and arches' },
      { id: 'wCircles', label: 'Circles & rings', min: 0, max: 1, default: 0.5, step: 0.01, random: [0, 1] },
      { id: 'wAngles', label: 'Angular shapes', min: 0, max: 1, default: 0.5, step: 0.01, random: [0, 1], help: 'Triangles, diagonal splits, stripes and inset squares' },
      { id: 'wPlain', label: 'Plain tiles', min: 0, max: 1, default: 0.1, step: 0.01, random: [0, 0.3] },
      {
        id: 'orient',
        label: 'Rotation',
        type: 'select',
        options: [['random', 'Random quarter turns'], ['radial', 'Mirrored 2×2'], ['aligned', 'All aligned']],
        default: 'random',
        random: ['random', 'random', 'random', 'radial', 'aligned'],
        help: 'Mirrored 2×2 turns every motif towards the centre of its 2×2 block, so quarter circles meet as full circles',
      },
      { id: 'pad', label: 'Motif padding', min: 0, max: 0.3, default: 0, step: 0.005, random: [0, 0.1] },

      { type: 'heading', label: 'Color' },
      {
        id: 'palette',
        label: 'Palette',
        type: 'palette',
        min: 2,
        default: ['#1f6f6b', '#e1a731', '#d8602b', '#f2e8d5', '#4e3527'],
        help: 'Every tile takes a background and a different motif color from this list',
      },
      {
        id: 'bgMode',
        label: 'Tile backgrounds',
        type: 'select',
        options: [['mixed', 'Any palette color'], ['single', 'First color only']],
        default: 'mixed',
        random: ['mixed', 'mixed', 'single'],
      },
      { id: 'gutterColor', label: 'Gutter color', type: 'color', default: '#f6efe2', random: 'light', showIf: gut },
      { id: 'texture', label: 'Print texture', min: 0, max: 1, default: 0.3, step: 0.01, random: [0, 0.5], help: 'Subtle ink mottling and specks, like a screen print' },

      { type: 'heading', label: 'Animation' },
      { id: 'turn', label: 'Tile turns', min: 0, max: 2, default: 0.5, step: 0.01, random: false, help: 'How often motifs turn a quarter while Animate is on' },
    ],
    presets: [
      {
        name: 'Bauhaus Primary',
        values: { palette: ['#d62828', '#f2c200', '#1d4fd8', '#141414', '#f1ead8'], wCurves: 1, wCircles: 0.55, wAngles: 0.6, wPlain: 0.08, size: 0.24, texture: 0.25 },
        seed: 21,
      },
      { name: 'Mid-Century', thumb: true, values: {}, seed: 1337 },
      {
        name: 'Scandi Pastel',
        values: {
          palette: ['#e9b8ad', '#a9c4b5', '#f3c9a0', '#c4c6e0', '#f1e4d3', '#7f9e95'],
          size: 0.2, gutter: 0.09, round: 0.22, gutterColor: '#fbf7f1', wCurves: 1, wCircles: 0.7, wAngles: 0.3, wPlain: 0.05, texture: 0.12,
        },
        seed: 4,
      },
      {
        name: 'Terracotta',
        values: {
          palette: ['#c2552b', '#e7a77b', '#f0e0c8', '#7d3420', '#d79a3a', '#5d6b4f'],
          size: 0.21, wCurves: 1, wCircles: 0.35, wAngles: 0.3, wPlain: 0.06, orient: 'radial', texture: 0.4,
        },
        seed: 9,
      },
      {
        name: 'Mono Shapes',
        values: { palette: ['#151515', '#efe9dd'], size: 0.17, wCurves: 1, wCircles: 0.6, wAngles: 0.7, wPlain: 0.04, texture: 0.15 },
        seed: 6,
      },
      {
        name: 'Big & Small',
        values: {
          palette: ['#1b2a4a', '#e85d4a', '#f2d0a4', '#7fb5d5', '#f7f1e3', '#f2b134'],
          size: 0.15, big: 0.45, gutter: 0.06, gutterColor: '#f7f1e3', wCurves: 1, wCircles: 0.6, wAngles: 0.45, wPlain: 0.05, texture: 0.2,
        },
        seed: 12,
      },
    ],
    glsl: /* glsl */ `
int bh_n = 2;   // palette size

bool  bh_isBig(vec2 B) { return u_big > 0.0 && pg_hash12(B + vec2(-7717.0, 3301.0)) < u_big; }
float bh_hSmall(vec2 id) { return pg_hash12(id + vec2(0.0, 5003.0)); }
float bh_hBig(vec2 B) { return pg_hash12(B + vec2(9001.0, -1201.0)); }
int   bh_free(float h) { return min(int(h * float(bh_n)), bh_n - 1); }

// The (h * available)-th palette index not in the bit mask; a plain random index if every colour is taken.
int bh_pick(int excl, float h) {
  int avail = 0;
  for (int i = 0; i < 16; i++) { if (i >= bh_n) break; if ((excl & (1 << i)) == 0) avail++; }
  if (avail == 0) return bh_free(h);
  int k = min(int(h * float(avail)), avail - 1);
  for (int i = 0; i < 16; i++) {
    if (i >= bh_n) break;
    if ((excl & (1 << i)) == 0) { if (k == 0) return i; k--; }
  }
  return 0;
}

// ---- background colours. Small tiles on even squares pick freely; odd tiles avoid all four neighbours.
// Big tiles avoid their free (even, small) neighbours, and big tiles on odd blocks also avoid big even blocks.
int bh_bigMask(vec2 B) {
  int m = 0;
  vec2 o = 2.0 * B;
  for (int i = 0; i < 8; i++) {
    vec2 d = i < 2 ? vec2(-1.0, float(i)) : i < 4 ? vec2(2.0, float(i - 2)) : i < 6 ? vec2(float(i - 4), -1.0) : vec2(float(i - 6), 2.0);
    vec2 c = o + d;
    if (mod(c.x + c.y, 2.0) > 0.5 || bh_isBig(floor(c * 0.5))) continue;
    m |= 1 << bh_free(bh_hSmall(c));
  }
  return m;
}
vec2 bh_dir(int i) { return i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0); }
int bh_bigCol(vec2 B) {
  int m = bh_bigMask(B);
  if (mod(B.x + B.y, 2.0) > 0.5) {
    for (int i = 0; i < 4; i++) {
      vec2 nb = B + bh_dir(i);
      if (bh_isBig(nb)) m |= 1 << bh_pick(bh_bigMask(nb), bh_hBig(nb));
    }
  }
  return bh_pick(m, bh_hBig(B));
}
int bh_smallCol(vec2 id) {
  float h = bh_hSmall(id);
  if (mod(id.x + id.y, 2.0) < 0.5) return bh_free(h);
  int m = 0;
  for (int i = 0; i < 4; i++) {
    vec2 nid = id + bh_dir(i);
    vec2 nB = floor(nid * 0.5);
    m |= 1 << (bh_isBig(nB) ? bh_bigCol(nB) : bh_free(bh_hSmall(nid)));
  }
  return bh_pick(m, h);
}

vec3 bh_pal(int i) { return u_palette[pg_wrapi(i, bh_n)]; }

// Motif family by weight, then a motif within it. -1 = plain tile.
int bh_kind(float a, float b) {
  float W = u_wCurves + u_wCircles + u_wAngles + u_wPlain;
  if (W <= 0.0) return -1;
  float t = a * W;
  if (t < u_wCurves) return min(int(b * 5.0), 4);
  t -= u_wCurves;
  if (t < u_wCircles) return 5 + min(int(b * 3.0), 2);
  t -= u_wCircles;
  if (t < u_wAngles) return 8 + min(int(b * 4.0), 3);
  return -1;
}

float bh_cov(float d, float clip, float S) { return pg_fill(max(d, clip) * S); }

// One motif in tile units (u in -0.5..0.5, S = tile size in pattern units). mc = motif colour, tc = third colour.
vec3 bh_motif(int kind, vec2 u, float S, vec3 bg, vec3 mc, vec3 tc) {
  if (kind < 0) return bg;
  float clip = u_pad > 0.0 ? pg_sdBox(u, vec2(0.5)) : -1e3;
  vec3 col = bg;
  float d;
  if (kind == 0) {                                   // quarter circle
    d = length(u + 0.5) - 1.0;
  } else if (kind == 1) {                            // half circle on an edge
    d = length(u + vec2(0.0, 0.5)) - 0.5;
  } else if (kind == 2) {                            // leaf: two overlapping quarter circles
    d = max(length(u + 0.5), length(u - 0.5)) - 1.0;
  } else if (kind == 3) {                            // concentric quarter rings
    float r = length(u + 0.5);
    col = mix(col, mc, bh_cov(r - 1.0, clip, S));
    col = mix(col, tc, bh_cov(r - 0.7, clip, S));
    return mix(col, mc, bh_cov(r - 0.4, clip, S));
  } else if (kind == 4) {                            // arch with an inner arch
    vec2 v = u - vec2(0.0, 0.1);
    float a = v.y > 0.0 ? length(v) : abs(v.x);
    col = mix(col, mc, bh_cov(a - 0.4, clip, S));
    return mix(col, tc, bh_cov(a - 0.2, clip, S));
  } else if (kind == 5) {                            // circle
    d = length(u) - 0.42;
  } else if (kind == 6) {                            // ring
    d = abs(length(u) - 0.3) - 0.12;
  } else if (kind == 7) {                            // dot
    d = length(u) - 0.17;
  } else if (kind == 8) {                            // triangle standing on an edge
    d = max((2.0 * abs(u.x) + u.y - 0.5) * 0.4472136, -0.5 - u.y);
  } else if (kind == 9) {                            // diagonal split (half-square triangle)
    d = (u.x + u.y) * 0.70710678;
  } else if (kind == 10) {                           // three stripes
    d = (abs(fract((u.y + 0.5) * 3.0) - 0.5) - 0.25) / 3.0;
  } else {                                           // inset square
    d = pg_sdBox(u, vec2(0.25));
  }
  return mix(col, mc, bh_cov(d, clip, S));
}

// Colour of the tile under p (no edge anti-aliasing between tiles; pattern() adds that).
vec3 bh_tile(vec2 p) {
  vec2 id = floor(p / u_size);
  vec2 B = floor(id * 0.5);
  bool big = bh_isBig(B);
  vec2 key = big ? B + vec2(-20011.0, 13007.0) : id;
  float cs = big ? 2.0 * u_size : u_size;
  vec2 ctr = big ? (2.0 * B + 1.0) * u_size : (id + 0.5) * u_size;
  vec2 par = mod(big ? B : id, 2.0);

  int bg = u_bgMode == BGMODE_SINGLE ? 0 : big ? bh_bigCol(B) : bh_smallCol(id);
  vec3 h = pg_hash32(key + vec2(0.0, -3889.0));
  vec3 h2 = pg_hash32(key + vec2(6271.0, 0.0));
  int mi = bh_n < 2 ? bg : pg_wrapi(bg + 1 + min(int(h.y * float(bh_n - 1)), bh_n - 2), bh_n);
  int ti = bh_n < 3 ? bg : bh_pick((1 << bg) | (1 << mi), h.z);
  int kind = bh_kind(h.x, h2.x);

  float k = 0.0;
  if (u_orient == ORIENT_RANDOM) k = floor(h2.y * 4.0);
  else if (u_orient == ORIENT_RADIAL) k = par.y < 0.5 ? (par.x < 0.5 ? 2.0 : 3.0) : (par.x < 0.5 ? 1.0 : 0.0);
  if (u_turn > 0.0 && u_time > 0.0) {                 // an occasional eased quarter turn (0 turns at time 0)
    const float W = 0.2;
    float ph = u_time * u_turn * 0.25 * (0.6 + 0.8 * h2.z) + W + h.z * (1.0 - W);
    k += floor(ph) + smoothstep(0.0, W, fract(ph)) - 1.0;
  }

  float hs = 0.5 * (cs - u_gutter * u_size);         // half the visible tile
  vec2 lp = p - ctr;
  vec2 u = pg_rot(-k * 0.5 * PG_PI) * lp / (2.0 * hs);
  float ps = 1.0 - 2.0 * u_pad;
  vec3 col = bh_motif(kind, u / ps, 2.0 * hs * ps, bh_pal(bg), bh_pal(mi), bh_pal(ti));
  if (u_gutter > 0.0) col = mix(u_gutterColor, col, pg_fill(pg_sdRoundBox(lp, vec2(hs), u_round * hs)));
  return col;
}

// Screen-print feel: soft ink mottling plus small light specks where the ink skipped.
vec3 bh_print(vec3 col, vec2 p) {
  if (u_texture <= 0.0) return col;
  vec2 q = p / u_size;
  float fine = 1.0 - smoothstep(0.02, 0.06, pg_px / u_size);
  float mottle = 0.6 * pg_noise(q * 1.9) + 0.4 * pg_noise(q * 6.3 + 17.0);
  col *= 1.0 + u_texture * 0.09 * mottle;
  float speck = smoothstep(0.7, 0.86, pg_vnoise(q * 22.0)) * smoothstep(-0.1, 0.4, pg_noise(q * 3.1 - 9.0));
  return mix(col, mix(col, vec3(1.0), 0.22), speck * fine * u_texture);
}

vec4 pattern(vec2 p) {
  bh_n = clamp(u_palette_count, 1, 16);
  // tiles below a few pixels: settle on the palette's average instead of aliasing into noise
  float far = smoothstep(0.25, 0.7, pg_px / u_size);
  vec3 avg = vec3(0.0);
  for (int i = 0; i < 16; i++) { if (i >= bh_n) break; avg += u_palette[i]; }
  avg /= float(bh_n);
  if (u_gutter > 0.0) avg = mix(avg, u_gutterColor, min(u_gutter * 2.0, 1.0));
  if (far >= 1.0) return vec4(avg, 1.0);              // far field (horizon): skip the tile work entirely

  vec3 col = bh_tile(p);
  // Anti-alias the tile borders: near an edge, blend in the neighbouring tile by pixel coverage
  // (sampled just across the edge; the lines inside a big 2×2 tile are not edges).
  if (u_gutter <= 0.0 && u_tf_aa > 0.5) {
    vec2 id = floor(p / u_size);
    vec2 f = p / u_size - id - 0.5;
    vec2 e = (0.5 - abs(f)) * u_size;
    float d = min(e.x, e.y);
    float w = clamp(0.5 - d / pg_px, 0.0, 0.5);
    vec2 dir = e.x < e.y ? vec2(sign(f.x), 0.0) : vec2(0.0, sign(f.y));
    vec2 B = floor(id * 0.5);
    if (w > 0.0 && !(floor((id + dir) * 0.5) == B && bh_isBig(B)))
      col = mix(col, bh_tile(p + dir * (d + min(0.02 * u_size, pg_px))), w);
  }
  col = bh_print(col, p);
  return vec4(mix(col, avg, far), 1.0);
}
`,
  });

  /* ======================================================================= Memphis */
  const bgOn = (v) => v.bgPattern !== 'flat';

  PG.registerPattern({
    id: 'memphis',
    name: 'Memphis',
    category: 'Geometric',
    description: '1980s Memphis confetti: squiggles, zigzags, triangles, dots and arcs scattered in bold colors.',
    params: [
      { type: 'heading', label: 'Shapes' },
      { id: 'size', label: 'Spacing', min: 0.04, max: 1.5, default: 0.24, step: 0.001, scale: 'log', random: [0.16, 0.36], help: 'Average distance between shapes' },
      { id: 'shapeSize', label: 'Shape size', min: 0.3, max: 1.4, default: 1, step: 0.01, random: [0.7, 1.1], help: 'How much of the free space around each shape it fills. Above 1 shapes may overlap' },
      { id: 'density', label: 'Density', min: 0.1, max: 1, default: 0.9, step: 0.01, random: [0.55, 1], help: 'Share of the grid spots that hold a shape; sparser shapes grow bigger' },
      { id: 'variation', label: 'Size variation', min: 0, max: 1, default: 0.15, step: 0.01, random: [0, 0.6] },

      { type: 'heading', label: 'Shape mix' },
      { id: 'wLines', label: 'Line shapes', min: 0, max: 1, default: 1, step: 0.01, random: [0.4, 1], help: 'Squiggles, zigzags, sticks and crosses' },
      { id: 'wSolid', label: 'Solid shapes', min: 0, max: 1, default: 0.7, step: 0.01, random: [0.2, 1], help: 'Triangles, half circles, squares and discs' },
      { id: 'wOutline', label: 'Outline shapes', min: 0, max: 1, default: 0.5, step: 0.01, random: [0, 0.8], help: 'Triangle outlines, rings and arcs' },
      { id: 'wDots', label: 'Dots & dot grids', min: 0, max: 1, default: 0.55, step: 0.01, random: [0, 0.8] },

      { type: 'heading', label: 'Style' },
      { id: 'stroke', label: 'Line width', min: 0.02, max: 0.2, default: 0.075, step: 0.001, random: [0.05, 0.11], help: 'Width of squiggles, zigzags and outlines, as a share of the spacing' },
      { id: 'outline', label: 'Bold outlines', type: 'bool', default: false, random: 0.35 },
      { id: 'shadow', label: 'Offset shadow', min: 0, max: 1, default: 0, step: 0.01, random: [-0.5, 0.6] }, // ~half of random picks clamp to 0

      { type: 'heading', label: 'Color' },
      { id: 'palette', label: 'Shape colors', type: 'palette', default: ['#ff5fa2', '#ffcc00', '#00b3a6', '#3d5afe', '#ff6b35', '#151515'] },
      { id: 'ink', label: 'Outline & shadow', type: 'color', default: '#151515', random: 'dark', showIf: (v) => v.outline || v.shadow > 0 },
      { id: 'bgColor', label: 'Background', type: 'color', default: '#fbf4e8', random: 'light' },
      {
        id: 'bgPattern',
        label: 'Backdrop',
        type: 'select',
        options: [['flat', 'Flat'], ['dots', 'Dots'], ['grid', 'Grid'], ['stripes', 'Stripes'], ['speckle', 'Speckle']],
        default: 'flat',
        random: ['flat', 'flat', 'dots', 'grid', 'stripes', 'speckle'],
      },
      { id: 'bgInk', label: 'Backdrop color', type: 'color', default: '#e8dcc8', random: 'light', showIf: bgOn },
      { id: 'bgScale', label: 'Backdrop scale', min: 0.3, max: 3, default: 1, step: 0.01, scale: 'log', random: [0.6, 1.6], showIf: bgOn },

      { type: 'heading', label: 'Animation' },
      { id: 'spin', label: 'Spin', min: 0, max: 2, default: 0.5, step: 0.01, random: false, help: 'How fast shapes rotate while Animate is on' },
    ],
    presets: [
      { name: 'Memphis Classic', thumb: true, values: {}, seed: 1337 },
      {
        name: 'Pastel Confetti',
        values: {
          palette: ['#f7a8c4', '#ffcf9e', '#a8dcc8', '#9cc0f5', '#cdb4db', '#f6e58d'],
          bgColor: '#fff8f2', bgPattern: 'dots', bgInk: '#f5e3dc', bgScale: 1, stroke: 0.06, wLines: 0.9, wSolid: 0.8, wOutline: 0.5, wDots: 0.6, shapeSize: 0.95,
        },
        seed: 3,
      },
      {
        name: 'Neon 80s',
        values: {
          palette: ['#ff2bd6', '#00f0ff', '#f5ff3b', '#39ff88', '#ff7a1a', '#9d4dff'],
          bgColor: '#0b0a12', bgPattern: 'grid', bgInk: '#2a2150', bgScale: 1.2, stroke: 0.07, wLines: 1, wSolid: 0.5, wOutline: 0.8, wDots: 0.5,
        },
        seed: 11,
      },
      {
        name: 'Black & White',
        values: {
          palette: ['#111111'], bgColor: '#f7f5f0', bgPattern: 'speckle', bgInk: '#c9c6bf', stroke: 0.08, wLines: 1, wSolid: 0.6, wOutline: 0.7, wDots: 0.6, shapeSize: 0.95,
        },
        seed: 5,
      },
      {
        name: 'Saved by the Bell',
        values: {
          palette: ['#ff3f8e', '#ffe23a', '#8a3ffc', '#ffffff', '#ff8a1f', '#a3e635'],
          bgColor: '#2ec4c6', bgPattern: 'flat', size: 0.26, shapeSize: 1.05, density: 0.95, variation: 0.1, stroke: 0.085, outline: true, shadow: 0.55, ink: '#111111', wLines: 1, wSolid: 0.9, wOutline: 0.4, wDots: 0.3,
        },
        seed: 7,
      },
    ],
    glsl: /* glsl */ `
#define MP_J 0.6            // centre jitter, in cell units
#define MP_RMAX 0.7         // (2 - MP_J) / 2: a shape this big can never reach one outside the 3×3 search

int mp_n = 1;

// Shape site of cell c: centre (cell units) and whether the cell holds a shape.
vec3 mp_site(vec2 c) {
  vec3 h = pg_hash32(c);
  return vec3(c + 0.5 + (h.xy - 0.5) * MP_J, h.z < u_density ? 1.0 : 0.0);
}

// Half the distance to the nearest neighbouring shape: two shapes sized like this can never overlap.
float mp_room(vec2 c, vec2 pos) {
  float d = 2.0 * MP_RMAX;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    if (i == 0 && j == 0) continue;
    vec3 s = mp_site(c + vec2(float(i), float(j)));
    if (s.z > 0.5) d = min(d, length(s.xy - pos));
  }
  return 0.5 * d;
}

// Shape family by weight, then a shape within it. -1 = none.
int mp_kind(float a, float b) {
  float W = u_wLines + u_wSolid + u_wOutline + u_wDots;
  if (W <= 0.0) return -1;
  float t = a * W;
  if (t < u_wLines) return min(int(b * 4.0), 3);
  t -= u_wLines;
  if (t < u_wSolid) return 4 + min(int(b * 4.0), 3);
  t -= u_wSolid;
  if (t < u_wOutline) return 8 + min(int(b * 3.0), 2);
  return 11 + min(int(b * 2.0), 1);
}

// Equilateral triangle, circumradius R, centred on its centroid, pointing up (after iq).
float mp_tri(vec2 p, float R) {
  const float k = 1.7320508;
  float r = R * 0.8660254;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

// Signed distance of shape 'kind' in its unit disc (every shape stays inside radius 1).
// w = half line width for line / outline shapes. Shapes 0-3 and 8-10 are strokes.
float mp_sd(int kind, vec2 q, float w) {
  if (kind == 0) {                                   // squiggle: 1.5 sine waves with round caps
    float L = 0.93 - w, A = 0.2, k = 1.5 * PG_PI / L;
    float x = clamp(q.x, -L, L), y = A * sin(k * x);
    if (abs(q.x) > L) return length(q - vec2(x, y)) - w;
    float dy = A * k * cos(k * x);
    return abs(q.y - y) / sqrt(1.0 + dy * dy) - w;
  }
  if (kind == 1) {                                   // zigzag
    float L = 0.9 - w, A = 0.26, d = 1e3;
    for (int i = 0; i < 4; i++) {
      float x0 = -L + float(i) * 0.5 * L, s = (i % 2 == 0) ? 1.0 : -1.0;
      d = min(d, pg_sdSegment(q, vec2(x0, -A * s), vec2(x0 + 0.5 * L, A * s)));
    }
    return d - w;
  }
  if (kind == 2) {                                   // three sticks
    float H = 0.72 - w;
    float d = min(pg_sdSegment(q, vec2(0.0, -H), vec2(0.0, H)), pg_sdSegment(vec2(abs(q.x) - 0.42, q.y), vec2(0.0, -H), vec2(0.0, H)));
    return d - w;
  }
  if (kind == 3) {                                   // cross
    float a = 0.78 - w;
    return min(pg_sdSegment(q, vec2(-a, 0.0), vec2(a, 0.0)), pg_sdSegment(q, vec2(0.0, -a), vec2(0.0, a))) - w;
  }
  if (kind == 4) return mp_tri(q, 0.97);                                        // triangle
  if (kind == 5) { vec2 v = q + vec2(0.0, 0.25); return max(length(v) - 0.9, -v.y); }  // half circle
  if (kind == 6) return pg_sdRoundBox(q, vec2(0.62), 0.05);                    // square
  if (kind == 7) return length(q) - 0.78;                                       // disc
  if (kind == 8) return abs(mp_tri(q, 0.97 - 2.0 * w)) - w;                     // triangle outline
  if (kind == 9) return abs(length(q) - (0.92 - w)) - w;                        // ring
  if (kind == 10) {                                  // arc (half ring)
    vec2 v = q + vec2(0.0, 0.25);
    float R = 0.85 - w;
    return (v.y >= 0.0 ? abs(length(v) - R) : length(vec2(abs(v.x) - R, v.y))) - w;
  }
  if (kind == 11) return length(q) - 0.42;                                      // dot
  vec2 g = clamp(floor(q / 0.34) + 0.5, -1.5, 1.5);                             // 4×4 dot grid
  return length(q - g * 0.34) - clamp(1.1 * w, 0.07, 0.12);
}

// Paint the shape of cell c (centre pos, room r, both in cell units) over col. v = point - centre.
vec3 mp_paint(vec3 col, vec2 c, vec2 v, float r) {
  vec3 h = pg_hash32(c + vec2(0.0, 7919.0));
  vec3 h2 = pg_hash32(c + vec2(-6007.0, 0.0));
  int kind = mp_kind(h.x, h.y);
  if (kind < 0) return col;
  bool stroke = kind <= 3 || (kind >= 8 && kind <= 10);
  vec3 fill = u_palette[pg_wrapi(min(int(h2.x * float(mp_n)), mp_n - 1), mp_n)];

  // offset shadow (fixed light direction): body and shadow share the disc, each of radius r - |o|/2
  vec2 o = vec2(0.7071, -0.7071) * min(u_shadow * 0.12, 0.35 * r);
  float rb = r - 0.5 * length(o);
  float ang = h.z * PG_TAU + u_time * u_spin * (h2.y - 0.5) * 1.6;
  mat2 R = pg_rot(-ang);
  float ow = u_outline > 0.5 && kind != 12 ? 0.3 * u_stroke / rb : 0.0;     // outline width, local units
  float w = min(0.5 * u_stroke / rb, 0.15);                                  // half line width, local units
  if (stroke) {
    // small shapes: shrink line and outline together (thin enough to keep the gaps in sticks / zigzags open)
    float cap = kind == 2 ? 0.12 : kind == 1 ? 0.16 : 0.22;
    float sc = min(1.0, cap / (w + ow));
    w *= sc;
    ow *= sc;
  } else {
    ow = min(ow, 0.16);                                                      // keep some colour inside tiny solids
  }
  float ws = stroke ? w + ow : w;
  float S = rb * u_size;                                                     // local → pattern units

  if (u_shadow > 0.0) col = mix(col, u_ink, pg_fill(mp_sd(kind, R * (v - 0.5 * o) / rb, ws) * S));
  float d = mp_sd(kind, R * (v + 0.5 * o) / rb, ws);
  if (ow > 0.0) col = mix(col, u_ink, pg_fill(d * S));
  return mix(col, fill, pg_fill((d + ow) * S));
}

vec3 mp_background(vec2 p) {
  vec3 col = u_bgColor;
  if (u_bgPattern == BGPATTERN_FLAT) return col;
  float s = u_size * u_bgScale;
  float cov, pitch, mean;
  if (u_bgPattern == BGPATTERN_DOTS) {
    pitch = 0.2 * s;
    vec2 f = (fract(p / pitch) - 0.5) * pitch;
    cov = pg_fill(length(f) - 0.16 * pitch);
    mean = 0.08;
  } else if (u_bgPattern == BGPATTERN_GRID) {
    pitch = 0.32 * s;
    vec2 f = abs(fract(p / pitch) - 0.5) * pitch;
    vec2 e = 0.5 * pitch - f;                          // distance to the nearest grid line, per axis
    cov = pg_line(min(e.x, e.y), 0.025 * pitch);
    mean = 0.1;
  } else if (u_bgPattern == BGPATTERN_STRIPES) {
    pitch = 0.16 * s;
    float x = (p.x + p.y) * 0.70710678 / pitch;
    cov = pg_line(abs(x - floor(x + 0.5)) * pitch, 0.18 * pitch);
    mean = 0.36;
  } else {                                             // speckle: tiny random dashes, each inside its own cell
    pitch = 0.3 * s;
    vec2 id = floor(p / pitch);
    vec3 h = pg_hash32(id + vec2(311.0, -97.0));
    vec2 ctr = (id + 0.5 + (h.xy - 0.5) * 0.36) * pitch;
    vec2 dir = vec2(cos(h.z * PG_TAU), sin(h.z * PG_TAU)) * 0.14 * pitch;
    cov = pg_line(pg_sdSegment(p, ctr - dir, ctr + dir), 0.045 * pitch);
    mean = 0.05;
  }
  // finer than a couple of pixels: fade to the mean tone instead of moiré
  cov = mix(cov, mean, smoothstep(0.2, 0.6, pg_px / pitch));
  return mix(col, u_bgInk, cov);
}

vec4 pattern(vec2 p) {
  mp_n = clamp(u_palette_count, 1, 16);
  vec3 bg = mp_background(p);
  vec2 q = p / u_size;
  vec2 c0 = floor(q);
  float aa = pg_px / u_size;
  // shapes below a few pixels: fade to the average tone instead of sparkling noise
  float far = smoothstep(0.12, 0.4, aa);
  vec3 avg = vec3(0.0);
  for (int i = 0; i < 16; i++) { if (i >= mp_n) break; avg += u_palette[i]; }
  avg = mix(bg, avg / float(mp_n), 0.22 * u_density * u_shapeSize * u_shapeSize);
  if (far >= 1.0) return vec4(avg, 1.0);              // far field (horizon): skip the shape search

  vec3 col = bg;
  float reach = MP_RMAX * u_shapeSize + aa;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 c = c0 + vec2(float(i), float(j));
    vec3 s = mp_site(c);
    vec2 v = q - s.xy;
    if (s.z < 0.5 || dot(v, v) > reach * reach) continue;
    float r = mp_room(c, s.xy) * u_shapeSize * (1.0 - u_variation * pg_hash12(c + vec2(-401.0, 2203.0)));
    if (length(v) > r + aa) continue;
    col = mp_paint(col, c, v, r);
  }
  return vec4(mix(col, avg, far), 1.0);
}
`,
  });
})();
