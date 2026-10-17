/* Guilloché — banknote / certificate security engraving: woven rosettes, spirograph loops, rope bands,
 * crossing wave meshes, concentric dial rings and certificate frames.
 * Every line is drawn from an analytic distance estimate (|f| / |grad f|, or a few Newton steps for looped
 * curves), and only the nearest few curves of each family are evaluated, so 80+ lines stay cheap. */
(function () {
  const is = (...modes) => (v) => modes.includes(v.mode);

  PG.registerPattern({
    id: 'guilloche',
    name: 'Guilloché',
    category: 'Security',
    description: 'Banknote security engraving: woven rosettes, spirograph loops, rope bands, wave meshes, dial rings and borders.',
    params: [
      { type: 'heading', label: 'Style' },
      {
        id: 'mode',
        label: 'Layout',
        type: 'select',
        options: [
          ['rosette', 'Rosette'],
          ['spiro', 'Spirograph'],
          ['bands', 'Rope bands'],
          ['mesh', 'Wave mesh'],
          ['rings', 'Dial rings'],
          ['border', 'Border frame'],
        ],
        default: 'rosette',
      },

      { type: 'heading', label: 'Lines' },
      { id: 'lines', label: 'Line count', type: 'int', min: 4, max: 96, default: 20, random: [12, 30] },
      { id: 'width', label: 'Line width', min: 0.0005, max: 0.02, default: 0.0018, step: 0.0001, scale: 'log', random: [0.0012, 0.003] },
      { id: 'amp', label: 'Amplitude', min: 0, max: 1, default: 0.3, step: 0.01, random: [0.15, 0.55], help: 'Wave height (relative)' },
      { id: 'lobes', label: 'Lobes', type: 'int', min: 1, max: 48, default: 10, random: [5, 14], help: 'Waves per turn / per length' },
      { id: 'spread', label: 'Phase spread', min: 0.02, max: 1, default: 1, step: 0.01, random: [0.2, 1], showIf: is('rosette', 'spiro', 'bands', 'border'), help: '1 = copies evenly interlaced, small = tight ribbons' },
      { id: 'loop', label: 'Loops', min: 0, max: 3, default: 1.6, step: 0.01, random: [0.8, 2.4], showIf: is('spiro'), help: 'Above 1 the curve folds back into loops' },

      { type: 'heading', label: 'Arrangement' },
      { id: 'radius', label: 'Radius', min: 0.1, max: 2, default: 0.78, step: 0.01, scale: 'log', random: [0.45, 0.85], showIf: is('rosette', 'spiro', 'rings') },
      { id: 'layers', label: 'Layers', type: 'int', min: 1, max: 4, default: 3, random: [1, 4], showIf: is('rosette', 'spiro', 'border') },
      { id: 'spacing', label: 'Row spacing', min: 0.05, max: 1, default: 0.3, step: 0.005, scale: 'log', random: [0.2, 0.45], showIf: is('bands') },
      { id: 'twist', label: 'Phase step', min: -1, max: 1, default: 0.5, step: 0.01, random: [-0.5, 0.5], help: 'Phase shift between layers / rows / rings, in waves' },
      { id: 'speed', label: 'Drift speed', min: -2, max: 2, default: 0.3, step: 0.01, random: [-0.6, 0.6], help: 'Layers counter-rotate and waves travel when Animate is on' },

      { type: 'heading', label: 'Color' },
      { id: 'colorBy', label: 'Coloring', type: 'select', options: [['solid', 'Two inks'], ['lines', 'Gradient across lines'], ['radial', 'Gradient by distance']], default: 'solid', random: ['solid', 'solid', 'lines', 'radial'] },
      { id: 'ink', label: 'Ink', type: 'color', default: '#0f4a35', random: false, showIf: (v) => v.colorBy === 'solid' },
      { id: 'ink2', label: 'Second ink', type: 'color', default: '#5f9e7a', random: false, showIf: (v) => v.colorBy === 'solid', help: 'Alternate layers / rows / families' },
      { id: 'grad', label: 'Gradient', type: 'gradient', default: 'Holo Film', showIf: (v) => v.colorBy !== 'solid' },
      { id: 'bg', label: 'Background', type: 'color', default: '#f1ecdc', random: false },
      { id: 'paper', label: 'Paper texture', min: 0, max: 1, default: 0.35, step: 0.01, random: [0, 0.5] },
      { id: 'glow', label: 'Glow', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.3], help: 'Light halo on dark paper, ink bleed on light paper' },
    ],
    presets: [
      { name: 'Banknote Rosette', thumb: true, values: {} },
      {
        name: 'Certificate Border',
        values: { mode: 'border', lines: 18, width: 0.0018, amp: 0.45, lobes: 16, spread: 0.55, layers: 3, twist: 0.5, ink: '#1f3a6b', ink2: '#7a5c2e', bg: '#f4efe1', paper: 0.45 },
      },
      {
        name: 'Spirograph',
        values: { mode: 'spiro', lines: 16, width: 0.0018, amp: 0.95, lobes: 7, loop: 2.2, radius: 0.85, layers: 1, colorBy: 'radial', grad: 'Sunset', bg: '#0d1020', paper: 0, glow: 0.25 },
      },
      {
        name: 'Wave Bands',
        values: { mode: 'bands', lines: 14, width: 0.0022, amp: 0.4, lobes: 6, spread: 0.35, spacing: 0.3, twist: 0.5, ink: '#7a1f3d', ink2: '#2d4f86', bg: '#f6f0e6', paper: 0.3 },
      },
      {
        name: 'Security Mesh',
        values: { mode: 'mesh', lines: 56, width: 0.0024, amp: 0.3, lobes: 7, twist: 0.12, ink: '#2b59a8', ink2: '#c2457a', bg: '#f3f1ea', paper: 0.25 },
      },
      {
        name: 'Holographic Foil',
        values: { mode: 'rosette', lines: 24, width: 0.0018, amp: 0.38, lobes: 10, radius: 0.85, layers: 3, twist: 0.25, colorBy: 'lines', grad: 'Holo Film', bg: '#07070b', paper: 0, glow: 0.45 },
      },
      {
        name: 'Guilloché Dial',
        values: { mode: 'rings', lines: 64, width: 0.0018, amp: 0.25, lobes: 18, twist: 0, radius: 0.5, ink: '#3c4048', ink2: '#3c4048', bg: '#d7d9dd', paper: 0.15 },
      },
    ],
    glsl: /* glsl */ `
// Ink coverage of a line of half-width w at distance d. Lines thinner than a pixel dim instead of breaking up.
float gcInk(float d, float w) {
  float ww = u_tf_aa > 0.5 ? max(w, 0.5 * pg_px) : w;
  return pg_stroke(d, ww) * (w / ww);
}

// Once neighbouring lines are packed tighter than ~2 samples apart, blend towards their average ink density
// (calm horizon instead of moiré mush). spacing = local distance between the two nearest lines.
float gcSettle(float cov, float spacing, float w) {
  if (u_tf_aa < 0.5) return cov;
  float k = 1.0 - smoothstep(1.0 * pg_px, 2.5 * pg_px, spacing);
  return mix(cov, clamp(2.0 * w / max(spacing, 1e-6), 0.0, 1.0), k);
}

// Nearest curve of a woven family, in a band's local frame (x along, y across; J = metric length of one x unit).
// Copy i (0..N-1, repeating every period P = 2π/k) is the trochoid
//   x(t) = (t + a·cos t)/k + m·P + i·D,   y(t) = A·sin t,   D = spread·P/N
// a = 0 gives plain sine waves, a > 1 makes loops. Only the copies next to the point are evaluated:
// both solutions of A·sin t = y give the copy offsets, then 6 neighbours each are tested.
// Returns vec3(distance, copy index, distance between the two nearest copies).
vec3 gcWeave(float xp, float yp, float J, float A, float k, float a, float N, float spread) {
  float P = PG_TAU / k;
  float D = spread * P / N;
  float as = asin(clamp(yp / max(A, 1e-6), -1.0, 1.0));
  float best = 1e9, second = 1e9, bo = 1e9, bi = 0.0;
  for (int b = 0; b < 2; b++) {
    float t0 = b == 0 ? as : PG_PI - as;
    float rel = xp - (t0 + a * cos(t0)) / k;
    float m = floor(rel / P);
    float i0 = floor((rel - m * P) / D);
    for (int j = 0; j < 6; j++) {
      float i, o;
      if (j < 4) { i = clamp(i0 + float(j - 1), 0.0, N - 1.0); o = m * P + i * D; }
      else if (j == 4) { i = 0.0; o = (m + 1.0) * P; }             // first copy of the next period
      else { i = N - 1.0; o = (m - 1.0) * P + i * D; }              // last copy of the previous period
      float d;
      if (a == 0.0) {
        float t = k * (xp - o);
        float slope = A * k * cos(t) / J;
        d = abs(yp - A * sin(t)) / sqrt(1.0 + slope * slope);
      } else {
        // a few Newton steps towards the closest point (local frame, metric J along x)
        float t = t0;
        for (int it = 0; it < 3; it++) {
          float st = sin(t), ct = cos(t);
          float X = J * ((t + a * ct) / k + o - xp), Y = A * st - yp;
          float Xp = J * (1.0 - a * st) / k, Yp = A * ct;
          float g = X * Xp + Y * Yp;
          float h = Xp * Xp + Yp * Yp - X * J * a * ct / k - Y * A * st;
          t -= clamp(g / (h > 1e-9 ? h : Xp * Xp + Yp * Yp + 1e-9), -0.6, 0.6);
        }
        d = length(vec2(J * ((t + a * cos(t)) / k + o - xp), A * sin(t) - yp));
      }
      bool same = abs(o - bo) < 1e-4 * P;   // the same copy reached from the other branch
      if (d < best) { if (!same) second = best; best = d; bo = o; bi = i; }
      else if (!same && d < second) second = d;
    }
  }
  return vec3(best, bi, best + second);
}

// Nearest line of the level-set family  v - A·sin(k·u + ph + tau·v) = n·S  (u along with metric J, v across).
// Returns vec3(distance, line number, local spacing).
vec3 gcLevels(float u, float v, float J, float A, float dA, float k, float ph, float S, float tau) {
  float psi = k * u + ph + tau * v;
  float g = (v - A * sin(psi)) / S;
  float gv = (1.0 - dA * sin(psi) - A * cos(psi) * tau) / S;
  float gu = -A * k * cos(psi) / (J * S);
  float gl = max(length(vec2(gu, gv)), 1e-6);
  float n = floor(g + 0.5);
  return vec3(abs(g - n) / gl, n, 1.0 / gl);
}

vec3 gc_col;   // running colour

// Glow falloff length; the halo ends smoothly at 4 of these (the families' reach includes it).
float gcGlowLen() { return 0.012 + 3.0 * pg_px; }

void gcInkOver(vec3 hit, float layer, float N, float pos) {
  float w = 0.5 * u_width;
  float cov = gcSettle(gcInk(hit.x, w), hit.z, w);
  vec3 ink;
  if (u_colorBy == COLORBY_SOLID) ink = mod(layer, 2.0) < 0.5 ? u_ink : u_ink2;
  else if (u_colorBy == COLORBY_LINES) ink = pg_grad(u_grad, (hit.y + 0.5) / N);
  else ink = pg_grad(u_grad, clamp(pos, 0.0, 1.0));
  if (u_glow > 0.0) {
    float x = max(hit.x - w, 0.0), s = gcGlowLen();
    float g = u_glow * 0.55 * exp(-x / s) * (1.0 - smoothstep(2.5 * s, 4.0 * s, x));
    // light emitted on dark paper, a soft ink bleed on light paper
    gc_col = mix(gc_col + ink * g, mix(gc_col, ink, min(g, 1.0)), smoothstep(0.25, 0.6, pg_luma(u_bg)));
  }
  gc_col = mix(gc_col, ink, cov);
}

vec3 gcPaper(vec2 p) {
  vec3 c = u_bg;
  if (u_paper > 0.0) {
    float fade = 1.0 - smoothstep(0.004, 0.02, pg_px);
    float n = 0.6 * pg_noise(p * 9.0) + 0.4 * pg_noise(p * vec2(4.0, 90.0) + 7.0) * fade + 0.5 * (pg_hash12(floor(p * 300.0)) - 0.5) * fade;
    c *= 1.0 + u_paper * 0.07 * n;
    c = mix(c, c * vec3(0.96, 0.93, 0.86), u_paper * 0.35 * smoothstep(0.6, 1.8, length(p)));
  }
  return c;
}

// Rounded-rectangle path (straight half-lengths h, corner radius rc). Returns (arc length along the centre line,
// signed distance across it, along-metric J: 1 on the straights, (rc + across) / rc around the corners).
vec3 gcFrame(vec2 p, vec2 h, float rc) {
  vec2 c = clamp(p, -h, h);
  vec2 dl = p - c;
  float q = PG_PI * 0.5 * rc;
  if (dl.x == 0.0 && dl.y == 0.0) {             // inside the straight core: push to the nearest side
    vec2 e = h - abs(p);
    if (e.x < e.y) dl.x = sign(p.x) * 1e-6; else dl.y = sign(p.y) * 1e-6;
    c = p - dl;
  }
  float a = atan(dl.y, dl.x), s, J = 1.0;
  if (dl.y == 0.0 && dl.x > 0.0) s = c.y + h.y;
  else if (dl.x == 0.0 && dl.y > 0.0) s = 2.0 * h.y + q + (h.x - c.x);
  else if (dl.y == 0.0 && dl.x < 0.0) s = 2.0 * h.y + 2.0 * h.x + 2.0 * q + (h.y - c.y);
  else if (dl.x == 0.0 && dl.y < 0.0) s = 4.0 * h.y + 2.0 * h.x + 3.0 * q + (c.x + h.x);
  else {
    J = length(dl) / rc;
    if (dl.x > 0.0 && dl.y > 0.0) s = 2.0 * h.y + rc * a;
    else if (dl.x < 0.0 && dl.y > 0.0) s = 2.0 * h.y + 2.0 * h.x + q + rc * (a - PG_PI * 0.5);
    else if (dl.x < 0.0) s = 4.0 * h.y + 2.0 * h.x + 2.0 * q + rc * (a + PG_PI);
    else s = 4.0 * h.y + 4.0 * h.x + 3.0 * q + rc * (a + PG_PI * 0.5);
  }
  return vec3(s, length(dl) - rc, J);
}

vec4 pattern(vec2 p) {
  gc_col = gcPaper(p);
  float N = u_lines;
  float w = 0.5 * u_width;
  float reach = w + (u_glow > 0.0 ? 4.0 * gcGlowLen() : 0.0) + 4.0 * pg_px;   // skip curves farther than this (glow included)
  int L = int(u_layers);
  float drift = u_time * u_speed;                 // radians of wave phase

  if (u_mode == MODE_ROSETTE || u_mode == MODE_SPIRO) {
    float r = length(p), th = atan(p.y, p.x);
    bool spiro = u_mode == MODE_SPIRO;
    for (int j = 0; j < 4; j++) {
      if (j >= L) break;
      float fj = float(j);
      float Rj = u_radius * (1.0 - fj * (spiro ? 0.32 : 0.27));
      float kj = max(2.0, floor(u_lobes * (spiro ? 1.0 : Rj / u_radius) + 0.5));
      float A, R0;
      if (spiro) { A = Rj * 0.5 * u_amp; R0 = Rj - A; }   // loops sweep between R0 - A and R0 + A
      else { A = u_amp * Rj; R0 = Rj - A; }
      if (abs(r - R0) > A + reach) continue;
      float shift = (u_twist * PG_TAU * fj + drift * (mod(fj, 2.0) < 0.5 ? 1.0 : -1.0)) / kj;   // layers counter-rotate
      vec3 hit = gcWeave(th - shift, r - R0, max(r, 1e-3), A, kj, spiro ? u_loop : 0.0, N, u_spread);
      gcInkOver(hit, fj, N, r / (u_radius * 1.05));
    }
  } else if (u_mode == MODE_BANDS) {
    float k = PG_PI * u_lobes * 0.5;
    float A = u_amp * 2.0 / u_lobes;
    float S = u_spacing;
    float row0 = floor(p.y / S + 0.5);
    for (int j = -4; j <= 4; j++) {                 // rows overlap when the amplitude exceeds the spacing
      float row = row0 + float(j);
      float yp = p.y - row * S;
      if (abs(yp) > A + reach) continue;
      vec3 hit = gcWeave(p.x + (row * u_twist * PG_TAU + drift * (mod(row, 2.0) < 0.5 ? 1.0 : -1.0)) / k, yp, 1.0, A, k, 0.0, N, u_spread);
      gcInkOver(hit, row, N, 0.5 + 0.5 * p.y);
    }
  } else if (u_mode == MODE_MESH) {
    float k = PG_PI * u_lobes * 0.5;
    float S = 2.0 / N;
    float A = u_amp * 0.25;
    float tau = clamp(u_twist * PG_TAU / S, -0.8 / max(A, 1e-4), 0.8 / max(A, 1e-4));
    vec3 h1 = gcLevels(p.x, p.y, 1.0, A, 0.0, k, drift, S, tau);
    vec3 h2 = gcLevels(p.x, p.y, 1.0, A, 0.0, k, PG_PI - drift, S, -tau);
    gcInkOver(h2, 1.0, N, 0.5 + 0.5 * p.x);
    gcInkOver(h1, 0.0, N, 0.5 + 0.5 * p.y);
  } else if (u_mode == MODE_RINGS) {
    float r = length(p), th = atan(p.y, p.x);
    float S = 2.0 / N;
    float x = clamp(r / u_radius, 0.0, 1.0);
    float A = u_amp * 0.25 * x * x * (3.0 - 2.0 * x);                 // waves grow from a calm centre
    float dA = u_amp * 0.25 * 6.0 * x * (1.0 - x) / u_radius * step(r, u_radius);
    float k = max(1.0, floor(u_lobes + 0.5));
    float tau = clamp(u_twist * PG_TAU / S, -0.8 / max(A, 1e-4), 0.8 / max(A, 1e-4));
    vec3 h1 = gcLevels(th, r, max(r, 1e-3), A, dA, k, drift, S, tau);
    vec3 h2 = gcLevels(th, r, max(r, 1e-3), A, dA, k, PG_PI - drift, S, -tau);
    float pos = r / (u_radius * 2.0);
    gcInkOver(h2, 1.0, N, pos);
    gcInkOver(h1, 0.0, N, pos);
  } else {
    // border: nested frames fitted to the view — rope bands alternating with finer full braids
    float aspect = u_res.x / u_res.y;
    float A0 = u_amp * 0.1;
    float inset = 0.06, prevA = 0.0;
    for (int j = 0; j < 4; j++) {
      if (j >= L) break;
      float fj = float(j);
      bool fine = mod(fj, 2.0) > 0.5;
      float A = fine ? 0.5 * A0 : A0;
      inset += prevA + A + (j > 0 ? 0.018 : 0.0);
      prevA = A;
      float rc = max(A + 0.02, 0.24 - inset);
      vec2 h = max(vec2(aspect, 1.0) - inset - rc, vec2(0.02));
      vec3 fr = gcFrame(p, h, rc);
      if (abs(fr.y) > A + reach) continue;
      float per = 4.0 * (h.x + h.y) + PG_TAU * rc;
      float waves = max(4.0, floor(u_lobes * per * (fine ? 0.5 : 0.25) + 0.5));   // whole number of waves around
      float k = PG_TAU * waves / per;
      vec3 hit = gcWeave(fr.x + (fj * u_twist * PG_TAU + drift * (fine ? -1.0 : 1.0)) / k, fr.y, fr.z, A, k, 0.0, N, fine ? 1.0 : u_spread);
      gcInkOver(hit, fj, N, fj / max(float(L) - 1.0, 1.0));
    }
  }
  return vec4(gc_col, 1.0);
}
`,
  });
})();
