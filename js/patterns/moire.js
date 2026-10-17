/* RGB Moiré — rainbow interference bands, beat moiré and RGB channel fringes.
 * A field (rings, lines, interference, spiral, grid, overlay, radial) yields 1–4 grating phases (in periods).
 * Colour modes: 'gradient' sweeps a cyclic gradient once per band (interference sources → wave sum: carrier
 * colour + dark fringes; grid/overlay → colour follows the beat between the two gratings), 'rgb' gives R, G
 * and B their own slightly offset gratings, 'lines' draws the gratings as ink. Unresolvable detail fades to
 * its average colour unless Smooth edges is off, in which case the raw sampling aliases into genuine moiré.
 * 'Alias grain' samples on a coarse screen grid (in CSS px, so it looks the same at any DPI / export size) and
 * blends bilinearly, like a low-res render scaled up — see the 'Holo Wave' preset. */
(function () {
  // Pastel holographic rainbow sampled from the reference image (red → lime → green → blue → violet → red).
  const HOLO = {
    stops: [[0, '#ff5459'], [0.3, '#c8ff5c'], [0.45, '#5ef470'], [0.66, '#5870ff'], [0.77, '#6c56f2'], [1, '#ff5459']],
    mode: 'smooth',
  };
  const is = (...f) => (v) => f.includes(v.field);
  const multi = (v) => v.field === 'grid' || v.field === 'overlay' || (v.field === 'interference' && v.combine === 'waves');
  const mode = (...m) => (v) => m.includes(v.colorMode);
  const gratings = (v) => v.field === 'grid' || v.field === 'overlay';
  const showFill = (v) => v.colorMode === 'gradient' && !gratings(v);

  PG.registerPattern({
    id: 'moire',
    name: 'RGB Moiré',
    category: 'Op-Art',
    description: 'Rainbow interference bands, zone-plate aliasing, beat moiré and RGB channel fringes.',
    params: [
      { type: 'heading', label: 'Field' },
      {
        id: 'field',
        label: 'Field',
        type: 'select',
        options: [
          ['rings', 'Rings'],
          ['lines', 'Lines'],
          ['interference', 'Interference'],
          ['spiral', 'Spiral'],
          ['grid', 'Grid'],
          ['overlay', 'Overlay (beat)'],
          ['radial', 'Radial'],
        ],
        default: 'interference',
        random: ['rings', 'rings', 'lines', 'interference', 'interference', 'spiral', 'grid', 'overlay', 'overlay', 'radial'],
      },
      { id: 'centerX', label: 'Centre X', min: -3, max: 3, default: -1.6, step: 0.01, random: [-1.6, 1.6], showIf: (v) => is('rings', 'interference', 'spiral', 'radial')(v) || (v.field === 'lines' && v.power !== 1) },
      { id: 'centerY', label: 'Centre Y', min: -3, max: 3, default: -1.2, step: 0.01, random: [-1.2, 1.2], showIf: (v) => is('rings', 'interference', 'spiral', 'radial')(v) || (v.field === 'lines' && v.power !== 1) },
      { id: 'angle', label: 'Angle', min: -180, max: 180, default: 100, step: 1, unit: '°', random: [-90, 90], help: 'Grating / source orientation; also the direction of the wobble', showIf: (v) => is('lines', 'interference', 'grid', 'overlay')(v) || (v.wobble > 0 && is('rings', 'spiral')(v)) },
      { id: 'sources', label: 'Sources', type: 'int', min: 2, max: 4, default: 2, random: [2, 3], showIf: is('interference') },
      { id: 'spacing', label: 'Source spacing', min: 0.02, max: 4, default: 0.6, step: 0.01, scale: 'log', random: [0.3, 1.6], showIf: is('interference') },
      {
        id: 'combine',
        label: 'Combine',
        type: 'select',
        options: [['waves', 'Wave sum'], ['ellipses', 'Sum of distances'], ['hyperbolas', 'Difference']],
        default: 'waves',
        help: 'Wave sum: coloured wavefronts with dark interference fringes. Sum → ellipses, difference → hyperbolas.',
        showIf: is('interference'),
      },
      { id: 'twist', label: 'Twist', min: -45, max: 45, default: 4, step: 0.1, unit: '°', random: [-8, 8], help: 'Rotation of the second grating', showIf: is('overlay') },
      { id: 'ratio', label: 'Scale ratio', min: 0.5, max: 2, default: 1.05, step: 0.001, scale: 'log', random: [0.92, 1.08], help: 'Frequency of the second grating relative to the first', showIf: is('overlay', 'grid') },
      { id: 'arms', label: 'Arms', type: 'int', min: -12, max: 12, default: 3, random: [-6, 6], help: 'Negative = opposite twist, 0 = rings', showIf: is('spiral') },
      { id: 'power', label: 'Spacing curve', min: 0.5, max: 3, default: 1.4, step: 0.01, random: [0.9, 2], help: '1 = even spacing, 2 = Newton rings / zone plate (bands crowd outwards)', showIf: is('rings', 'lines', 'interference', 'spiral') },

      { type: 'heading', label: 'Bands' },
      { id: 'freq', label: 'Frequency', min: 0.5, max: 200, default: 6, step: 0.01, scale: 'log', random: [4, 24], help: 'Bands per unit' },
      { id: 'fill', label: 'Thickness', min: 0.05, max: 1, default: 1, step: 0.01, random: [0.55, 1], help: 'Width of each colour band; below 1 leaves gaps of the background colour', showIf: showFill },
      { id: 'width', label: 'Thickness', min: 0.02, max: 0.98, default: 0.5, step: 0.01, random: [0.2, 0.7], help: 'Line width as a fraction of the band period', showIf: (v) => v.colorMode !== 'gradient' || gratings(v) },
      { id: 'sharp', label: 'Sharpness', min: 0, max: 1, default: 0, step: 0.01, random: [0, 1], help: 'Soft sine-like bands ↔ hard-edged bands' },
      { id: 'phase', label: 'Phase', min: 0, max: 1, default: 0, step: 0.001, random: [0, 1] },
      { id: 'drift', label: 'Drift', min: -4, max: 4, default: 0.5, step: 0.01, random: [-1, 1], help: 'Animation speed in bands per second (also moves the wobble). Used when Animate is on.' },

      { type: 'heading', label: 'Distortion' },
      { id: 'wobble', label: 'Wobble', min: 0, max: 2, default: 0.15, step: 0.001, random: [0, 0.6], help: 'Sinusoidal bending of the bands (in band widths, measured 1 unit from the centre)' },
      { id: 'wobbleFreq', label: 'Wobble freq', min: 0.2, max: 12, default: 2, step: 0.01, scale: 'log', random: [0.6, 3], showIf: (v) => v.wobble > 0 },
      { id: 'wobbleGrow', label: 'Wobble growth', min: 0, max: 3, default: 1, step: 0.01, random: [0, 1.5], help: '0 = even wobble everywhere, higher = calm near the centre, wild further out', showIf: (v) => v.wobble > 0 && is('rings', 'interference', 'spiral')(v) },
      { id: 'turbulence', label: 'Turbulence', min: 0, max: 2, default: 0, step: 0.01, random: [0, 0.5], help: 'Organic noise distortion of the bands, in band widths (changes with the Seed)' },

      { type: 'heading', label: 'Color' },
      {
        id: 'colorMode',
        label: 'Color mode',
        type: 'select',
        options: [['gradient', 'Gradient bands'], ['rgb', 'RGB channels'], ['lines', 'Lines']],
        default: 'gradient',
        random: ['gradient', 'gradient', 'rgb', 'lines'],
      },
      { id: 'grad', label: 'Gradient', type: 'gradient', default: HOLO, showIf: (v) => v.colorMode === 'gradient' || (v.colorMode === 'lines' && v.lineGrad) },
      {
        id: 'steps',
        label: 'Color steps',
        type: 'int',
        min: 2,
        max: 16,
        default: 6,
        random: [3, 8],
        help: 'Gradient mode: solid colour bands per cycle (with Sharpness or Thickness). Lines mode: lines per colour cycle.',
        showIf: (v) => (v.colorMode === 'gradient' && (v.sharp > 0 || (showFill(v) && v.fill < 1) || v.field === 'grid')) || (v.colorMode === 'lines' && v.lineGrad && !multi(v)),
      },
      { id: 'fringe', label: 'Fringe depth', min: 0, max: 1, default: 0.45, step: 0.01, random: [0.3, 0.9], help: 'Darkness of the interference fringes (wave sum) or of the grating lines (grid, overlay)', showIf: (v) => v.colorMode === 'gradient' && multi(v) },
      { id: 'rgbShift', label: 'Channel offset', min: 0, max: 0.5, default: 0.15, step: 0.001, random: [0.05, 0.33], help: 'Phase offset between the R, G and B gratings (in periods)', showIf: mode('rgb') },
      { id: 'rgbSpread', label: 'Channel spread', min: -0.15, max: 0.15, default: 0.03, step: 0.001, random: [-0.05, 0.05], help: 'Frequency difference between the R, G and B gratings → beat fringes', showIf: mode('rgb') },
      { id: 'rgbInk', label: 'Ink on white', type: 'bool', default: false, random: 0.3, showIf: mode('rgb') },
      { id: 'lineGrad', label: 'Gradient lines', type: 'bool', default: false, random: 0.4, help: 'Colour the lines with the gradient (by beat phase when two gratings overlap)', showIf: mode('lines') },
      { id: 'lineColor', label: 'Line color', type: 'color', default: '#f4f1ea', random: 'light', showIf: (v) => v.colorMode === 'lines' && !v.lineGrad },
      {
        id: 'bgColor',
        label: 'Background',
        type: 'color',
        default: '#111118',
        random: 'dark',
        showIf: (v) => v.colorMode === 'lines' || (v.colorMode === 'gradient' && ((showFill(v) && v.fill < 1) || (multi(v) && v.fringe > 0))),
      },

      { type: 'heading', label: 'Aliasing' },
      {
        id: 'grain',
        label: 'Alias grain',
        min: 0,
        max: 12,
        default: 0,
        step: 1,
        unit: 'px',
        random: false,
        help: 'Sample the bands on a coarse screen grid and blend between samples, like a low-res render scaled up: bands finer than the grid alias into moiré. Strongest with Smooth edges off; Supersampling softens it. 0 = off',
      },
    ],
    presets: [
      {
        name: 'Holo Wave',
        thumb: true,
        // Flat take on docs/reference-moire.png: a steep zone plate (spacing curve 3) centred off the lower-left
        // corner gives wide calm arcs there and bands that crowd towards the upper right; wobble growth keeps the
        // arcs smooth while the middle bands snake, and Alias grain + Smooth edges off turn the far corner into
        // soft aliasing moiré (Supersampling 2× multisamples the coarse grid, muting it to a pastel grey).
        values: { field: 'rings', centerX: -2.1, centerY: -1.5, power: 3, freq: 0.52, phase: 0.92, angle: 78, wobble: 0.01, wobbleFreq: 2, wobbleGrow: 3, grain: 3 },
        transform: { ss: '2', aa: false },
      },
      {
        name: 'Newton Rings',
        values: { field: 'rings', centerX: 0, centerY: 0, power: 2, freq: 3.2, wobble: 0, grad: 'Oil Slick', sharp: 0.15 },
        post: { vignette: 0.45 },
      },
      {
        name: 'Two-Source Interference',
        values: { field: 'interference', centerX: 0, centerY: 0, angle: 0, spacing: 0.7, power: 1, freq: 13, wobble: 0, fringe: 1, grad: 'Rainbow', bgColor: '#05050a' },
      },
      {
        name: 'Beat Lines',
        values: { field: 'overlay', angle: 80, twist: 2.5, ratio: 1.03, freq: 38, wobble: 0.25, wobbleFreq: 0.6, colorMode: 'lines', width: 0.5, sharp: 1, lineColor: '#141414', bgColor: '#f3f0e8' },
      },
      {
        name: 'Rainbow Beat',
        values: { field: 'overlay', angle: 15, twist: 4, ratio: 1.03, freq: 34, wobble: 0.3, wobbleFreq: 0.8, width: 0.35, sharp: 0.4, fringe: 0.8, grad: 'Holo Film' },
      },
      {
        name: 'Spiral Trip',
        values: { field: 'spiral', centerX: 0, centerY: 0, arms: 5, power: 1.25, freq: 3.5, wobble: 0, sharp: 1, steps: 5, fill: 0.82, grad: 'Vaporwave', bgColor: '#120a24' },
      },
      {
        name: 'CRT Moiré',
        values: { field: 'interference', centerX: 0, centerY: 0, angle: 0, spacing: 0.6, power: 1, freq: 12, wobble: 0, colorMode: 'rgb', width: 0.35, sharp: 0.5, rgbShift: 0.15, rgbSpread: 0.03 },
        post: { scanlines: 0.3, scanSize: 3, vignette: 0.5 },
      },
      {
        name: 'Mono Op-Art',
        values: { field: 'radial', centerX: 0, centerY: 0, freq: 12, wobble: 0.5, wobbleFreq: 1.5, colorMode: 'lines', width: 0.5, sharp: 1, lineColor: '#111111', bgColor: '#f4f1ea' },
      },
    ],
    glsl: /* glsl */ `
// Coverage (0..1) of bands of width 'duty' (fraction of a period) centred on integer u.
// fw = pixel footprint of u; unresolvable bands fade to their average coverage when smooth edges are on.
float mo_band(float u, float fw, float duty, float sharp) {
  float e = 0.5 * duty - abs(fract(u + 0.5) - 0.5);
  float w = (1.0 - sharp) * 0.5 * min(duty, 1.0 - duty);
  if (u_tf_aa > 0.5) {
    w = max(max(w, 0.5 * fw), 1e-5);
    return mix(smoothstep(-w, w, e), duty, smoothstep(0.35, 0.9, fw));
  }
  return w > 1e-5 ? smoothstep(-w, w, e) : step(0.0, e);
}

float mo_chirp(float r) { return pow(max(r, 0.0), u_power); }
// Wobble amplitude (in bands) for radial fields: 'wobble' at distance 1, scaled like the local band density
// (a displacement along the band normal) times r^grow, so rings stay calm near the centre and ripple further out.
float mo_slope(float r) { return pow(max(r, 1e-4), u_power - 1.0 + u_wobbleGrow); }
float mo_wobT() { return u_time * u_drift * 2.0; }
float mo_wob(float s) { return u_wobble * sin(PG_TAU * u_wobbleFreq * s + mo_wobT()); }
// Footprint (in bands) of the wobble for wobble coordinate s. An analytic bound rather than fwidth of the
// wobble itself: once the sine oscillates within a pixel (near the horizon) its fwidth is aliased and random.
float mo_wobFW(float s) { return abs(u_wobble) * PG_TAU * u_wobbleFreq * fwidth(s); }
// Footprint of an angle in turns (atan seam at ±pi hidden by also measuring a copy with the seam at 0).
float mo_fwTurn(float th) { return min(fwidth(th), fwidth(fract(th + 1.0))); }
// Ray count for radial mode: 'freq' bands per unit measured at radius 0.5.
float mo_rays() { return max(1.0, floor(u_freq * PG_PI + 0.5)); }

// Gratings. Band coordinate of grating k = S[k] * scale + F[k]; S scales with the RGB channel spread,
// F holds phase, drift and spiral arms. FW[k] = pixel footprint of the band coordinate, FB = footprint of
// the beat S.x - S.y between the first two gratings. Returns the grating count 1..4.
int mo_field(vec2 p, out vec4 S, out vec4 F, out vec4 FW, out float FB) {
  float t = u_phase + u_time * u_drift;
  vec2 q = p - vec2(u_centerX, u_centerY);
  float turb = 0.0, tfw = 0.0;
  if (u_turbulence > 0.0) {
    turb = u_turbulence * pg_fbm(p * 1.6 + vec2(0.0, 0.05 * u_time * u_drift), 3);
    tfw = u_turbulence * 6.0 * length(fwidth(p)); // bound, same reason as mo_wobFW
  }
  float a = radians(u_angle);
  vec2 n = vec2(cos(a), sin(a));
  vec2 tg = vec2(-n.y, n.x);
  S = vec4(0.0); F = vec4(0.0); FW = vec4(0.0); FB = 0.0;
  int K = 1;

  if (u_field == FIELD_RINGS || u_field == FIELD_SPIRAL) {
    float r = length(q);
    float th = atan(q.y, q.x) / PG_TAU;
    float s = dot(q, tg), sl = mo_slope(r);
    float base = mo_chirp(r) * u_freq;
    S.x = base + sl * mo_wob(s) + turb;
    float arms = u_field == FIELD_SPIRAL ? u_arms : 0.0;
    F.x = th * arms + t;
    FW.x = fwidth(base) + sl * mo_wobFW(s) + tfw + abs(arms) * mo_fwTurn(th);
  } else if (u_field == FIELD_LINES) {
    float x = dot(q, n), s = dot(p, tg);
    float sl = pow(max(abs(x), 1e-3), u_power - 1.0);
    float base = sign(x) * mo_chirp(abs(x)) * u_freq;
    S.x = base + sl * mo_wob(s) + turb;
    F.x = t;
    FW.x = fwidth(base) + sl * mo_wobFW(s) + tfw;
  } else if (u_field == FIELD_RADIAL) {
    float th = atan(q.y, q.x) / PG_TAU;
    float N = mo_rays();
    float r = length(q);
    S.x = th * N;
    F.x = t + mo_wob(r) + turb;
    FW.x = N * mo_fwTurn(th) + mo_wobFW(r) + tfw;
  } else if (u_field == FIELD_GRID || u_field == FIELD_OVERLAY) {
    vec2 n2 = u_field == FIELD_GRID ? tg : pg_rot(radians(u_twist)) * n;
    vec2 t2 = vec2(-n2.y, n2.x);
    float b1 = dot(p, n) * u_freq, b2 = dot(p, n2) * u_freq * u_ratio;
    float s1 = dot(p, tg), s2 = dot(p, t2);
    S.x = b1 + mo_wob(s1) + turb;
    S.y = b2 + mo_wob(s2);
    F.x = t;
    FW.xy = vec2(fwidth(b1) + mo_wobFW(s1) + tfw, fwidth(b2) + mo_wobFW(s2));
    FB = fwidth(b1 - b2) + mo_wobFW(s1) + mo_wobFW(s2) + tfw;
    K = 2;
  } else { // interference: 2-4 point sources on a circle of diameter 'spacing'
    int N = int(u_sources);
    float s = dot(q, tg);
    float w = mo_wob(s), wfw = mo_wobFW(s);
    float sum = 0.0, alt = 0.0, sl = 0.0;
    vec4 B = vec4(0.0);
    for (int i = 0; i < 4; i++) {
      if (i >= N) break;
      float ai = a + float(i) * PG_TAU / float(N);
      float r = length(q - 0.5 * u_spacing * vec2(cos(ai), sin(ai)));
      float d = mo_chirp(r), si = mo_slope(r);
      B[i] = d * u_freq;
      S[i] = B[i] + w * si + turb;
      F[i] = i == 0 ? t : u_time * u_drift;
      FW[i] = wfw * si;
      sum += d;
      alt += (i % 2 == 0) ? d : -d;
      sl += si;
    }
    if (u_combine == COMBINE_WAVES) {
      K = N;
      FB = fwidth(B.x - B.y) + FW.x + FW.y;
      FW += fwidth(B) + tfw;
    } else {
      float base = (u_combine == COMBINE_ELLIPSES ? sum / float(N) : alt) * u_freq;
      S = vec4(base + w * sl / float(N) + turb, 0.0, 0.0, 0.0);
      F = vec4(t, 0.0, 0.0, 0.0);
      FW = vec4(fwidth(base) + wfw * sl / float(N) + tfw, 0.0, 0.0, 0.0);
    }
  }
  // Past ~2^20 bands a float has (almost) no fractional bits left, so fract() collapses to 0 and the far
  // horizon of a tilted view turned into a solid line of the gradient's first colour. Smooth edges already
  // fades such bands to their average; with it off, stand in per-sample noise, which is what they alias to.
  vec2 nk = floor(pg_screen * u_res * 8.0);
  S = mix(S, vec4(pg_hash22(nk), pg_hash22(nk.yx)), vec4(greaterThan(abs(S), vec4(1e6))));
  return K;
}

// Average colour of the gradient (what unresolvable bands blur to).
vec3 mo_gradAvg() {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 8; i++) s += pg_grad(u_grad, (float(i) + 0.5) / 8.0);
  return s / 8.0;
}

// Cyclic gradient sampled at phi (turns), with an anti-aliased wrap seam and far-field fade.
vec3 mo_gradSmooth(float phi, float fw) {
  vec3 col = pg_gradWrap(u_grad, phi);
  if (u_tf_aa > 0.5) {
    float sd = abs(fract(phi + 0.5) - 0.5);
    vec3 seam = 0.5 * (pg_grad(u_grad, 0.0) + pg_grad(u_grad, 1.0));
    col = mix(col, seam, clamp(1.0 - 2.0 * sd / max(fw, 1e-6), 0.0, 1.0));
    col = mix(col, mo_gradAvg(), smoothstep(0.3, 0.8, fw));
  }
  return col;
}

// Gradient bands: one full gradient sweep per period; Sharpness terraces it into 'steps' solid bands,
// fill (Thickness) < 1 opens background gaps between those bands.
vec3 mo_gradBands(float phi, float fw, float fill) {
  float n = u_steps;
  float y = phi * n, fy = fw * n;
  float aa = u_tf_aa > 0.5 ? 1.0 : 0.0;
  float w = clamp(max(1.0 - u_sharp, aa * fy), 0.0, 1.0);
  float c = fract(y) - 0.5;
  float t = (floor(y) + 0.5 + sign(c) * max(abs(c) - 0.5 * (1.0 - w), 0.0) / max(w, 1e-4)) / n;
  vec3 col = pg_gradWrap(u_grad, t);
  if (aa > 0.5) {
    float sd = abs(fract(t + 0.5) - 0.5);
    vec3 seam = 0.5 * (pg_grad(u_grad, 0.0) + pg_grad(u_grad, 1.0));
    col = mix(col, seam, clamp(1.0 - 2.0 * sd / max(fw, 1e-6), 0.0, 1.0));
  }
  if (fill < 0.999) col = mix(u_bgColor, col, mo_band(y + 0.5, fy, fill, u_sharp));
  if (aa > 0.5) col = mix(col, mix(u_bgColor, mo_gradAvg(), fill), smoothstep(0.3, 0.8, fw));
  return col;
}

// Colour of the field at one point. FW = band footprints, FB = footprint of the beat between gratings 0 and 1
// (passed in rather than measured here, so 'Alias grain' can shade extrapolated sample points).
vec3 mo_shade(vec4 S, vec4 F, vec4 FW, float FB, int K) {
  vec3 col;
  if (u_colorMode == COLORMODE_RGB) {
    // Each channel gets its own grating, offset in phase and frequency → rainbow fringes where they drift apart.
    vec3 v;
    for (int c = 0; c < 3; c++) {
      float k = float(c) - 1.0;
      float sc = 1.0 + k * u_rgbSpread;
      if (u_field == FIELD_RADIAL) { float N = mo_rays(); sc = max(1.0, floor(N * sc + 0.5)) / N; }
      float clear = 1.0;
      for (int g = 0; g < 4; g++) {
        if (g >= K) break;
        clear *= 1.0 - mo_band(S[g] * sc + F[g] + k * u_rgbShift, FW[g] * sc, u_width, u_sharp);
      }
      v[c] = 1.0 - clear;
    }
    col = u_rgbInk > 0.5 ? 1.0 - v : v;
  } else if (u_colorMode == COLORMODE_LINES) {
    float clear = 1.0;
    for (int g = 0; g < 4; g++) {
      if (g >= K) break;
      clear *= 1.0 - mo_band(S[g] + F[g], FW[g], u_width, u_sharp);
    }
    vec3 ink = u_lineColor;
    if (u_lineGrad > 0.5) {
      float phi = K > 1 ? (S.x + F.x) - (S.y + F.y) : (S.x + F.x) / u_steps;
      float fw = K > 1 ? FB : FW.x / u_steps;
      ink = mo_gradSmooth(phi, fw);
    }
    col = mix(u_bgColor, ink, 1.0 - clear);
  } else if (u_field == FIELD_GRID || u_field == FIELD_OVERLAY) {
    // Two line gratings over a rainbow backlight: colour follows their difference (the moiré beat;
    // spread over 'steps' lines for the grid), the grating lines darken it.
    float beat = (S.x + F.x) - (S.y + F.y);
    float fb = FB;
    if (u_field == FIELD_GRID) { beat /= u_steps; fb /= u_steps; }
    col = mo_gradBands(beat, fb, 1.0);
    float clear = (1.0 - mo_band(S.x + F.x, FW.x, u_width, u_sharp)) * (1.0 - mo_band(S.y + F.y, FW.y, u_width, u_sharp));
    col = mix(col, u_bgColor, u_fringe * (1.0 - clear));
  } else {
    float phi, fw, env = 1.0;
    if (K == 1) {
      phi = S.x + F.x;
      fw = FW.x;
    } else {
      // Superpose the gratings as waves: colour follows the carrier phase, brightness the beat envelope.
      vec2 z = vec2(0.0);
      fw = 0.0;
      for (int g = 0; g < 4; g++) {
        if (g >= K) break;
        float u = PG_TAU * (S[g] + F[g]);
        z += vec2(cos(u), sin(u));
        fw += FW[g];
      }
      fw /= float(K);
      phi = atan(z.y, z.x) / PG_TAU;
      env = length(z) / float(K);
      if (u_tf_aa > 0.5) env = mix(env, K == 2 ? 0.64 : 0.5, smoothstep(0.35, 0.9, FB));
    }
    col = mo_gradBands(phi, fw, u_fill);
    if (K > 1) col = mix(u_bgColor, col, mix(1.0, env, u_fringe));
  }
  return col;
}

vec4 pattern(vec2 p) {
  vec4 S, F, FW;
  float FB;
  int K = mo_field(p, S, F, FW, FB);
  if (u_grain < 0.5) return vec4(mo_shade(S, F, FW, FB, K), 1.0);

  // Alias grain: shade only at the points of a coarse screen grid and blend between them bilinearly, like a
  // low-res render scaled up, so detail finer than the grid aliases into soft moiré. Grid points are reached
  // from p through the local screen→pattern Jacobian; the pixel's own footprints are kept, so Smooth edges
  // still fades detail finer than a pixel. Supersampling jitters the grid points by the sub-sample offset
  // (scaled to the grid), i.e. it multisamples the coarse render and softens the aliasing.
  float G = max(u_grain * u_pxScale, 1.0);
  vec2 fc = pg_screen * u_res;
  vec2 pc = floor(fc) + 0.5;
  vec2 jit = (fc - pc) * G;
  vec2 g = pc / G - 0.5;
  vec2 g0 = floor(g), f = g - g0;
  vec2 jx = dFdx(p), jy = dFdy(p);
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    vec2 o = vec2(float(k % 2), float(k / 2));
    vec2 d = (g0 + o + 0.5) * G + jit - fc;
    vec4 S2, F2, FW2;
    float FB2;
    mo_field(p + jx * d.x + jy * d.y, S2, F2, FW2, FB2);
    vec2 wt = mix(1.0 - f, f, o);
    acc += wt.x * wt.y * mo_shade(S2, F2, FW, FB, K);
  }
  return vec4(acc, 1.0);
}
`,
  });
})();
