/* Op-Art — Bridget Riley / Victor Vasarely style optical art: warped stripes, a bulging 'Vega' checkerboard,
 * tunnelling squares, twisted radial bursts, zebra waves, hypnotic spirals and tumbling isometric blocks.
 * Stripes are box-filtered analytically, so they fade to an even tone instead of moiré when they get too fine. */
(function () {
  PG.registerPattern({
    id: 'opart',
    name: 'Op-Art',
    category: 'Op-Art',
    description: 'Riley waves, Vasarely bulges, tunnels, bursts, spirals and tumbling blocks — optical illusions in two or three colors.',
    params: [
      { type: 'heading', label: 'Pattern' },
      {
        id: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          ['stripes', 'Warped stripes'],
          ['bulge', 'Bulge (Vega)'],
          ['squares', 'Concentric squares'],
          ['burst', 'Radial burst'],
          ['zebra', 'Zebra wave'],
          ['spiral', 'Hypnotic spiral'],
          ['cubes', 'Tumbling cubes'],
        ],
        default: 'stripes',
      },
      { id: 'freq', label: 'Frequency', min: 1, max: 60, default: 11, step: 0.1, scale: 'log', random: [6, 18], help: 'Stripes per unit (wedge pairs ×2 for bursts, cube density for cubes)' },
      { id: 'thickness', label: 'Line ratio', min: 0.05, max: 0.95, default: 0.5, step: 0.01, random: [0.35, 0.65], showIf: (v) => v.mode !== 'cubes' && v.mode !== 'bulge', help: 'Share of each period painted in color A' },
      { id: 'angle', label: 'Angle', min: -180, max: 180, default: 0, step: 1, unit: '°', random: [-90, 90], showIf: (v) => v.mode === 'stripes' || v.mode === 'zebra' || v.mode === 'squares', help: 'Stripe direction (squares: direction of the tunnel)' },
      { id: 'distort', label: 'Distortion', min: 0, max: 3, default: 1.2, step: 0.01, random: [0.5, 2], showIf: (v) => v.mode !== 'bulge' },
      {
        id: 'bend',
        label: 'Bend',
        type: 'select',
        options: [
          ['sine', 'Sine waves'],
          ['radial', 'Radial ripple'],
          ['fold', 'Zigzag folds'],
        ],
        default: 'sine',
        showIf: (v) => v.mode === 'stripes',
      },
      { id: 'waveFreq', label: 'Wave frequency', min: 0.2, max: 10, default: 2.4, step: 0.01, scale: 'log', random: [1.2, 4], showIf: (v) => v.mode === 'stripes' || v.mode === 'zebra' || v.mode === 'cubes' || v.mode === 'burst' },
      { id: 'twist', label: 'Twist', min: -4, max: 4, default: 0.8, step: 0.01, random: [-1.5, 1.5], showIf: (v) => v.mode === 'squares' || v.mode === 'burst' || v.mode === 'spiral' },
      { id: 'arms', label: 'Spiral arms', type: 'int', min: 1, max: 12, default: 2, random: [1, 5], showIf: (v) => v.mode === 'spiral' },
      { id: 'bulgeR', label: 'Bulge radius', min: 0.2, max: 2.5, default: 0.85, step: 0.01, random: [0.6, 1.2], showIf: (v) => v.mode === 'bulge' },
      { id: 'bulgeS', label: 'Bulge strength', min: -0.9, max: 0.95, default: 0.65, step: 0.01, random: [0.4, 0.85], showIf: (v) => v.mode === 'bulge', help: 'Negative values pinch the grid into a dimple' },

      { type: 'heading', label: 'Color' },
      {
        id: 'coloring',
        label: 'Coloring',
        type: 'select',
        options: [
          ['duo', 'Two colors'],
          ['tri', 'Three colors'],
          ['bands', 'Gradient bands'],
          ['field', 'Gradient field'],
        ],
        default: 'duo',
        random: ['duo', 'duo', 'tri', 'bands', 'field'],
      },
      { id: 'colorA', label: 'Color A', type: 'color', default: '#111111', random: false },
      { id: 'colorB', label: 'Color B', type: 'color', default: '#f3f0e8', random: false },
      { id: 'colorC', label: 'Accent', type: 'color', default: '#e4572e', random: false, showIf: (v) => v.coloring === 'tri' || v.mode === 'cubes', help: 'Three colors: every other gap. Cubes: the right-hand faces' },
      { id: 'gradient', label: 'Gradient', type: 'gradient', default: 'Pastel Prism', showIf: (v) => v.coloring === 'bands' || v.coloring === 'field', help: 'Replaces color A' },
      { id: 'gradScale', label: 'Gradient repeat', min: 0.05, max: 4, default: 0.6, step: 0.01, scale: 'log', random: [0.25, 1.5], showIf: (v) => v.coloring === 'bands' || v.coloring === 'field' },
      { id: 'shade', label: 'Depth shading', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.6], help: 'Shadows that exaggerate the 3D illusion' },
    ],
    presets: [
      { name: 'Riley Waves', thumb: true, values: { mode: 'stripes', freq: 15, distort: 1.6, bend: 'sine', waveFreq: 2, angle: 90, shade: 0.3 } },
      { name: 'Vega Bulge', values: { mode: 'bulge', freq: 7, bulgeR: 0.95, bulgeS: 0.7, coloring: 'field', gradient: 'Holo Film', gradScale: 0.35, colorB: '#0e0e14', shade: 0.55 } },
      { name: 'Hypno Spiral', values: { mode: 'spiral', freq: 7, arms: 3, twist: 0.6, distort: 0, colorA: '#0d0d0d', colorB: '#f2f2f2' } },
      { name: 'Tumbling Blocks', values: { mode: 'cubes', freq: 7, distort: 0.35, waveFreq: 1.6, colorA: '#1d1d1f', colorB: '#f4f1ea', colorC: '#8d99ae' } },
      { name: 'Zebra', values: { mode: 'zebra', freq: 8, distort: 1.5, waveFreq: 1.4, thickness: 0.5, angle: 70, colorA: '#141414', colorB: '#f6f1e3' } },
      { name: 'Radial Twist', values: { mode: 'burst', freq: 12, twist: 2.2, distort: 0.4, waveFreq: 3, coloring: 'tri', colorA: '#0e1b2c', colorB: '#f5efe0', colorC: '#e63946', shade: 0.35 } },
      { name: 'Pastel Riley', values: { mode: 'stripes', freq: 9, distort: 1.1, bend: 'fold', waveFreq: 1.8, angle: 90, thickness: 0.62, coloring: 'bands', gradient: 'Pastel Prism', gradScale: 0.12, colorB: '#22223b' } },
      { name: 'Vasarely Tunnel', values: { mode: 'squares', freq: 10, distort: 1.0, twist: 0.12, angle: 30, coloring: 'tri', colorA: '#1b1b3a', colorB: '#f2e9e4', colorC: '#c9ada7', shade: 0.4 } },
    ],
    glsl: /* glsl */ `
float opAA = 1.0;   // pixel footprint relative to a full output pixel (1 / supersampling), set in pattern()

// Filter width (in u units) of one output sample.
float opW(float u) { return length(vec2(dFdx(u), dFdy(u))) * opAA; }

// Box-filtered pulse train: 1 on [k, k + duty), 0 on the rest of each period.
// Exact area coverage, so stripes finer than a pixel settle to an even 'duty' grey instead of moiré.
float opPulse(float u, float duty, float w) {
  if (u_tf_aa < 0.5) return step(fract(u), duty);
  w = max(w, 1e-4);
  float a = u - 0.5 * w, b = u + 0.5 * w;
  float ia = floor(a) * duty + min(fract(a), duty);
  float ib = floor(b) * duty + min(fract(b), duty);
  return clamp((ib - ia) / w, 0.0, 1.0);
}

// Box-filtered checkerboard (iq). Returns 1 on 'A' squares.
float opChecker(vec2 q, vec2 w) {
  if (u_tf_aa < 0.5) return mod(floor(q.x) + floor(q.y), 2.0);
  w = max(w, vec2(1e-4));
  vec2 i = 2.0 * (abs(fract((q - 0.5 * w) * 0.5) - 0.5) - abs(fract((q + 0.5 * w) * 0.5) - 0.5)) / w;
  return clamp(0.5 - 0.5 * i.x * i.y, 0.0, 1.0);
}

// Fade a sinusoidal distortion with phase 'ph' (radians) once it oscillates faster than the pixel grid
// (horizon, far zoom): a box-filtered sine averages to zero, and leaving it in only produces speckle.
float opCalm(float ph) { return 1.0 - smoothstep(0.3, 1.3, length(vec2(dFdx(ph), dFdy(ph)))); }

// Mean colour of a gradient (what a band/field colouring averages to when it gets finer than a pixel).
vec3 opGradMean() {
  return (pg_grad(u_gradient, 0.1) + pg_grad(u_gradient, 0.3) + pg_grad(u_gradient, 0.5) + pg_grad(u_gradient, 0.7) + pg_grad(u_gradient, 0.9)) * 0.2;
}

// Gradient (wrapped) box-filtered over [t - d/2, t + d/2]; settles to the mean once d gets large.
vec3 opGradBox(float t, float d) {
  vec3 c = pg_gradWrap(u_gradient, t - 0.375 * d) + pg_gradWrap(u_gradient, t - 0.125 * d)
         + pg_gradWrap(u_gradient, t + 0.125 * d) + pg_gradWrap(u_gradient, t + 0.375 * d);
  return mix(c * 0.25, opGradMean(), smoothstep(0.2, 0.5, d));
}

float opTri(float x) { return abs(fract(x) - 0.5) * 4.0 - 1.0; }   // triangle wave, -1..1, period 1

float opCross(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

// Tumbling blocks: colour of the cube face under hex-local point h (pointy-top hex, centres 1 apart).
// Faces are the three 120° wedges between the rays at 30°, 150° and 270°.
vec3 opCubeFace(vec2 h, vec3 top, vec3 left, vec3 right, float sc) {
  const vec2 d30 = vec2(0.8660254, 0.5), d150 = vec2(-0.8660254, 0.5), d270 = vec2(0.0, -1.0);
  float c30 = opCross(d30, h) * sc, c150 = opCross(d150, h) * sc, c270 = opCross(d270, h) * sc;
  float wt = min(pg_fill(-c30), pg_fill(c150));
  float wl = min(pg_fill(-c150), pg_fill(c270));
  float wr = min(pg_fill(-c270), pg_fill(c30));
  return (top * wt + left * wl + right * wr) / max(wt + wl + wr, 1e-4);
}

vec4 pattern(vec2 p) {
  opAA = clamp(pg_px / max(max(length(dFdx(p)), length(dFdy(p))), 1e-7), 0.15, 1.0);
  float T = u_time;
  float D = u_distort;
  float duty = u_thickness;
  float r = length(p);
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle)));
  vec2 q = vec2(dot(p, vec2(dir.y, -dir.x)), dot(p, dir));   // rotated frame: stripes run along q.x
  vec3 colA = u_colorA, colB = u_colorB;
  float u = 0.0;        // stripe coordinate in periods (the 'on' part of each period is color A)
  float w = 0.0;        // its filter width
  float cov = 0.0;      // coverage of color A
  bool direct = false;  // true when a mode computes cov itself (otherwise: box-filtered stripes of u)
  float sh = 0.0;       // depth shading term, -1 (shadow) .. 1 (light)
  float fieldT = r * 0.5;  // gradient-field coordinate
  float bandA = 1e9, bandB = 1e9;   // colour indices of the A band / the gap (default: from u)
  float bandU = 0.0;                // continuous band coordinate (for filtering the band colours)
  float bandW = 0.0;                // its filter width (0 = measure bandU)
  float bandN = 0.0;                // > 0: bands repeat every bandN (angular modes, so colours have no seam at ±180°)

  if (u_mode == MODE_STRIPES) {
    float wf = u_waveFreq;
    float disp, slope;
    if (u_bend == BEND_RADIAL) {
      float k = r * wf * 3.0 - T;
      float env = 0.55 * exp(-r * 0.6);
      env *= opCalm(k);
      disp = sin(k) * env;
      slope = cos(k) * env;
    } else if (u_bend == BEND_FOLD) {
      float env = 0.6 + 0.4 * sin(q.y * 0.9 + 0.5);
      float k = q.x * wf * 0.5 + 0.15 * q.y + T * 0.08;
      env *= opCalm(k * PG_TAU);
      disp = opTri(k) * env;
      slope = sign(fract(k) - 0.5) * env;
    } else {
      // Riley-style: the wave's phase drifts with height and its amplitude swells, so lines bunch into folds
      float env = 0.3 + 0.7 * smoothstep(-1.0, 1.0, sin(q.y * 1.1 + q.x * 0.3 + 0.9));
      float k = q.x * wf * 3.0 * (1.0 + 0.25 * sin(q.y * 0.35)) + q.y * wf * 0.8 + T * 0.6;
      env *= opCalm(k);
      disp = sin(k) * env;
      slope = cos(k) * env;
    }
    u = u_freq * q.y + D * 2.2 * disp;
    sh = -slope;
    fieldT = q.x * 0.35 + 0.5;
  } else if (u_mode == MODE_BULGE) {
    // Vasarely 'Vega': a checkerboard magnified by a spherical lens
    vec2 c = 0.22 * vec2(sin(T * 0.5), sin(T * 0.37));
    vec2 v = p - c;
    float x = clamp(1.0 - dot(v, v) / (u_bulgeR * u_bulgeR), 0.0, 1.0);
    vec2 g = (c + v * (1.0 - u_bulgeS * x * x)) * u_freq;
    cov = opChecker(g, vec2(opW(g.x), opW(g.y)));
    direct = true;
    bandA = floor(g.x) + floor(g.y);
    bandB = floor(g.y);
    bandU = g.x + g.y;
    vec3 n = vec3(v / u_bulgeR, sqrt(x));
    sh = (dot(n, normalize(vec3(-0.45, 0.55, 0.7))) - 0.7) * 1.8 * sign(u_bulgeS) * smoothstep(0.0, 0.12, x);
    fieldT = length(v) / u_bulgeR * 0.8;
  } else if (u_mode == MODE_SQUARES) {
    // nested squares whose centres slide towards a vanishing point (tunnel), each ring turned a little more
    vec2 vp = clamp(D * 0.28, 0.0, 0.85) * dir;
    vec2 pr = pg_rot(u_twist * max(abs(p.x), abs(p.y))) * p;
    vec2 s = abs(pr) / (1.0 + sign(pr) * vp);
    float d = max(s.x, s.y);
    u = u_freq * d - T * 0.5;
    sh = -exp(-d * 2.5) * 2.0 + 0.6;
    fieldT = d;
  } else if (u_mode == MODE_BURST) {
    float n = max(floor(u_freq * 2.0 + 0.5), 2.0);
    float wob = D * 0.18 * sin(r * u_waveFreq * 4.0 - T * 1.5);
    float tw = u_twist * log(max(r, 1e-4)) * 2.0 - T * 0.25;
    float u1 = n * atan(p.y, p.x) / PG_TAU + tw + wob;
    float u2 = n * (atan(-p.y, -p.x) + PG_PI) / PG_TAU + tw + wob;   // same field, seam on the other side
    u = u1;
    w = min(opW(u1), opW(u2));
    bandN = n;
    sh = smoothstep(0.0, 1.0, r) * 1.4 - 1.0;
    fieldT = r * 0.6;
  } else if (u_mode == MODE_ZEBRA) {
    // domain-warped stripes; noise added to the stripe *field* (not the coordinate) makes them fork and merge
    float wf = u_waveFreq;
    vec2 z = q * wf * 0.5;
    vec2 wq = q + D * 0.22 * vec2(pg_fbm(z + 3.1, 3), pg_fbm(z + vec2(T * 0.05, 8.7), 3));
    float bendN = pg_fbm(wq * wf * 0.35 + vec2(0.0, T * 0.04), 3);
    u = u_freq * wq.y + D * 1.6 * bendN + D * 0.5 * sin(wq.x * wf * 1.3 + T * 0.4);
    float field = cos(PG_TAU * u) + 1.7 * min(D, 1.5) * pg_fbm(wq * wf * 1.3 + 13.7, 3);
    cov = pg_aastep(cos(PG_PI * duty), field);
    if (u_tf_aa > 0.5) cov = mix(cov, duty, smoothstep(0.08, 0.3, max(opW(u), pg_px * max(u_freq, u_waveFreq * 2.0) * 0.7)));
    direct = true;
    sh = bendN * 2.0;
    fieldT = wq.y * 0.35 + bendN;
  } else if (u_mode == MODE_SPIRAL) {
    float a = floor(u_arms + 0.5);
    float rr = max(r, 1e-4);
    float base = u_freq * 0.6 * r + u_twist * log(rr) * 1.5 + D * 0.3 * sin(3.0 * atan(p.y, p.x) + r * 5.0) - T * 0.8;
    float u1 = a * atan(p.y, p.x) / PG_TAU + base;
    float u2 = a * (atan(-p.y, -p.x) + PG_PI) / PG_TAU + base;
    u = u1;
    w = min(opW(u1), opW(u2));
    bandN = a;
    sh = smoothstep(0.0, 1.3, r) * 1.2 - 1.0;
    fieldT = r * 0.6;
  } else {
    // tumbling blocks on a pointy-top hex lattice; a gentle sine warp makes the stack ripple
    float sc = u_freq * 0.32;
    vec2 x = p * sc;
    x += D * 0.12 * vec2(sin(x.y * u_waveFreq * 0.6 + T * 0.5), sin(x.x * u_waveFreq * 0.6 - T * 0.4));
    vec4 hg = pg_hexGrid(x);
    vec2 h = hg.xy;
    vec3 top = colB, left = colA, right = u_colorC;
    if (u_coloring == COLORING_BANDS || u_coloring == COLORING_FIELD) {
      float t = u_coloring == COLORING_BANDS ? pg_hash12(hg.zw) : length(hg.zw) * u_gradScale * 0.15;
      top = pg_gradWrap(u_gradient, t);
    }
    float ps = 1.0 / sc;                                   // hex units → pattern units (approx.)
    vec3 own = opCubeFace(h, top, left, right, ps);
    // blend across the hex border with the neighbour's face (normal directions 0°, 60°, … for pointy-top)
    float ang = floor(atan(h.y, h.x) / (PG_PI / 3.0) + 0.5) * (PG_PI / 3.0);
    vec2 nrm = vec2(cos(ang), sin(ang));
    vec3 nb = opCubeFace(h - nrm, top, left, right, ps);
    if (u_coloring == COLORING_BANDS || u_coloring == COLORING_FIELD) {
      const vec2 S = vec2(1.0, 1.7320508);                // hex id → centre
      vec2 nid = floor((hg.zw * S + nrm) / S * 2.0 + 0.5) * 0.5;
      float t = u_coloring == COLORING_BANDS ? pg_hash12(nid) : length(nid) * u_gradScale * 0.15;
      vec3 ntop = pg_gradWrap(u_gradient, t);
      nb = opCubeFace(h - nrm, ntop, left, right, ps);
    }
    float edge = pg_sdHex(h.yx, 0.5) * ps;
    vec3 col = mix(nb, own, pg_fill(edge));
    if (u_tf_aa > 0.5) col = mix(col, (top + left + right) / 3.0, smoothstep(0.12, 0.35, pg_px * sc));
    return vec4(col * (1.0 - u_shade * 0.6 * smoothstep(0.2, 1.8, r)), 1.0);
  }

  if (!direct) {
    if (w <= 0.0) w = opW(u);
    cov = opPulse(u, duty, w);
  }

  // colours: gradient replaces A (by band index or by position); 'tri' alternates B / accent in the gaps
  if (bandA > 1e8) { bandA = floor(u - 0.5 * duty + 0.5); bandU = u; bandW = w; }  // nearest A band
  if (bandB > 1e8) bandB = floor(u - 0.5 * duty);        // nearest gap
  if (bandN > 0.0) { bandA = mod(bandA, bandN); bandB = mod(bandB, bandN); bandU = mod(bandU, bandN); }
  float bw = bandW > 0.0 ? bandW : opW(bandU);
  if (u_coloring == COLORING_BANDS) {
    float gs = u_gradScale * 0.25;
    colA = pg_gradWrap(u_gradient, bandA * gs);
    if (u_tf_aa > 0.5) {
      // bands finer than a pixel: per-band colours → the smooth gradient they average to → its overall mean
      colA = mix(colA, opGradBox(bandU * gs, bw * gs), smoothstep(0.6, 1.6, bw));
    }
  } else if (u_coloring == COLORING_FIELD) {
    float t = fieldT * u_gradScale * 2.0;
    colA = pg_grad(u_gradient, 1.0 - abs(fract(t * 0.5) * 2.0 - 1.0));   // ping-pong, no seams
    if (u_tf_aa > 0.5) colA = mix(colA, opGradMean(), smoothstep(0.15, 0.5, opW(t)));
  } else if (u_coloring == COLORING_TRI) {
    colB = mod(bandB, 2.0) < 0.5 ? u_colorB : u_colorC;
    if (u_tf_aa > 0.5) colB = mix(colB, 0.5 * (u_colorB + u_colorC), smoothstep(0.3, 0.7, bw));
  }
  vec3 col = mix(colB, colA, cov);
  col *= 1.0 + u_shade * 0.45 * clamp(sh, -1.0, 1.0);
  return vec4(col, 1.0);
}
`,
  });
})();
