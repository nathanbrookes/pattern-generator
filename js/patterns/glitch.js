/* Glitch — digital glitch art generated inside the pattern.
 * A built-in source image (colour bars, gradient, stripes, checker, clouds, digital UI) is run through stacked,
 * seeded glitch stages: datamosh, slice tearing, per-band RGB split, pixel sorting, broken JPEG, VHS tracking,
 * interlace combing, bit crush, noise blocks and stutter, with bursts of activity over time.
 *
 * All glitch geometry lives in screen pixels: vp = pg_screen * u_res / u_pxScale ("preview pixels", identical in the
 * preview, in tiled exports and at any export size), so blocks stay crisp and digital at any zoom. A screen-pixel
 * offset is turned into a pattern-space offset with the local Jacobian of p (dFdx / dFdy), which follows zoom,
 * rotation, tilt and warps. */
(function () {
  'use strict';

  const NEON = ['#07060f', '#1b1446', '#00f0ff', '#ff2bd6', '#fff35c', '#f4f4ff'];
  const SUNSET = ['#12081f', '#3d1452', '#9b1d5c', '#e4472f', '#ff9a3c', '#ffe3a1'];
  const OCEAN = ['#020b1a', '#0b3a5c', '#1680a3', '#5cc6c9', '#d8f3e8'];
  const BOLD = ['#111111', '#ff2a2a', '#ffd400', '#00b3ff', '#f5f5f5', '#00c853'];
  const SKY = ['#0d1a26', '#2b5675', '#6f9fbe', '#c9dae2', '#f4efe2'];
  const CANDY = ['#1d2b64', '#6b4fbb', '#f8a5c2', '#ff6a3d', '#ffd23f', '#e8fbff'];
  const ACID = ['#050505', '#203a12', '#7cff00', '#00ffc8', '#ff00a8', '#ffffff'];
  const MONO = ['#050505', '#3a3a3a', '#8a8a8a', '#d6d6d6', '#ffffff'];
  const LIGHT = ['#eef1f5', '#c9d2de', '#2f6fde', '#e5483d', '#1d2230', '#f3b51b'];
  const BW = ['#0a0a0a', '#f2f2f2'];

  const fx = (id) => (v) => v[id] > 0;
  const off = (o) => Object.assign({ mosh: 0, tear: 0, rgb: 0, sort: 0, jpeg: 0, vhs: 0, interlace: 0, crush: 0, noise: 0, stutter: 0 }, o);

  PG.registerPattern({
    id: 'glitch',
    name: 'Glitch',
    category: 'Signal',
    autoplay: true,
    description: 'Digital glitch art: datamosh, slice tears, RGB split, pixel sorting, broken JPEG, VHS tracking, interlace and noise blocks, stacked over a built-in source image.',
    params: [
      { type: 'heading', label: 'Source' },
      {
        id: 'source',
        label: 'Source image',
        type: 'select',
        options: [
          ['bars', 'Color bars'],
          ['gradient', 'Gradient'],
          ['stripes', 'Stripes'],
          ['checker', 'Checker'],
          ['clouds', 'Clouds'],
          ['ui', 'Digital UI'],
        ],
        default: 'bars',
        random: ['bars', 'bars', 'gradient', 'stripes', 'checker', 'clouds', 'ui', 'ui'],
        help: 'The clean picture that gets glitched',
      },
      { id: 'colors', label: 'Colors', type: 'palette', min: 2, max: 8, default: NEON, random: [NEON, SUNSET, OCEAN, BOLD, SKY, CANDY, ACID, MONO, LIGHT, BW], showIf: (v) => v.source !== 'bars', help: 'First color = background / darkest' },
      { id: 'scale', label: 'Scale', min: 0.1, max: 5, default: 1, step: 0.01, scale: 'log', random: [0.5, 1.8], help: 'Size of the source image (the glitch itself stays in screen pixels)' },
      { id: 'motion', label: 'Source motion', min: 0, max: 3, default: 0.4, step: 0.01, random: [0, 1], help: 'How fast the source image moves while Animate is on' },

      { type: 'heading', label: 'Glitch' },
      { id: 'intensity', label: 'Intensity', min: 0, max: 2, default: 1, step: 0.01, random: [0.6, 1.4], help: 'Master amount for every effect below' },
      { id: 'rate', label: 'How often', min: 0, max: 1, default: 0.6, step: 0.01, random: [0.25, 1], help: '1 = glitching all the time; lower = bursts with calm in between' },
      { id: 'burst', label: 'Burst length', min: 0.05, max: 3, default: 0.4, step: 0.01, scale: 'log', unit: 's', random: [0.15, 1], showIf: (v) => v.rate < 1 },
      { id: 'calm', label: 'Between bursts', min: 0, max: 1, default: 0.25, step: 0.01, random: [0, 0.5], showIf: (v) => v.rate < 1, help: 'How much glitch is left between bursts' },
      { id: 'fps', label: 'Glitch rate', min: 1, max: 30, default: 12, step: 0.5, unit: '/s', random: [5, 20], help: 'How many times a second the glitch pattern changes' },
      { id: 'block', label: 'Macroblock', type: 'select', options: [['8', '8 px'], ['16', '16 px'], ['32', '32 px']], default: '16', random: ['8', '16', '16', '32'], help: 'Block size for datamosh and noise blocks (screen pixels)' },

      { type: 'heading', label: 'Effects' },
      { id: 'mosh', label: 'Datamosh', min: 0, max: 1, default: 0.5, step: 0.01, random: [-0.4, 1], help: 'P-frames without their I-frame: the old picture melts along the motion vectors in block steps, with repeated and stuck blocks' },
      { id: 'tear', label: 'Slice tear', min: 0, max: 1, default: 0.55, step: 0.01, random: [-0.4, 1], help: 'Horizontal slices of the picture jump sideways' },
      { id: 'rgb', label: 'RGB split', min: 0, max: 1, default: 0.5, step: 0.01, random: [-0.3, 1], help: 'Red and blue pulled apart, by a different amount in each band' },
      { id: 'sort', label: 'Pixel sort', min: 0, max: 1, default: 0, step: 0.01, random: [-1, 1], help: 'Bright runs of pixels are sorted into streaks along a direction' },
      { id: 'sortThresh', label: 'Sort threshold', min: 0, max: 1, default: 0.4, step: 0.01, random: [0.15, 0.65], showIf: fx('sort'), help: 'Only pixels brighter than this get sorted' },
      { id: 'sortAngle', label: 'Sort direction', min: -180, max: 180, default: -90, step: 1, unit: '°', random: [-180, 180], showIf: fx('sort') },
      { id: 'jpeg', label: 'Broken JPEG', min: 0, max: 1, default: 0.35, step: 0.01, random: [-0.4, 1], help: 'Blocking and banding, 16×16 color blocks, ringing; bursts break the bitstream: garbage blocks, then a shifted, tinted or grey rest' },
      { id: 'vhs', label: 'VHS', min: 0, max: 1, default: 0, step: 0.01, random: [-0.6, 1], help: 'Soft picture with edge halos, smeared color, tracking noise band, line wobble, head-switching noise' },
      { id: 'interlace', label: 'Interlace', min: 0, max: 1, default: 0, step: 0.01, random: [-0.7, 0.8], help: 'Combing: every other line pair is shifted, like a badly deinterlaced field' },
      { id: 'crush', label: 'Bit crush', min: 0, max: 1, default: 0, step: 0.01, random: [-0.6, 0.8], help: 'Fewer color levels with ordered dither, plus bands of bit-shifted color' },
      { id: 'noise', label: 'Noise blocks', min: 0, max: 1, default: 0.2, step: 0.01, random: [-0.4, 0.9], help: 'Static, decoder-green and smeared blocks, failed runs of macroblocks' },
      { id: 'stutter', label: 'Stutter', min: 0, max: 1, default: 0.25, step: 0.01, random: [-0.3, 1], help: 'Choppy time and freeze frames (whole or lower part of the frame)' },
    ],
    presets: [
      {
        name: 'Corrupted Bars',
        thumb: true,
        play: true,
        values: off({ source: 'bars', mosh: 0.5, tear: 0.55, rgb: 0.5, jpeg: 0.35, noise: 0.2, stutter: 0.25 }),
      },
      {
        name: 'Datamosh',
        play: true,
        values: off({ source: 'clouds', colors: OCEAN, scale: 0.8, motion: 0.8, rate: 0.9, calm: 0.4, fps: 10, block: '16', mosh: 1, rgb: 0.12, stutter: 0.35, noise: 0.08 }),
      },
      {
        name: 'VHS Tracking',
        play: true,
        values: off({ source: 'bars', rate: 1, fps: 25, vhs: 1, interlace: 0.3, tear: 0.12, rgb: 0.15 }),
        post: { scanlines: 0.3, scanSize: 3, vignette: 0.35, grain: 0.12 },
      },
      {
        name: 'Pixel Sort',
        play: true,
        values: off({ source: 'clouds', colors: SUNSET, scale: 1.2, motion: 0.3, rate: 1, fps: 6, sort: 0.85, sortThresh: 0.3, sortAngle: -90 }),
      },
      {
        name: 'Broken JPEG',
        play: true,
        values: off({ source: 'gradient', colors: CANDY, scale: 1, motion: 0.5, rate: 0.85, calm: 0.5, fps: 6, block: '8', jpeg: 1, crush: 0.15 }),
      },
      {
        name: 'RGB Tear',
        play: true,
        values: off({ source: 'checker', colors: BW, scale: 1.4, motion: 0.3, rate: 0.75, calm: 0.3, fps: 14, tear: 0.9, rgb: 1, noise: 0.08 }),
      },
      {
        name: 'Signal Loss',
        play: true,
        values: off({ source: 'ui', colors: LIGHT, scale: 1.2, motion: 0.4, rate: 0.6, burst: 0.6, calm: 0.25, fps: 8, block: '16', noise: 0.75, mosh: 0.7, jpeg: 0.2, stutter: 0.9 }),
      },
      {
        name: 'Cyber Glitch',
        play: true,
        values: off({ source: 'ui', colors: NEON, scale: 1, motion: 0.6, rate: 0.8, calm: 0.35, fps: 15, block: '8', rgb: 0.8, tear: 0.6, noise: 0.3, crush: 0.3, mosh: 0.25, interlace: 0.2 }),
        post: { scanlines: 0.15, scanSize: 3 },
      },
    ],
    glsl: /* glsl */ `
// ---- per-sample state, set at the top of pattern() (pattern() runs once per sample)
vec2 gt_p = vec2(0.0);    // pattern point of this sample
vec2 gt_vp = vec2(0.0);   // its screen position in preview pixels (y up)
vec2 gt_jx = vec2(0.0);   // pattern units per preview pixel along screen x
vec2 gt_jy = vec2(0.0);   // ... along screen y
float gt_gfi = 0.0;       // glitch frame index (after stutter)
float gt_aM = 0.0;        // datamosh amount right now
float gt_B = 16.0;        // macroblock size (preview px)
vec2 gt_vres = vec2(1.0); // frame size in preview px
float gt_dt = 0.0;        // source time per glitch frame
float gt_cov = -1.0;      // datamosh coverage threshold
vec2 gt_pan = vec2(0.0);  // datamosh: global (camera) motion of this GOP, px per frame

// ---- per-output-pixel caches. pattern() runs once per supersample, in a loop, inside one fragment invocation, so
// globals survive between the samples of a pixel: work that only depends on the pixel (or on its 8×8 block) is
// done once instead of ss² times.
vec2 gt_pk = vec2(-1e9);  // pixel the caches below belong to
vec4 gt_sortC = vec4(0.0);
vec4 gt_mD = vec4(0.0);   // datamosh displacement (.xy) and source-time offset (.z) of this pixel
vec3 gt_mTint = vec3(0.0);
vec4 gt_vhsA = vec4(0.0), gt_vhsB = vec4(0.0);
vec2 gt_jk = vec2(-1e9);  // 8×8 block the JPEG cache belongs to
vec3 gt_jY = vec3(0.0), gt_jC = vec3(0.0);
float gt_jAct = 0.0;
vec4 gt_jB = vec4(0.0);   // per block: DC-only flag, ringing frequencies
vec3 gt_jW = vec3(0.0);   // per block: wrong-DC offset
vec4 gt_jS = vec4(0.0);   // bitstream: block shift (.xy, px), truncated → grey (.z)
vec3 gt_jD = vec3(0.0);   // bitstream: accumulated DC error
vec3 gt_jJ = vec3(-1.0);  // bitstream: garbage block hash (x < 0: none)

// seeded hash of an integer id + frame + salt (salt < 64)
vec3 gt_h3(vec2 id, float frame, float salt) {
  return pg_hash32(vec2(id.x * 1031.0 + id.y, frame * 64.0 + salt));
}

vec3 gt_yuv(vec3 c) {
  return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(-0.14713, -0.28886, 0.436)), dot(c, vec3(0.615, -0.51499, -0.10001)));
}
vec3 gt_rgb(vec3 y) {
  return vec3(y.x + 1.13983 * y.z, y.x - 0.39465 * y.y - 0.5806 * y.z, y.x + 2.03211 * y.y);
}

vec3 gt_pal(int i) { return u_colors[pg_wrapi(i, u_colors_count)]; }
// smooth ramp first → last color, t in 0..1
vec3 gt_ramp(float t) {
  float n = float(max(u_colors_count - 1, 1));
  float x = clamp(t, 0.0, 1.0) * n;
  float i = min(floor(x), n - 1.0);
  float f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(gt_pal(int(i)), gt_pal(int(i) + 1), f);
}
// smooth cyclic ramp through every color
vec3 gt_cycle(float t) {
  float n = float(max(u_colors_count, 1));
  float x = fract(t) * n;
  float i = floor(x);
  float f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(gt_pal(int(i)), gt_pal(int(i) + 1), f);
}

// ================================================================== sources
// SMPTE colour bars (EG 1, 75%): q.x 0..1 left → right, q.y 0..1 top → bottom.
// Top bars in order grey, yellow, cyan, green, magenta, red, blue: R on for bars 0,1,4,5, G for 0–3, B for even bars.
vec3 gt_top(int i) { return 0.75 * vec3(float((i & 3) < 2), float(i < 4), float((i & 1) == 0)); }

vec3 gt_barsAt(vec2 q) {
  float x7 = q.x * 7.0;
  int i = clamp(int(floor(x7)), 0, 6);
  if (q.y < 0.67) return gt_top(i);
  if (q.y < 0.75) return (i & 1) == 1 ? vec3(0.075) : gt_top(6 - i);   // castellations: blue, magenta, cyan, grey
  if (x7 < 1.25) return vec3(0.0, 33.0, 76.0) / 255.0;    // -I
  if (x7 < 2.5) return vec3(1.0);                // 100% white
  if (x7 < 3.75) return vec3(50.0, 0.0, 106.0) / 255.0;   // +Q
  if (x7 < 5.0) return vec3(0.075);
  if (x7 < 5.33333) return vec3(0.035);          // PLUGE: 3.5, 7.5, 11.5 IRE (blacker than black, black, lighter)
  if (x7 < 5.66667) return vec3(0.075);
  if (x7 < 6.0) return vec3(0.115);
  return vec3(0.075);
}

vec3 gt_bars(vec2 p) {
  vec2 frame = vec2(3.2, 2.0) * u_scale;          // one 16:10 card, repeated
  vec2 q = vec2(fract(p.x / frame.x + 0.5), fract(0.5 - p.y / frame.y));
  vec3 c = gt_barsAt(q);
  // anti-alias against the neighbour across the nearest vertical and horizontal boundary (only near one)
  float x7 = q.x * 7.0;
  float bx = floor(x7 + 0.5);
  if (q.y >= 0.75) {                              // bottom row: edges at 1.25 steps, then PLUGE thirds, then 6, 7
    bx = x7 < 5.0 ? min(floor(x7 / 1.25 + 0.5) * 1.25, 5.0)
                  : (x7 < 6.0 ? 5.0 + floor((x7 - 5.0) * 3.0 + 0.5) / 3.0 : (x7 < 6.5 ? 6.0 : 7.0));
  }
  float dx = (bx - x7) / 7.0;
  float wx = pg_fill(abs(dx) * frame.x);
  if (wx > 0.0) c = mix(c, gt_barsAt(vec2(fract(q.x + dx + sign(dx) * 1e-4), q.y)), wx);
  float by = q.y < 0.335 ? 0.0 : (q.y < 0.71 ? 0.67 : (q.y < 0.875 ? 0.75 : 1.0));
  float dy = by - q.y;
  float wy = pg_fill(abs(dy) * frame.y);
  if (wy > 0.0) c = mix(c, gt_barsAt(vec2(q.x, fract(q.y + dy + sign(dy) * 1e-4))), wy);
  return c;
}

vec3 gt_gradient(vec2 p, float t) {
  vec2 q = p / u_scale;
  float g = q.x * 0.2 + q.y * 0.07 + 0.16 * sin(q.y * 1.6 + q.x * 0.7 + t * 0.8) + t * 0.04;
  vec3 c = gt_cycle(g);
  return c * (0.8 + 0.2 * (0.5 + 0.5 * sin(q.y * 1.2 - q.x * 0.4 - t * 0.6 + 1.0)));
}

vec3 gt_stripes(vec2 p, float t) {
  float w = 0.12 * u_scale;
  float x = (p.x + 0.12 * p.y) / w + t * 0.6;
  float i = floor(x), f = x - i;
  vec3 c = gt_pal(int(i));
  vec3 cn = gt_pal(int(i) + (f < 0.5 ? -1 : 1));
  return mix(c, cn, pg_fill(min(f, 1.0 - f) * w * 0.9934));
}

vec3 gt_checker(vec2 p, float t) {
  float s = 0.2 * u_scale;
  vec2 q = p / s + vec2(t * 0.4, 0.0);
  vec2 i = floor(q), f = q - i;
  float par = mod(i.x + i.y, 2.0);
  vec2 d = min(f, 1.0 - f) * s;
  float wx = pg_fill(d.x), wy = pg_fill(d.y);
  float k = mix(par, 1.0 - par, wx * (1.0 - wy) + wy * (1.0 - wx));
  return mix(gt_pal(0), gt_pal(u_colors_count - 1), k);
}

vec3 gt_clouds(vec2 p, float t) {
  vec2 q = p / (0.75 * u_scale) + vec2(t * 0.22, t * 0.07);
  q += 0.55 * vec2(pg_noise(q * 0.45 + vec2(3.1, t * 0.05)), pg_noise(q * 0.45 + vec2(-7.7, 1.9)));
  float n = pg_fbm(q, 4);
  return gt_ramp(0.5 + 0.95 * n);
}

// ---- digital UI: KD-split panels with pixel text, bar charts, gauges, scopes, solid blocks
float gt_text(vec2 lc, float w, float key, float px) {
  const float RH = 0.06, GW = 0.03;
  float row = floor(lc.y / RH);
  float ry = lc.y - row * RH;
  float gi = floor(lc.x / GW);
  float gx = lc.x - gi * GW;
  vec3 rh = pg_hash32(vec2(key, row + 1000.0));
  float len = floor(mix(0.3, 1.0, rh.x) * w / GW);
  if (row < 0.0 || gi < 0.0 || gi >= len || rh.y < 0.15) return 0.0;
  float gh = pg_hash12(vec2(key, row * 128.0 + gi));
  if (gh < 0.17) return 0.0;                               // word gap
  vec2 g = vec2(gx / (GW * 0.75) * 3.0, (ry - RH * 0.2) / (RH * 0.6) * 5.0);
  if (g.x < 0.0 || g.x >= 3.0 || g.y < 0.0 || g.y >= 5.0) return 0.0;
  vec2 gc = floor(g);
  uint bits = uint(fract(gh * 7.31) * 32768.0);
  float bit = float((bits >> uint(gc.y * 3.0 + gc.x)) & 1u);
  // glyph pixels smaller than a screen pixel fade to their average ink
  float fade = clamp(GW * 0.25 / max(px, 1e-6) - 0.5, 0.0, 1.0);
  return mix(0.5, bit, fade);
}

vec3 gt_ui(vec2 p, float t) {
  float s = 1.1 * u_scale;
  vec2 q = p / s;
  float px = pg_px / s;
  vec2 cid = floor(q), f = q - cid;
  vec2 lo = vec2(0.0), hi = vec2(1.0);
  vec2 id = cid;
  for (int k = 0; k < 3; k++) {
    vec3 h = pg_hash32(vec2(id.x * 977.0 + id.y, float(k) + 1.0));
    if (k == 2 && h.z < 0.35) break;
    vec2 sz = hi - lo;
    float cut = floor(mix(0.3, 0.7, h.x) * 8.0 + 0.5) / 8.0;
    if (sz.x * mix(0.75, 1.35, h.y) > sz.y) {
      float c = lo.x + sz.x * cut;
      float side = step(c, f.x);
      lo.x = mix(lo.x, c, side); hi.x = mix(c, hi.x, side);
      id = vec2(id.x * 2.0 + side, id.y);
    } else {
      float c = lo.y + sz.y * cut;
      float side = step(c, f.y);
      lo.y = mix(lo.y, c, side); hi.y = mix(c, hi.y, side);
      id = vec2(id.x, id.y * 2.0 + side);
    }
  }
  float key = id.x * 977.0 + id.y;
  vec3 h = pg_hash32(vec2(key, 11.0));
  vec3 h2 = pg_hash32(vec2(key, 12.0));
  int n = u_colors_count;
  vec3 bg = gt_pal(0);
  vec3 acc = gt_pal(1 + int(h.x * float(max(n - 1, 1))));
  vec3 acc2 = gt_pal(1 + int(h2.z * float(max(n - 1, 1))));

  // background with a faint 1/16 grid
  vec3 col = bg;
  vec2 gq = abs(fract(q * 16.0) - 0.5) / 16.0;
  col = mix(col, mix(bg, gt_pal(1), 0.6), pg_line((0.5 / 16.0 - max(gq.x, gq.y)) * s, 0.0012 * s) * 0.6);

  const float GAP = 0.016;
  vec2 c = 0.5 * (lo + hi), hs = 0.5 * (hi - lo) - GAP;
  if (hs.x <= 0.01 || hs.y <= 0.01) return col;
  vec2 lp = f - c;
  float dBox = pg_sdBox(lp, hs) * s;
  vec2 uv = (lp + hs) / (2.0 * hs);                   // 0..1 inside the panel
  vec2 tl = vec2(lp.x + hs.x - 0.03, hs.y - lp.y - 0.05);   // from the top-left, y down
  float type = h.y;
  vec3 body = mix(bg, acc, 0.13);
  vec3 ink = acc;
  float m = 0.0;
  if (type < 0.2) {
    // solid block with a label
    body = acc; ink = bg;
    m = gt_text(tl, hs.x * 1.2, key, px);
  } else if (type < 0.42) {
    m = gt_text(tl, hs.x * 2.0 - 0.06, key, px);
  } else if (type < 0.58) {
    // bar chart
    float nb = floor(mix(5.0, 16.0, h2.x));
    float bi = floor(uv.x * nb), bxf = fract(uv.x * nb);
    float hb = 0.12 + 0.72 * pg_hash12(vec2(key, bi + 300.0)) + 0.1 * sin(t * 2.5 + bi * 1.9);
    float dxu = (abs(bxf - 0.5) - 0.34) * (2.0 * hs.x / nb);
    float dyu = (uv.y - clamp(hb, 0.04, 0.92)) * 2.0 * hs.y;
    m = pg_fill(max(dxu, max(dyu, (0.06 - uv.y) * 2.0 * hs.y)) * s);
    ink = mix(acc, acc2, step(0.8, pg_hash12(vec2(key, bi + 700.0))));
  } else if (type < 0.72) {
    // ring gauge
    float R = 0.72 * min(hs.x, hs.y);
    float r = length(lp);
    float a = atan(lp.x, -lp.y) / PG_TAU + 0.5;
    float val = 0.15 + 0.8 * fract(h2.y + t * 0.04);
    float ring = pg_fill((abs(r - R) - 0.11 * R) * s);
    float tick = pg_fill((abs(r - R * 0.72) - 0.02 * R) * s);
    m = ring * mix(0.3, 1.0, step(a, val)) + tick * 0.6 + pg_fill((r - 0.12 * R) * s);
    ink = mix(acc, acc2, step(a, val) * step(0.6, h2.x));
  } else if (type < 0.86) {
    // oscilloscope: grid + trace
    vec2 gg = abs(fract(uv * vec2(8.0, 6.0)) - 0.5) / vec2(8.0, 6.0) * 2.0 * hs;
    float grid = pg_line((0.5 / 8.0 * 2.0 * hs.x - gg.x) * s, 0.0012 * s) + pg_line((0.5 / 6.0 * 2.0 * hs.y - gg.y) * s, 0.0012 * s);
    float fq = mix(8.0, 26.0, h2.x);
    float wave = 0.5 + 0.32 * sin(uv.x * fq + t * 4.0) * sin(uv.x * 2.3 + h2.y * 6.0 + t);
    float slope = 0.32 * fq * 2.0 * hs.y / (2.0 * hs.x);
    float dw = (uv.y - wave) * 2.0 * hs.y / sqrt(1.0 + slope * slope * 0.5);
    m = max(pg_line(dw * s, 0.008 * s), 0.35 * min(grid, 1.0));
  } else {
    // gradient meter with hatching
    body = mix(acc, acc2, uv.x);
    float hatch = abs(fract((lp.x + lp.y) * 22.0) - 0.5) / 22.0;
    m = pg_fill((hatch - 0.25 / 22.0) * s) * step(0.5, h2.x) * 0.5;
    ink = bg;
  }
  vec3 pc = mix(body, ink, clamp(m, 0.0, 1.0));
  if (h2.y > 0.45 && type >= 0.2) {
    // header strip
    float hdr = pg_fill((hs.y - 0.045 - lp.y) * s);
    pc = mix(pc, acc, hdr);
  }
  col = mix(col, pc, pg_fill(dBox));
  col = mix(col, acc, pg_line(dBox, 0.003 * s));
  return col;
}

vec3 gt_src(vec2 p, float t) {
  if (u_source == SOURCE_BARS) return gt_bars(p);
  if (u_source == SOURCE_GRADIENT) return gt_gradient(p, t);
  if (u_source == SOURCE_STRIPES) return gt_stripes(p, t);
  if (u_source == SOURCE_CHECKER) return gt_checker(p, t);
  if (u_source == SOURCE_CLOUDS) return gt_clouds(p, t);
  return gt_ui(p, t);
}

// source as seen at screen position s (preview px) at source time t
vec3 gt_at(vec2 s, float t) {
  vec2 d = s - gt_vp;
  return gt_src(gt_p + gt_jx * d.x + gt_jy * d.y, t);
}

// ================================================================== datamosh
// I-frame removal: inside moshed areas every macroblock is predicted from the previous frame along its motion vector,
// frame after frame, but the reference is the stale picture instead of the real one. Following that chain back
// through the GOP (one block lookup per frame) gives the real thing: the old picture is dragged along a coherent
// motion field in block-sized steps, and where the chain leaves the moshed area the edge pixels bloom into blocky
// streaks. Plus corrupt vectors, slices that repeat one block, lone stuck blocks and residue on the wrong picture.
const float GT_GOP = 10.0;

// motion vector of macroblock b in this GOP (whole px per frame): a smooth field, a camera pan, a few corrupt vectors
vec2 gt_mv(vec2 b, float gop) {
  vec2 q = (b + 0.5) * (gt_B / 250.0);
  vec2 v = vec2(pg_noise(q + vec2(gop * 7.31, 1.7)), pg_noise(q + vec2(-3.9, gop * 5.17 + 0.5))) * 16.0 + gt_pan;
  vec3 h = gt_h3(b, gop, 4.0);
  if (h.x < 0.07) v = (h.yz - 0.5) * gt_B * 3.0;
  return floor(v + 0.5);
}
bool gt_moshed(vec2 b, float gop) {
  return pg_noise((b + 0.5) * (gt_B / 330.0) + vec2(11.3, gop * 3.71)) < gt_cov;
}

vec2 gt_mosh(vec2 s, inout float t, inout vec3 tint) {
  float a = gt_aM;
  if (a <= 0.0) return s;
  float B = gt_B;
  float gg = gt_gfi + 6.0;                              // phased so a still (time 0) is well into a GOP
  float gop = floor(gg / GT_GOP);
  float age = gg - gop * GT_GOP + 1.0;                  // frames since the (missing) I-frame
  vec2 bid = floor(s / B);
  vec2 bl = s - bid * B;
  vec3 bh = gt_h3(bid, gop, 5.0);

  // slice error: the decoder repeats one block along the rest of a run in its row
  vec3 rr = gt_h3(vec2(bid.y, 21.0), floor(gt_gfi / 2.0), 8.0);
  if (rr.x < a * 0.04) {
    float cols = ceil(gt_vres.x / B);
    float c0 = floor(rr.y * cols);
    if (bid.x >= c0 && bid.x < c0 + 2.0 + floor(rr.z * rr.z * cols * 0.6)) {
      t -= 2.0 * gt_dt;
      return vec2(c0 * B + bl.x, s.y);
    }
  }

  if (gt_moshed(bid, gop)) {
    vec2 x = s;
    float k = 0.0;
    for (int i = 0; i < int(GT_GOP); i++) {
      if (float(i) >= age) break;
      vec2 b = floor(x / B);
      if (i > 0 && !gt_moshed(b, gop)) break;           // that block was intra-coded: the chain ends there
      x -= gt_mv(b, gop);
      k += 1.0;
    }
    t -= k * gt_dt;
    // the residual meant for the real picture, added to the stale one
    tint += (vec3(bh.y, fract(bh.y * 7.13), fract(bh.y * 3.71)) - 0.5) * vec3(0.4, 0.3, 0.4) * step(0.975, bh.z) * min(a, 1.0);
    return x;
  }

  if (bh.y < a * 0.012) {
    // a lone block stuck from an older frame, copied from a neighbour
    t -= 13.0 * gt_dt;
    return (bid + floor((bh.zx - 0.5) * 5.0)) * B + bl;
  }
  return s;
}

// ================================================================== pixel sort
// Real threshold intervals: along the sort direction, each run of pixels brighter than the threshold (cut at a
// maximum length) is replaced by its own colours sorted by brightness. The run is located from 10 samples over the
// column segment plus a bisection of each end, so all pixels of one run agree on its extent. Only lumas are kept
// (a small register footprint keeps the whole shader fast); the two colours needed are fetched again at the end.
float gt_lum(vec2 x, float t) { return pg_luma(gt_at(x, t)); }

// sorted colour at screen point sc (preview px); .w = 1 when this pixel lies in a sorted run
vec4 gt_sort(vec2 sc, float t, float aS, float lum) {
  float thr = u_sortThresh;
  if (lum < thr) return vec4(0.0);
  float an = radians(u_sortAngle);
  vec2 dir = vec2(cos(an), sin(an));
  float colId = floor(dot(sc, vec2(-dir.y, dir.x)));
  float u = dot(sc, dir);
  float sf = floor(gt_gfi / 4.0);
  vec3 ch = gt_h3(vec2(colId, 9.0), sf, 19.0);
  // maximum interval length and where the cuts fall: smooth across columns (neighbouring columns hold similar
  // pixels, so their sorted runs line up), with a little per-column jitter for ragged ends
  float L = mix(50.0, 900.0, aS) * (1.0 + 0.3 * pg_noise(vec2(colId * 0.013, sf * 0.53 + 5.0))) * mix(0.985, 1.015, ch.x);
  float o = L * (0.5 + 0.7 * pg_noise(vec2(colId * 0.006, sf * 0.37 + 2.0)) + 0.012 * ch.y);
  float seg = floor((u + o) / L);
  if (pg_vnoise(vec2(colId * 0.03, seg * 7.0 + sf * 3.0)) > 0.3 + 0.9 * aS) return vec4(0.0);
  float a0 = seg * L - o;                 // segment start along dir
  float w = u - a0;                       // this pixel's position in the segment
  float h = L / 10.0;
  vec2 base = sc + dir * (a0 - u);
  float lu[12];
  uint m = 0u;                            // bit k = sample k is bright
  for (int k = 0; k < 10; k++) {
    lu[k] = gt_lum(base + dir * ((float(k) + 0.5) * h), t);
    if (lu[k] >= thr) m |= 1u << uint(k);
  }
  int j = int(floor(w / h - 0.5));        // samples j and j + 1 bracket the pixel
  int seed = -1;
  if (j >= 0 && ((m >> uint(j)) & 1u) != 0u) seed = j;
  else if (j < 9 && ((m >> uint(j + 1)) & 1u) != 0u) seed = j + 1;
  if (seed < 0) return vec4(0.0);
  int ka = 0, kb = 9;                     // the run of bright samples around the seed
  for (int k = 0; k < 10; k++) {
    bool dark = ((m >> uint(k)) & 1u) == 0u;
    if (dark && k < seed) ka = k + 1;
    if (dark && k > seed && kb == 9) kb = k - 1;
  }
  // refine both ends of the run (the colours found there are near the threshold: the dark end of the sort)
  float aB = (float(ka) + 0.5) * h, bB = (float(kb) + 0.5) * h;
  lu[10] = lu[ka]; lu[11] = lu[kb];
  if (ka > 0) {
    float lo = aB - h;
    for (int i = 0; i < 3; i++) {
      float mid = 0.5 * (lo + aB);
      float l = gt_lum(base + dir * mid, t);
      if (l >= thr) { aB = mid; lu[10] = l; } else lo = mid;
    }
  } else { aB = 0.0; lu[10] = gt_lum(base, t); }
  if (kb < 9) {
    float hi = bB + h;
    for (int i = 0; i < 4; i++) {
      float mid = 0.5 * (bB + hi);
      float l = gt_lum(base + dir * mid, t);
      if (l >= thr) { bB = mid; lu[11] = l; } else hi = mid;
    }
  } else { bB = L; lu[11] = gt_lum(base + dir * L, t); }
  if (w < aB - 1.0 || w > bB + 1.0) return vec4(0.0);
  // the samples of rank r0 and r0 + 1 (ascending brightness along dir) at this pixel's place in the run
  float f = clamp((w - aB) / max(bB - aB, 1.0), 0.0, 1.0);
  float n = float(kb - ka + 3);
  float x = f * (n - 1.0);
  float r0 = floor(x);
  int i0 = 10, i1 = 10;
  for (int i = 0; i < 12; i++) {
    if (i < 10 && (i < ka || i > kb)) continue;
    float rank = 0.0;
    for (int q = 0; q < 12; q++) {
      bool inq = q >= 10 || (q >= ka && q <= kb);
      if (inq && (lu[q] < lu[i] || (lu[q] == lu[i] && q < i))) rank += 1.0;
    }
    if (rank == r0) i0 = i;
    if (rank == r0 + 1.0) i1 = i;
  }
  if (r0 >= n - 1.0) i1 = i0;
  float p0 = i0 == 10 ? aB : (i0 == 11 ? bB : (float(i0) + 0.5) * h);
  float p1 = i1 == 10 ? aB : (i1 == 11 ? bB : (float(i1) + 0.5) * h);
  vec3 c0 = gt_at(base + dir * p0, t);
  vec3 c1 = i1 == i0 ? c0 : gt_at(base + dir * p1, t);
  return vec4(mix(c0, c1, x - r0), 1.0);
}

// broken-JPEG garbage: a block decoded from the wrong bits = a few strong DCT basis functions with wild chroma (YUV)
vec3 gt_junk(vec2 l8, vec3 h) {
  vec2 f1 = floor(h.xy * 8.0), f2 = floor(fract(h.yz * 13.7) * 8.0);
  float b1 = cos(PG_PI * f1.x * (l8.x + 0.5) / 8.0) * cos(PG_PI * f1.y * (l8.y + 0.5) / 8.0);
  float b2 = cos(PG_PI * f2.x * (l8.x + 0.5) / 8.0) * cos(PG_PI * f2.y * (l8.y + 0.5) / 8.0);
  return vec3(0.45 + 0.4 * b1 + 0.2 * b2 + (h.z - 0.5) * 0.3,
              (h.x - 0.5) * 0.45 + 0.18 * b2,
              (fract(h.x * 7.31) - 0.5) * 0.45 - 0.18 * b1);
}

// ================================================================== main
vec4 pattern(vec2 p) {
  // screen → pattern Jacobian, taken first while control flow is still uniform
  vec2 jx = dFdx(p), jy = dFdy(p);
  if (u_tf_snap > 0.0 || dot(jx, jx) + dot(jy, jy) < 1e-24) {
    // floor pixels make p piecewise constant: fall back to the flat view mapping
    float k = 2.0 / (u_res.y * u_tf_zoom);
    mat2 R = pg_rot(-radians(u_tf_rotate));
    jx = R * vec2(k, 0.0);
    jy = R * vec2(0.0, k);
  }
  // symmetry folds / warp seams make the derivative jump: cap it near the real pixel footprint
  float lim = 3.0 * pg_px * pg_ss;
  if (length(jx) > lim) jx *= lim / length(jx);
  if (length(jy) > lim) jy *= lim / length(jy);
  float pxs = max(u_pxScale, 1e-3);
  gt_jx = jx * pxs;
  gt_jy = jy * pxs;
  gt_p = p;
  vec2 vres = u_res / pxs;
  vec2 vp = pg_screen * vres;
  gt_vp = vp;
  gt_vres = vres;
  vec2 pkey = floor(pg_screen * u_res);                 // output pixel of this sample
  bool first = pkey != gt_pk;                           // first sample of the pixel: refresh the per-pixel caches
  gt_pk = pkey;
  vec2 vpc = (pkey + 0.5) / pxs;                        // the pixel's centre, preview px

  // ---- clock: glitch frames, stutter (choppy time + freeze frames), bursts
  float T = u_time;
  float fps = max(u_fps, 0.5);
  float fi = floor(T * fps);
  float stu = clamp(u_stutter * u_intensity, 0.0, 1.0);
  float gfi = fi;
  if (stu > 0.0) {
    float chunk = floor(fi / 6.0);
    vec3 sh = gt_h3(vec2(chunk, 0.0), 0.0, 6.0);
    if (sh.x < stu * 0.7) {
      float line = floor(sh.z * vres.y / 16.0) * 16.0;   // partial freeze: everything below a line
      if (sh.y < 0.45 || vp.y < line) gfi = chunk * 6.0;
    }
  }
  gt_gfi = gfi;
  float tq = stu > 0.0 ? (gfi + 0.5) / fps : T;
  float t = tq * u_motion;                              // source time

  float slot = floor(((gfi + 0.5) / fps) / max(u_burst, 0.02));
  vec3 bh = gt_h3(vec2(slot, 1.0), 0.0, 9.0);
  float on = bh.x < u_rate ? mix(0.6, 1.0, bh.y) : 0.0;
  if (slot < 0.5) on = 1.0;                             // a still frame (time 0) is always mid-burst
  float env = u_rate > 0.995 ? 1.0 : max(on, u_calm);
  float G = u_intensity * env;                          // discrete glitches
  float S = u_intensity * mix(0.6, 1.0, env);           // steady artefacts

  gt_B = u_block == BLOCK_8 ? 8.0 : (u_block == BLOCK_16 ? 16.0 : 32.0);
  gt_aM = u_mosh * G;
  gt_dt = u_motion / fps;
  gt_cov = -0.75 + 1.2 * gt_aM;
  vec3 gp = gt_h3(vec2(0.0, 1.0), floor((gfi + 6.0) / GT_GOP), 7.0);   // some GOPs have a camera pan
  gt_pan = step(0.5, gp.z) * (gp.xy - 0.5) * vec2(18.0, 10.0);

  // ---- where to read the picture from (analog stages first: they happen last in the signal chain)
  vec2 s = vp;
  vec3 tint = vec3(0.0);
  float band = 0.0, head = 0.0;

  float aV = u_vhs * S;
  if (aV > 0.0) {
    float line = floor(vp.y);
    float wob = pg_noise(vec2(line * 0.017, T * 1.1 + 3.0)) * 2.5 + (gt_h3(vec2(line, 1.0), gfi, 10.0).x - 0.5) * 1.2;
    float by = (1.0 - fract(T * 0.06 + 0.37)) * vres.y * 1.5 - 0.25 * vres.y;   // tracking band rolls down
    float bw = mix(10.0, 46.0, min(aV, 1.0));
    band = smoothstep(bw, 0.0, abs(vp.y - by)) * min(aV * 1.5, 1.0);
    vec3 th = gt_h3(vec2(line, 2.0), gfi, 11.0);
    head = smoothstep(vres.y * 0.04, vres.y * 0.01, vp.y) * min(aV * 1.5, 1.0);   // head-switching strip
    s.x += wob * min(aV, 1.5) + band * ((th.x - 0.5) * 50.0 + 12.0) + head * (8.0 + 24.0 * th.y);
  }

  float aI = u_interlace * S;
  if (aI > 0.0) {
    float odd = mod(floor(vp.y / 2.0), 2.0);
    float comb = 0.5 + 0.5 * pg_noise(vec2(vp.y * 0.008, T * 0.6 + 4.0));
    s.x += odd * floor(mix(2.0, 26.0, comb) * min(aI, 1.5));
    t -= odd * aI * 0.15 * u_motion;
  }

  float aT = u_tear * G;
  if (aT > 0.0) {
    float o = 0.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      vec3 fh = gt_h3(vec2(fk, 3.0), gfi, 12.0);
      float hgt = (k == 0 ? 3.0 : (k == 1 ? 14.0 : 48.0)) * mix(0.6, 1.7, fh.x);
      float ph = floor(fh.y * 17.0);
      float bnd = floor(vp.y / hgt) + ph;
      vec3 hh = gt_h3(vec2(bnd, fk), gfi, 13.0);
      if (hh.x < aT * (k == 0 ? 0.05 : 0.3)) {
        o += sign(hh.y - 0.5) * mix(24.0, 400.0, pow(hh.z, 1.6));
        // some coarse slices also repeat their top line (vertical streaks)
        if (k == 2 && hh.z > 0.82) s.y = (bnd - ph + 1.0) * hgt - 0.5;
      }
    }
    s.x += floor(o * mix(0.6, 1.2, min(aT, 1.0)));
  }

  // broken JPEG bitstream, in raster order of 8×8 blocks. At an error point the Huffman decoder loses sync: a run of
  // garbage blocks, then everything after it is shifted by whole MCUs and DC-tinted (DC is coded as differences, so
  // the error sticks) — to the end of the file, or only up to the next restart marker.
  float aJ = u_jpeg * G, aJs = u_jpeg * S;
  vec2 jid = floor(s / 8.0), jl = s - jid * 8.0;
  if (u_jpeg > 0.0) {
    if (first) {                                      // depends only on the pixel's block: once per pixel
      float cols = ceil(vres.x / 8.0), rows = ceil(vres.y / 8.0);
      float wrapX = floor(jid.x / cols) * cols;
      float r = (rows - 1.0 - jid.y) * cols + (jid.x - wrapX);
      float jf = floor(gfi / 3.0);
      float shift = 0.0;
      gt_jD = vec3(0.0);
      gt_jJ = vec3(-1.0);
      for (int k = 0; k < 3; k++) {
        vec3 h = gt_h3(vec2(float(k), 4.0), jf, 14.0);
        vec3 h2 = gt_h3(vec2(float(k), 5.0), jf, 14.0);
        float rE = floor(mix(0.06, 1.0, sqrt(h.y)) * cols * rows);
        float mcuRow = cols * 2.0;                                     // 4:2:0 → one MCU row = 2 block rows
        float rEnd = h2.x < 0.45 ? (floor(rE / mcuRow) + 1.0 + floor(h2.y * 4.0)) * mcuRow : 1e9;
        if (h.x < aJ * 0.6 && r >= rE && r < rEnd) {
          if (r < rE + 1.0 + floor(h2.z * h2.z * cols * 1.5)) gt_jJ = gt_h3(vec2(r, float(k)), jf, 20.0);
          shift += 2.0 * floor((h.z - 0.5) * 14.0);
          gt_jD += (gt_h3(vec2(float(k), 6.0), jf, 14.0) - 0.5) * vec3(0.28, 0.42, 0.48) * min(1.0, 0.1 + aJ);
        }
      }
      // truncated file: the rest decodes as flat mid grey
      vec3 ht = gt_h3(vec2(3.0, 4.0), jf, 14.0);
      gt_jS = vec4(0.0, 0.0, ht.x < aJ * 0.25 && r >= floor(mix(0.55, 0.97, ht.y) * cols * rows) ? 1.0 : 0.0, 0.0);
      if (shift != 0.0) {
        float r2 = r - shift;
        float row2 = floor(r2 / cols);
        gt_jS.xy = (vec2(r2 - row2 * cols + wrapX, rows - 1.0 - row2) - jid) * 8.0;
      }
    }
    s += gt_jS.xy;
    jid += gt_jS.xy / 8.0;
  }

  vec2 sN = s;                // decoded-block space (noise blocks live here)
  // datamosh: the motion chain is followed once per pixel (all its samples sit in the same macroblock)
  vec2 sm = s;
  if (gt_aM > 0.0) {
    if (first) {
      vec2 sc = s - (vp - vpc);
      float tt = t;
      vec3 tn = vec3(0.0);
      gt_mD = vec4(gt_mosh(sc, tt, tn) - sc, tt - t, 0.0);
      gt_mTint = tn;
    }
    sm = s + gt_mD.xy;
    t += gt_mD.z;
    tint += gt_mTint;
  }

  // ---- per-band RGB split (+ the odd channel swap)
  float aR = u_rgb * G;
  vec2 oR = vec2(0.0);
  float swap = 0.0;
  if (u_rgb > 0.0) {
    oR = vec2((1.0 + 3.0 * u_rgb) * min(S, 1.0), 0.0);       // a steady misregistration, plus bands below
    for (int k = 0; k < 2; k++) {
      float fk = float(k);
      vec3 fh = gt_h3(vec2(fk, 6.0), gfi, 15.0);
      float hgt = (k == 0 ? 8.0 : 38.0) * mix(0.6, 1.8, fh.x);
      float bnd = floor(vp.y / hgt + fh.y * 9.0);
      vec3 hh = gt_h3(vec2(bnd, fk), gfi, 16.0);
      if (hh.x < aR * 0.4) {
        oR += vec2(sign(hh.y - 0.5), (hh.z - 0.5) * 0.3) * mix(5.0, 50.0, hh.z * hh.z) * mix(0.5, 1.2, min(aR, 1.0));
        if (k == 1 && hh.z > 0.85 && hh.y > 0.5) swap = 1.0;
      }
    }
  }

  vec3 c;
  if (u_rgb > 0.0) {
    vec3 cg = gt_at(sm, t);
    c = vec3(gt_at(sm + oR, t).r, cg.g, gt_at(sm - oR, t).b);
    if (swap > 0.5) c = c.brg;
  } else {
    c = gt_at(sm, t);
  }

  // ---- broken JPEG: blocking from quantised DC, 4:2:0 chroma flattened per 16×16 MCU, posterised AC, mosquito
  // noise in blocks that hold an edge, DC-only blocks, garbage blocks after a bitstream error
  if (u_jpeg > 0.0) {
    if (jid != gt_jk) {                               // block-level decode, once per pixel
      gt_jk = jid;
      vec2 md = sm - s;                               // this pixel's datamosh displacement, applied to its block
      vec2 mc = jid * 8.0 + 4.0 + md;
      gt_jY = gt_yuv(gt_at(mc, t));
      float l1 = gt_yuv(gt_at(mc + vec2(-2.5, 2.5), t)).x;
      float l2 = gt_yuv(gt_at(mc + vec2(2.5, -2.5), t)).x;
      gt_jAct = abs(l1 - gt_jY.x) + abs(l2 - gt_jY.x) + abs(l1 - l2);
      gt_jC = gt_yuv(gt_at(floor(jid / 2.0) * 16.0 + 8.0 + md, t));
      vec3 jb = gt_h3(jid, floor(gfi / 3.0), 17.0);
      gt_jB = vec4(jb.x, floor(jb.yz * 5.0) + 2.0, 0.0);
      vec3 jw = gt_h3(jid, floor(gfi / 2.0), 18.0);
      gt_jW = jw.x < aJ * 0.004 ? (vec3(jw.y, jw.z, fract(jw.y * 7.31)) - 0.5) * vec3(0.7, 0.4, 0.4) : vec3(0.0);
    }
    vec3 Y0 = gt_yuv(c), Y = Y0;
    float k = clamp(aJs, 0.0, 1.0);
    // quantised DC (chroma much coarser than luma): blocky contours across smooth gradients
    float dqY = mix(0.008, 0.05, k), dqC = mix(0.015, 0.085, k);
    vec3 D = vec3(floor(gt_jY.x / dqY + 0.5) * dqY, floor(gt_jC.yz / dqC + 0.5) * dqC);
    Y.yz = mix(Y.yz, D.yz, min(1.0, k * 1.6));
    float dev = Y.x - gt_jY.x;
    float qs = mix(0.04, 0.3, k);
    Y.x = D.x + floor(dev / qs + 0.5) * qs;
    vec2 fq = gt_jB.yz;
    Y.x += cos(PG_PI * fq.x * (jl.x + 0.5) / 8.0) * cos(PG_PI * fq.y * (jl.y + 0.5) / 8.0) * min(gt_jAct, 0.6) * 0.35 * k;
    if (gt_jB.x < k * 0.12) Y = D;                                    // DC-only block
    Y += gt_jW;                                                       // the odd wrong DC
    if (gt_jJ.x >= 0.0) Y = gt_junk(jl, gt_jJ);                       // garbage after a bitstream error
    Y = mix(Y0, Y, min(1.0, k * 5.0));                                // fades in from the clean picture
    Y += gt_jD;
    c = mix(gt_rgb(Y), vec3(0.5), gt_jS.z);
  }

  // ---- pixel sort (worked out once per output pixel, at its centre: a sort works on whole pixels anyway)
  float aS = clamp(u_sort * S, 0.0, 1.0);
  if (aS > 0.0) {
    if (first) gt_sortC = gt_sort(sm - (vp - vpc), t, aS, pg_luma(c));
    if (gt_sortC.w > 0.5) c = gt_sortC.rgb;
  }

  // ---- noise blocks: static, decoder fill colours, smeared and garbage blocks, failed runs of macroblocks
  float aN = u_noise * G;
  if (aN > 0.0) {
    float B = gt_B;
    float nrow = floor(sN.y / B);
    vec2 nb = vec2(B * (1.0 + floor(gt_h3(vec2(nrow, 12.0), gfi, 29.0).x * 4.0)), B);   // strips of 1–4 blocks
    vec2 nid = vec2(floor(sN.x / nb.x), nrow);
    vec3 h = gt_h3(nid, gfi, 21.0);
    vec3 h2 = gt_h3(nid, gfi, 22.0);
    float kind = h.x < aN * 0.06 ? h.y : -1.0;
    vec3 rf = gt_h3(vec2(0.0, 10.0), floor(gfi / 2.0), 23.0);
    if (rf.x < aN * 0.6) {
      float cols = ceil(vres.x / B), rows = ceil(vres.y / B);
      vec2 mb = floor(sN / B);
      float r = (rows - 1.0 - mb.y) * cols + mod(mb.x, cols);
      float r0 = floor(rf.y * cols * rows * 0.9);
      float len = floor(mix(0.4, 7.0, rf.z * rf.z) * cols * min(aN, 1.0));
      if (r >= r0 && r < r0 + len) { kind = rf.z < 0.55 ? 0.5 : 0.8; h2 = rf; }
    }
    if (kind >= 0.0) {
      if (kind < 0.18) {
        c = gt_h3(floor(vp), gfi, 24.0);                                        // RGB static
      } else if (kind < 0.3) {
        c = vec3(gt_h3(floor(vp / 2.0), gfi, 25.0).x);                          // luma static
      } else if (kind < 0.62) {
        c = h2.y < 0.5 ? vec3(0.0, 0.53, 0.0) : (h2.y < 0.72 ? vec3(0.5) : (h2.y < 0.86 ? vec3(0.55, 0.0, 0.55) : vec3(0.02)));
      } else if (kind < 0.88) {
        float top = (floor(sN.y / B) + 1.0) * B - 0.5;                        // vertical smear of the block's top line
        c = gt_at(vec2(sm.x, sm.y + (top - sN.y)), t);
      } else {
        vec2 f8 = floor(h2.yz * 8.0);
        vec2 l8 = mod(sN, 8.0);
        c = (0.5 + 0.45 * cos(PG_PI * f8.x * (l8.x + 0.5) / 8.0) * cos(PG_PI * f8.y * (l8.y + 0.5) / 8.0)) * mix(vec3(1.0), h2 * 1.4, 0.6);
      }
    }
  }

  // ---- VHS: soft luma with the deck's edge-enhancement halo, low-bandwidth chroma smeared to the right, chroma
  // noise, tape grain, snow in the tracking band, head-switching noise, lifted blacks
  if (aV > 0.0) {
    if (first) {                                      // neighbours along the line, once per pixel
      vec2 sc = sm - (vp - vpc);
      vec3 y1 = gt_yuv(gt_at(sc + vec2(-4.0, 0.0), t));
      vec3 y2 = gt_yuv(gt_at(sc + vec2(-10.0, 0.0), t));
      float yl = gt_yuv(gt_at(sc + vec2(-1.5, 0.0), t)).x;
      float yr = gt_yuv(gt_at(sc + vec2(1.5, 0.0), t)).x;
      gt_vhsA = vec4(y1.yz * 0.4 + y2.yz * 0.3, yl + yr, y1.x);
      float ln = floor(vpc.y) * 1.37 + gfi * 17.0;
      gt_vhsB = vec4(pg_vnoise(vec2(vpc.x / 14.0, ln)), pg_vnoise(vec2(vpc.x / 14.0 + 50.0, ln)), 0.0, 0.0) - 0.5;
    }
    vec3 Y = gt_yuv(c);
    float k = min(aV, 1.0);
    Y.yz = mix(Y.yz, (Y.yz * 0.3 + gt_vhsA.xy) * 1.12 + gt_vhsB.xy * 0.07, k);
    float yb = 0.5 * Y.x + 0.25 * gt_vhsA.z;
    Y.x = mix(Y.x, yb + 0.3 * (yb - gt_vhsA.w), k);
    float line = floor(vp.y);
    vec3 lh = gt_h3(vec2(line, 11.0), gfi, 26.0);
    Y.x += (gt_h3(floor(vp), gfi, 27.0).x - 0.5) * 0.08 * k;
    float dash = gt_h3(vec2(floor(vp.x / mix(4.0, 30.0, lh.x)), line), gfi, 28.0).x;
    float snow = step(1.0 - (0.003 + band * 0.3 + head * 0.35) * k, dash);
    Y.x = mix(Y.x, 0.92, snow * 0.85);
    Y.yz *= 1.0 - snow;
    Y.x += head * (lh.y - 0.5) * 0.3;
    Y.yz *= 1.0 - 0.6 * head;
    Y.x = mix(Y.x, Y.x * 0.86 + 0.07, k);
    c = gt_rgb(Y);
  }

  c += tint;

  // ---- bit crush: few levels per channel, ordered dither in screen pixels
  float aC = clamp(u_crush * S, 0.0, 1.0);
  if (aC > 0.0) {
    c = clamp(c, 0.0, 1.0);
    // bit-shifted bands: the top bits fall off, values wrap into harsh contours
    vec3 bf = gt_h3(vec2(0.0, 13.0), floor(gfi / 2.0), 30.0);
    vec3 bb = gt_h3(vec2(floor(vp.y / mix(5.0, 48.0, bf.x * bf.x) + bf.y * 50.0), 14.0), floor(gfi / 2.0), 31.0);
    if (bb.x < u_crush * G * 0.12) c = fract(c * (bb.y < 0.6 ? 2.0 : 4.0) + (bb.z < 0.3 ? 0.5 : 0.0));
    float lv = floor(mix(16.0, 2.0, sqrt(aC)) + 0.5);
    float d = pg_bayer4(floor(vp)) - 0.5;
    c = floor(c * (lv - 1.0) + 0.5 + d) / (lv - 1.0);
  }

  return vec4(clamp(c, 0.0, 1.0), 1.0);
}
`,
  });
})();
