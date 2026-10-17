/* Pattern Generator — shared GLSL.
 *   PG.glsl.common      helpers shared by both passes (hash, colour, bayer, hex grid, SDFs)
 *   PG.glsl.patternLib  helpers for pattern code (noise, fbm, voronoi, gradients, anti-aliasing)
 *   PG.glsl.patternMain screen → pattern-space mapping (perspective, warp, symmetry) + supersampling loop
 *   PG.glsl.postMain    pixelate / colour / quantize / dither / effects pass
 * Names starting with pg_ / PG_ / u_ / TF_ / FX_ are reserved for the engine. */
(function () {
  'use strict';
  const PG = window.PG;
  PG.glsl = {};
  // size limits of the glitch's card effects, shared by the post shader and PG.glsl.glitchReach()
  const G = { SMEAR_STEPS: 8, SMEAR_V: 28, SORT_L: 560, JPEG_SHIFT: 8 };

  PG.glsl.common = /* glsl */ `
#define PG_PI 3.14159265358979
#define PG_TAU 6.28318530717959

mat2 pg_rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// ---- seeded hashes (PCG3D). Inputs can be any floats; integers (cell ids) are typical.
uvec3 pg_pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
uvec3 pg_hashBits(vec2 p) {
  return pg_pcg3d(uvec3(floatBitsToUint(p.x), floatBitsToUint(p.y), uint(u_seed) * 747796405u + 2891336453u));
}
float pg_hash12(vec2 p) { return float(pg_hashBits(p).x) * (1.0 / 4294967296.0); }
vec2  pg_hash22(vec2 p) { return vec2(pg_hashBits(p).xy) * (1.0 / 4294967296.0); }
vec3  pg_hash32(vec2 p) { return vec3(pg_hashBits(p)) * (1.0 / 4294967296.0); }
float pg_hash11(float x) { return pg_hash12(vec2(x, 0.3713)); }

// ---- colour
float pg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 pg_hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 pg_rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}

// ---- ordered dither thresholds in [0,1)
float pg_bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float pg_bayer4(vec2 a) { return pg_bayer2(0.5 * a) * 0.25 + pg_bayer2(a); }
float pg_bayer8(vec2 a) { return pg_bayer4(0.5 * a) * 0.25 + pg_bayer2(a); }

// ---- pointy-top hex lattice, neighbouring centres 1 apart. Returns (offset from centre .xy, cell id .zw)
vec4 pg_hexGrid(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 0.8660254)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 0.5);
}

// ---- signed distance functions (negative inside)
float pg_sdCircle(vec2 p, float r) { return length(p) - r; }
float pg_sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float pg_sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float pg_sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
// flat-top hexagon with inradius r (use p.yx for pointy-top)
float pg_sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}
`;

  PG.glsl.patternLib = /* glsl */ `
// Size of one *sample* in pattern units (one output pixel / supersampling factor; accounts for zoom, perspective, warp).
// Note fwidth()/dFdx() measure a whole output pixel, i.e. roughly pg_px * pg_ss.
float pg_px = 0.001;
// Supersampling factor per axis (1–4).
float pg_ss = 1.0;
// Perspective depth of the current sample: 1.0 at screen centre, grows towards the horizon.
float pg_depth = 1.0;
// Screen position of the current sample, 0..1.
vec2 pg_screen = vec2(0.5);

// ---- gradients (gradient params are 256×1 textures)
vec3 pg_grad(sampler2D g, float t) { return texture(g, vec2(clamp(t, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb; }
vec3 pg_gradWrap(sampler2D g, float t) { return pg_grad(g, fract(t)); }

int pg_wrapi(int i, int n) { n = max(n, 1); return ((i % n) + n) % n; }

// ---- anti-aliasing (respect the global "Smooth edges" toggle)
// step(edge, x) with a 1px soft edge. x should vary continuously across the screen.
float pg_aastep(float edge, float x) {
  if (u_tf_aa < 0.5) return step(edge, x);
  float w = max(0.5 * fwidth(x), 1e-7);
  return smoothstep(edge - w, edge + w, x);
}
// Coverage of a signed distance d (pattern units, negative = inside).
float pg_fill(float d) {
  if (u_tf_aa < 0.5) return step(d, 0.0);
  return clamp(0.5 - d / max(pg_px, 1e-7), 0.0, 1.0);
}
// Coverage of a line of half-width w around the zero of d.
float pg_stroke(float d, float w) { return pg_fill(abs(d) - w); }
// Like pg_stroke but energy-conserving for lines thinner than a pixel: they get fainter instead of
// turning solid, so dense line art (guilloché, contours, hatching) keeps its tone when far away.
float pg_line(float d, float w) {
  if (u_tf_aa < 0.5) return step(abs(d), w);
  float ww = max(w, 0.5 * pg_px);
  return pg_fill(abs(d) - ww) * (w / ww);
}

// ---- noise
vec2 pg_gradDir(vec2 i) { float a = pg_hash12(i) * PG_TAU; return vec2(cos(a), sin(a)); }
// Gradient (Perlin-style) noise, roughly [-1, 1].
float pg_noise(vec2 p) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(pg_gradDir(i), f);
  float b = dot(pg_gradDir(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(pg_gradDir(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(pg_gradDir(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return 1.4142 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Value noise, [0, 1].
float pg_vnoise(vec2 p) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pg_hash12(i), pg_hash12(i + vec2(1.0, 0.0)), u.x),
             mix(pg_hash12(i + vec2(0.0, 1.0)), pg_hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Fractal sum of pg_noise (octaves 1..8), roughly [-1, 1].
float pg_fbm(vec2 p, int octaves) {
  float s = 0.0, a = 0.5, n = 0.0;
  const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    s += a * pg_noise(p); n += a;
    p = m * p + 17.13; a *= 0.5;
  }
  return s / n;
}
// Cellular noise on a jittered grid (jitter 0..1). Returns vec4(F1, F2, cell id .xy).
vec4 pg_voronoi(vec2 p, float jitter) {
  vec2 i = floor(p), f = p - i;
  float f1 = 8.0, f2 = 8.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = pg_hash22(i + g) * jitter + 0.5 * (1.0 - jitter);
    float d = length(g + o - f);
    if (d < f1) { f2 = f1; f1 = d; id = i + g; } else if (d < f2) { f2 = d; }
  }
  return vec4(f1, f2, id);
}
`;

  PG.glsl.patternMain = /* glsl */ `
out vec4 pg_out;

// Screen pixel → point on the (optionally tilted) pattern plane. False when the ray misses the plane (sky).
bool pg_perspective(vec2 fc, out vec2 plane, out float depth) {
  vec2 uv = (fc - 0.5 * u_res) / u_res.y * 2.0;
  float tilt = radians(u_tf_tilt);
  depth = 1.0;
  if (tilt < 1e-4) { plane = uv; return true; }
  float k = tan(radians(u_tf_fov) * 0.5);
  float dir = radians(u_tf_tiltDir);
  vec2 q = pg_rot(-dir) * uv;
  float c = cos(tilt), s = sin(tilt);
  float den = c - s * q.y * k;
  if (den <= 1e-5) { plane = vec2(0.0); depth = 1e9; return false; }
  float t = c / den;
  plane = pg_rot(dir) * vec2(t * q.x, c * t * q.y + s * (t - 1.0) / k);
  depth = t;
  return true;
}

vec2 pg_warp(vec2 v) {
  float A = u_tf_warpAmt, F = u_tf_warpFreq, ph = u_time * u_tf_warpSpeed;
  float r = length(v);
  if (u_tf_warp == TF_WARP_WAVES) {
    return v + A * 0.2 * vec2(sin(v.y * F + ph), sin(v.x * F + ph * 1.31));
  } else if (u_tf_warp == TF_WARP_NOISE) {
    vec2 q = v * F * 0.35;
    return v + A * 0.35 * vec2(pg_fbm(q + vec2(ph * 0.15, 0.0), 4), pg_fbm(q + vec2(31.7, -ph * 0.15), 4));
  } else if (u_tf_warp == TF_WARP_SWIRL) {
    return pg_rot(A * 4.0 * exp(-r * F * 0.35) + ph * 0.3) * v;
  } else if (u_tf_warp == TF_WARP_RIPPLE) {
    return v + (r > 1e-5 ? v / r : vec2(0.0)) * A * 0.08 * sin(r * F * 4.0 - ph * 3.0);
  } else if (u_tf_warp == TF_WARP_TWIST) {
    return pg_rot(A * r * F * 0.5 + ph * 0.3) * v;
  } else if (u_tf_warp == TF_WARP_BULGE) {
    // softened at the centre so magnification stays finite (no pinch point on line patterns)
    float rs = sqrt(r * r + 0.02 * 16.0 / (F * F));
    return v * pow(rs, A * 0.8);
  } else if (u_tf_warp == TF_WARP_ZIGZAG) {
    float tri = abs(fract(v.y * F / PG_TAU + ph * 0.05) * 2.0 - 1.0) * 2.0 - 1.0;
    return v + vec2(A * 0.2 * tri, 0.0);
  } else if (u_tf_warp == TF_WARP_POLAR) {
    float a = atan(v.y, v.x);
    vec2 pol = vec2(a / PG_PI * F * 0.5, -log(max(r, 1e-5)) * F * 0.5 / PG_PI + ph * 0.1);
    return mix(v, pol, clamp(A, 0.0, 1.0));
  }
  return v;
}

vec2 pg_symmetry(vec2 v) {
  if (u_tf_symmetry == TF_SYMMETRY_MIRRORX) v.x = abs(v.x);
  else if (u_tf_symmetry == TF_SYMMETRY_MIRRORY) v.y = abs(v.y);
  else if (u_tf_symmetry == TF_SYMMETRY_QUAD) v = abs(v);
  else if (u_tf_symmetry == TF_SYMMETRY_KALEIDO) {
    float n = max(u_tf_segments, 2.0);
    float seg = PG_TAU / n;
    float a = mod(atan(v.y, v.x) + PG_PI * 0.5, seg);
    a = abs(a - seg * 0.5);
    v = length(v) * vec2(sin(a), cos(a));
  }
  return v;
}

// Full screen → pattern mapping. full=false skips the non-continuous steps (symmetry fold, snapping),
// which is what we want when measuring the pixel footprint.
bool pg_map(vec2 fc, bool full, out vec2 p, out float depth) {
  vec2 plane;
  bool ok = pg_perspective(fc, plane, depth);
  vec2 v = pg_rot(-radians(u_tf_rotate)) * plane / u_tf_zoom;
  if (u_tf_warp != TF_WARP_NONE) v = pg_warp(v);
  if (full) v = pg_symmetry(v);
  p = v + vec2(u_tf_panX, u_tf_panY);
  if (full && u_tf_snap > 0.0) p = (floor(p / u_tf_snap) + 0.5) * u_tf_snap;
  return ok;
}

void main() {
  vec2 fc0 = gl_FragCoord.xy + u_fcOffset; // full-image pixel coords (tiles render sub-rectangles)
  int ss = max(u_ss, 1);
  vec2 a, b, c; float d0, d1, d2;
  pg_map(fc0, false, a, d0);
  pg_map(fc0 + vec2(1.0, 0.0), false, b, d1);
  pg_map(fc0 + vec2(0.0, 1.0), false, c, d2);
  pg_ss = float(ss);
  pg_px = clamp(max(length(b - a), length(c - a)), 1e-7, 1e4) / pg_ss;

  vec4 acc = vec4(0.0);
  for (int j = 0; j < ss; j++) {
    for (int i = 0; i < ss; i++) {
      vec2 o = (vec2(float(i), float(j)) + 0.5) / float(ss) - 0.5;
      vec2 fc = fc0 + o;
      vec2 p; float depth;
      vec4 col;
      pg_screen = fc / u_res;
      bool hit = pg_map(fc, true, p, depth);
      pg_depth = hit ? depth : 1e4;
      // always evaluate pattern() so derivatives (fwidth) stay in uniform control flow
      col = pattern(p);
      if (hit) {
        if (u_tf_fog > 0.0) {
          float f = clamp(1.0 - exp(-u_tf_fog * max(depth - 1.0, 0.0) * 0.35), 0.0, 1.0);
          col = mix(col, vec4(u_tf_fogColor, 1.0), f);
        }
      } else {
        col = vec4(u_tf_fogColor, 1.0);
      }
      acc += clamp(col, 0.0, 1.0);
    }
  }
  pg_out = acc / float(ss * ss);
}
`;

  PG.glsl.postMain = /* glsl */ `
out vec4 pg_out;

float fx_blockSize() { return max(1.0, u_fx_pxSize * u_pxScale); }

// u_src covers full-image pixels [u_srcOffset, u_srcOffset + u_srcSize]
// (clamped to the image like CLAMP_TO_EDGE, so tiled and single-pass renders match exactly)
bool fx_snap = false; // glitch path: sample on a 1/256 px grid (see fx_glitchSample)
vec4 fx_src(vec2 fc) {
  fc = clamp(fc, vec2(0.5), u_res - 0.5);
  if (fx_snap) fc = floor(fc * 256.0 + 0.5) * (1.0 / 256.0);
  return texture(u_src, (fc - u_srcOffset) / u_srcSize);
}

// Pixel-block geometry. Returns the block centre (render px); local = position in block units (-0.5..0.5); id = block index.
vec2 fx_block(vec2 fc, out vec2 local, out vec2 id) {
  if (u_fx_pixelate < 0.5) { local = vec2(0.0); id = floor(fc / max(u_pxScale, 1e-3)); return fc; }
  float B = fx_blockSize();
  vec2 o = 0.5 * u_res;
  vec2 q = (fc - o) / B;
  if (u_fx_pxShape == FX_PXSHAPE_HEX) {
    vec4 h = pg_hexGrid(q);
    local = h.xy; id = h.zw;
    return o + (q - h.xy) * B;
  }
  id = floor(q);
  local = q - id - 0.5;
  return o + (id + 0.5) * B;
}

vec4 fx_sample(vec2 fc) {
  vec2 local, id;
  vec2 c = fx_block(fc, local, id);
  if (u_fx_pixelate > 0.5 && u_fx_pxSample == FX_PXSAMPLE_AVERAGE) {
    float B = fx_blockSize();
    vec4 acc = vec4(0.0);
    for (int j = 0; j < 4; j++)
      for (int i = 0; i < 4; i++)
        acc += fx_src(c + (vec2(float(i), float(j)) - 1.5) * 0.25 * B * 0.9);
    return acc / 16.0;
  }
  return fx_src(c);
}

float fx_mask(vec2 local) {
  if (u_fx_pixelate < 0.5) return 1.0;
  float B = fx_blockSize();
  float g = u_fx_pxGap;
  float r = 0.5 * (1.0 - g);
  float d;
  if (u_fx_pxShape == FX_PXSHAPE_SQUARE) {
    if (g <= 0.0) return 1.0;
    vec2 a = abs(local); d = max(a.x, a.y) - r;
  } else if (u_fx_pxShape == FX_PXSHAPE_ROUND) {
    d = length(local) - r;
  } else if (u_fx_pxShape == FX_PXSHAPE_ROUNDED) {
    d = pg_sdRoundBox(local, vec2(r), r * 0.45);
  } else if (u_fx_pxShape == FX_PXSHAPE_DIAMOND) {
    d = (abs(local.x) + abs(local.y) - r) * 0.7071;
  } else {
    if (g <= 0.0) return 1.0;
    d = pg_sdHex(local.yx, r);
  }
  return clamp(0.5 - d * B, 0.0, 1.0);
}

vec3 fx_adjust(vec3 c) {
  if (u_fx_hue != 0.0) { vec3 h = pg_rgb2hsv(c); h.x = fract(h.x + u_fx_hue / 360.0); c = pg_hsv2rgb(h); }
  c = mix(vec3(pg_luma(c)), c, u_fx_saturation);
  c = (c - 0.5) * u_fx_contrast + 0.5 + u_fx_brightness;
  c = clamp(c, 0.0, 1.0);
  if (u_fx_invert > 0.5) c = 1.0 - c;
  if (u_fx_gradMap > 0.5) {
    vec3 g = texture(u_fx_gradMapGrad, vec2(pg_luma(c) * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb;
    c = mix(c, g, u_fx_gradMapMix);
  }
  return c;
}

float fx_threshold(vec2 id) {
  if (u_fx_dither == FX_DITHER_BAYER2) return pg_bayer2(id);
  if (u_fx_dither == FX_DITHER_BAYER4) return pg_bayer4(id);
  if (u_fx_dither == FX_DITHER_BAYER8) return pg_bayer8(id);
  if (u_fx_dither == FX_DITHER_NOISE) return fract(52.9829189 * fract(dot(id, vec2(0.06711056, 0.00583715))));
  return 0.5;
}

vec3 fx_quantize(vec3 c, vec2 id) {
  if (u_fx_quantize == FX_QUANTIZE_OFF) return c;
  float t = u_fx_dither == FX_DITHER_NONE ? 0.5 : mix(0.5, fx_threshold(id), u_fx_ditherAmt);
  if (u_fx_quantize == FX_QUANTIZE_POSTERIZE) {
    float L = max(u_fx_levels - 1.0, 1.0);
    return clamp(floor(c * L + t) / L, 0.0, 1.0);
  }
  vec3 cc = c + (t - 0.5) * 0.45;
  int n = clamp(u_fx_qPalette_count, 1, 16);
  float best = 1e9; vec3 bc = u_fx_qPalette[0];
  for (int i = 0; i < 16; i++) {
    if (i >= n) break;
    vec3 d = cc - u_fx_qPalette[i];
    float e = dot(d * d, vec3(0.30, 0.59, 0.11));
    if (e < best) { best = e; bc = u_fx_qPalette[i]; }
  }
  return bc;
}

// ---- glitch. A displacement of the sample position (applied before pixelate, so pixel blocks inherit it) plus
// colour damage. Deterministic in (full-image px, seed, glitch frame = floor(time × rate)); every size is in preview
// px × u_pxScale × u_glitchFit (the engine lowers u_glitchFit below 1 only when a giant export can't carry the reach).
// PG.glsl.glitchReach() bounds the displacement for tiled exports — keep the two in sync.

// Cheap seeded hash of an integer-valued cell id + salted frame number → 3 × [0,1) (11 + 11 + 10 bits)
vec3 fx_gh(vec2 a, float k) {
  uint h = uint(int(a.x)) * 0x9E3779B1u + uint(int(a.y)) * 0x85EBCA77u + uint(int(k)) * 0xC2B2AE3Du + uint(u_seed) * 0x27D4EB2Fu;
  h ^= h >> 16; h *= 0x7FEB352Du; h ^= h >> 15; h *= 0x846CA68Bu; h ^= h >> 16;
  return vec3(float(h >> 21), float((h >> 10) & 2047u), float(h & 1023u)) * vec3(1.0 / 2048.0, 1.0 / 2048.0, 1.0 / 1024.0);
}

// Set by fx_glitch() for the card effects below: glitch frame, size scale (render px per preview px), and fx_gZ, which
// is always 0 but unknown to the compiler: added to the bounds of the bigger card-effect loops so they aren't unrolled.
// Fully unrolled, the post shader grew past a size at which the GPU compiler (Apple / Metal) built the unrelated colour
// code (hue shift) differently — ±1 level changes even with glitch = 0. Keep new card-effect loops rolled the same way.
float fx_gF = 0.0, fx_gS = 1.0;
int fx_gZ = 0;

// One tearing layer: bands of height H (px); a band is hit with probability p and jumps up to ±maxShift px.
float fx_gTear(float Y, float H, float phase, float p, float maxShift, float salt, float F) {
  float row = floor(Y / H + phase);
  vec3 r = fx_gh(vec2(row, salt), F);
  return r.x < p ? sign(r.y - 0.5) * maxShift * (0.1 + 0.9 * r.z) : 0.0;
}

// Returns the displacement (render px, y up). gi.x = R/B channel offset (px), gi.y = block colour damage
// (integer part = kind 1..5, fraction = variant), gi.z = white noise mix, gi.w = VHS band strength.
// blank = 1 when a torn line was pulled in from beyond the picture edge (shows the black of the blanking interval).
vec2 fx_glitch(vec2 fc, out vec4 gi, out float blank) {
  gi = vec4(0.0);
  vec2 d = vec2(0.0);
  float ls = 0.0;                                  // horizontal line shift (tearing, VHS); d = block damage
  float g = u_fx_glitch;
  float S = max(u_pxScale * u_glitchFit, 1e-3);
  // glitch frame; wraps after 65536 frames so F × 16 + salt stays exact in a float (long animations / videos)
  float F = mod(floor(u_time * max(u_fx_glitchRate, 0.0)), 65536.0);
  float X = fc.x, Y = u_res.y - fc.y;            // raster coordinates: y runs down from the top edge, like video
  vec3 fr = fx_gh(vec2(1.0, 2.0), F * 16.0);     // per-frame randoms
  // per-frame energy: animated glitches come in bursts (frame 0 = a still image is always fully glitched)
  float e = F == 0.0 ? 1.0 : (fr.x < 0.3 * (1.0 - g) ? 0.15 : 0.55 + 0.45 * fr.y);
  fx_gF = F; fx_gS = S; fx_gZ = int(min(u_seed, 0.0));   // u_seed >= 0

  // horizontal slice tearing at three scales (coarse bands hold for two frames)
  if (u_fx_glitchSlices > 0.0) {
    float k = u_fx_glitchSlices * g;
    float p = k * e;
    float amp = (0.4 + 0.6 * k) * S;
    float F2 = floor(F * 0.5) * 16.0;
    vec3 ph = fx_gh(vec2(3.0, 4.0), F2 + 1.0);      // band phases
    ls += fx_gTear(Y, 72.0 * S, ph.x, p * 0.45, 150.0 * amp, 1.0, F2 + 2.0);
    ls += fx_gTear(Y, 21.0 * S, ph.y, p * 0.35, 70.0 * amp, 2.0, F * 16.0 + 2.0);
    ls += fx_gTear(Y, 5.0 * S, ph.z, p * 0.3, 26.0 * amp, 3.0, F * 16.0 + 2.0);
  }

  // macroblock damage (datamosh): runs of broken blocks along a block row (an error garbles the rest of the slice)
  // plus a few scattered single and double blocks. Runs and double blocks hold for two frames.
  if (u_fx_glitchBlocks > 0.0) {
    float k = u_fx_glitchBlocks * g * e;
    float B = max(u_fx_glitchBlock * S, 2.0);
    float F2 = floor(F * 0.5) * 16.0;
    vec2 q = vec2(X, Y) / B;
    vec2 id = floor(q);
    vec3 rr = fx_gh(vec2(id.y, 5.0), F2 + 3.0);
    float cols = ceil(u_res.x / B);
    float start = floor(rr.y * cols);
    bool run = rr.x < k * 0.3 && id.x >= start && id.x < start + 1.0 + floor(rr.z * rr.z * cols * 0.6);
    vec3 rb = fx_gh(id, F * 16.0 + 4.0);
    vec2 id2 = floor(q * 0.5);
    vec3 r2 = fx_gh(id2, F2 + 5.0);
    bool big = r2.x < k * 0.03;
    if (run || big || rb.x < k * 0.03) {
      float Bs = big ? 2.0 * B : B;
      vec2 loc = vec2(X, Y) - (big ? id2 : id) * Bs;          // position inside the block (raster, 0..Bs)
      vec3 rv = big ? r2 : rb;                                // .y = kind of damage, .z = colour damage
      vec3 rm = fx_gh(run ? vec2(start, id.y) : (big ? id2 : id), (run || big ? F2 : F * 16.0) + (run ? 6.0 : big ? 11.0 : 12.0));
      float v = rv.y;
      if (v < 0.4) {
        // motion vector: show a block up to 3 across / 1 up or down (shared along a run)
        d += vec2(floor(rm.x * 7.0) - 3.0, 1.0 - floor(rm.y * 3.0)) * B;
      } else if (v < 0.6) {
        d += vec2(-loc.x, loc.y) * (0.45 + 0.3 * rm.y);       // stretched: a corner of the block blown up
      } else if (v < 0.75) {
        d.y += loc.y - 0.5;                                   // smear the top row down the block
      } else if (v < 0.85) {
        d.x += 0.5 - loc.x;                                   // smear the left column across
      } else {
        d += vec2(0.5 * Bs - loc.x, loc.y - 0.5 * Bs);        // flat block (only the DC term survived)
      }
      float c = run ? rm.z : rv.z;
      if (c < 0.45) {
        float u = fract(c * 7.31);
        gi.y = (u < 0.35 ? 1.0 : u < 0.6 ? 2.0 : u < 0.7 ? 3.0 : u < 0.85 ? 4.0 : 5.0) + 0.99 * fract(c * 53.7);
      }
    }
  }

  // R/B channel split in random bands
  if (u_fx_glitchRGB > 0.0) {
    float k = u_fx_glitchRGB * g;
    vec3 r = fx_gh(vec2(floor(Y / (30.0 * S) + fr.z), 7.0), F * 16.0 + 7.0);
    if (r.x < k * e * 0.4) gi.x = floor(sign(r.y - 0.5) * (4.0 + 26.0 * r.z) * (0.4 + 0.6 * k) * S + 0.5);
  }

  // VHS: line jitter, a tracking band rolling down the screen, head-switching noise at the bottom, dropouts
  if (u_fx_glitchNoise > 0.0) {
    float k = u_fx_glitchNoise * g;
    float line = floor(Y / S);
    vec3 rl = fx_gh(vec2(line, 9.0), F * 16.0 + 8.0);
    ls += (rl.x - 0.5) * 5.0 * k * S;                  // time-base jitter: every line wobbles a little (±2.5 px at full)
    float bh = (26.0 + 70.0 * k) * S;
    float roll = fract(u_seed * 0.618034 + 0.3 + u_time * max(u_fx_glitchRate, 0.0) * 0.012);
    float t = clamp(1.0 - abs(Y - (roll * (u_res.y + 2.0 * bh) - bh)) / (0.5 * bh), 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    float hs = clamp(1.0 - (u_res.y - Y) / (9.0 * S), 0.0, 1.0);
    float w = max(t, hs);
    if (w > 0.0) {
      ls += ((rl.y - 0.5) * 44.0 * w + 14.0 * t + 40.0 * hs * hs) * k * S;
      float len = (3.0 + 30.0 * rl.z) * S;
      vec3 rs = fx_gh(vec2(floor(X / len + rl.z), line), F * 16.0 + 9.0);
      // streak density: thins out at low amounts so a light touch of VHS noise stays light
      gi.z = step(1.0 - w * (0.12 * min(1.0, k / 0.15) + 0.4 * k), rs.x) * (0.55 + 0.45 * rs.y);
      gi.w = w * k;
    }
    if (rl.x < k * 0.01) {                              // dropout: a short white streak along one line, fading out
      float x0 = rl.y * u_res.x;
      float u = (X - x0) / ((0.02 + 0.16 * rl.z * rl.z) * u_res.x);
      if (u >= 0.0 && u < 1.0) gi.z = max(gi.z, 0.95 * (1.0 - 0.75 * u));
    }
  }
  d.x = clamp(d.x + ls, -240.0 * S, 240.0 * S);
  d = floor(d + 0.5);      // whole pixels: crisp torn edges, and tiled exports sample exactly like single-pass ones
  float sx = fc.x + d.x;
  blank = abs(ls) >= 0.5 && (sx < 0.0 || sx > u_res.x) ? 1.0 : 0.0;
  return d;
}

vec3 fx_glitchColor(vec3 c, vec4 gi) {
  if (gi.y >= 1.0) {
    float m = floor(gi.y), r = fract(gi.y);
    if (m < 2.0) {         // chroma DC lost: Cb = Cr = 0 → the classic saturated green block, Cb = Cr = max → magenta
      float l = pg_luma(c);
      float s = (r < 0.5 ? -1.0 : 1.0) * (0.22 + 0.28 * fract(r * 2.0));
      c = vec3(l) + (c - l) * 0.2 + vec3(1.402, -1.058, 1.772) * s;
    } else if (m < 3.0) {  // channels swapped
      c = r < 0.5 ? c.brg : c.gbr;
    } else if (m < 4.0) {  // inverted
      c = 1.0 - c;
    } else if (m < 5.0) {  // 1 bit per channel
      c = step(vec3(0.35 + 0.3 * r), c);
    } else {               // overflowed
      c = fract(c * (1.6 + 2.0 * r) + 0.1);
    }
  }
  if (gi.w > 0.0) c = mix(c, vec3(pg_luma(c)), 0.5 * gi.w) * (1.0 + 0.2 * gi.w) + 0.05 * gi.w;
  return mix(c, vec3(0.93, 0.94, 0.96), gi.z);
}

// ---- the Glitch card's effects (js/patterns/glitch.js), run on the rendered picture: datamosh smear, pixel sort,
// broken JPEG, VHS bleed, interlace, bit crush. Each is off at 0 and skipped entirely. Sizes are preview px × fx_gS;
// displacements are whole render px. Reach bounds live in PG.glsl.glitchReach() — keep the two in sync.
const float FX_GOP = ${G.SMEAR_STEPS}.0;       // datamosh: frames per GOP = longest motion chain
const float FX_MV = ${G.SMEAR_V}.0;            // datamosh: largest motion vector per frame (preview px, per axis)
const float FX_SORTL = ${G.SORT_L}.0;          // pixel sort: longest interval (preview px, before ±32 % variation)
const float FX_JSHIFT = ${G.JPEG_SHIFT}.0;     // broken JPEG: largest bitstream shift (8×8 blocks)

vec3 fx_yuv(vec3 c) {
  return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(-0.14713, -0.28886, 0.436)), dot(c, vec3(0.615, -0.51499, -0.10001)));
}
vec3 fx_rgb(vec3 y) { return vec3(y.x + 1.13983 * y.z, y.x - 0.39465 * y.y - 0.5806 * y.z, y.x + 2.03211 * y.y); }
// burst energy of glitch frame F, as in fx_glitch() (frame 0 = a still: always 1)
float fx_gEnergy(float F) {
  vec3 fr = fx_gh(vec2(1.0, 2.0), F * 16.0);
  return F == 0.0 ? 1.0 : (fr.x < 0.3 * (1.0 - u_fx_glitch) ? 0.15 : 0.55 + 0.45 * fr.y);
}
// smooth value noise in [0,1] on the integer lattice
float fx_vn(vec2 p, float k) {
  vec2 i = floor(p), f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fx_gh(i, k).x, fx_gh(i + vec2(1.0, 0.0), k).x, f.x), mix(fx_gh(i + vec2(0.0, 1.0), k).x, fx_gh(i + vec2(1.0, 1.0), k).x, f.x), f.y);
}
// raster (y down) ↔ render px (y up)
vec2 fx_ras(vec2 p) { return vec2(p.x, u_res.y - p.y); }

// state handed from fx_glitchMove() to fx_glitchDamage()
vec2 fx_gJid = vec2(0.0), fx_gJl = vec2(0.0);   // JPEG: decoded 8×8 block, position in it (render px, raster)
vec3 fx_gJD = vec3(0.0), fx_gJunk = vec3(-1.0); // JPEG: accumulated DC error (YUV), garbage block hash (x < 0: none)
float fx_gJGrey = 0.0;                          // JPEG: truncated file → mid grey
vec2 fx_gMd = vec2(0.0);                        // datamosh displacement (raster px)
vec3 fx_gTint = vec3(0.0);                      // datamosh residue on the wrong picture
vec2 fx_gPan = vec2(0.0);                       // datamosh camera pan of this GOP

// smooth value noise, three channels at once
vec3 fx_vn3(vec2 p, float k) {
  vec2 i = floor(p), f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fx_gh(i, k), fx_gh(i + vec2(1.0, 0.0), k), f.x), mix(fx_gh(i + vec2(0.0, 1.0), k), fx_gh(i + vec2(1.0, 1.0), k), f.x), f.y);
}
// datamosh field of macroblock b in this GOP: .xy = motion vector (whole px per frame: smooth field + GOP pan + the odd
// corrupt vector), .z < 0 = the block is moshed (predicted), else intra-coded
vec3 fx_gMosh(vec2 b, float gop, float B, float cov) {
  float S = fx_gS;
  vec3 n = fx_vn3((b + 0.5) * B / (240.0 * S), gop * 16.0 + 1.0);
  vec2 v = (n.xy - 0.5) * 48.0 * S + fx_gPan;
  vec3 h = fx_gh(b, gop * 16.0 + 3.0);
  if (h.x < 0.07) v = (h.yz - 0.5) * B * 3.0;
  float m = floor(FX_MV * S);
  return vec3(clamp(floor(v + 0.5), -m, m), n.z - cov);
}

// Extra displacement of the sample point sc (render px): VHS line wobble, interlace combing, JPEG bitstream shift,
// datamosh motion chain. VHS lines that wobble off the picture show the blanking black, like fx_glitch(); the others
// read the clamped picture edge.
vec2 fx_glitchMove(vec2 sc, inout float blank) {
  float g = u_fx_glitch, S = fx_gS, F = fx_gF;
  vec2 R = fx_ras(sc);
  vec2 R0 = R;
  if (u_fx_glitchBleed > 0.0) {
    // VHS time-base wobble: a line pushed past the picture edge shows the blanking black
    float k = u_fx_glitchBleed * g;
    float lx = floor((fx_vn(vec2(R.y / (60.0 * S), F * 0.2), 6.0) - 0.5) * 5.0 * k * S + 0.5);
    if (lx != 0.0) {
      R.x += lx;
      if (R.x < 0.0 || R.x > u_res.x) blank = 1.0;
    }
  }
  if (u_fx_glitchInterlace > 0.0) {
    // combing: the other field holds picture all the way to the edge (no blanking comb along the image border)
    float k = u_fx_glitchInterlace * g;
    float odd = mod(floor(R.y / (2.0 * S)), 2.0);
    float comb = fx_vn(vec2(R.y / (110.0 * S), F * 0.15), 5.0);
    R.x += odd * floor(mix(2.0, 26.0, comb) * k * S + 0.5);
  }

  // broken JPEG bitstream, in raster order of 8×8 blocks. At an error point the decoder loses sync: a run of garbage
  // blocks, then everything after it is shifted by whole MCUs and DC-tinted (DC is coded as differences, so the error
  // sticks) — to the end of the file, or only up to the next restart marker. Blocks that would wrap in from the
  // other end of a row decode as garbage.
  if (u_fx_glitchJpeg > 0.0) {
    float aJ = u_fx_glitchJpeg * g * fx_gEnergy(floor(F / 3.0) * 3.0);   // errors hold for 3 frames
    float J = 8.0 * S;
    vec2 jid = floor(R / J);
    fx_gJl = R - jid * J;
    float cols = ceil(u_res.x / J), rows = ceil(u_res.y / J);
    float col = clamp(jid.x, 0.0, cols - 1.0);
    float r = clamp(jid.y, 0.0, rows - 1.0) * cols + col;
    float jf = floor(F / 3.0) * 16.0;
    float shift = 0.0;
    fx_gJD = vec3(0.0);
    fx_gJunk = vec3(-1.0);
    for (int k = 0; k < 3 + fx_gZ; k++) {
      float fk = float(k);
      vec3 h = fx_gh(vec2(fk, 40.0), jf + 13.0);
      vec3 h2 = fx_gh(vec2(fk, 41.0), jf + 13.0);
      float rE = floor(mix(0.06, 1.0, sqrt(h.y)) * cols * rows);
      float mcuRow = 2.0 * cols;                                      // 4:2:0 → one MCU row = 2 block rows
      float rEnd = h2.x < 0.45 ? (floor(rE / mcuRow) + 1.0 + floor(h2.y * 4.0)) * mcuRow : 1e9;
      if (h.x < aJ * 0.6 && r >= rE && r < rEnd) {
        if (r < rE + 1.0 + floor(h2.z * h2.z * cols * 1.5)) fx_gJunk = fx_gh(vec2(r, fk), jf + 14.0);
        shift += 2.0 * floor((h.z - 0.5) * 6.0);
        fx_gJD += (fx_gh(vec2(fk, 42.0), jf + 13.0) - 0.5) * vec3(0.28, 0.42, 0.48) * min(1.0, 0.1 + aJ);
      }
    }
    shift = clamp(shift, -FX_JSHIFT, FX_JSHIFT);
    vec3 ht = fx_gh(vec2(3.0, 43.0), jf + 13.0);
    fx_gJGrey = ht.x < aJ * 0.25 && r >= floor(mix(0.55, 0.97, ht.y) * cols * rows) ? 1.0 : 0.0;
    if (shift != 0.0) {
      float c2 = col - shift;
      if (c2 < 0.0 || c2 >= cols) {
        if (fx_gJunk.x < 0.0) fx_gJunk = fx_gh(vec2(r, 7.0), jf + 14.0);
      } else {
        R.x -= floor(shift * J + 0.5);
        jid.x = c2;
      }
    }
    fx_gJid = jid;
  }

  // datamosh (I-frame removal): inside moshed blobs every macroblock is predicted from the previous frame along its
  // motion vector, frame after frame, from a stale picture. Following that chain back through the GOP (one block lookup
  // per frame) drags the picture along a coherent motion field in block-sized steps; where a chain leaves the blob it
  // picks up the clean picture. The chain grows by one step per glitch frame, so the melt flows while animating.
  fx_gMd = vec2(0.0);
  fx_gTint = vec3(0.0);
  if (u_fx_glitchSmear > 0.0) {
    float a = u_fx_glitchSmear * g;
    float B = max(u_fx_glitchBlock * S, 2.0);
    float gg = F + FX_GOP - 3.0;                       // phased so a still (frame 0) is well into a GOP
    float gop = floor(gg / FX_GOP);
    float age = gg - gop * FX_GOP + 1.0;               // frames since the (missing) I-frame
    vec3 gp = fx_gh(vec2(gop, 44.0), 13.0);
    fx_gPan = step(0.5, gp.z) * (gp.xy - 0.5) * vec2(18.0, 10.0) * S;
    float cov = 0.72 * pow(min(a, 1.0), 0.6);           // moshed share of the picture: starts from none at 0
    vec2 b0 = floor(R / B);
    vec3 mf = fx_gMosh(b0, gop, B, cov);
    if (mf.z < 0.0) {
      vec2 x = R;
      for (int i = 0; i < int(FX_GOP); i++) {
        if (float(i) >= age) break;
        if (i > 0) {
          mf = fx_gMosh(floor(x / B), gop, B, cov);
          if (mf.z >= 0.0) break;                        // that block was intra-coded: the chain ends there
        }
        x -= mf.xy;
      }
      fx_gMd = x - R;
      R = x;
      vec3 bh = fx_gh(b0, gop * 16.0 + 5.0);
      fx_gTint = (vec3(bh.y, fract(bh.y * 7.13), fract(bh.y * 3.71)) - 0.5) * vec3(0.4, 0.3, 0.4) * step(0.992, bh.z) * min(a, 1.0);
    }
  }
  vec2 dR = R - R0;
  return sc + vec2(dR.x, -dR.y);
}

float fx_gLum(vec2 p) { return pg_luma(fx_src(p).rgb); }

// Pixel sort with real threshold intervals: along the sort direction, each run of pixels brighter than the threshold
// (cut at a maximum length) is replaced by its own colours sorted by brightness. The run is located from 10 samples over
// the segment plus a bisection of each end, so all pixels of one run agree on its extent. Returns the sorted colour at
// p (render px); .w = 1 when p lies in a sorted run.
vec4 fx_gSort(vec2 p, float aS, float lum) {
  float thr = u_fx_glitchSortThreshold;
  // a pixel a little darker than the threshold still joins a run found around it: photo grain near the threshold
  // would otherwise leave speckles of unsorted pixels all over the streaks (clearly darker detail still cuts through)
  if (lum < thr - 0.08) return vec4(0.0);
  float S = fx_gS;
  vec2 dir = u_fx_glitchSortDir == FX_GLITCHSORTDIR_HORIZONTAL ? vec2(1.0, 0.0) : vec2(0.0, -1.0);
  float colId = floor(dot(p, vec2(-dir.y, dir.x)));
  float u = dot(p, dir);
  float sf = floor(fx_gF / 4.0);
  vec3 ch = fx_gh(vec2(colId, 50.0), sf * 16.0 + 15.0);
  // interval length and where the cuts fall: smooth across columns (neighbouring columns hold similar pixels, so their
  // sorted runs line up), with a little per-column jitter for ragged ends
  float n1 = fx_vn(vec2(colId * 0.013 / S, sf * 0.53), 51.0) * 2.0 - 1.0;
  float n2 = fx_vn(vec2(colId * 0.006 / S, sf * 0.37), 52.0) * 2.0 - 1.0;
  float L = mix(40.0, FX_SORTL, aS) * S * (1.0 + 0.3 * n1) * mix(0.985, 1.015, ch.x);
  float o = L * (0.5 + 0.7 * n2 + 0.012 * ch.y);
  float seg = floor((u + o) / L);
  if (fx_vn(vec2(colId * 0.03 / S, seg * 7.0 + sf * 3.0), 53.0) > (0.3 + 0.9 * aS) * min(1.0, aS * 10.0)) return vec4(0.0);
  float a0 = seg * L - o;                 // segment start along dir
  float w = u - a0;                       // this pixel's position in the segment
  float h = L / 10.0;
  vec2 base = p + dir * (a0 - u);
  float lu[12];
  uint m = 0u;                            // bit k = sample k is bright
  for (int k = 0; k < 10 + fx_gZ; k++) {
    lu[k] = fx_gLum(base + dir * ((float(k) + 0.5) * h));
    if (lu[k] >= thr) m |= 1u << uint(k);
  }
  int j = int(floor(w / h - 0.5));        // samples j and j + 1 bracket the pixel
  int sd = -1;
  if (j >= 0 && ((m >> uint(j)) & 1u) != 0u) sd = j;
  else if (j < 9 && ((m >> uint(j + 1)) & 1u) != 0u) sd = j + 1;
  if (sd < 0) return vec4(0.0);
  int ka = 0, kb = 9;                     // the run of bright samples around the seed
  for (int k = 0; k < 10 + fx_gZ; k++) {
    bool dark = ((m >> uint(k)) & 1u) == 0u;
    if (dark && k < sd) ka = k + 1;
    if (dark && k > sd && kb == 9) kb = k - 1;
  }
  // refine both ends of the run (the colours found there are near the threshold: the dark end of the sort)
  float aB = (float(ka) + 0.5) * h, bB = (float(kb) + 0.5) * h;
  lu[10] = lu[ka]; lu[11] = lu[kb];
  if (ka > 0) {
    float lo = aB - h;
    for (int i = 0; i < 3; i++) {
      float mid = 0.5 * (lo + aB);
      float l = fx_gLum(base + dir * mid);
      if (l >= thr) { aB = mid; lu[10] = l; } else lo = mid;
    }
  } else { aB = 0.0; lu[10] = fx_gLum(base); }
  if (kb < 9) {
    float hi = bB + h;
    for (int i = 0; i < 4; i++) {
      float mid = 0.5 * (bB + hi);
      float l = fx_gLum(base + dir * mid);
      if (l >= thr) { bB = mid; lu[11] = l; } else hi = mid;
    }
  } else { bB = L; lu[11] = fx_gLum(base + dir * L); }
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
  vec3 c0 = fx_src(base + dir * p0).rgb;
  vec3 c1 = i1 == i0 ? c0 : fx_src(base + dir * p1).rgb;
  return vec4(mix(c0, c1, x - r0), 1.0);
}

// broken-JPEG garbage: a block decoded from the wrong bits = a few strong DCT basis functions with wild chroma (YUV)
vec3 fx_gJunkBlock(vec2 l8, vec3 h) {
  vec2 f1 = floor(h.xy * 8.0), f2 = floor(fract(h.yz * 13.7) * 8.0);
  float b1 = cos(PG_PI * f1.x * (l8.x + 0.5) / 8.0) * cos(PG_PI * f1.y * (l8.y + 0.5) / 8.0);
  float b2 = cos(PG_PI * f2.x * (l8.x + 0.5) / 8.0) * cos(PG_PI * f2.y * (l8.y + 0.5) / 8.0);
  return vec3(0.45 + 0.4 * b1 + 0.2 * b2 + (h.z - 0.5) * 0.3, (h.x - 0.5) * 0.45 + 0.18 * b2, (fract(h.x * 7.31) - 0.5) * 0.45 - 0.18 * b1);
}

// Colour damage of the card effects. c = sampled colour, p = where it was sampled (render px), fc = output pixel.
vec3 fx_glitchDamage(vec3 c, vec2 p, vec2 fc) {
  float g = u_fx_glitch, S = fx_gS, F = fx_gF;

  // broken JPEG: blocking from quantised DC, 4:2:0 chroma flattened per 16×16 MCU, posterised AC, mosquito noise in
  // blocks that hold an edge, DC-only blocks, garbage blocks after a bitstream error
  if (u_fx_glitchJpeg > 0.0) {
    float k = clamp(u_fx_glitchJpeg * g, 0.0, 1.0);
    float aJ = k * fx_gEnergy(floor(F / 2.0) * 2.0);
    float J = 8.0 * S;
    vec2 jid = fx_gJid;
    vec2 mc = fx_ras((jid + 0.5) * J + fx_gMd);                    // block centre, moved like this pixel
    vec3 Yb = fx_yuv(fx_src(mc).rgb);
    float l1 = fx_yuv(fx_src(mc + vec2(-2.5, 2.5) * S).rgb).x;
    float l2 = fx_yuv(fx_src(mc + vec2(2.5, -2.5) * S).rgb).x;
    float act = abs(l1 - Yb.x) + abs(l2 - Yb.x) + abs(l1 - l2);
    vec3 C = fx_yuv(fx_src(fx_ras((floor(jid / 2.0) * 2.0 + 1.0) * J + fx_gMd)).rgb);
    vec3 jb = fx_gh(jid, floor(F / 3.0) * 16.0 + 15.0);
    vec3 jw = fx_gh(jid, floor(F / 2.0) * 16.0 + 12.0);
    vec3 Y0 = fx_yuv(c), Y = Y0;
    // quantised DC (chroma much coarser than luma): blocky contours across smooth gradients
    float dqY = mix(0.008, 0.05, k), dqC = mix(0.012, 0.06, k);
    vec3 D = vec3(floor(Yb.x / dqY + 0.5) * dqY, floor(C.yz / dqC + 0.5) * dqC);
    Y.yz = mix(Y.yz, D.yz, min(1.0, k * 1.6));
    float qs = mix(0.04, 0.3, k);
    Y.x = D.x + floor((Y.x - Yb.x) / qs + 0.5) * qs;
    vec2 fq = floor(jb.yz * 5.0) + 2.0;
    vec2 l8 = fx_gJl / S;
    Y.x += cos(PG_PI * fq.x * (l8.x + 0.5) / 8.0) * cos(PG_PI * fq.y * (l8.y + 0.5) / 8.0) * min(act, 0.6) * 0.35 * k;
    if (jb.x < k * 0.12) Y = D;                                           // DC-only block
    if (jw.x < aJ * 0.004) Y += (vec3(jw.y, jw.z, fract(jw.y * 7.31)) - 0.5) * vec3(0.7, 0.4, 0.4);   // the odd wrong DC
    if (fx_gJunk.x >= 0.0) Y = fx_gJunkBlock(l8, fx_gJunk);              // garbage after a bitstream error
    Y = mix(Y0, Y, min(1.0, k * 5.0));                                    // fades in from the clean picture
    Y += fx_gJD;
    c = mix(fx_rgb(Y), vec3(0.5), fx_gJGrey);
  }

  // pixel sort (replaces the colour inside sorted runs)
  if (u_fx_glitchSort > 0.0) {
    vec4 s = fx_gSort(p, clamp(u_fx_glitchSort * g, 0.0, 1.0), pg_luma(c));
    if (s.w > 0.5) c = s.rgb;
  }

  c += fx_gTint;

  // VHS: soft luma with the deck's edge-enhancement halo, low-bandwidth chroma smeared to the right, chroma noise,
  // tape grain, lifted blacks
  if (u_fx_glitchBleed > 0.0) {
    float k = min(u_fx_glitchBleed * g, 1.0);
    vec3 y1 = fx_yuv(fx_src(p + vec2(-4.0, 0.0) * S).rgb);
    vec3 y2 = fx_yuv(fx_src(p + vec2(-10.0, 0.0) * S).rgb);
    float yl = pg_luma(fx_src(p + vec2(-1.5, 0.0) * S).rgb);
    float yr = pg_luma(fx_src(p + vec2(1.5, 0.0) * S).rgb);
    float line = floor((u_res.y - fc.y) / S);
    float ln = line * 1.37 + F * 17.0;
    vec2 cn = vec2(fx_vn(vec2(fc.x / (14.0 * S), ln), 8.0), fx_vn(vec2(fc.x / (14.0 * S) + 50.0, ln), 8.0)) - 0.5;
    vec3 Y = fx_yuv(c);
    Y.yz = mix(Y.yz, (Y.yz * 0.3 + y1.yz * 0.4 + y2.yz * 0.3) * 1.12 + cn * 0.07, k);
    float yb = 0.5 * Y.x + 0.25 * (yl + yr);
    Y.x = mix(Y.x, yb + 0.3 * (yb - y1.x), k);
    Y.x += (fx_gh(floor(fc / S), F * 16.0 + 10.0).x - 0.5) * 0.08 * k;
    Y.x = mix(Y.x, Y.x * 0.86 + 0.07, k);
    c = fx_rgb(Y);
  }
  return c;
}

// Bit crush: few levels per channel with ordered dither (preview px), plus bands of bit-shifted colour
vec3 fx_glitchCrush(vec3 c, vec2 fc) {
  float S = fx_gS, F = fx_gF;
  float aC = clamp(u_fx_glitchCrush * u_fx_glitch, 0.0, 1.0);
  c = clamp(c, 0.0, 1.0);
  float Y = u_res.y - fc.y;
  vec3 bf = fx_gh(vec2(0.0, 45.0), floor(F * 0.5) * 16.0 + 14.0);
  vec3 bb = fx_gh(vec2(floor(Y / (mix(5.0, 48.0, bf.x * bf.x) * S) + floor(bf.y * 50.0)), 46.0), floor(F * 0.5) * 16.0 + 14.0);
  if (bb.x < aC * fx_gEnergy(floor(F * 0.5) * 2.0) * 0.12) c = fract(c * (bb.y < 0.6 ? 2.0 : 4.0) + (bb.z < 0.3 ? 0.5 : 0.0));
  float lv = floor(exp2(mix(8.0, 1.0, pow(aC, 0.3))) + 0.5);   // levels per channel: ~76 at 0.01, 10 at 0.25, 2 at 1
  float d = pg_bayer4(floor(vec2(fc.x, Y) / S)) - 0.5;
  return floor(c * (lv - 1.0) + 0.5 + d) / (lv - 1.0);
}

// Sample with the glitch applied (also returns the displaced pixel-block geometry)
vec4 fx_glitchSample(vec2 fc, out vec2 local, out vec2 id) {
  // The glitch reaches many sub-pixel positions (pixel-block centres ± offsets). Snapping them to 1/256 px keeps the
  // GPU's filter weights from rounding differently in a tile (other texture offset/size) than in a single pass.
  fx_snap = true;
  vec4 gi;
  float blank;
  vec2 sc = fc + fx_glitch(fc, gi, blank);
  bool card = u_fx_glitchSmear > 0.0 || u_fx_glitchSort > 0.0 || u_fx_glitchJpeg > 0.0 || u_fx_glitchBleed > 0.0 || u_fx_glitchInterlace > 0.0;
  if (card) sc = fx_glitchMove(sc, blank);
  vec2 bc = fx_block(sc, local, id);
  vec2 off = vec2(gi.x, 0.0);
  if (u_fx_rgbSplit > 0.0) { float a = radians(u_fx_rgbAngle); off += vec2(cos(a), sin(a)) * u_fx_rgbSplit * u_pxScale; }
  vec4 src;
  if (off != vec2(0.0)) {
    vec4 g = fx_sample(sc);
    src = vec4(fx_sample(sc + off).r, g.g, fx_sample(sc - off).b, g.a);
  } else {
    src = fx_sample(sc);
  }
  if (card) src.rgb = fx_glitchDamage(src.rgb, bc, fc);
  if (blank > 0.0) src = vec4(0.0, 0.0, 0.0, 1.0);
  vec3 c = fx_glitchColor(src.rgb, gi);
  if (u_fx_glitchCrush > 0.0) c = fx_glitchCrush(c, fc);
  return vec4(clamp(c, 0.0, 1.0), max(src.a, gi.z));
}

void main() {
  vec2 fc = gl_FragCoord.xy + u_fcOffset;
  vec2 local, id;
  vec4 src;
  if (u_fx_glitch > 0.0) {
    src = fx_glitchSample(fc, local, id);
  } else {
    fx_block(fc, local, id);
    if (u_fx_rgbSplit > 0.0) {
      float a = radians(u_fx_rgbAngle);
      vec2 off = vec2(cos(a), sin(a)) * u_fx_rgbSplit * u_pxScale;
      vec4 g = fx_sample(fc);
      src = vec4(fx_sample(fc + off).r, g.g, fx_sample(fc - off).b, g.a);
    } else {
      src = fx_sample(fc);
    }
  }

  vec3 c = fx_adjust(src.rgb);
  c = fx_quantize(c, id);
  vec4 col = mix(vec4(u_fx_pxGapColor, 1.0), vec4(c, src.a), fx_mask(local));

  if (u_fx_scanlines > 0.0) {
    float s = 0.5 + 0.5 * cos(PG_TAU * fc.y / max(1.0, u_fx_scanSize * u_pxScale));
    col.rgb *= 1.0 - u_fx_scanlines * 0.75 * (1.0 - s);
  }
  if (u_fx_grain > 0.0) {
    float n = pg_hash12(floor(fc) + floor(fract(u_time * 7.31) * 64.0) * 131.0) - 0.5;
    col.rgb += n * u_fx_grain * 0.35;
  }
  if (u_fx_vignette > 0.0) {
    vec2 v = (fc / u_res - 0.5) * vec2(u_res.x / u_res.y, 1.0);
    col.rgb *= 1.0 - u_fx_vignette * smoothstep(0.35, 1.1, length(v) * 1.25);
  }
  pg_out = vec4(clamp(col.rgb, 0.0, 1.0), col.a);
}
`;

  /** Upper bound of fx_glitch()'s sample displacement per axis, in preview px (multiply by pxScale × glitch fit),
   *  including the R/B channel offset. The renderer widens tile margins by it. Keep in sync with fx_glitch(). */
  PG.glsl.glitchReach = function (post) {
    const g = +post.glitch || 0;
    if (!(g > 0)) return { x: 0, y: 0 };
    const k = (id) => Math.max(0, +post[id] || 0) * g;
    let x = 0, y = 0;
    if (k('glitchSlices') > 0) x += (150 + 70 + 26) * (0.4 + 0.6 * k('glitchSlices'));
    if (k('glitchBlocks') > 0) {
      const B = Math.max(+post.glitchBlock || 0, 0);
      x += 3 * B; // motion vectors up to 3 blocks across; smears / flat double blocks ≤ 2 blocks
      y += 2 * B;
    }
    if (k('glitchNoise') > 0) x += 78.5 * k('glitchNoise'); // line jitter 2.5 + band 44/2 + 14 + head switching 40
    x = Math.min(x, 240); // fx_glitch() clamps the horizontal displacement
    if (k('glitchRGB') > 0) x += 30 * (0.4 + 0.6 * k('glitchRGB'));
    // card effects (fx_glitchMove / fx_glitchDamage): further displacement of the sample point …
    let slack = 0; // whole-pixel rounding of those displacements (render px)
    if (k('glitchInterlace') > 0) { x += 26 * k('glitchInterlace'); slack += 0.5; }
    if (k('glitchBleed') > 0) { x += 2.5 * k('glitchBleed'); slack += 0.5; }
    if (k('glitchJpeg') > 0) { x += G.JPEG_SHIFT * 8; slack += 0.5; }
    if (k('glitchSmear') > 0) { x += G.SMEAR_STEPS * G.SMEAR_V; y += G.SMEAR_STEPS * G.SMEAR_V; }
    // … plus the reads around it: JPEG block decode (≤ 8 px), VHS bleed taps (10 px left), the pixel-sort interval
    if (k('glitchJpeg') > 0) { x += 8; y += 8; }
    if (k('glitchBleed') > 0) x += 10;
    if (k('glitchSort') > 0) {
      const L = (40 + (G.SORT_L - 40) * Math.min(1, k('glitchSort'))) * 1.3 * 1.015 + 1;
      if (post.glitchSortDir === 'horizontal') x += L;
      else y += L;
    }
    return { x, y, slack };
  };
})();
