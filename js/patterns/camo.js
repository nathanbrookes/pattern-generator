/* Camo — military camouflage: digital MARPAT / CADPAT pixels, M81 woodland blobs, multi-terrain blends,
 * tiger stripe, Splittertarn shards and Flecktarn dots.
 * The first palette colour is the ground; every further colour is an independent layer painted on top,
 * each thresholded so it gets its share of the area (Ground area / Top layers). */
(function () {
  'use strict';

  const is = (...styles) => (v) => styles.includes(v.style);

  PG.registerPattern({
    id: 'camo',
    name: 'Camo',
    category: 'Military',
    description: 'Camouflage: digital MARPAT pixels, woodland blobs, multi-terrain, tiger stripe, splinter and flecktarn.',
    params: [
      { type: 'heading', label: 'Style' },
      {
        id: 'style',
        label: 'Style',
        type: 'select',
        options: [
          ['digital', 'Digital (pixel)'],
          ['woodland', 'Woodland'],
          ['multicam', 'Multi-terrain'],
          ['tiger', 'Tiger stripe'],
          ['splinter', 'Splinter'],
          ['flecktarn', 'Flecktarn'],
        ],
        default: 'digital',
        random: ['digital', 'digital', 'woodland', 'multicam', 'tiger', 'splinter', 'flecktarn'],
      },
      { id: 'scale', label: 'Pattern scale', min: 0.05, max: 3, default: 0.5, step: 0.001, scale: 'log', random: [0.25, 1.1], help: 'Size of the large shapes' },
      { id: 'pixel', label: 'Pixel size', min: 0.003, max: 0.1, default: 0.017, step: 0.0005, scale: 'log', random: [0.009, 0.03], showIf: is('digital'), help: 'Size of one camo pixel' },
      { id: 'fleck', label: 'Fleck size', min: 0.008, max: 0.2, default: 0.042, step: 0.001, scale: 'log', random: [0.025, 0.07], showIf: is('flecktarn') },
      { id: 'stretch', label: 'Stretch', min: 0.25, max: 4, default: 1.3, step: 0.01, scale: 'log', random: [0.8, 2], help: 'Horizontal elongation of the shapes' },

      { type: 'heading', label: 'Colors' },
      { id: 'palette', label: 'Colors', type: 'palette', min: 2, max: 6, random: false, default: ['#9a9174', '#56603e', '#6b5541', '#272620'], help: 'First color is the ground, the rest are layered on top in order' },
      { id: 'base', label: 'Ground area', min: 0.05, max: 0.8, default: 0.27, step: 0.01, random: [0.18, 0.4], help: 'Share of the first color' },
      { id: 'balance', label: 'Top layers', min: 0.3, max: 2, default: 0.8, step: 0.01, scale: 'log', random: [0.55, 1.2], help: 'Below 1: later colors get smaller. Above 1: later colors dominate' },

      { type: 'heading', label: 'Shape' },
      { id: 'roughness', label: 'Edge roughness', min: 0, max: 1, default: 0.55, step: 0.01, random: [0.3, 0.8] },
      { id: 'detail', label: 'Detail', min: 0, max: 1, default: 0.6, step: 0.01, random: [0.35, 0.85], showIf: (v) => v.style !== 'splinter', help: 'Amount of small-scale shapes' },
      { id: 'soft', label: 'Blend softness', min: 0, max: 1, default: 0.55, step: 0.01, random: [0.3, 0.8], showIf: is('multicam'), help: 'How softly the background colors fade into each other' },
      { id: 'rain', label: 'Rain streaks', min: 0, max: 1, default: 0.55, step: 0.01, random: [0.2, 0.8], showIf: is('splinter'), help: 'Short vertical dashes over the shards (Splittertarn)' },

      { type: 'heading', label: 'Animation' },
      { id: 'speed', label: 'Morph speed', min: 0, max: 2, default: 0.35, step: 0.01, random: false, help: 'Layers drift through each other when Animate is on' },
    ],
    presets: [
      { name: 'Woodland MARPAT', thumb: true, values: { pixel: 0.021, scale: 0.6, roughness: 0.5 } },
      { name: 'Desert MARPAT', values: { palette: ['#c9b48f', '#a88b63', '#7d6a54'], base: 0.36, balance: 0.75, stretch: 1.2 } },
      { name: 'Urban Digital', values: { palette: ['#c4c7c8', '#8b8f91', '#5a5e61', '#24272a'], pixel: 0.018, scale: 0.5, base: 0.34, balance: 0.8, stretch: 1.5, roughness: 0.6 } },
      { name: 'Navy / Ocean', values: { palette: ['#3d5a80', '#22324b', '#6c86a8', '#121a28'], pixel: 0.014, scale: 0.42, base: 0.32, balance: 0.7, stretch: 1.6, roughness: 0.6 } },
      { name: 'Classic Woodland', values: { style: 'woodland', palette: ['#5d6a3c', '#6e4e35', '#a08c63', '#1e1d19'], scale: 0.6, base: 0.34, balance: 0.65, stretch: 1.6, roughness: 0.5, detail: 0.55 } },
      { name: 'Multi-terrain', values: { style: 'multicam', palette: ['#b3a47e', '#8a8a5f', '#7a6446', '#4a3b2b', '#e6dcc0'], scale: 0.55, base: 0.3, balance: 0.75, stretch: 0.75, roughness: 0.6, detail: 0.6, soft: 0.6 } },
      { name: 'Tiger Stripe', values: { style: 'tiger', palette: ['#9c9a62', '#55663a', '#5a4528', '#191812'], scale: 0.45, base: 0.32, balance: 1.0, stretch: 1.4, roughness: 0.7, detail: 0.7 } },
      { name: 'Arctic', values: { style: 'splinter', palette: ['#f2f5f7', '#c9d3dc', '#8f9eac', '#4b5866'], scale: 0.55, base: 0.38, balance: 0.75, stretch: 1.2, roughness: 0.6, rain: 0.45 } },
      { name: 'Flecktarn', values: { style: 'flecktarn', palette: ['#8a8d60', '#4c5732', '#6c4a33', '#1d1d18', '#a9ab7d'], scale: 0.5, fleck: 0.038, base: 0.36, balance: 0.7, roughness: 0.5, detail: 0.55 } },
      { name: 'Neon Fantasy', values: { palette: ['#2a0c4e', '#7b2ff7', '#ff4fb4', '#ffb3e6', '#12d6df'], pixel: 0.022, scale: 0.6, base: 0.32, balance: 0.7, roughness: 0.45, stretch: 1.1 } },
    ],
    glsl: /* glsl */ `
#define CAMO_N 6

int camoN = 2;
float camoCov[CAMO_N];   // fraction of the area under layer i (before later layers cover it)
float camoThr[CAMO_N];   // threshold for layer i on a unit-variance field

// Inverse normal CDF (Abramowitz–Stegun 26.2.23, |err| < 5e-4).
float camoProbit(float p) {
  p = clamp(p, 1e-4, 1.0 - 1e-4);
  float q = p < 0.5 ? p : 1.0 - p;
  float t = sqrt(-2.0 * log(q));
  float x = t - (2.515517 + t * (0.802853 + t * 0.010328)) / (1.0 + t * (1.432788 + t * (0.189269 + t * 0.001308)));
  return p < 0.5 ? -x : x;
}

// Layer coverages: colour 0 gets u_base of the area, colours 1..n-1 share the rest with ratio u_balance.
void camoSetup() {
  camoN = clamp(u_palette_count, 1, CAMO_N);
  float W = 0.0, w = 1.0;
  for (int k = 1; k < CAMO_N; k++) { if (k >= camoN) break; W += w; w *= u_balance; }
  float sum = u_base; w = 1.0;
  camoCov[0] = 1.0; camoThr[0] = -9.0;
  for (int k = 1; k < CAMO_N; k++) {
    if (k >= camoN) break;
    float a = (1.0 - u_base) * w / W;
    sum += a; w *= u_balance;
    camoCov[k] = a / sum;
    camoThr[k] = camoProbit(1.0 - camoCov[k]);
  }
}

// Average colour (what the pattern looks like from far away).
vec3 camoMean() {
  vec3 c = vec3(0.0); float vis = 1.0;
  for (int k = CAMO_N - 1; k >= 0; k--) {
    if (k >= camoN) continue;
    c += u_palette[k] * camoCov[k] * vis;
    vis *= 1.0 - camoCov[k];
  }
  return c;
}

vec2 camoOff(int i) { return vec2(37.17, 61.73) * float(i) + vec2(-13.1, 7.7); }
// Later layers are a little smaller and busier than the ground layers.
float camoLayerFreq(int i) { return 1.0 + 0.28 * float(max(i - 1, 0)); }
vec2 camoDrift(int i) { float a = float(i) * 2.39996 + 0.7; return vec2(cos(a), sin(a)) * u_time * u_speed * 0.12; }

// Octave count for a field with base frequency freq (per pattern unit): drops octaves finer than ~3 samples.
float camoOct(float want, float freq) {
  float lim = log2(max(0.33 / (freq * pg_px), 1e-3)) + 1.0;
  return clamp(min(want, lim), 1.0, 7.0);
}

// Unit-variance fBm with fractional octave count and adjustable gain (roughness).
float camoFbm(vec2 q, float oct, float gain) {
  const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  float s = 0.0, a = 1.0, v = 0.0;
  for (int k = 0; k < 7; k++) {
    float w = clamp(oct - float(k), 0.0, 1.0);
    if (w <= 0.0) break;
    s += a * w * pg_noise(q);
    v += a * a * w * w;
    q = m * q + 17.13; a *= gain;
  }
  return s / (0.304 * sqrt(v));
}

// ---------------------------------------------------------------- digital (MARPAT / CADPAT)
// Palette index of one camo pixel. Real MARPAT/CADPAT is a few large, smooth blob fields snapped to the pixel
// grid; roughness only nudges pixels that sit near a blob edge (1–3 pixel nubs, the odd stray pixel) —
// it must never turn the shapes into salt-and-pepper noise.
int camoPixelIndex(vec2 id, float oct) {
  vec2 q = (id + 0.5) * u_pixel / u_scale;
  q.x /= u_stretch;
  vec2 cq = id / (2.2 * vec2(sqrt(u_stretch), 1.0));
  float R = 0.6 * u_roughness;
  float norm = inversesqrt(1.0 + R * R * 0.72);
  // top layer first: the first layer that is "on" wins
  for (int i = CAMO_N - 1; i >= 1; i--) {
    if (i >= camoN) continue;
    vec2 o = camoOff(i), dr = camoDrift(i);
    float f = camoFbm(q * camoLayerFreq(i) + o + dr, oct, 0.45);
    float c = pg_noise(cq + o * 1.7 + dr * (u_scale / u_pixel)) / 0.304;
    float h = (pg_hash12(id + vec2(float(i) * 71.0, 3.0)) - 0.5) * 3.4641;
    if ((f + R * (0.75 * c + 0.4 * h)) * norm > camoThr[i]) return i;
  }
  return 0;
}

// Same field without pixel quantisation — used where camo pixels are smaller than a screen pixel.
vec3 camoPixelFar(vec2 p, float oct) {
  vec2 q = p / u_scale;
  q.x /= u_stretch;
  vec3 col = u_palette[0];
  for (int i = 1; i < CAMO_N; i++) {
    if (i >= camoN) break;
    float f = camoFbm(q * camoLayerFreq(i) + camoOff(i) + camoDrift(i), oct, 0.5);
    col = mix(col, u_palette[i], pg_aastep(camoThr[i], f));
  }
  return col;
}

vec3 camoDigital(vec2 p) {
  float freq = 1.0 / (u_scale * min(u_stretch, 1.0));
  // few octaves: digital camo is smooth macro blobs; finer detail would only add speckle
  float oct = min(camoOct(1.5 + 1.5 * u_detail, freq), log2(max(0.5 / (freq * u_pixel), 1.0)) + 1.0);
  float w = pg_px / u_pixel;                 // sample footprint in camo pixels
  float lod = u_tf_aa > 0.5 ? smoothstep(0.5, 1.4, w) : 0.0;
  vec3 col = vec3(0.0);
  if (lod < 1.0) {
    vec2 g = p / u_pixel, id = floor(g), f = g - id;
    col = u_palette[camoPixelIndex(id, oct)];
    if (u_tf_aa > 0.5) {
      // Box-filter the hard pixel edges: blend in the neighbouring pixel(s) inside the footprint.
      vec2 s = sign(f - 0.5);
      vec2 wt = clamp(0.5 - (0.5 - abs(f - 0.5)) / max(w, 1e-5), 0.0, 0.5);
      if (wt.x > 0.0) col = mix(col, u_palette[camoPixelIndex(id + vec2(s.x, 0.0), oct)], wt.x);
      if (wt.y > 0.0) {
        vec3 cy = u_palette[camoPixelIndex(id + vec2(0.0, s.y), oct)];
        if (wt.x > 0.0) cy = mix(cy, u_palette[camoPixelIndex(id + s, oct)], wt.x);
        col = mix(col, cy, wt.y);
      }
    }
  }
  if (lod > 0.0) col = mix(col, camoPixelFar(p, oct), lod);
  return col;
}

// ---------------------------------------------------------------- woodland / multi-terrain / tiger
vec3 camoOrganic(vec2 p) {
  bool tiger = u_style == STYLE_TIGER, multi = u_style == STYLE_MULTICAM;
  float st = u_stretch * (tiger ? 3.2 : 1.0);
  vec2 q = p / u_scale;
  q.x /= st;
  float freq = 1.0 / (u_scale * min(st, 1.0));
  // shared domain warp: organic, interlocking shapes (wavy bands for tiger)
  float wo = camoOct(2.0, freq * 0.7);
  vec2 wq = q * 0.7 + camoDrift(0);
  q += (tiger ? vec2(0.15, 0.45) : vec2(0.32)) * vec2(camoFbm(wq + 3.1, wo, 0.5), camoFbm(wq + 9.7, wo, 0.5)) * 0.35;
  float gain = mix(0.3, 0.68, u_roughness);
  float oct = camoOct(2.0 + 4.0 * u_detail, freq);
  int nd = multi ? (camoN >= 5 ? 2 : 1) : 0;    // multi-terrain: sharp small shapes on top of soft blends
  vec3 col = u_palette[0];
  for (int i = 1; i < CAMO_N; i++) {
    if (i >= camoN) break;
    vec2 o = camoOff(i) + camoDrift(i);
    bool small = multi && i >= camoN - nd;
    bool lines = i == camoN - 1 && (tiger || (u_style == STYLE_WOODLAND && camoN >= 4));
    float lf = lines ? 0.85 : tiger ? 1.0 : camoLayerFreq(i);
    // soft multi-terrain blends: fine octaves would show through the wide blend as warp-smeared streaks
    float lo = multi && !small ? min(oct, 2.0 + 0.8 * u_detail) : oct;
    float f = small ? camoFbm(q * vec2(2.2, 1.7) + o, camoOct(2.0 + 4.0 * u_detail, freq * 2.2), gain)
                    : camoFbm(q * lf + o, lo, gain);
    if (tiger) {
      // dry-brush streaks along the stripes
      float bo = camoOct(2.0, freq * 9.0);
      f = (f + 0.55 * u_roughness * camoFbm(vec2(q.x * 2.0, q.y * 9.0) + o * 3.0, bo, 0.5)) * inversesqrt(1.0 + 0.3 * u_roughness * u_roughness);
    }
    float k;
    if (lines) {
      // thin branches / brush strokes along the zero-crossings of the field
      // width varies along the line and drops to zero in places, so strokes taper and break up
      float wv = camoFbm(q * 1.1 + o * 1.3, 2.0, 0.5);
      float tw = camoProbit(0.5 + 0.5 * camoCov[i]) * smoothstep(-0.7, -0.05, wv) * (1.15 + 0.45 * wv);
      k = 1.0 - pg_aastep(tw, abs(f));
      if (u_tf_aa > 0.5) k *= clamp(2.0 * tw / max(fwidth(f), 1e-6), 0.0, 1.0);   // sub-pixel strokes fade out
    } else if (multi && !small) {
      float s = 0.1 + 1.1 * u_soft;
      k = smoothstep(camoThr[i] - s, camoThr[i] + s, f);
    } else {
      k = pg_aastep(camoThr[i], f);
    }
    col = mix(col, u_palette[i], k);
  }
  return col;
}

// ---------------------------------------------------------------- splinter (Splittertarn)
// One layer of angular shards: Voronoi cells switched on at random; shared edges are straight lines.
// A maps pattern space to cell space. Returns coverage.
float camoShards(vec2 p, mat2 A, vec2 off, float cov, float salt) {
  vec2 x = A * p + off;
  vec2 i = floor(x), f = x - i;
  float jit = 0.55 + 0.45 * u_roughness;
  float d1 = 1e9, d2 = 1e9;
  vec2 p1 = vec2(0.0), p2 = vec2(0.0), id1 = vec2(0.0), id2 = vec2(0.0);
  for (int y = -1; y <= 1; y++)
  for (int xx = -1; xx <= 1; xx++) {
    vec2 g = vec2(float(xx), float(y));
    vec2 c = g + 0.5 + (pg_hash22(i + g + vec2(salt, 0.0)) - 0.5) * jit;
    vec2 r = c - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; p2 = p1; id2 = id1; d1 = d; p1 = c; id1 = i + g; }
    else if (d < d2) { d2 = d; p2 = c; id2 = i + g; }
  }
  bool on1 = pg_hash12(id1 + vec2(0.0, salt)) < cov;
  bool on2 = pg_hash12(id2 + vec2(0.0, salt)) < cov;
  if (on1 == on2) return on1 ? 1.0 : 0.0;
  vec2 n = normalize(p2 - p1);
  float e = dot(f - 0.5 * (p1 + p2), n) / length(transpose(A) * n);   // signed distance to the edge, pattern units
  return pg_fill(on1 ? e : -e);
}

// Splittertarn "rain": short vertical dashes on regular columns.
float camoRain(vec2 p) {
  float sx = u_scale * 0.06, sy = u_scale * 0.2;
  float cx = floor(p.x / sx);
  float lx = (fract(p.x / sx) - 0.5) * sx;
  float py = p.y + pg_hash11(cx) * sy;
  float cy = floor(py / sy), ly = py - cy * sy;
  vec3 h = pg_hash32(vec2(cx, cy) + vec2(913.0, -71.0));
  float len = sy * (0.3 + 0.55 * h.x);
  float y0 = (sy - len) * h.y;
  float d = max(abs(lx) - sx * 0.11, max(y0 - ly, ly - y0 - len));
  float on = step(h.z, u_rain);
  float far = smoothstep(0.08, 0.3, pg_px / sx);
  return on * mix(pg_fill(d), 0.22 * 0.58, far);
}

vec3 camoSplinter(vec2 p) {
  vec3 col = u_palette[0];
  vec2 q = p / u_scale;
  for (int i = 1; i < CAMO_N; i++) {
    if (i >= camoN) break;
    float a = 0.55 + 0.42 * sin(float(i) * 2.1) + (pg_hash11(float(i) + 0.5) - 0.5) * 0.3;
    mat2 A = mat2(1.0 / (2.2 * u_stretch), 0.0, 0.0, 1.0) * pg_rot(a) * (2.3 / u_scale);
    vec2 off = camoOff(i) + camoDrift(i) * 4.0;
    col = mix(col, u_palette[i], camoShards(p, A, off, camoCov[i], float(i) * 17.0));
  }
  if (u_rain > 0.0 && camoN >= 2) col = mix(col, u_palette[camoN - 1], camoRain(p));
  return col;
}

// ---------------------------------------------------------------- flecktarn
// One layer of irregular flecks; dots grow inside clusters of a low-frequency mask.
float camoFlecks(vec2 p, int i, vec2 q, float oct) {
  vec2 o = camoOff(i);
  float m = camoFbm(q * 0.85 + o + camoDrift(i), oct, 0.5);
  const float fill = 0.5;                                   // dot coverage inside a cluster
  float t = camoProbit(1.0 - min(camoCov[i] / fill, 0.97));
  float grow = smoothstep(t - 0.3, t + 0.25, m);
  if (grow <= 0.0) return 0.0;                              // outside every cluster
  vec2 x = p / u_fleck + o * 0.37;
  vec2 ci = floor(x), cf = x - ci;
  float dmin = 1e9;
  for (int y = -1; y <= 1; y++)
  for (int xx = -1; xx <= 1; xx++) {
    vec2 g = vec2(float(xx), float(y));
    vec3 h = pg_hash32(ci + g + vec2(float(i) * 57.0, 0.0));
    vec2 r = cf - (g + 0.5 + (h.xy - 0.5) * 0.85);
    float rad = mix(0.44, 0.18 + 0.55 * h.z, u_detail) * grow;
    float ang = atan(r.y, r.x);
    rad *= 1.0 + 0.32 * u_roughness * sin(2.0 * ang + h.x * 6.283) * sin(3.0 * ang + h.y * 6.283);
    dmin = min(dmin, length(r) - rad);
  }
  float far = smoothstep(0.12, 0.4, pg_px / u_fleck);
  return mix(pg_fill(dmin * u_fleck), grow * fill, far);
}

vec3 camoFleck(vec2 p) {
  vec2 q = p / u_scale;
  q.x /= u_stretch;
  float oct = camoOct(1.0 + 3.0 * u_detail, 1.0 / (u_scale * min(u_stretch, 1.0)));
  vec3 col = u_palette[0];
  for (int i = 1; i < CAMO_N; i++) {
    if (i >= camoN) break;
    col = mix(col, u_palette[i], camoFlecks(p, i, q, oct));
  }
  return col;
}

vec4 pattern(vec2 p) {
  camoSetup();
  vec3 col;
  if (u_style == STYLE_DIGITAL) col = camoDigital(p);
  else if (u_style == STYLE_SPLINTER) col = camoSplinter(p);
  else if (u_style == STYLE_FLECKTARN) col = camoFleck(p);
  else col = camoOrganic(p);
  // far away (horizon) the shapes are smaller than a pixel: settle on the average colour instead of shimmering
  float far = smoothstep(0.05, 0.22, pg_px / u_scale);
  return vec4(mix(col, camoMean(), far), 1.0);
}
`,
  });
})();
