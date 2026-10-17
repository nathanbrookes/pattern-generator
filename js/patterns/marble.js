/* Marble & Liquid — domain-warped noise fields: veined stone, iq-style nested-warp liquid, demoscene plasma,
 * thin-film oil iridescence, glowing lava crust and reflective liquid chrome. Every mode is coloured through
 * one gradient; noise octaves fade out below pixel size so tilted views stay calm at the horizon. */
(function () {
  const is = (...modes) => (v) => modes.includes(v.mode);
  const banded = is('liquid', 'plasma', 'oil', 'chrome');
  const HOLO = { stops: [[0, '#ff9ee0'], [0.2, '#c6a8ff'], [0.4, '#8fe3ff'], [0.6, '#a6ffd5'], [0.8, '#fff2a8'], [1, '#ff9ee0']], mode: 'smooth' };

  PG.registerPattern({
    id: 'marble',
    name: 'Marble & Liquid',
    category: 'Organic',
    description: 'Domain-warped noise: veined marble, flowing liquid, plasma, oil-slick iridescence, lava crust and liquid chrome.',
    params: [
      { type: 'heading', label: 'Style' },
      {
        id: 'mode',
        label: 'Material',
        type: 'select',
        options: [
          ['marble', 'Marble'],
          ['liquid', 'Liquid'],
          ['plasma', 'Plasma'],
          ['oil', 'Oil slick'],
          ['lava', 'Lava'],
          ['chrome', 'Chrome'],
        ],
        default: 'liquid',
      },

      { type: 'heading', label: 'Shape' },
      { id: 'scale', label: 'Scale', min: 0.1, max: 5, default: 1, step: 0.01, scale: 'log', random: [0.45, 1.8] },
      { id: 'warp', label: 'Warp strength', min: 0, max: 2, default: 1, step: 0.01, random: [0.5, 1.5] },
      { id: 'detail', label: 'Detail', type: 'int', min: 1, max: 6, default: 3, random: [2, 5], showIf: (v) => v.mode !== 'plasma', help: 'Noise octaves (stone and lava add two more)' },
      { id: 'veins', label: 'Vein count', min: 0.5, max: 12, default: 2.5, step: 0.1, scale: 'log', random: [1.2, 5], showIf: is('marble') },
      { id: 'angle', label: 'Vein angle', min: 0, max: 180, default: 35, step: 1, unit: '°', random: [0, 180], showIf: is('marble') },
      { id: 'sharpness', label: 'Sharpness', min: 0, max: 1, default: 0.6, step: 0.01, random: [0.35, 0.85], showIf: is('marble', 'lava'), help: 'Vein / crack crispness' },
      { id: 'bands', label: 'Color bands', min: 0.25, max: 8, default: 2.2, step: 0.01, scale: 'log', random: [1, 3.5], showIf: banded, help: 'How many times the gradient repeats' },
      { id: 'shine', label: 'Gloss', min: 0, max: 1, default: 0.6, step: 0.01, random: [0.2, 0.8], showIf: is('liquid', 'oil', 'chrome') },
      { id: 'speed', label: 'Flow speed', min: 0, max: 2, default: 0.3, step: 0.01, random: [0.1, 0.6], help: 'Used when Animate is on' },

      { type: 'heading', label: 'Color' },
      { id: 'colors', label: 'Colors', type: 'gradient', default: HOLO },
      { id: 'offset', label: 'Color offset', min: 0, max: 1, default: 0, step: 0.01, random: [0, 1], showIf: banded },
      { id: 'base', label: 'Base color', type: 'color', default: '#07070c', random: false, showIf: is('oil', 'lava') },
      { id: 'contrast', label: 'Contrast', min: 0.3, max: 3, default: 1, step: 0.01, scale: 'log', random: [0.85, 1.6] },
    ],
    presets: [
      {
        name: 'Carrara',
        values: {
          mode: 'marble', scale: 1.1, warp: 0.6, detail: 4, veins: 4, angle: 35, sharpness: 0.5,
          colors: { stops: [[0, '#f6f4f0'], [0.25, '#e9e6e1'], [0.55, '#bdbcbd'], [0.8, '#83868e'], [1, '#4f535d']], mode: 'smooth' },
        },
      },
      {
        name: 'Black Marble',
        values: {
          mode: 'marble', scale: 0.8, warp: 0.7, detail: 4, veins: 2, angle: 120, sharpness: 0.35, contrast: 1.4,
          colors: { stops: [[0, '#0b0b0d'], [0.35, '#1d1c20'], [0.7, '#8d7a55'], [0.88, '#d9bf7a'], [1, '#fff4cf']], mode: 'smooth' },
        },
      },
      {
        name: 'Liquid Holo', thumb: true,
        values: {
          mode: 'liquid', detail: 2, warp: 1.05, bands: 2.1, shine: 0.65, contrast: 1.1, colors: HOLO,
        },
      },
      {
        name: 'Oil Slick',
        values: { mode: 'oil', scale: 0.8, detail: 4, warp: 1, bands: 4, shine: 0.5, colors: 'Oil Slick', base: '#05060a' },
      },
      {
        name: 'Plasma 1993',
        values: { mode: 'plasma', scale: 0.6, warp: 0.2, bands: 2.4, speed: 1, colors: 'Rainbow' },
        post: { pixelate: true, pxSize: 6, quantize: 'posterize', levels: 6, dither: 'bayer4', ditherAmt: 0.5 },
      },
      {
        name: 'Lava',
        values: { mode: 'lava', scale: 0.9, warp: 0.9, detail: 3, sharpness: 0.55, colors: 'Fire', base: '#191312', contrast: 1.1, speed: 0.4 },
      },
      {
        name: 'Liquid Chrome',
        values: {
          mode: 'chrome', detail: 3, warp: 1, bands: 1.5, shine: 0.75, contrast: 1.2,
          colors: { stops: [[0, '#07080b'], [0.28, '#424854'], [0.48, '#dfe6ef'], [0.55, '#ffffff'], [0.66, '#7b828e'], [0.84, '#16181d'], [1, '#c9d3df']], mode: 'smooth' },
        },
      },
      {
        name: 'Vapor Swirl',
        values: { mode: 'liquid', detail: 2, warp: 1.2, bands: 1.3, shine: 0.35, colors: 'Vaporwave', contrast: 1.2 },
        transform: { warp: 'swirl', warpAmt: 0.9, warpFreq: 1.5 },
      },
    ],
    glsl: /* glsl */ `
float mb_px = 0.001;   // one output pixel in noise units (q = p / scale)
float mb_t = 0.0;      // flow time

// fbm whose octaves fade out once they get smaller than a pixel (no horizon sparkle when Smooth edges is on).
float mbFbm(vec2 q, int oct) {
  const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  float s = 0.0, a = 0.5, n = 0.0, f = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float k = u_tf_aa > 0.5 ? 1.0 - smoothstep(0.2, 0.5, f * mb_px) : 1.0;
    if (k <= 0.0) break;
    s += a * k * pg_noise(q);
    n += a;
    q = m * q + 17.13; a *= 0.5; f *= 2.0;
  }
  return n > 0.0 ? s / n : 0.0;
}

// pg_noise with its analytic gradient: vec3(value, d/dx, d/dy).
vec3 mbNoiseD(vec2 p) {
  vec2 i = floor(p), f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = pg_gradDir(i), gb = pg_gradDir(i + vec2(1.0, 0.0));
  vec2 gc = pg_gradDir(i + vec2(0.0, 1.0)), gd = pg_gradDir(i + vec2(1.0, 1.0));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0)), vd = dot(gd, f - vec2(1.0, 1.0));
  float k = va - vb - vc + vd;
  float n = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
  vec2 g = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * k + vec2(vb - va, vc - va));
  return 1.4142 * vec3(n, g);
}

// mbFbm with its gradient (same octave fade): vec3(value, d/dx, d/dy). ridged sums |noise| (Perlin turbulence),
// whose creases give marble veins their kinks.
vec3 mbFbmD(vec2 q, int oct, bool ridged) {
  const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  vec3 s = vec3(0.0);
  float a = 0.5, n = 0.0, f = 1.0;
  mat2 J = mat2(1.0);                                // d(octave coords)/dq
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float k = u_tf_aa > 0.5 ? 1.0 - smoothstep(0.2, 0.5, f * mb_px) : 1.0;
    if (k <= 0.0) break;
    vec3 v = mbNoiseD(q);
    if (ridged) v = vec3(abs(v.x), sign(v.x) * v.yz);
    s += a * k * vec3(v.x, transpose(J) * v.yz);
    n += a;
    q = m * q + 17.13; J = m * J; a *= 0.5; f *= 2.0;
  }
  return n > 0.0 ? s / n : vec3(0.0);
}

float mbContrast(float v) { return clamp(0.5 + (v - 0.5) * u_contrast, 0.0, 1.0); }

vec3 mbGradMean() {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 8; i++) s += pg_grad(u_colors, (float(i) + 0.5) / 8.0);
  return s / 8.0;
}

// Repeat the gradient as a mirrored (seamless) ramp; fade to its mean colour once bands get sub-pixel.
vec3 mbBands(float x) {
  float fw = fwidth(x);
  float v = 1.0 - abs(mod(x + 2.0 * u_offset, 2.0) - 1.0);
  vec3 c = pg_grad(u_colors, mbContrast(v));
  float k = u_tf_aa > 0.5 ? smoothstep(0.35, 1.2, fw) : 0.0;
  return mix(c, mbGradMean(), k);
}

// 0 up close → 1 once the (warped) detail is only a few pixels across: far away gloss and reflections calm down
// to their average instead of sparkling (tilted horizons, extreme zoom-out).
float mbFar() { return u_tf_aa > 0.5 ? smoothstep(0.005, 0.03, mb_px) : 0.0; }

// Gloss: soft diffuse + specular highlight from the slope g of a height field.
vec3 mbGloss(vec3 col, vec2 g, float amt) {
  vec3 n = normalize(vec3(-g, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float dif = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(clamp(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0, 1.0), 48.0);
  col *= mix(1.0, 0.45 + 0.75 * dif, amt);
  return col + amt * spec * 0.85;
}

// Vein around every integer of s. G = |grad s| (analytic, s-units per noise unit), so d/G is the distance to the
// vein in noise units. Width ws in s-units, capped at wq noise units so the line can't swell into a blob where the
// warp folds (G → 0). Widened & dimmed once thinner than a pixel; settles to its mean density once veins crowd.
float mbVein(float s, float G, float ws, float wq) {
  G = max(G, 1e-3);
  float d = abs(fract(s + 0.5) - 0.5) / G;
  float w = min(ws / G, wq);
  if (u_tf_aa < 0.5) return 1.0 - smoothstep(0.0, w, d);
  float ww = max(w, 0.75 * mb_px * float(max(u_ss, 1)));
  float v = (1.0 - smoothstep(0.0, ww, d)) * (w / ww);
  return mix(v, min(w * G, 1.0), smoothstep(0.15, 0.4, G * mb_px));
}

// ---- marble: tilted ramp bent by domain-warped turbulence, sliced into veins of varying weight.
// Gradients are carried through the warp analytically (chain rule) for the vein widths.
vec3 mbMarble(vec2 q) {
  int o = int(u_detail) + 2;
  float W = u_warp, Wa = 1.3 * u_warp;
  vec2 drift = vec2(mb_t * 0.04, 0.0);
  vec3 fx = mbFbmD(q * 0.6 + vec2(3.1, 7.7) + drift, o, false);
  vec3 fy = mbFbmD(q * 0.6 + vec2(9.4, 2.5) - drift, o, false);
  vec2 w = q + Wa * vec2(fx.x, fy.x);
  mat2 Jt = transpose(mat2(1.0) + 0.6 * Wa * mat2(fx.y, fy.y, fx.z, fy.z));   // (dw/dq)^T
  float a = radians(u_angle);
  vec2 dir = vec2(cos(a), sin(a));
  float ws = 0.4 * pow(0.04, u_sharpness);          // vein width in s-units
  float wq = mix(0.08, 0.012, u_sharpness);         // ... but never wider than this

  float A1 = 0.6 + 2.2 * W, R1 = u_veins * 0.35;
  vec3 n1 = mbFbmD(w, o, true);
  float s1 = dot(q, dir) * R1 + n1.x * A1;
  float g1 = length(dir * R1 + A1 * (Jt * n1.yz));
  float k1 = (0.45 + 0.55 * pg_hash11(floor(s1 + 0.5) + 17.0)) * (0.5 + 0.5 * smoothstep(-0.35, 0.3, mbFbm(q * 0.5 + 13.0, 3)));
  float v1 = k1 * (mbVein(s1, g1, ws, wq) + 0.3 * mbVein(s1, g1, ws * 5.0, wq * 4.0));

  vec2 dir2 = pg_rot(0.9) * dir;
  float A2 = 1.0 + 3.0 * W, R2 = u_veins * 0.8;
  vec3 n2 = mbFbmD(w * 1.9 + 5.0, o, false);
  float s2 = dot(q, dir2) * R2 + n2.x * A2;
  float g2 = length(dir2 * R2 + 1.9 * A2 * (Jt * n2.yz));
  float k2 = (0.3 + 0.7 * pg_hash11(floor(s2 + 0.5) + 71.0)) * smoothstep(-0.1, 0.4, mbFbm(q * 0.7 + 27.0, 3));
  float v2 = k2 * mbVein(s2, g2, ws * 0.45, wq * 0.5);

  float cloud = 0.5 + 0.5 * mbFbm(w * 0.8 + 21.0, o);
  float t = 0.22 * cloud + v1 + 0.55 * v2;
  return pg_grad(u_colors, mbContrast(clamp(t, 0.0, 1.0)));
}

// ---- liquid: iq-style nested domain warping f(p + W·r(p + W·q(p)))
float mbLiquidF(vec2 q, out vec2 a, out vec2 b) {
  int o = int(u_detail);
  float W = 3.0 * u_warp;
  a = vec2(mbFbm(q + 0.04 * mb_t, o), mbFbm(q + vec2(5.2, 1.3) - 0.03 * mb_t, o));
  b = vec2(mbFbm(q + W * a + vec2(1.7, 9.2) + 0.15 * mb_t, o), mbFbm(q + W * a + vec2(8.3, 2.8) + 0.126 * mb_t, o));
  return mbFbm(q + W * b, o);
}
float mbLiquidV(vec2 q) {
  vec2 a, b;
  float f = mbLiquidF(q, a, b);
  return f + 0.35 * length(b) + 0.15 * a.x;
}
vec3 mbLiquid(vec2 q) {
  float e = max(0.006, mb_px);
  float v = mbLiquidV(q);
  vec2 g = vec2(mbLiquidV(q + vec2(e, 0.0)) - v, mbLiquidV(q + vec2(0.0, e)) - v) / e;
  float far = mbFar();
  vec3 col = mix(mbBands((v + 0.5) * u_bands), mbGradMean(), 0.7 * far);
  return mbGloss(col, g * 0.35 * (1.0 - far), u_shine);
}

// ---- plasma: sum of travelling sines (+ optional noise warp)
vec3 mbPlasma(vec2 q) {
  vec2 o = (pg_hash22(vec2(7.0, 3.0)) - 0.5) * 12.0;
  float t = mb_t * 1.5;
  if (u_warp > 0.0) q += u_warp * 1.2 * vec2(pg_noise(q * 0.35 + o), pg_noise(q * 0.35 + o.yx + 4.0));
  float v = sin(q.x + t + o.x);
  v += sin(0.9 * (q.x * sin(t * 0.5 + o.x) + q.y * cos(t * 0.33 + o.y)) + t);
  vec2 c = q + 3.0 * vec2(sin(t * 0.2 + o.y), cos(t * 0.31 + o.x));
  v += sin(sqrt(dot(c, c) + 1.0) - t);
  v += sin(q.y * 0.8 - t * 0.7 + o.y);
  return mbBands((v * 0.25 + 1.0) * u_bands);
}

// ---- oil slick: film thickness from warped fbm → interference bands, fading out where the film is thick
float mbOilF(vec2 q) {
  int o = int(u_detail);
  float W = 2.2 * u_warp;
  vec2 a = vec2(mbFbm(q * 0.7 + vec2(1.3, 4.1) + 0.05 * mb_t, o), mbFbm(q * 0.7 + vec2(6.2, 0.7) - 0.04 * mb_t, o));
  return mbFbm(q + W * a, o);
}
vec3 mbOil(vec2 q) {
  float e = max(0.006, mb_px);
  float d = mbOilF(q);
  vec2 g = vec2(mbOilF(q + vec2(e, 0.0)) - d, mbOilF(q + vec2(0.0, e)) - d) / e;
  float th = 0.5 + 0.8 * d;                                    // film thickness
  float x = th * u_bands * 2.0;
  vec3 iri = mbBands(x);
  float fx = 1.37 * x;                                         // interference minima drift across the hues
  float fringe = mix(0.45 + 0.55 * pow(0.5 + 0.5 * cos(PG_TAU * fx), 0.5), 0.7, u_tf_aa > 0.5 ? smoothstep(0.35, 1.2, fwidth(fx)) : 0.0);
  float slick = smoothstep(-0.35, 0.2, mbFbm(q * 0.4 + vec2(40.0, 11.0) + 0.02 * mb_t, 3));
  float amt = slick * (1.0 - 0.6 * smoothstep(0.5, 1.2, th)) * fringe;  // thick film → washed out
  vec3 col = mix(u_base, iri * 1.15, clamp(amt, 0.0, 1.0));
  float far = mbFar();
  col = mix(col, mix(u_base, mbGradMean(), 0.5 * slick), 0.7 * far);
  return mbGloss(col, g * 0.3 * (1.0 - far), u_shine);
}

// ---- lava: voronoi crust plates on a warped domain; cracks glow through the gradient
vec3 mbLava(vec2 q) {
  int o = int(u_detail) + 2;
  vec2 drift = vec2(0.05, 0.02) * mb_t;
  vec2 w = q * 1.8 + drift + u_warp * 0.7 * vec2(mbFbm(q * 0.8 + 3.0, o), mbFbm(q * 0.8 + 8.0, o));
  vec4 vo = pg_voronoi(w, 0.95);
  float e = vo.y - vo.x;
  float vary = 0.5 + 0.5 * mbFbm(q * 1.4 + 30.0, 3);
  float cw = 0.25 * pow(0.08, u_sharpness) * (0.35 + 1.3 * vary);
  float fw = fwidth(e);
  float ww = u_tf_aa > 0.5 ? max(cw, 0.75 * fw) : cw;
  float core = (1.0 - smoothstep(0.0, ww, e)) * (cw / ww);
  float glow = exp(-e / (cw * 2.5 + 0.05));
  float flick = 0.5 + 0.5 * pg_noise(q * 1.3 + vec2(0.0, mb_t * 0.6));
  float cell = pg_hash12(vo.zw);
  float T = core * (0.8 + 0.2 * flick) + glow * (0.25 + 0.3 * flick) * vary + 0.12 * cell * smoothstep(0.6, 1.0, flick);
  // far away many cracks share a pixel: settle on their average heat instead of sparkling
  if (u_tf_aa > 0.5) T = mix(T, 0.08 + 0.25 * cw + 0.1 * vary, smoothstep(0.08, 0.35, mb_px * 1.8));
  float rock = 0.5 + 0.5 * mbFbm(q * 7.0 + 50.0, o);
  vec3 crust = u_base * (0.45 + 1.1 * rock);
  vec3 heat = pg_grad(u_colors, mbContrast(clamp(T, 0.0, 1.0)));
  return crust * (1.0 - smoothstep(0.3, 0.9, T)) + heat;
}

// ---- chrome: reflective height field — environment bands picked by the reflected ray + specular
float mbChromeH(vec2 q) {
  int o = int(u_detail);
  float W = 1.6 * u_warp;
  vec2 a = vec2(mbFbm(q * 0.8 + vec2(2.0, 9.0) + 0.06 * mb_t, o), mbFbm(q * 0.8 + vec2(7.0, 3.0) - 0.05 * mb_t, o));
  return mbFbm(q * 0.8 + W * a, o);
}
vec3 mbChrome(vec2 q) {
  float e = max(0.006, mb_px);
  float h = mbChromeH(q);
  vec2 g = vec2(mbChromeH(q + vec2(e, 0.0)) - h, mbChromeH(q + vec2(0.0, e)) - h) / e;
  float far = mbFar();
  vec3 n = normalize(vec3(-g * 0.9 * (1.0 - far), 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 col = mix(mbBands((0.5 + 0.5 * r.y + 0.25 * r.x + 0.6 * h) * u_bands), mbGradMean(), 0.7 * far);
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float spec = pow(clamp(dot(r, L), 0.0, 1.0), 60.0);
  float rim = pow(1.0 - n.z, 2.0);
  return col * (1.0 - 0.35 * u_shine * rim) + u_shine * spec;
}

vec4 pattern(vec2 p) {
  // per-material base frequency so Scale = 1 looks right everywhere
  float freq = u_mode == MODE_PLASMA ? 3.5 : (u_mode == MODE_MARBLE || u_mode == MODE_LAVA) ? 1.0 : u_mode == MODE_OIL ? 0.6 : 0.35;
  vec2 q = p * freq / u_scale;
  mb_px = pg_px * freq / u_scale;
  mb_t = u_time * u_speed;
  vec3 col;
  if (u_mode == MODE_MARBLE) col = mbMarble(q);
  else if (u_mode == MODE_LIQUID) col = mbLiquid(q);
  else if (u_mode == MODE_PLASMA) col = mbPlasma(q);
  else if (u_mode == MODE_OIL) col = mbOil(q);
  else if (u_mode == MODE_LAVA) col = mbLava(q);
  else col = mbChrome(q);
  return vec4(col, 1.0);
}
`,
  });
})();
