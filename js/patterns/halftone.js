/* Halftone — classic print screens over an analytic tone image: round / square / diamond / elliptical dots,
 * line, cross and ring screens; mono, gradient-coloured, duotone or 4-plate CMYK (rosettes + misregistration).
 * Every dot samples the tone at its own cell centre (2×2 neighbour search), so dots stay true shapes. */
(function () {
  PG.registerPattern({
    id: 'halftone',
    name: 'Halftone',
    category: 'Print',
    description: 'Print halftone screens: Ben-Day dots, newsprint, CMYK rosettes, line, cross and ring screens.',
    params: [
      { type: 'heading', label: 'Screen' },
      {
        id: 'shape',
        label: 'Dot shape',
        type: 'select',
        options: [
          ['round', 'Round dots'],
          ['square', 'Squares'],
          ['diamond', 'Diamonds'],
          ['line', 'Lines'],
          ['cross', 'Crosses'],
          ['ring', 'Rings'],
          ['ellipse', 'Ellipses'],
        ],
        default: 'round',
      },
      { id: 'cell', label: 'Cell size', min: 0.006, max: 0.4, default: 0.05, step: 0.001, scale: 'log', random: [0.022, 0.09] },
      { id: 'angle', label: 'Screen angle', min: -90, max: 90, default: 45, step: 1, unit: '°', random: [0, 90], help: 'In CMYK the plates keep their classic offsets (C −30°, M +30°, Y −45°) around this angle' },

      { type: 'heading', label: 'Tone' },
      {
        id: 'source',
        label: 'Tone source',
        type: 'select',
        options: [
          ['linear', 'Linear gradient'],
          ['radial', 'Radial gradient'],
          ['noise', 'Noise (fbm)'],
          ['waves', 'Waves'],
          ['spiral', 'Spiral'],
          ['rings', 'Rings'],
        ],
        default: 'noise',
      },
      { id: 'toneScale', label: 'Tone scale', min: 0.1, max: 6, default: 0.9, step: 0.01, scale: 'log', random: [0.45, 2], help: 'Size of the tone features' },
      { id: 'toneAngle', label: 'Tone angle', min: -180, max: 180, default: 20, step: 1, unit: '°', random: [-180, 180], showIf: (v) => v.source === 'linear' || v.source === 'waves' },
      { id: 'arms', label: 'Spiral arms', type: 'int', min: 1, max: 12, default: 3, random: [1, 6], showIf: (v) => v.source === 'spiral' },
      { id: 'contrast', label: 'Contrast', min: 0.2, max: 5, default: 2.2, step: 0.01, scale: 'log', random: [1, 3] },
      { id: 'gain', label: 'Dot gain', min: -0.5, max: 0.5, default: 0, step: 0.01, random: [-0.1, 0.12], help: 'Grows (+) or shrinks (−) every dot, like ink spreading into the paper' },
      { id: 'minDot', label: 'Min dot', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.15] },
      { id: 'maxDot', label: 'Max dot', min: 0, max: 1, default: 1, step: 0.01, random: [0.75, 1] },
      { id: 'invert', label: 'Invert tone', type: 'bool', default: false, random: 0.2 },

      { type: 'heading', label: 'Ink' },
      {
        id: 'colorMode',
        label: 'Color mode',
        type: 'select',
        options: [
          ['mono', 'Mono (ink on paper)'],
          ['gradient', 'Gradient dots'],
          ['duotone', 'Duotone (2 screens)'],
          ['cmyk', 'CMYK (4 screens)'],
        ],
        default: 'mono',
        random: ['mono', 'mono', 'gradient', 'duotone', 'cmyk'],
      },
      { id: 'ink', label: 'Ink', type: 'color', default: '#1b1a24', random: false, showIf: (v) => v.colorMode !== 'gradient', help: 'In CMYK this is the black (K) plate' },
      { id: 'ink2', label: 'Second ink', type: 'color', default: '#e8402f', random: false, showIf: (v) => v.colorMode === 'duotone' },
      { id: 'paper', label: 'Paper', type: 'color', default: '#f2ebdc', random: false },
      { id: 'gradient', label: 'Gradient', type: 'gradient', default: { stops: [[0, '#ffd166'], [0.35, '#f4845f'], [0.65, '#c0365b'], [1, '#2b2d62']], mode: 'smooth' }, showIf: (v) => v.colorMode === 'gradient' || v.colorMode === 'cmyk', help: 'Gradient mode: dot colour along the tone. CMYK: the full-colour image that gets separated into plates' },
      { id: 'misreg', label: 'Misregistration', min: 0, max: 1, default: 0.12, step: 0.01, random: [0, 0.35], showIf: (v) => v.colorMode === 'cmyk' || v.colorMode === 'duotone', help: 'Offset between the printing plates, in cells' },
      { id: 'grit', label: 'Print grit', min: 0, max: 1, default: 0.15, step: 0.01, random: [0, 0.5], help: 'Rough ink edges and mottled paper' },
    ],
    presets: [
      { name: 'Comic Dots', values: { shape: 'round', cell: 0.075, angle: 45, source: 'radial', toneScale: 1.9, contrast: 1, minDot: 0, maxDot: 0.9, ink: '#e3262f', paper: '#fff3d1', grit: 0.1 } },
      { name: 'Newsprint', values: { shape: 'round', cell: 0.019, angle: 45, source: 'noise', toneScale: 0.75, contrast: 1.9, gain: 0.04, ink: '#1f1e22', paper: '#e6e0d1', grit: 0.55 } },
      { name: 'CMYK Rosette', thumb: true, values: { shape: 'round', cell: 0.034, angle: 45, source: 'noise', toneScale: 1.1, contrast: 1.35, colorMode: 'cmyk', gradient: { stops: [[0, '#fffaf0'], [0.28, '#9ad1d4'], [0.52, '#f6bd60'], [0.74, '#e5546f'], [1, '#2a2f5b']], mode: 'smooth' }, paper: '#fbf8f1', misreg: 0.12, grit: 0.1 } },
      { name: 'Pop Art', values: { shape: 'round', cell: 0.11, angle: 30, source: 'spiral', toneScale: 0.9, arms: 4, contrast: 1.2, minDot: 0.08, maxDot: 0.9, colorMode: 'gradient', gradient: 'Candy Bands', paper: '#141414', grit: 0 } },
      { name: 'Line Screen', values: { shape: 'line', cell: 0.03, angle: -30, source: 'noise', toneScale: 1, contrast: 1.6, ink: '#14213d', paper: '#efe9dc', grit: 0.2 } },
      { name: 'Ring Halftone', values: { shape: 'ring', cell: 0.065, angle: 45, source: 'rings', toneScale: 0.65, contrast: 1.4, minDot: 0.05, maxDot: 0.78, colorMode: 'gradient', gradient: 'Ocean', paper: '#06121a', grit: 0 } },
      { name: 'Duotone', values: { shape: 'round', cell: 0.036, angle: 45, source: 'noise', toneScale: 1.3, contrast: 1.6, colorMode: 'duotone', ink: '#1d2a44', ink2: '#ff6b4a', paper: '#f6efe2', misreg: 0.08, grit: 0.2 } },
      { name: 'Vapor Waves', values: { shape: 'diamond', cell: 0.055, angle: 45, source: 'waves', toneScale: 1.2, toneAngle: -90, contrast: 1.3, colorMode: 'gradient', gradient: 'Vaporwave', paper: '#120a24', grit: 0 } },
    ],
    glsl: /* glsl */ `
// ---- tone image: 0 = paper .. 1 = solid ink (before gain / min / max). Raw source, before contrast:
float htToneRaw(vec2 p) {
  float s = u_toneScale, ph = u_time * 0.35;
  vec2 dir = vec2(cos(radians(u_toneAngle)), sin(radians(u_toneAngle)));
  float r = length(p), t;
  if (u_source == SOURCE_LINEAR) {
    t = 0.5 + 0.5 * dot(p, dir) / s + 0.2 * sin(ph);
  } else if (u_source == SOURCE_RADIAL) {
    t = 1.0 - r / (s * (1.0 + 0.12 * sin(ph * 2.0)));
  } else if (u_source == SOURCE_NOISE) {
    t = 0.5 + 0.8 * pg_fbm(p / s + vec2(ph * 0.3, -ph * 0.2), 4);
  } else if (u_source == SOURCE_WAVES) {
    float u = dot(p, dir), v = dot(p, vec2(-dir.y, dir.x));
    t = 0.5 + 0.5 * sin((u + 0.18 * s * sin(v * 2.1 / s + ph)) * PG_TAU / s - ph * 2.0);
  } else if (u_source == SOURCE_SPIRAL) {
    t = 0.5 + 0.5 * sin(floor(u_arms + 0.5) * atan(p.y, p.x) + r * PG_TAU / s - ph * 2.0) * smoothstep(0.0, 0.25 * s, r);
  } else {
    t = 0.5 + 0.5 * cos(r * PG_TAU / s - ph * 2.0);
  }
  return t;
}
// Soft S-curve contrast (steepens the midtones but eases into paper / solid instead of clipping) + invert.
float htCurve(float t) {
  t = clamp(0.5 + 0.5 * tanh(u_contrast * (2.0 * t - 1.0)) / tanh(max(u_contrast, 1.0)), 0.0, 1.0);
  return u_invert > 0.5 ? 1.0 - t : t;
}
float htTone(vec2 p) { return htCurve(htToneRaw(p)); }

// Ink amount (0..1) of one plate for tone t. plate: 0 = mono/gradient, 1..4 = C M Y K, 5..6 = duotone ink 1 / 2.
float htInkFromTone(float t, int plate) {
  float a = t;
  if (plate >= 5) {
    a = plate == 5 ? clamp(t * 1.2, 0.0, 1.0) : pow(clamp((t - 0.35) / 0.65, 0.0, 1.0), 1.15);
  } else if (plate >= 1) {
    vec3 cmy = 1.0 - pg_grad(u_gradient, t);
    float k = clamp((min(cmy.x, min(cmy.y, cmy.z)) - 0.2) / 0.8, 0.0, 1.0);   // black only in greyer / darker tones
    vec4 sep = vec4((cmy - k) / max(1.0 - k, 1e-3), k);
    a = plate == 1 ? sep.x : plate == 2 ? sep.y : plate == 3 ? sep.z : sep.w;
  }
  if (a <= 0.004) return 0.0;
  a = clamp(a + u_gain * (1.0 - 0.5 * abs(2.0 * a - 1.0)), 0.0, 1.0);
  return mix(u_minDot, u_maxDot, a);
}

// Signed distance (cell units, < 0 = ink) of a dot of coverage c at offset l from its centre.
// Radii are chosen so the inked area of the screen ≈ c (overlaps included) for every shape.
float htDot(vec2 l, float c) {
  if (c <= 0.0) return 1.0;
  float d;
  if (u_shape == SHAPE_ROUND) {
    float r = c < 0.7854 ? sqrt(c / PG_PI) : 0.5 + 0.2071 * (1.0 - sqrt(max(1.0 - (c - 0.7854) / 0.2146, 0.0)));
    d = length(l) - r;
  } else if (u_shape == SHAPE_SQUARE) {
    d = pg_sdBox(l, vec2(0.5 * sqrt(c)));
  } else if (u_shape == SHAPE_DIAMOND) {
    float k = c < 0.5 ? sqrt(c * 0.5) : 1.0 - sqrt((1.0 - c) * 0.5);
    d = (abs(l.x) + abs(l.y) - k) * 0.70711;
  } else if (u_shape == SHAPE_LINE) {
    d = abs(l.y) - 0.5 * c;
  } else if (u_shape == SHAPE_CROSS) {
    float a = c < 0.51 ? sqrt(c / 2.04) : 0.56;
    float w = c < 0.51 ? 0.3 * a : 0.5 * (1.0 - sqrt(1.0 - c));
    d = min(pg_sdBox(l, vec2(a, w)), pg_sdBox(l, vec2(w, a)));
  } else if (u_shape == SHAPE_RING) {
    float ro = 0.70711 * sqrt(c), ri = ro * 0.7 * (1.0 - c * c);
    float r = length(l);
    d = max(r - ro, ri - r);
  } else {
    float r = sqrt(c / PG_PI) * (1.0 + 0.4 * smoothstep(0.45, 1.0, c));
    d = (length(l / vec2(1.4, 0.714)) - r) * 0.714;
  }
  return d - 0.03 * smoothstep(0.93, 1.0, c);   // close the seams at full coverage
}

// Ink coverage at which a dot of the current shape starts to reach past its own cell.
float htReach() {
  if (u_shape == SHAPE_ROUND) return 0.78;
  if (u_shape == SHAPE_SQUARE || u_shape == SHAPE_LINE) return 0.92;
  if (u_shape == SHAPE_ELLIPSE) return 0.36;
  return 0.5;   // diamonds, crosses, rings
}

// One screen at angle ang (radians). tRange = bounds of the raw tone over this pixel's neighbour dots.
// Returns ink coverage; the winning dot's ink amount goes to inkAmt.
float htScreen(vec2 p, float ang, int plate, float rough, vec2 tRange, out float inkAmt) {
  vec2 q = pg_rot(-ang) * p / u_cell;
  vec2 id = floor(q);
  vec2 f = q - id - 0.5;
  vec2 sg = vec2(f.x < 0.0 ? -1.0 : 1.0, f.y < 0.0 ? -1.0 : 1.0);
  bool lines = u_shape == SHAPE_LINE;

  // own dot: tone sampled exactly at its centre (lines: along the line, so they swell smoothly)
  vec2 c0 = id + 0.5;
  if (lines) c0.x = q.x;
  inkAmt = htInkFromTone(htTone(pg_rot(ang) * (c0 * u_cell)), plate);
  float best = htDot(q - c0, inkAmt);

  // Neighbours only reach into this cell once dots grow past their own cell (dark tones). Skip them where no
  // tone within reach is that dark; otherwise sample each at its own centre, so overlapping dots keep their
  // true outline instead of being clipped at the cell border. (5 samples: CMYK separations aren't monotonic.)
  float aMax = inkAmt;
  for (int k = 0; k < 5; k++) aMax = max(aMax, htInkFromTone(htCurve(mix(tRange.x, tRange.y, float(k) * 0.25)), plate));
  if (aMax + 0.1 + 0.5 * u_grit > htReach()) {      // grit roughens edges by up to ~0.16 grit cells
    for (int k = 1; k < 4; k++) {
      if (lines && k != 2) continue;                    // line screens: only the row above / below
      vec2 c = c0 + vec2(float(k & 1), float(k >> 1)) * sg;
      float an = htInkFromTone(htTone(pg_rot(ang) * (c * u_cell)), plate);
      float d = htDot(q - c, an);
      if (d < best) { best = d; inkAmt = an; }
    }
  }
  float cov = pg_fill(best * u_cell + rough);
  // cells smaller than a few pixels (horizon, far zoom): fade to the mean ink instead of moiré
  if (u_tf_aa > 0.5) cov = mix(cov, inkAmt, smoothstep(0.2, 0.45, pg_px / u_cell));
  return cov;
}

vec4 pattern(vec2 p) {
  float ang = radians(u_angle);
  // Range of the raw tone over the neighbouring dot centres (≤ 1.6 cells + misregistration away): first-order
  // from its screen-space slope, plus a curvature allowance for the periodic / noisy sources.
  float tr = htToneRaw(p);
  float reach = (1.6 + u_misreg) * u_cell;
  float slope = length(vec2(dFdx(tr) / max(length(dFdx(p)), 1e-7), dFdy(tr) / max(length(dFdy(p)), 1e-7)));
  float kf = u_source == SOURCE_LINEAR || u_source == SOURCE_RADIAL ? 0.0
           : u_source == SOURCE_NOISE ? 9.0 / u_toneScale
           : PG_TAU / u_toneScale + (u_source == SOURCE_SPIRAL ? floor(u_arms + 0.5) / max(length(p), reach) : 0.0);
  float dt = slope * reach + 0.25 * kf * kf * reach * reach;
  vec2 tRange = vec2(tr - dt, tr + dt);
  // print grit: wobbly ink edges + mottled paper (seeded noise, calmed down where it would alias)
  float calm = 1.0 - smoothstep(0.004, 0.012, pg_px);
  float rough = u_grit * u_cell * 0.16 * pg_noise(p / u_cell * 2.3) * calm;
  float mottle = u_grit * (0.5 + 0.5 * pg_fbm(p * 9.0, 3) * calm);
  vec3 paper = u_paper * (1.0 - 0.12 * mottle);
  vec3 col;
  float a;

  if (u_colorMode == COLORMODE_CMYK) {
    // process inks, multiplied over the paper. Plate angles relative to K: C −30°, M +30°, Y −45°
    // (K 45° → C 15°, M 75°, Y 0°). Each plate is nudged off-register in a seeded direction.
    const vec3 inkC = vec3(0.0, 0.66, 0.93), inkM = vec3(0.92, 0.0, 0.55), inkY = vec3(1.0, 0.93, 0.0);
    float m = u_misreg * u_cell;
    vec3 dir = pg_hash32(vec2(7.1, 3.3)) * PG_TAU;
    float cC = htScreen(p - m * vec2(cos(dir.x), sin(dir.x)), ang - PG_PI / 6.0, 1, rough, tRange, a);
    float cM = htScreen(p - m * vec2(cos(dir.y), sin(dir.y)), ang + PG_PI / 6.0, 2, rough, tRange, a);
    float cY = htScreen(p - m * vec2(cos(dir.z), sin(dir.z)), ang - PG_PI / 4.0, 3, rough, tRange, a);
    float cK = htScreen(p, ang, 4, rough, tRange, a);
    col = paper * mix(vec3(1.0), inkC, cC) * mix(vec3(1.0), inkM, cM) * mix(vec3(1.0), inkY, cY);
    col *= mix(vec3(1.0), min(u_ink / max(u_paper, vec3(0.02)), 1.0), cK);
  } else if (u_colorMode == COLORMODE_DUOTONE) {
    // light ink carries highlights + midtones on its own screen angle, the dark ink the shadows
    vec2 m = u_misreg * u_cell * vec2(0.8, 0.6);
    float c1 = htScreen(p - m, ang + PG_PI / 6.0, 5, rough, tRange, a);
    float c2 = htScreen(p, ang, 6, rough, tRange, a);
    vec3 f1 = min(u_ink2 / max(u_paper, vec3(0.02)), 1.0), f2 = min(u_ink / max(u_paper, vec3(0.02)), 1.0);
    col = paper * mix(vec3(1.0), f1, c1) * mix(vec3(1.0), f2, c2);
  } else {
    float cov = htScreen(p, ang, 0, rough, tRange, a);
    vec3 ink = u_ink * (1.0 - 0.15 * mottle);
    if (u_colorMode == COLORMODE_GRADIENT) ink = pg_grad(u_gradient, (a - u_minDot) / max(u_maxDot - u_minDot, 1e-3));
    col = mix(paper, ink, cov);
  }
  return vec4(col, 1.0);
}
`,
  });
})();
