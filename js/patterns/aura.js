/* Aura — soft, out-of-focus organic blobs whose density glows through a multi-band gradient, like a thermal camera,
 * an aura photograph or ionized gas: background → thin vivid halo → dark band → warm → bright → cool cores.
 * A level field (1 = core, 0 = outline, < 0 outside) is built from warped superellipse "balls" (or a full-frame noise
 * field / concentric rings), then mapped through background + gradient with a blur, per-channel chromatic fringe,
 * a soft bloom, film grain and vignette. Everything morphs on integer harmonics of one phase, so motion loops. */
(function () {
  const shapeIs = (...m) => (v) => m.includes(v.shape);
  const notField = (v) => v.shape !== 'field';
  const g = (stops) => ({ stops, mode: 'smooth' });

  // edge → core. Stop 0 is the halo that fades into the background.
  const IONIZED = g([
    [0, '#b93ad6'], [0.035, '#3c1a48'], [0.075, '#0e1a10'], [0.11, '#20361a'], [0.15, '#5c2e1c'], [0.2, '#a6442e'],
    [0.25, '#c2603a'], [0.3, '#b6b252'], [0.34, '#c6ce72'], [0.39, '#f0faf2'], [0.5, '#c2f0ea'], [0.63, '#8ad4e2'],
    [0.74, '#72b2e0'], [0.84, '#6494d8'], [0.92, '#3a58bc'], [1, '#22337e'],
  ]);
  const GREEN_GLOW = g([
    [0, '#0c1a14'], [0.07, '#2a4a1c'], [0.16, '#cad85e'], [0.25, '#e4eec0'], [0.33, '#a8dcd8'],
    [0.42, '#74b2ce'], [0.52, '#5f86b8'], [0.62, '#5664a4'], [0.74, '#566a86'], [0.87, '#5e7a6c'], [1, '#535b62'],
  ]);
  const CREAM = g([
    [0, '#d8be5a'], [0.06, '#55644a'], [0.18, '#37554a'], [0.3, '#5e4658'], [0.41, '#cc4c3e'],
    [0.51, '#d0606c'], [0.6, '#b45a88'], [0.72, '#686a62'], [0.86, '#4f7a62'], [1, '#4a7c62'],
  ]);
  const NAVY = g([[0, '#4a2c74'], [0.12, '#1c0c38'], [0.35, '#1c1660'], [0.7, '#2232b8'], [1, '#2a3ed8']]);
  const ORANGE = g([
    [0, '#3a1e0c'], [0.08, '#0e160a'], [0.18, '#1a2a14'], [0.28, '#5a6aa8'], [0.36, '#8aa0f0'], [0.47, '#e08ac0'],
    [0.6, '#f6eccc'], [0.76, '#f0f07a'], [0.9, '#a8dc50'], [1, '#56c840'],
  ]);
  const THERMAL = g([
    [0, '#5a1490'], [0.1, '#0a0418'], [0.24, '#5a0c8a'], [0.4, '#d0206a'], [0.56, '#ff7a1a'],
    [0.72, '#ffd23a'], [0.88, '#fff8d0'], [1, '#ffffff'],
  ]);
  const AURORA = g([
    [0, '#3ad8a8'], [0.08, '#06201c'], [0.2, '#0e4a4a'], [0.36, '#2ad08a'], [0.52, '#d6f8a0'],
    [0.66, '#8ac8f8'], [0.82, '#8a5ae0'], [1, '#e070d8'],
  ]);
  const CHROME = g([
    [0, '#9ab8ff'], [0.07, '#20232c'], [0.17, '#5a6272'], [0.3, '#e8eef8'], [0.4, '#ffffff'],
    [0.52, '#bfeaff'], [0.66, '#ffd2f0'], [0.8, '#e2dcff'], [1, '#fbfbff'],
  ]);

  PG.registerPattern({
    id: 'aura',
    name: 'Aura Gradient',
    category: 'Organic',
    description: 'Blurry glowing blobs mapped through a multi-band gradient — thermal camera, aura photo, ionized gas. Animates.',
    autoplay: true,
    params: [
      { type: 'heading', label: 'Shape' },
      {
        id: 'shape',
        label: 'Shape',
        type: 'select',
        options: [
          ['blob', 'Single blob'],
          ['pair', 'Blob + satellite'],
          ['cluster', 'Cluster'],
          ['field', 'Full-frame field'],
          ['rings', 'Rings'],
        ],
        default: 'blob',
        random: ['blob', 'blob', 'pair', 'pair', 'cluster', 'field', 'rings'],
      },
      { id: 'size', label: 'Size', min: 0.15, max: 3, default: 0.95, step: 0.01, scale: 'log', random: [0.75, 1.1], showIf: (v) => v.repeat === 'off' || v.shape === 'field' || v.shape === 'cluster', help: 'Blob half-height (field: feature scale)' },
      { id: 'stretch', label: 'Stretch', min: 0.3, max: 3, default: 0.8, step: 0.01, scale: 'log', random: [0.6, 1.35], showIf: notField, help: 'Width ÷ height' },
      { id: 'squareness', label: 'Squareness', min: 0, max: 1, default: 0.35, step: 0.01, random: [0, 0.7], showIf: shapeIs('blob', 'pair', 'rings'), help: 'Ellipse → rounded square' },
      { id: 'angle', label: 'Angle', min: -90, max: 90, default: 0, step: 1, unit: '°', random: [-35, 35], showIf: notField },
      { id: 'count', label: 'Blobs', type: 'int', min: 2, max: 7, default: 4, random: [3, 6], showIf: shapeIs('cluster') },
      { id: 'satSize', label: 'Satellite size', min: 0.15, max: 1, default: 0.42, step: 0.01, random: [0.3, 0.6], showIf: shapeIs('pair') },
      { id: 'satAngle', label: 'Satellite direction', min: -180, max: 180, default: -125, step: 1, unit: '°', random: [-180, 180], showIf: shapeIs('pair') },
      { id: 'satDist', label: 'Satellite distance', min: 0.2, max: 2, default: 1.05, step: 0.01, random: [0.8, 1.3], showIf: shapeIs('pair'), help: 'From the centre, in blob sizes' },
      { id: 'lumps', label: 'Lumpiness', min: 0, max: 1.5, default: 0.55, step: 0.01, random: [0.25, 0.9], help: 'Organic warp of the outline' },
      { id: 'inner', label: 'Inner swirl', min: 0, max: 1.5, default: 0.65, step: 0.01, random: [0.3, 1], help: 'Extra cores and hollows inside the blob' },
      { id: 'uneven', label: 'Uneven bands', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.25, 0.8], showIf: (v) => v.shape !== 'rings', help: 'Band widths vary around the blob: broad bands next to thin, vanishing ones' },
      { id: 'cx', label: 'Centre X', min: -1.5, max: 1.5, default: 0, step: 0.01, random: [-0.15, 0.15] },
      { id: 'cy', label: 'Centre Y', min: -1.5, max: 1.5, default: 0, step: 0.01, random: [-0.15, 0.15] },

      { type: 'heading', label: 'Repeat' },
      { id: 'repeat', label: 'Repeat', type: 'select', options: [['off', 'Off'], ['grid', 'Grid'], ['brick', 'Brick']], default: 'off', random: ['off', 'off', 'grid', 'brick'], showIf: (v) => v.shape !== 'field' && v.shape !== 'cluster', help: 'Fill the screen with several auras — neighbours melt together where their halos meet' },
      { id: 'copies', label: 'Copies across', min: 1.2, max: 10, default: 3, step: 0.1, random: [2, 4.5], showIf: (v) => v.repeat !== 'off' && v.shape !== 'field' && v.shape !== 'cluster', help: 'How many auras fit across the shorter side of the screen' },
      { id: 'spacing', label: 'Spacing', min: 0.75, max: 3, default: 1.1, step: 0.01, random: [0.9, 1.4], showIf: (v) => v.repeat !== 'off' && v.shape !== 'field' && v.shape !== 'cluster', help: 'Room around each aura (1 = touching; smaller = they merge)' },
      { id: 'variety', label: 'Variety', min: 0, max: 1, default: 0.6, step: 0.01, random: [0.3, 0.9], showIf: (v) => v.repeat !== 'off' && v.shape !== 'field' && v.shape !== 'cluster', help: 'How different each copy is: shape, size, tilt, timing and colors' },

      { type: 'heading', label: 'Color' },
      { id: 'gradient', label: 'Gradient', type: 'gradient', default: IONIZED, help: 'Edge → core. The first stop is the halo next to the background' },
      { id: 'bg', label: 'Background', type: 'color', default: '#dbc3e2', random: 'light' },
      { id: 'accent', label: 'Satellite gradient', type: 'gradient', default: NAVY, showIf: shapeIs('pair', 'cluster') },
      { id: 'accentMix', label: 'Satellite colors', min: 0, max: 1, default: 1, step: 0.01, random: [0, 1], showIf: shapeIs('pair', 'cluster'), help: 'Pair: the satellite. Cluster: every other blob. 0 = everything uses the main gradient' },
      { id: 'bands', label: 'Bands', min: 0.3, max: 6, default: 1, step: 0.01, scale: 'log', random: [0.85, 1.8], help: 'How many times the gradient runs from edge to core (rings: rings per size)' },
      { id: 'softness', label: 'Softness', min: 0, max: 1, default: 0.45, step: 0.01, random: [0.25, 0.7], help: 'Blur between the bands and into the background' },
      { id: 'fringe', label: 'Chromatic fringe', min: 0, max: 1, default: 0.35, step: 0.01, random: [0, 0.6] },
      { id: 'glow', label: 'Glow', min: 0, max: 1, default: 0.35, step: 0.01, random: [0.1, 0.6] },
      { id: 'drift', label: 'Color drift', min: 0, max: 1, default: 0.4, step: 0.01, random: [0.15, 0.7], help: 'How far the colors wander across the bands' },
      { id: 'hueShift', label: 'Hue wander', min: 0, max: 180, default: 40, step: 1, unit: '°', random: [0, 70], help: 'Slowly rotates the hues from place to place (luminance kept)' },

      { type: 'heading', label: 'Finish' },
      { id: 'grain', label: 'Grain', min: 0, max: 1, default: 0.3, step: 0.01, random: [0.1, 0.5] },
      { id: 'vignette', label: 'Vignette', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.4] },

      { type: 'heading', label: 'Motion' },
      { id: 'morph', label: 'Morph speed', min: 0, max: 2, default: 0.5, step: 0.01, random: [0.25, 0.9], help: 'Used when Animate is on. Loops every 10 s ÷ speed' },
      { id: 'driftSpeed', label: 'Color drift speed', min: 0, max: 2, default: 0.5, step: 0.01, random: [0.2, 0.9], help: 'Used when Animate is on. Loops every 10 s ÷ speed' },
    ],
    presets: [
      {
        name: 'Ionized', thumb: true, play: true,
        values: {
          shape: 'blob', size: 0.97, stretch: 0.74, squareness: 0.35, angle: -12, lumps: 0.4, inner: 0.85, uneven: 0.7, cx: 0, cy: -0.02,
          gradient: IONIZED, bg: '#dbc3e2', bands: 1, softness: 0.4, fringe: 0.35, glow: 0.3, drift: 0.35, hueShift: 70, grain: 0.3,
        },
      },
      {
        name: 'Green Glow', play: true,
        values: {
          shape: 'blob', size: 1.2, stretch: 1.1, squareness: 0.8, angle: 3, lumps: 0.3, inner: 0.6, uneven: 0.45, cx: 0.04, cy: 0.22,
          gradient: GREEN_GLOW, bg: '#1d2f86', bands: 1, softness: 0.55, fringe: 0.3, glow: 0.4, drift: 0.35, hueShift: 60, grain: 0.3,
        },
      },
      {
        name: 'Cream Aura', play: true,
        values: {
          shape: 'pair', size: 0.98, stretch: 0.8, squareness: 0.15, angle: 0, lumps: 0.3, inner: 0.2, cx: 0.14, cy: 0.3,
          satSize: 0.5, satAngle: -128, satDist: 1.12, accent: NAVY, accentMix: 1,
          gradient: CREAM, bg: '#efe8db', bands: 1, softness: 0.6, fringe: 0.2, glow: 0.2, drift: 0.3, grain: 0.3,
        },
      },
      {
        name: 'Orange Flare', play: true,
        values: {
          shape: 'blob', size: 1.12, stretch: 0.95, squareness: 0.6, angle: 6, lumps: 0.7, inner: 1, cx: 0.04, cy: 0.12,
          gradient: ORANGE, bg: '#c94a1e', bands: 0.8, softness: 0.45, fringe: 0.25, glow: 0.3, drift: 0.5, grain: 0.3,
        },
      },
      {
        name: 'Thermal', play: true,
        values: {
          shape: 'cluster', count: 5, size: 1.12, stretch: 1.15, lumps: 0.5, inner: 0.6, accentMix: 0,
          gradient: THERMAL, bg: '#140828', bands: 1, softness: 0.55, fringe: 0.25, glow: 0.45, drift: 0.4, grain: 0.35, vignette: 0.3,
        },
      },
      {
        name: 'Aurora', play: true,
        values: {
          shape: 'field', size: 0.92, lumps: 0.7, inner: 0.45, gradient: AURORA, bg: '#05121a',
          bands: 1, softness: 0.65, fringe: 0.3, glow: 0.45, drift: 0.5, grain: 0.3, vignette: 0.25,
        },
      },
      {
        name: 'Ionized Wallpaper', play: true,
        values: {
          shape: 'blob', repeat: 'brick', copies: 3.2, spacing: 1.0, variety: 0.7, stretch: 0.8, squareness: 0.4, angle: -8, lumps: 0.45, inner: 0.8, uneven: 0.6,
          gradient: IONIZED, bg: '#dbc3e2', bands: 1, softness: 0.4, fringe: 0.35, glow: 0.3, drift: 0.35, hueShift: 70, grain: 0.3,
        },
      },
      {
        name: 'Chrome Bubble', play: true,
        values: {
          shape: 'rings', size: 0.97, stretch: 0.9, squareness: 0.25, angle: -15, lumps: 0.6, inner: 0.45,
          gradient: CHROME, bg: '#c4cee2', bands: 1.4, softness: 0.7, fringe: 0.5, glow: 0.3, drift: 0.4, grain: 0.25,
        },
      },
    ],
    glsl: /* glsl */ `
float au_T = 0.0;     // morph phase (radians): all shape motion uses integer harmonics of it → loops every 2π
float au_C = 0.0;     // colour-drift phase (radians), same rule
float au_acc = 0.0;   // weight of the satellite gradient at this sample
float au_hw = 0.1;    // halo fade width (gradient units)

float au_ph = 0.0;          // per-copy morph phase offset (Repeat)
vec2 au_so = vec2(0.0);     // per-copy noise offset (Repeat) — gives each copy its own outline and interior
vec2 auCirc(float k, float ph) { float a = k * (au_T + au_ph) + ph; return vec2(cos(a), sin(a)); }

// Low-frequency organic displacement (blob units) that morphs on a loop: the noise domain travels round circles.
vec2 auWarp(vec2 q) {
  vec2 m1 = 0.55 * auCirc(1.0, 0.0), m2 = 0.4 * auCirc(-2.0, 1.3);
  vec2 a = vec2(pg_noise(q * 0.7 + vec2(3.1, 7.7) + m1), pg_noise(q * 0.7 + vec2(9.4, 2.5) - m1.yx));
  vec2 b = vec2(pg_noise(q * 1.5 + vec2(1.7, 4.2) + m2), pg_noise(q * 1.5 + vec2(6.3, 8.1) + m2.yx));
  return a + 0.25 * b;
}

// Superellipse level: 1 at the centre, 0 on the outline, negative outside (≈ linear in distance).
float auBall(vec2 q, vec2 c, vec2 rad, float n, float ang) {
  vec2 d = abs(pg_rot(-ang) * (q - c)) / rad;
  float m = max(max(d.x, d.y), 1e-5);
  d /= m;                                            // keep pow() in range far outside
  return 1.0 - m * pow(pow(d.x, n) + pow(d.y, n), 1.0 / n);
}

// background → halo → gradient (ping-pong beyond 1). bgK = 0 swaps the background for black (light emitted by the bands).
vec3 auRamp(float t, float bgK) {
  float m = 1.0 - abs(mod(max(t, 0.0), 2.0) - 1.0);
  vec3 c = pg_grad(u_gradient, m);
  if (u_shape == SHAPE_PAIR || u_shape == SHAPE_CLUSTER) c = mix(c, pg_grad(u_accent, m), au_acc);
  float h = smoothstep(-au_hw, 0.0, t);
  return mix(u_bg * bgK, c, h * h * (2.0 - h));
}
// gaussian-ish blur along the gradient axis (≈ a spatial blur, since the level field is near-linear in distance)
vec3 auSoft(float t, float s, float bgK) {
  return (auRamp(t - 2.0 * s, bgK) + 4.0 * auRamp(t - s, bgK) + 6.0 * auRamp(t, bgK) + 4.0 * auRamp(t + s, bgK) + auRamp(t + 2.0 * s, bgK)) * (1.0 / 16.0);
}

float auSoftplus(float v, float k) { return max(v, 0.0) + k * log(1.0 + exp(-abs(v) / k)); }   // smooth max(v, 0), overflow-safe

vec3 auHue(vec3 c, float a) {
  vec3 yiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c;
  yiq.yz = pg_rot(a) * yiq.yz;
  return mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * yiq;
}

// Smooth union of levels (log-sum-exp), also blending the satellite weight.
float au_sw = 0.0, au_sa = 0.0, au_mx = -1e9;
float au_k = 0.11;   // blend width (level units)
void auAdd(float L, float acc) {
  // running log-sum-exp with rescaling
  if (L > au_mx) {
    float r = exp((au_mx - L) / au_k);
    au_sw *= r; au_sa *= r; au_mx = L;
  }
  float e = exp((L - au_mx) / au_k);
  au_sw += e; au_sa += e * acc;
}

// One aura (blob / pair / cluster / rings) at q (blob units). Returns its level (1 core … 0 outline … < 0 outside);
// acc = satellite gradient weight, wq = the warped coordinates (for the inner swirl).
float auShape(vec2 q, float ang, out float acc, out vec2 wq) {
  vec2 rad = vec2(u_stretch, 1.0);
  float n = 2.0 + 5.0 * u_squareness;
  vec2 w = q + u_lumps * 0.32 * auWarp(q + au_so);
  wq = w;
  acc = 0.0;
  if (u_shape == SHAPE_PAIR) {
    au_mx = -1e9; au_sw = 0.0; au_sa = 0.0; au_k = 0.11;
    auAdd(auBall(w, 0.03 * auCirc(1.0, 0.5), rad, n, ang), 0.0);
    float sa = radians(u_satAngle);
    vec2 c2 = u_satDist * vec2(cos(sa), sin(sa)) + 0.06 * auCirc(1.0, 2.4);
    auAdd(auBall(w, c2, vec2(u_satSize * (1.0 + 0.04 * sin(au_T + au_ph + 1.0))), 2.2, 0.0), u_accentMix);
    acc = au_sa / au_sw;
    return au_mx + au_k * log(au_sw);
  }
  if (u_shape == SHAPE_CLUSTER) {
    au_mx = -1e9; au_sw = 0.0; au_sa = 0.0; au_k = 0.2;
    int N = int(u_count);
    for (int i = 0; i < 7; i++) {
      if (i >= N) break;
      vec3 h = pg_hash32(vec2(float(i), 41.0));
      float a = (float(i) + 0.6 * h.x) * PG_TAU / float(N) + 0.45 * sin(au_T + h.y * PG_TAU);
      float rr = (i == 0 ? 0.0 : 0.38 + 0.3 * h.z) * (1.0 + 0.12 * sin(au_T * 2.0 + h.x * 6.0));
      vec2 c = rr * vec2(cos(a) * u_stretch, sin(a));
      c = pg_rot(ang) * c;
      float r = (i == 0 ? 0.62 : 0.3 + 0.25 * h.y) * (1.0 + 0.06 * sin(au_T + h.z * 6.0));
      auAdd(auBall(w, c, vec2(r), 2.0, 0.0), (i - (i / 2) * 2 == 1) ? u_accentMix : 0.0);
    }
    acc = au_sa / au_sw;
    return au_mx + au_k * log(au_sw);
  }
  if (u_shape == SHAPE_RINGS) return auBall(w, vec2(0.0), rad, n, ang);
  return auBall(w, 0.04 * auCirc(1.0, 0.5), rad, n, ang);
}

vec4 pattern(vec2 p) {
  // fit the view to the shorter side of the window, so the aura stays whole in tall / narrow windows too
  p *= max(1.0, u_res.y / u_res.x);
  float S = u_size;
  au_T = u_time * u_morph * PG_TAU / 10.0;
  au_C = u_time * u_driftSpeed * PG_TAU / 10.0;
  au_hw = 0.02 + 0.14 * u_softness;

  vec2 q = (p - vec2(u_cx, u_cy)) / S;               // blob units, centre at the origin
  float ang = radians(u_angle);
  vec2 rad = vec2(u_stretch, 1.0);
  float n = 2.0 + 5.0 * u_squareness;
  vec2 w = q, so = vec2(0.0);
  float L, coff = 0.0;
  bool rings = u_shape == SHAPE_RINGS;

  if (u_shape == SHAPE_FIELD) {
    w = q + u_lumps * 0.32 * auWarp(q);
    vec2 m3 = 0.5 * auCirc(1.0, 0.4), m4 = 0.4 * auCirc(-2.0, 2.0);
    vec2 v = q * 0.55 + u_lumps * 0.6 * auWarp(q * 0.5);
    float f = pg_noise(v + vec2(5.3, 1.1) + m3) + 0.45 * pg_noise(v * 2.1 + vec2(8.8, 3.3) + m4);
    L = 0.32 + 0.9 * f;
  } else if (u_repeat == REPEAT_OFF || u_shape == SHAPE_CLUSTER) {
    float acc;
    L = auShape(q, ang, acc, w);
    au_acc = acc;
  } else {
    // Repeat: a grid / brick lattice of auras. Each point blends the four nearest copies (smooth union), so halos melt
    // together instead of being cut at the tile edges. Cells are sized from the aura's bounding box × Spacing.
    vec2 ext = vec2(u_stretch, 1.0) * (1.0 + 0.25 * u_lumps);
    float ca = abs(cos(ang)), sn = abs(sin(ang));
    vec2 box = vec2(length(vec2(ext.x * ca, ext.y * sn)), length(vec2(ext.x * sn, ext.y * ca)));
    vec2 bc = vec2(0.0);                               // centre of the composition's bounding box
    if (u_shape == SHAPE_PAIR) {
      // the satellite sits on one side: box the blob + satellite together and centre that box in the cell
      float sa = radians(u_satAngle);
      vec2 sc = u_satDist * vec2(cos(sa), sin(sa));
      vec2 lo = min(-box, sc - u_satSize), hi = max(box, sc + u_satSize);
      bc = 0.5 * (lo + hi);
      box = 0.5 * (hi - lo);
    }
    vec2 cell = 2.0 * box * u_spacing;                 // blob units
    // Copies across: scale the blob so that 'copies' cells fit across the view's shorter side (2 pattern units)
    float Sr = 2.0 / max(u_copies, 0.5) / max(cell.x, cell.y);
    q = (p - vec2(u_cx, u_cy)) / Sr;
    vec2 g = q / cell;
    float vr = u_variety;
    float cmx = -1e9, csw = 0.0, csa = 0.0, csv = 0.0, best = -1e9;
    float r0 = floor(g.y - 0.5);
    for (int j = 0; j < 2; j++) {
      float row = r0 + float(j);
      float sh = u_repeat == REPEAT_BRICK ? 0.5 * (row - 2.0 * floor(row * 0.5)) : 0.0;
      float c0 = floor(g.x - sh - 0.5);
      for (int i = 0; i < 2; i++) {
        float cx = c0 + float(i);
        vec3 h = pg_hash32(vec2(cx, row) + vec2(7.0, 19.0));
        vec2 ctr = vec2(cx + 0.5 + sh, row + 0.5) * cell - bc;
        au_ph = vr * h.x * PG_TAU;
        au_so = (h.yz - 0.5) * 40.0 * vr;
        float sz = 1.0 + vr * 0.3 * (h.z - 0.5);
        float ac; vec2 lw;
        float Lc = auShape((q - ctr) / sz, ang + radians(vr * 50.0 * (h.y - 0.5)), ac, lw);
        if (Lc > cmx) { float r = exp((cmx - Lc) / 0.11); csw *= r; csa *= r; csv *= r; cmx = Lc; }
        float e = exp((Lc - cmx) / 0.11);
        csw += e; csa += e * ac; csv += e * (h.x - 0.5);
        if (Lc > best) { best = Lc; w = lw; so = au_so; }
      }
    }
    au_ph = 0.0; au_so = vec2(0.0);
    L = cmx + 0.11 * log(csw);
    au_acc = csa / csw;
    coff = vr * csv;
  }

  // inner swirl: extra cores and hollows, growing with depth
  vec2 m5 = 0.5 * auCirc(1.0, 2.1), m6 = 0.4 * auCirc(-1.0, 4.0);
  float inn = pg_noise(w * 1.05 + so + vec2(11.3, 5.9) + m5) + 0.35 * pg_noise(w * 2.3 + so + vec2(2.9, 13.4) + m6);

  float x, rate = 1.0;
  if (rings) {
    float rr = 1.0 - L;
    rr = sqrt(rr * rr + 0.02) - 0.1414;              // round off the cone tip at the centre
    float s = rr * u_bands - au_C / PG_PI + 0.25 * u_inner * inn;
    float tri = abs(mod(s, 2.0) - 1.0);              // 1 at the centre
    x = mix(-0.1 - au_hw, 1.0, tri);
  } else {
    // uneven bands: the gradient advances faster in some places than in others, so a band can be broad on one side
    // and thin out to nothing on the other. Blur, fringe and halo scale with the rate, so they stay even on screen.
    if (u_uneven > 0.0) {
      float nr = pg_noise(w * 0.8 + so + vec2(17.1, 2.3) + 0.45 * auCirc(1.0, 3.3));
      rate = exp(u_uneven * 1.3 * nr);
      au_hw *= rate;
    }
    x = L * u_bands * rate + u_inner * 0.65 * inn * smoothstep(0.06, 0.5, L);
    // overshoot past the core saturates (a plateau) instead of folding back into an echo ring
    float xm = max(u_bands, 1.0);
    x = xm - auSoftplus(xm - x, 0.24);
  }
  // colour drift: a slow, travelling shift through the bands (kept off the outer halo)
  float dn = pg_noise(q * 0.75 + vec2(21.0, 3.0) + 0.8 * vec2(cos(au_C), sin(au_C)));
  x += (u_drift * (0.4 * dn + 0.08 * sin(au_C + 1.0)) + 0.9 * coff) * smoothstep(0.03, 0.3, x);

  float s = (0.004 + 0.05 * u_softness) * rate;
  // hue wander: chroma rotated (YIQ, luma kept) by a slow travelling field — halos go magenta ↔ rust, rust ↔ green
  float hr = 0.0;
  if (u_hueShift > 0.0) {
    float hn = pg_noise(q * 0.6 + vec2(31.0, 17.0) + 0.7 * vec2(cos(au_C + 2.0), sin(au_C + 2.0)));
    hr = radians(u_hueShift) * (hn * 1.4 + 0.25 * sin(au_C));
  }
  float fr = 0.045 * u_fringe * rate;
  vec3 col = vec3(auSoft(x - fr, s, 1.0).r, auSoft(x, s, 1.0).g, auSoft(x + fr, s, 1.0).b);
  if (u_hueShift > 0.0) col = auHue(col, hr * smoothstep(-au_hw - 0.08, -0.3 * au_hw, x) * (1.0 - 0.75 * smoothstep(0.3, 0.6, x)));

  // bloom: a wide blur of the bright bands, screened on top (spills a little onto the background too)
  if (u_glow > 0.0) {
    vec3 gw = auSoft(x, (0.06 + 0.06 * u_glow) * rate, 0.0);
    vec3 bloom = gw * smoothstep(0.2, 0.95, pg_luma(gw));
    col = 1.0 - (1.0 - col) * (1.0 - 0.75 * u_glow * bloom);
  }

  // far away (tilt / zoom-out) the bands crowd into a few pixels: settle on their average colour
  if (u_tf_aa > 0.5) {
    // fwidth(x) alone aliases where the field turns to sub-pixel noise (it can read small by chance), so also use a
    // smooth estimate: blob units per pixel × a rough bound on how fast x changes per blob unit
    float gx = u_shape == SHAPE_FIELD ? 2.0 : rings ? 2.2 * u_bands + 0.5 * u_inner : 1.5 * u_bands * rate + u_inner;
    float k = smoothstep(0.25, 0.9, max(fwidth(x), length(fwidth(q)) * gx));
    vec3 mean = vec3(0.0);
    for (int i = 0; i < 6; i++) mean += pg_grad(u_gradient, (float(i) + 0.5) / 6.0);
    // blobs are finite: far outside them the average is simply the background
    float cover = u_shape == SHAPE_FIELD ? 0.7 : rings ? 0.85 : smoothstep(-0.3, 0.3, x);
    col = mix(col, mix(u_bg, mean / 6.0, cover), k);
  }

  // vignette + film grain (screen space, in preview pixels so exports match)
  vec2 sc = pg_screen - 0.5;
  sc.x *= u_res.x / u_res.y;
  col *= 1.0 - 0.55 * u_vignette * smoothstep(0.3, 1.0, length(sc) * 1.25);
  if (u_grain > 0.0) {
    vec2 gp = pg_screen * u_res / max(u_pxScale, 1.0) - 0.5;
    vec2 gi = floor(gp), gf = gp - gi;
    gf = gf * gf * (3.0 - 2.0 * gf);
    float fr2 = mod(floor(u_time * 24.0), 64.0);
    vec2 o = vec2(fr2 * 389.0, fr2 * 211.0);
    vec3 a = pg_hash32(gi + o), b = pg_hash32(gi + o + vec2(1.0, 0.0));
    vec3 c = pg_hash32(gi + o + vec2(0.0, 1.0)), d = pg_hash32(gi + o + vec2(1.0, 1.0));
    vec3 gn = mix(mix(a, b, gf.x), mix(c, d, gf.x), gf.y) - 0.5;
    gn = mix(vec3(gn.x), gn, 0.3);
    col += gn * u_grain * 0.16 * clamp(u_pxScale, 0.4, 1.0);   // thumbnails: less grain
  }
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
  });
})();
