/* TV Static — analog snow, colour (chroma) snow, a misbehaving analog set (scanlines, line tearing, rolling
 * vertical-hold bar, flicker), RF interference (diagonal / herringbone beat patterns), a weak signal with a ghost
 * of colour bars showing through, salt & pepper impulses and fine film grain.
 *
 * Everything is computed in "q" units = CSS pixels of the picture (full-image pixels ÷ u_pxScale), so grain sizes,
 * scanline pitches and jitter look the same in the preview and in high-resolution / tiled exports. With Grain space =
 * Pattern the same q coordinates are derived from the pattern position (identical at the default view), so the static
 * follows zoom, tilt and warp. Noise is a seeded PCG hash of (cell, row, frame): crisp per-speck values, optionally
 * blended along each scan line like a bandwidth-limited analog signal, never blurred across lines. */
(function () {
  const is = (...modes) => (v) => modes.includes(v.mode);
  const tvModes = ['snow', 'color', 'analog', 'interference', 'weak'];

  PG.registerPattern({
    id: 'static',
    name: 'TV Static',
    category: 'Signal',
    description: 'Analog TV snow, color static, rolling bars, RF interference, weak-signal ghosts, salt & pepper and film grain — animated.',
    autoplay: true,
    params: [
      {
        id: 'mode',
        label: 'Type',
        type: 'select',
        options: [
          ['snow', 'Snow (B&W)'],
          ['color', 'Color snow'],
          ['analog', 'Analog TV'],
          ['interference', 'RF interference'],
          ['weak', 'Weak signal'],
          ['saltpepper', 'Salt & pepper'],
          ['grain', 'Film grain'],
        ],
        default: 'snow',
        random: ['snow', 'color', 'analog', 'analog', 'interference', 'weak', 'weak', 'saltpepper', 'grain'],
      },

      { type: 'heading', label: 'Grain' },
      { id: 'grain', label: 'Grain size', min: 0.5, max: 16, default: 1.5, step: 0.05, scale: 'log', unit: 'px', random: [1, 2.6], help: 'Size of one speck in screen pixels (exports keep the same look). In Analog TV this sets the speck width; Line pitch sets the height' },
      { id: 'stretch', label: 'Stretch', min: 0.5, max: 8, default: 1.3, step: 0.01, scale: 'log', random: [1, 2.4], showIf: (v) => v.mode !== 'grain', help: 'Horizontal elongation of each speck: analog video smears noise sideways along the scan lines' },
      { id: 'smear', label: 'Line smear', min: 0, max: 1, default: 0.6, step: 0.01, random: [0, 0.9], showIf: (v) => tvModes.includes(v.mode), help: 'Blend neighbouring specks along each line like a band-limited analog signal (0 = hard blocks)' },
      { id: 'fps', label: 'Refresh rate', min: 1, max: 60, default: 30, step: 1, unit: 'fps', random: [12, 60], help: 'How often the noise re-rolls while Animate is on' },
      {
        id: 'dist',
        label: 'Distribution',
        type: 'select',
        options: [['gaussian', 'Gaussian'], ['uniform', 'Uniform']],
        default: 'gaussian',
        random: ['gaussian', 'gaussian', 'uniform'],
        showIf: (v) => v.mode !== 'saltpepper',
        help: 'Gaussian = real thermal noise (mostly mid-greys, some bright sparks). Uniform = flatter, harsher',
      },
      {
        id: 'space',
        label: 'Grain space',
        type: 'select',
        options: [['screen', 'Screen (fixed pixels)'], ['pattern', 'Pattern (follows zoom, tilt, warp)']],
        default: 'screen',
        random: false,
        help: 'Screen keeps the static pixel-sharp at any zoom. Pattern lets zoom, perspective and warp move it',
      },

      { type: 'heading', label: 'Tone' },
      { id: 'contrast', label: 'Contrast', min: 0, max: 3, default: 1, step: 0.01, random: [0.75, 1.5] },
      { id: 'brightness', label: 'Brightness', min: -1, max: 1, default: 0, step: 0.01, random: [-0.15, 0.12] },
      { id: 'colorAmt', label: 'Color amount', min: 0, max: 2, default: 1, step: 0.01, random: [0.3, 1.5], showIf: is('color', 'weak', 'grain') },
      { id: 'chromaW', label: 'Chroma smear', min: 1, max: 8, default: 3, step: 0.01, scale: 'log', random: [1, 5], showIf: is('color'), help: 'Analog color is blurrier than brightness: 1 = per-speck RGB confetti, higher = smeared color streaks' },
      { id: 'tint', label: 'Tint', type: 'color', default: '#ffffff', random: 'light', help: 'Multiplies the image, e.g. green or amber phosphor' },
      { id: 'streaks', label: 'Line streaks', min: 0, max: 1, default: 0.3, step: 0.01, random: [0, 0.7], showIf: is('snow', 'color', 'analog', 'interference'), help: 'Uneven scan lines and occasional bright impulse dashes' },
      { id: 'flicker', label: 'Flicker', min: 0, max: 1, default: 0.35, step: 0.01, random: [0, 0.6], showIf: is('analog', 'weak', 'grain'), help: 'Frame-to-frame brightness pumping' },
      { id: 'density', label: 'Density', min: 0, max: 1, default: 0.18, step: 0.005, random: [0.04, 0.5], showIf: is('saltpepper'), help: 'Share of pixels hit by a black or white impulse (1 = pure binary noise)' },
      { id: 'soft', label: 'Grain softness', min: 0, max: 1, default: 0.45, step: 0.01, random: [0.1, 0.8], showIf: is('grain'), help: 'Clumpy, organic grain vs. crisp digital noise' },
      { id: 'dust', label: 'Dust & scratches', min: 0, max: 1, default: 0.25, step: 0.01, random: [0, 0.6], showIf: is('grain') },

      { type: 'heading', label: 'CRT' },
      { id: 'scanlines', label: 'Scanlines', min: 0, max: 1, default: 0.55, step: 0.01, random: [0.2, 0.8], showIf: is('analog') },
      { id: 'lineSize', label: 'Line pitch', min: 1.5, max: 16, default: 3, step: 0.1, scale: 'log', unit: 'px', random: [2.5, 5], showIf: is('analog'), help: 'Height of one scan line; each line carries its own noise' },
      { id: 'roll', label: 'Rolling bar', min: 0, max: 1, default: 0.6, step: 0.01, random: [0.2, 0.9], showIf: is('analog'), help: 'Lost vertical hold: a dark blanking bar and a soft hum band roll through the picture' },
      { id: 'rollSpeed', label: 'Roll speed', min: -1, max: 1, default: 0.12, step: 0.005, random: [-0.3, 0.3], showIf: (v) => v.mode === 'analog' && v.roll > 0, help: 'Picture heights per second' },
      { id: 'jitter', label: 'Line jitter', min: 0, max: 1, default: 0.4, step: 0.01, random: [0.1, 0.7], showIf: is('analog', 'interference', 'weak'), help: 'Unstable horizontal sync: lines wobble sideways and tear' },

      { type: 'heading', label: 'Interference' },
      { id: 'ifStyle', label: 'Style', type: 'select', options: [['herringbone', 'Herringbone'], ['diagonal', 'Diagonal']], default: 'herringbone', random: ['herringbone', 'diagonal'], showIf: is('interference') },
      { id: 'ifFreq', label: 'Frequency', min: 8, max: 400, default: 70, step: 0.5, scale: 'log', random: [30, 160], showIf: is('interference'), help: 'Stripes per picture height' },
      { id: 'ifAmt', label: 'Amount', min: 0, max: 1, default: 0.55, step: 0.01, random: [0.3, 0.8], showIf: is('interference') },
      { id: 'ifAngle', label: 'Angle', min: -80, max: 80, default: 38, step: 0.5, unit: '°', random: [-60, 60], showIf: is('interference') },
      { id: 'ifSpeed', label: 'Drift', min: -8, max: 8, default: 2.5, step: 0.05, random: [-4, 4], showIf: is('interference'), help: 'Stripes per second while animating' },

      { type: 'heading', label: 'Signal' },
      {
        id: 'ghost',
        label: 'Picture',
        type: 'select',
        options: [['smpte', 'SMPTE color bars'], ['bars', 'EBU color bars'], ['ramp', 'Gray steps'], ['gradient', 'Gradient']],
        default: 'smpte',
        random: ['smpte', 'smpte', 'bars', 'ramp', 'gradient'],
        showIf: is('weak'),
      },
      { id: 'ghostGrad', label: 'Gradient', type: 'gradient', default: 'Vaporwave', showIf: (v) => v.mode === 'weak' && v.ghost === 'gradient' },
      { id: 'signal', label: 'Signal strength', min: 0, max: 1, default: 0.35, step: 0.01, random: [0.15, 0.6], showIf: is('weak'), help: 'How much of the picture survives the noise' },
      { id: 'echo', label: 'Multipath ghost', min: 0, max: 1, default: 0.35, step: 0.01, random: [0, 0.7], showIf: is('weak'), help: 'A faint shifted copy from a reflected signal' },
    ],
    presets: [
      { name: 'Classic Snow', thumb: true, values: {}, play: true },
      { name: 'Color Static', values: { mode: 'color', grain: 1.5, stretch: 1.4, colorAmt: 1.1, chromaW: 3, contrast: 1.1, streaks: 0.2 }, play: true },
      { name: 'Analog TV', values: { mode: 'analog', grain: 1.6, stretch: 1.5, smear: 0.7, contrast: 1.15, streaks: 0.45, tint: '#e9efff' }, post: { vignette: 0.45 }, play: true },
      { name: 'Weak Signal', values: { mode: 'weak', ghost: 'smpte', signal: 0.32, echo: 0.4, jitter: 0.35, flicker: 0.25, grain: 1.5 }, play: true },
      { name: 'RF Interference', values: { mode: 'interference', ifStyle: 'herringbone', ifFreq: 70, ifAmt: 0.6, ifAngle: 38, jitter: 0.25, streaks: 0.25 }, play: true },
      {
        name: 'Green Phosphor',
        values: { mode: 'analog', tint: '#46ff86', grain: 1.4, stretch: 1.2, contrast: 1.3, brightness: 0.06, scanlines: 0.7, lineSize: 3.5, roll: 0.3, rollSpeed: -0.06, jitter: 0.2, flicker: 0.2, streaks: 0.3 },
        post: { vignette: 0.55 },
        play: true,
      },
      { name: 'Film Grain', values: { mode: 'grain', grain: 1.2, stretch: 1, soft: 0.5, contrast: 1, brightness: 0.02, colorAmt: 0.7, fps: 24, flicker: 0.3, dust: 0.3, tint: '#f3ead8' }, play: true },
      { name: 'Salt & Pepper', values: { mode: 'saltpepper', grain: 1, stretch: 1, density: 0.2, fps: 24 }, play: true },
    ],
    glsl: /* glsl */ `
// ---------------------------------------------------------------- hashing
// PCG3D on integer (x, y, stream) — one call gives three independent 32-bit values.
uvec3 st_pcg(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
// c = integer cell, k = integer stream (frame * 8 + purpose). Seeded by the global seed.
vec3 st_h3(vec2 c, float k) {
  uvec3 v = uvec3(ivec3(int(c.x), int(c.y), int(k)));
  v.z = v.z * 2654435761u + uint(u_seed) * 747796405u + 2891336453u;
  return vec3(st_pcg(v)) * (1.0 / 4294967296.0);
}
// three independent unit-variance deviates (gaussian via the Tukey-lambda inverse CDF, or uniform)
vec3 st_n3(vec2 c, float k) {
  vec3 u = st_h3(c, k);
  if (u_dist == DIST_UNIFORM) return (u - 0.5) * 3.4641016;
  u = clamp(u, 1e-6, 1.0 - 1e-6);
  return (pow(u, vec3(0.135)) - pow(1.0 - u, vec3(0.135))) * (1.0 / 0.1975);
}
// Noise field on cells of size cs (q units): discrete rows (scan lines), and along each row either hard cells
// (smear 0) or a smooth blend between neighbouring cell values, variance-compensated so contrast stays even.
vec3 st_field(vec2 q, vec2 cs, float k, float smear) {
  vec2 g = q / cs;
  float row = floor(g.y);
  if (smear < 0.002) return st_n3(vec2(floor(g.x), row), k);
  float x = g.x - 0.5;
  float c0 = floor(x), t = x - c0;
  float w = smoothstep(0.0, 1.0, clamp((t - 0.5) / smear + 0.5, 0.0, 1.0));
  vec3 a = st_n3(vec2(c0, row), k), b = st_n3(vec2(c0 + 1.0, row), k);
  return (a + (b - a) * w) * inversesqrt((1.0 - w) * (1.0 - w) + w * w);
}
// Bilinear (2D-smooth) version for film grain clumps.
vec3 st_field2(vec2 q, vec2 cs, float k) {
  vec2 g = q / cs - 0.5;
  vec2 c0 = floor(g), t = g - c0;
  t = t * t * (3.0 - 2.0 * t);
  vec3 a = st_n3(c0, k), b = st_n3(c0 + vec2(1.0, 0.0), k);
  vec3 c = st_n3(c0 + vec2(0.0, 1.0), k), d = st_n3(c0 + vec2(1.0, 1.0), k);
  vec2 s = (1.0 - t) * (1.0 - t) + t * t;
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y) * inversesqrt(s.x * s.y);
}

// ---------------------------------------------------------------- picture coordinates
float st_H = 600.0;   // picture height in q units (CSS px)
float st_W = 960.0;   // picture width
float st_qpx = 0.5;   // one supersample in q units (anti-aliasing of edges)
vec2 st_qc = vec2(0.0); // where the noise is sampled (see st_coords)
float st_npx = 0.0;   // footprint of one noise sample in q units (0 = point-sampled once per output pixel)
vec2 st_coords(vec2 p) {
  float s = max(u_pxScale, 1e-3);
  st_H = u_res.y / s;
  st_W = u_res.x / s;
  if (u_space == SPACE_PATTERN) {
    vec2 q = (p + vec2(u_res.x / u_res.y, 1.0)) * (st_H * 0.5);
    st_qpx = max(pg_px * st_H * 0.5, 1e-5);
    // Same idea as screen space below, through the local Jacobian: move this supersample back to its pixel's centre
    // (exact for zoom / rotate / pan, first-order under tilt and warp — it only picks which speck a pixel shows).
    // Grains smaller than a pixel then lose contrast through st_aa() instead of by averaging supersamples.
    vec2 o = fract(pg_screen * u_res) - 0.5;
    st_qc = q - dFdx(q) * o.x - dFdy(q) * o.y + 1.0 / 64.0;   // (tiny bias: centres that land exactly on a cell edge
    st_npx = st_qpx * pg_ss;                                    //  pick the same cell as in screen space, every sample)
    return q;
  }
  st_qpx = 1.0 / (s * pg_ss);
  // Screen space: every supersample of an output pixel reads the noise at the pixel's centre, so each pixel shows
  // exactly one speck / scan line. Otherwise grain sizes that don't land on whole pixels (1.5 px → rows straddling
  // every third pixel row) average two specks into a grey pixel: a fixed, visible pattern of soft rows/columns.
  st_npx = 0.0;
  st_qc = (floor(pg_screen * u_res) + 0.5) / s + 1.0 / 64.0;
  return pg_screen * u_res / s;
}
// contrast left after averaging grains smaller than one noise sample (1 when point-sampled per pixel)
float st_aa(vec2 cs) {
  if (st_npx <= 0.0) return 1.0;
  return inversesqrt(max(1.0, st_npx / cs.x) * max(1.0, st_npx / cs.y));
}
// coverage of a signed distance in q units (negative = inside), honouring Smooth edges
float st_fill(float d) {
  if (u_tf_aa < 0.5) return step(d, 0.0);
  return clamp(0.5 - d / max(st_qpx, 1e-5), 0.0, 1.0);
}

// ---------------------------------------------------------------- shared TV artefacts
// Horizontal sync wobble for one line, in q px.
float st_shift(float row, float fr, float t, float amt) {
  if (amt <= 0.0) return 0.0;
  vec3 h = st_h3(vec2(row, 11.0), fr * 8.0 + 2.0);
  float wob = sin(row * 0.093 + t * 2.3) * 0.7 + sin(row * 0.031 - t * 1.13) * 0.9;
  return amt * ((h.x - 0.5) * 2.4 + wob * 1.6);
}
// Per-line level wobble plus rare bright impulse dashes (ignition / switching noise).
float st_streak(vec2 q, float row, float fr, float amt) {
  if (amt <= 0.0) return 0.0;
  vec3 h = st_h3(vec2(row, 23.0), fr * 8.0 + 4.0);
  float s = (h.x - 0.5) * 0.11 * amt;
  if (h.y < 0.025 * amt) {
    float x0 = h.z * st_W * 1.1 - 0.1 * st_W;
    float len = 18.0 + 160.0 * fract(h.z * 91.7);
    float d = q.x - x0;
    s += (0.45 + 0.3 * fract(h.z * 13.1)) * smoothstep(0.0, 3.0, d) * (1.0 - smoothstep(len * 0.4, len, d));
  }
  return s;
}

// ---------------------------------------------------------------- test pictures (uv: 0..1, y top-down)
vec3 st_rgbBar(float b) { // 0..6 = white yellow cyan green magenta red blue
  return vec3(step(mod(b, 4.0), 1.5), step(b, 3.5), 1.0 - mod(b, 2.0));
}
vec3 st_picture(vec2 uv) {
  float x = fract(uv.x), y = clamp(uv.y, 0.0, 1.0);
  if (u_ghost == GHOST_SMPTE) {
    float b = min(floor(x * 7.0), 6.0);
    if (y < 2.0 / 3.0) return st_rgbBar(b) * 0.75;
    if (y < 0.75) return mod(b, 2.0) > 0.5 ? vec3(0.075) : st_rgbBar(6.0 - b) * 0.75;
    float xb = x * 7.0;
    if (xb < 1.25) return vec3(0.0, 0.13, 0.30);       // -I
    if (xb < 2.5) return vec3(1.0);                     // 100% white
    if (xb < 3.75) return vec3(0.20, 0.0, 0.42);       // +Q
    if (xb < 5.0) return vec3(0.075);
    if (xb < 5.3333) return vec3(0.035);               // PLUGE: below black
    if (xb < 5.6667) return vec3(0.075);
    if (xb < 6.0) return vec3(0.115);                  //        above black
    return vec3(0.075);
  }
  if (u_ghost == GHOST_BARS) {
    float b = floor(x * 8.0);
    if (b > 6.5) return vec3(0.0);
    return b < 0.5 ? vec3(1.0) : st_rgbBar(b) * 0.75;
  }
  if (u_ghost == GHOST_RAMP) return vec3(min(floor(x * 11.0), 10.0) / 10.0);
  return pg_grad(u_ghostGrad, x);
}

// ---------------------------------------------------------------- main
vec4 pattern(vec2 p) {
  vec2 q = st_coords(p);
  float t = u_time;
  float fr = floor(t * max(u_fps, 0.1) + 1e-4);
  float K = fr * 8.0;                       // per-frame hash stream
  float sig = 0.29 * u_contrast;            // noise standard deviation (clips to black / white like a TV's AGC)
  float mean = 0.5 + u_brightness;
  vec2 cs = vec2(u_grain * (u_mode == MODE_GRAIN ? 1.0 : u_stretch), u_grain);   // film grain is isotropic
  vec3 col;

  if (u_mode == MODE_SALTPEPPER) {
    cs = max(cs, vec2(1e-3));
    vec3 h = st_h3(floor(st_qc / cs), K);
    float hit = step(h.x, u_density);
    float speck = clamp(0.5 + (h.y < 0.5 ? -0.5 : 0.5) * u_contrast, 0.0, 1.0);
    float v = mix(mean, speck, hit);
    // grains smaller than a sample average out toward the expected tone
    float avg = mix(mean, 0.5, u_density);
    col = vec3(mix(avg, v, st_aa(cs)));

  } else if (u_mode == MODE_GRAIN) {
    float aa = st_aa(cs);
    vec3 g1 = st_field2(st_qc, cs * 1.35, K);                 // soft clumps
    vec3 g2 = st_n3(floor(st_qc / (cs * 0.75)), K + 1.0);     // crisp silver specks
    float s = u_soft;
    vec3 g = (g1 * s + g2 * (1.0 - s)) * inversesqrt(s * s + (1.0 - s) * (1.0 - s));
    vec3 gn = mix(vec3(g.x), g, clamp(u_colorAmt * 0.3, 0.0, 1.0));       // dye-cloud colour grain
    float fl = 1.0 + u_flicker * 0.09 * (st_h3(vec2(5.0, 9.0), K + 3.0).x - 0.5) * 2.0;
    col = (mean + gn * 0.125 * u_contrast * aa) * fl;
    if (u_dust > 0.0) {
      // dust: a few specks per frame on a coarse grid; hairline scratch that wanders slowly
      vec2 dc = vec2(46.0);
      vec2 ci = floor(q / dc);
      vec3 hd = st_h3(ci, K + 5.0);
      if (hd.x < u_dust * 0.07) {
        vec2 c = (ci + 0.2 + 0.6 * hd.yz) * dc;
        float r = 0.6 + 2.6 * fract(hd.y * 37.1);
        vec2 dv = (q - c) * vec2(1.0, 0.7 + 0.6 * fract(hd.z * 17.3));
        float a = st_fill(length(dv) - r);
        col = mix(col, vec3(fract(hd.z * 53.7) < 0.75 ? 0.06 : 0.95), a * 0.85);
      }
      vec3 hs = st_h3(vec2(floor(t * 0.7), 3.0), 77.0);
      if (hs.x < u_dust) {
        float sx = (0.1 + 0.8 * hs.y) * st_W + sin(q.y * 0.013 + hs.z * 6.28) * 6.0 + (st_h3(vec2(fr, 1.0), 31.0).x - 0.5) * 3.0;
        float a = st_fill(abs(q.x - sx) - 0.35) * (0.35 + 0.35 * hs.z);
        col = mix(col, vec3(0.92), a);
      }
    }

  } else {
    // ---------------- analog TV family
    float lp = u_mode == MODE_ANALOG ? max(u_lineSize, 0.5) : max(u_grain, 0.5);   // scan-line height
    float row = floor(st_qc.y / lp);
    float jit = (u_mode == MODE_ANALOG || u_mode == MODE_INTERFERENCE || u_mode == MODE_WEAK) ? u_jitter : 0.0;
    if (u_mode == MODE_WEAK) jit *= 1.4 - u_signal * 0.6;
    float shift = st_shift(row, fr, t, jit);
    float tear = 1.0;
    if (u_mode == MODE_ANALOG && jit > 0.0) {
      // tearing bands: groups of lines lose horizontal lock — displaced and stretched sideways
      float band = smoothstep(0.62, 0.92, pg_vnoise(vec2(row * lp / 26.0, fr * 0.37 + 11.0)));
      vec3 hb = st_h3(vec2(floor(row * lp / 26.0), 5.0), K + 6.0);
      shift += band * jit * (hb.x - 0.5) * 80.0;
      tear = 1.0 + band * jit * (1.5 + 4.0 * hb.y);
    }
    vec2 qs = vec2((q.x + shift) / tear, q.y);                // continuous (edges, stripes)
    vec2 qn = vec2((st_qc.x + shift) / tear, st_qc.y);        // noise sample position
    if (u_mode == MODE_ANALOG) cs.y = lp;
    cs = max(cs, vec2(1e-3));
    float aa = st_aa(cs);
    vec3 n = st_field(qn, cs, K, u_smear) * aa;
    float v = mean + n.x * sig;
    // (streaks are one line tall: fade them linearly once a line is thinner than a noise sample)
    if (u_mode != MODE_WEAK) v += st_streak(qs, floor(qn.y / cs.y), fr, u_streaks) * u_contrast * (st_npx > 0.0 ? min(1.0, cs.y / st_npx) : 1.0);

    if (u_mode == MODE_COLOR) {
      vec3 c = st_field(qn, cs * vec2(max(u_chromaW, 1.0), 1.0), K + 1.0, 1.0) * aa;
      float ca = sig * 0.5 * u_colorAmt;
      float I = c.y * ca, Q = c.z * ca;
      col = vec3(v + 0.956 * I + 0.621 * Q, v - 0.272 * I - 0.647 * Q, v - 1.106 * I + 1.703 * Q);

    } else if (u_mode == MODE_INTERFERENCE) {
      float per = st_H / max(u_ifFreq, 1.0);
      float ang = radians(u_ifAngle);
      float coord;
      if (u_ifStyle == IFSTYLE_HERRINGBONE) {
        float zh = max(per * 3.5, 6.0);                                   // chevron height
        float tri = abs(fract(qs.y / (2.0 * zh)) - 0.5) * 2.0 * zh;     // 0..zh zig-zag
        coord = (qs.x + tan(ang) * tri) * cos(ang);
      } else {
        coord = qs.x * cos(ang) + qs.y * sin(ang);
      }
      float ph = coord / per - t * u_ifSpeed + 0.35 * sin(qs.y / st_H * 11.0 + t * 0.9);   // slow waviness
      float w = sin(PG_TAU * ph);
      w = sign(w) * pow(abs(w), 0.7);                                     // slightly sharpened beat lines
      float fade = smoothstep(2.0, 4.0, per / (st_qpx * pg_ss));          // too fine to resolve → fade out
      // broad bands of stronger / weaker interference sweeping diagonally through the picture
      float yb = (q.y + q.x * 0.35) / st_H;
      float env = 0.5 + 0.5 * sin(PG_TAU * (yb * 1.7 + t * 0.21)) * (0.65 + 0.35 * sin(PG_TAU * (yb * 0.6 - t * 0.09)));
      env = 0.25 + 0.75 * env * (0.7 + 0.6 * pg_vnoise(vec2(q.y / st_H * 9.0, t * 0.8)));
      v += u_ifAmt * env * w * 0.5 * fade * u_contrast;
      col = vec3(v);

    } else if (u_mode == MODE_WEAK) {
      float s = clamp(u_signal, 0.0, 1.0);
      vec2 uv = vec2((q.x + shift) / st_W, 1.0 - q.y / st_H);
      vec3 P;
      if (u_tf_aa > 0.5) {
        vec2 o = vec2(0.3 * st_qpx / st_W, 0.3 * st_qpx / st_H);
        P = 0.5 * (st_picture(uv + o) + st_picture(uv - o));
      } else {
        P = st_picture(uv);
      }
      if (u_echo > 0.0) {
        vec3 E = st_picture(uv - vec2(0.045, 0.0));
        float e = u_echo * 0.55;
        P = (P + e * (E - 0.25)) / (1.0 + e * 0.5);
      }
      float sat = u_colorAmt * smoothstep(0.1, 0.6, s);                  // colour killer on weak signals
      P = mix(vec3(pg_luma(P)), P, sat);
      float k = pow(s, 1.2);
      float ns = sig * (1.15 - 0.95 * s);                                 // n already carries the AA falloff
      col = mix(vec3(mean - 0.04), P, k) + n.x * ns + vec3(n.y, n.z, -n.y) * ns * 0.25 * sat;
      col *= 1.0 + u_flicker * 0.14 * (st_h3(vec2(5.0, 7.0), K + 3.0).x - 0.5) * 2.0;

    } else {
      col = vec3(v);
    }

    if (u_mode == MODE_ANALOG) {
      // scan-line beam profile (fades out when the lines get too fine to resolve)
      float yy = fract(q.y / lp) - 0.5;
      float beam = exp(-yy * yy * 11.0) * 1.42;
      float sf = smoothstep(1.6, 3.2, lp / (st_qpx * pg_ss));
      col *= mix(1.0, beam, u_scanlines * sf);
      // rolling vertical-hold: soft hum band + hard blanking bar with a few VBI data lines
      if (u_roll > 0.0) {
        float yr = fract(q.y / st_H + t * u_rollSpeed + 0.2);                // + 0.2: bar starts near the top
        float hum = 0.5 + 0.5 * cos(PG_TAU * (yr - 0.5));
        col *= 1.0 - u_roll * 0.42 * hum * hum;
        float bh = 0.075 * st_H;                                          // bar height
        float yc = (fract(yr + 0.5) - 0.5) * st_H;                        // cyclic offset from the bar centre, q px
        float a = st_fill(abs(yc) - 0.5 * bh);
        vec3 bar = vec3(0.02 + 0.03 * (n.x * 0.5));
        float yb = yc + 0.5 * bh;                                         // 0..bh inside the bar
        float lineInBar = floor(yb / lp);
        float nLines = floor(bh / lp);
        float dk = floor(t * u_fps * 0.5) * 8.0 + 7.0;                    // data changes every other frame
        vec3 hv = st_h3(vec2(lineInBar, 41.0), dk);
        // whole VBI lines (teletext / closed-caption style dashes) in the second quarter of the bar
        if (lineInBar >= floor(nLines * 0.25) && lineInBar < max(floor(nLines * 0.5), floor(nLines * 0.25) + 1.0) && hv.x < 0.3) {
          float bit = step(0.5, st_h3(vec2(floor(q.x / 9.0), lineInBar), dk + 1.0).x);
          bar += vec3(0.75) * bit * step(0.18 * st_W, q.x);
        }
        col = mix(col, bar, a * min(1.0, u_roll * 1.8));
      }
      col *= 1.0 + u_flicker * 0.16 * (st_h3(vec2(5.0, 7.0), K + 3.0).x - 0.5) * 2.0
                 + u_flicker * 0.04 * sin(t * 37.7);
    }
  }

  col *= u_tint;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
  });
})();
