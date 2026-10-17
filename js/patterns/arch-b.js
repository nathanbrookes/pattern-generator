/* Architecture styles (b): Bevelled Frames, Window Facade.
 *
 * Both are grids of raised, mitred window frames around flat glass panes, painted like a gouache study:
 * crisp facets in flat colour, panes in soft stepped vertical gradients taken from the Glass gradient, and (with Paint
 * texture) slightly wavering hand-painted edges and brush strokes that run along each facet.
 *
 * Bevel colours (both styles): palette colours 0–3, in any order — they are ranked by brightness. The lightest goes on
 * the facet facing the light, the 2nd on the side facet the light leans towards, the 3rd on the facet opposite the
 * light and the darkest on the side facet turned away. With the light from the upper right (e.g. 70°) that is the
 * reference studies: pale top, light right, mid bottom, saturated/dark left; from the upper left it is mirrored.
 * Turning the Light direction moves the colours round smoothly (soft change-overs). Relief sets the contrast between
 * the four facets (0 = flat, 0.6 = the palette colours as given, 1 = exaggerated).
 *
 *   Bevelled Frames  one square frame per cell (cell = one frame). Thin Mortar lines between frames.
 *                    Params: framesBevel (bevel width), framesShift (pane pushed away from the brighter facets, which
 *                    then look wider — the slightly oblique view of the study), framesSpan (distance along the Glass
 *                    gradient between the top and bottom colours of a pane).
 *   Window Facade    rows of tall windows (cell width = one window) separated by horizontal bands of stepped diagonal
 *                    ramps: a sawtooth gradient between palette colours 5 and 6 (the darker = shadowed foot of a ramp,
 *                    the lighter = its lit top; if they are too close in brightness they are pushed apart). Colour 4
 *                    is not used, so the shared default palettes give a matched pair. The gradient is pixelated into
 *                    blocks whose diagonal is the ramp edge, so the edges read as stairs. Most panes are darker at the
 *                    top, as in the study.
 *                    Params: facadeBevel, facadeWindow (window height, cells), facadeBand (band height, cells),
 *                    facadeRamp (ramp length, cells), facadeSteps (blocks per ramp), facadeSpan.
 *
 * Motion (u_time, all 0 = off and then pixel-identical to the still image; every motion loops seamlessly):
 *   framesCycle   (changes / s) each pane steps through 4 seeded glass positions; the change wipes softly down the pane
 *                 and ripples diagonally across the grid. Period 4 / rate s.
 *   facadeLights  (share lit)   office windows switch on / off (warm, brightest at the ceiling, light spilling onto the
 *                 reveals; ~1 in 9 has a tube that now and then flickers, ≤ 3 flashes / s). Period 12 s. Far away:
 *                 the expected mean.
 *   facadeFlow    (ramps / s)   the stepped ramps slide along their bands; the moving block edges are box-filtered so
 *                 they glide instead of creeping in whole pixels. Period 1 / |flow| s.
 *   Color rain    (shared param, ar_rain; rows / s, Pour or Jacob's ladder, Stagger) the tiles stay put and their colours
 *                 move down (negative: up) through them, a tile at a time. Bevelled Frames: each frame's glass is handed
 *                 to the frame below; during a change the glass slides down one pane. Window Facade: rows are storeys
 *                 (window row + band) so a wave runs down the whole facade; the window glass slides down the columns
 *                 of windows and each ramp block takes the colour of the block above (the band's ramps continued), so
 *                 the stepped ramps walk down their stairs a block per wave; the office lights stay with their windows.
 *                 Not periodic (new colours keep arriving from upstream). Off (0): the code paths above, bit for bit.
 *
 * Panes are varied per window by the seed. When a cell gets down to a few pixels the detail fades to the cell's mean
 * colour (no moiré when zoomed out or tilted). */
(function () {
  const M = (PG.archModes = PG.archModes || []);

  const COMMON = /* glsl */ `
// ---- arch-b shared helpers (prefix arB_) ----
vec3 arB_f[4];              // palette colours 0..3 sorted by brightness, arB_f[0] lightest
vec3 arB_F[4];              // facet colours under the current light: 0 top, 1 right, 2 bottom, 3 left
vec3 arB_fMean = vec3(0.5); // mean of palette colours 0..3
vec2 arB_lit = vec2(0.0, 1.0); // unit vector towards the brighter facets (used to offset panes)
float arB_k = 1.0;          // relief contrast: 0 flat … 1 palette as given (relief 0.6) … 1.5 exaggerated

void arB_init() {
  vec3 a = ar_c(0), b = ar_c(1), c = ar_c(2), d = ar_c(3), t;
  // 4-element sorting network, brightest first
  if (pg_luma(a) < pg_luma(b)) { t = a; a = b; b = t; }
  if (pg_luma(c) < pg_luma(d)) { t = c; c = d; d = t; }
  if (pg_luma(a) < pg_luma(c)) { t = a; a = c; c = t; }
  if (pg_luma(b) < pg_luma(d)) { t = b; b = d; d = t; }
  if (pg_luma(b) < pg_luma(c)) { t = b; b = c; c = t; }
  arB_f[0] = a; arB_f[1] = b; arB_f[2] = c; arB_f[3] = d;
  arB_fMean = 0.25 * (a + b + c + d);
  arB_k = u_relief < 0.6 ? u_relief / 0.6 : 1.0 + (u_relief - 0.6) * 1.25;
  // Facet j's outward normal is j quarter turns clockwise from "up"; the light is u quarter turns clockwise from up.
  // dq = quarter turns between them (0..2): < 0.5 lit → lightest; 0.5..1 the side the light leans to → 2nd;
  // 1..1.5 the side turned away → darkest; > 1.5 opposite the light → 3rd. Soft change-overs keep it continuous.
  float u = (90.0 - u_light) / 90.0;
  for (int j = 0; j < 4; j++) {
    float dq = abs(mod(float(j) - u + 2.0, 4.0) - 2.0);
    vec3 col = mix(arB_f[0], arB_f[1], smoothstep(0.35, 0.65, dq));
    col = mix(col, arB_f[3], smoothstep(0.88, 1.12, dq));
    col = mix(col, arB_f[2], smoothstep(1.35, 1.65, dq));
    arB_F[j] = clamp(mix(arB_fMean, col, arB_k), 0.0, 1.0);
  }
  vec2 v = vec2(pg_luma(arB_F[1]) - pg_luma(arB_F[3]), pg_luma(arB_F[0]) - pg_luma(arB_F[2]));
  arB_lit = dot(v, v) > 1e-4 ? normalize(v) : ar_light;
}

// Two-channel value noise (one set of hashes for both channels), [0, 1).
vec2 arB_vnoise2(vec2 p) {
  vec2 i = floor(p), f = p - i, w = f * f * (3.0 - 2.0 * f);
  return mix(mix(pg_hash22(i), pg_hash22(i + vec2(1.0, 0.0)), w.x),
             mix(pg_hash22(i + vec2(0.0, 1.0)), pg_hash22(i + vec2(1.0, 1.0)), w.x), w.y);
}

// Hand-painted edges (with Paint texture): the cell coordinates waver by up to amp × Paint / 2 cells with freq waves per
// cell, so straight edges, mitres and seams are not ruler-straight. Smooth, so neighbouring cells stay joined; faded out
// before the waves get shorter than ~14 px (shorter ones only make thin lines look jagged).
vec2 arB_wobble(vec2 q, float freq, float amp) {
  float a = u_paint * amp * (1.0 - smoothstep(0.07, 0.11, ar_px * pg_ss * freq));   // output pixels, not samples
  if (a <= 0.0 || u_tf_aa < 0.5) return q;                 // hard-edged mode: keep edges pixel-straight
  return q + a * (arB_vnoise2(q * freq + 11.0) - 0.5);
}

// Brush strokes along a facet (with Paint texture): horizontal streaks (panes, top and bottom bevels) or vertical ones
// (side bevels, vert = 1), freq streaks per cell; faded out before they get thinner than ~2 px.
vec3 arB_strokes(vec3 col, vec2 q, float vert, float freq) {
  float a = u_paint * (1.0 - smoothstep(0.25, 0.5, ar_px * pg_ss * freq));
  if (a <= 0.0) return col;
  vec2 s = vert > 0.5 ? q.yx : q;
  float n = pg_vnoise(vec2(s.x * freq * 0.08, s.y * freq));
  return col * (1.0 + a * 0.15 * (n - 0.5));
}

// Bevel widths (top, right, bottom, left) of a frame: outer box half-size hs, glass box centre gc and half-size gh.
vec4 arB_bevels(vec2 hs, vec2 gc, vec2 gh) {
  return max(vec4(hs.y - gc.y - gh.y, hs.x - gc.x - gh.x, hs.y + gc.y - gh.y, hs.x + gc.x - gh.x), 1e-4);
}

// Mitred frame at l (position from the outer box centre). Each facet runs from the outer edge to the glass edge and the
// mitres join outer and inner corners, so a shifted pane gives wider facets on one side (a slightly oblique view).
// vert = coverage of the side (vertical) facets, for the brush-stroke direction.
vec3 arB_frame(vec2 l, vec2 hs, vec2 gc, vec2 gh, out float vert) {
  vec4 bw = arB_bevels(hs, gc, gh);
  vec4 n = vec4(hs.y - l.y, hs.x - l.x, hs.y + l.y, hs.x + l.x) / bw;   // 0 at the outer edge, 1 at the glass edge
  bool top = n.x < n.z, right = n.y < n.w;
  float nh = top ? n.x : n.z, bh = top ? bw.x : bw.z;
  float nv = right ? n.y : n.w, bv = right ? bw.y : bw.w;
  vec3 colH = top ? arB_F[0] : arB_F[2];
  vec3 colV = right ? arB_F[1] : arB_F[3];
  float h = ar_fill((nh - nv) * inversesqrt(1.0 / (bh * bh) + 1.0 / (bv * bv)));
  vert = 1.0 - h;
  return mix(colV, colH, h);
}

// Area-weighted mean colour of the four facets (they are trapezoids).
vec3 arB_frameMean(vec2 hs, vec2 gc, vec2 gh) {
  vec4 a = arB_bevels(hs, gc, gh) * vec4(hs.x + gh.x, hs.y + gh.y, hs.x + gh.x, hs.y + gh.y);
  return (a.x * arB_F[0] + a.y * arB_F[1] + a.z * arB_F[2] + a.w * arB_F[3]) / max(a.x + a.y + a.z + a.w, 1e-6);
}

// Glass pane: a soft-stepped vertical blend between two colours of the Glass gradient, picked per pane from its id.
// v = 0 bottom … 1 top; span = how far apart (along the gradient) the two colours are; flip = chance that the pane
// has the lower gradient position at the top (darker tops with the presets' glass).
vec3 arB_paneH(vec3 h, float v, float span, float flip) {
  float d = min(span * (0.75 + 0.5 * h.z), 1.0);
  float t0 = h.x * (1.0 - d), t1 = t0 + d;
  if (h.y < flip) { float t = t0; t0 = t1; t1 = t; }
  float s = clamp(v, 0.0, 1.0) * 8.0;
  float st = (floor(s) + smoothstep(0.0, 1.0, fract(s))) / 8.0;   // soft terraces, no hard bands
  return mix(ar_glass(t0), ar_glass(t1), st);
}
vec3 arB_pane(vec2 id, float v, float span, float flip) { return arB_paneH(pg_hash32(id), v, span, flip); }

vec3 arB_glassMean() {
  return 0.2 * (ar_glass(0.1) + ar_glass(0.3) + ar_glass(0.5) + ar_glass(0.7) + ar_glass(0.9));
}

// Color rain: +1 = colours fall (a tile shows the colour of the one above it), −1 = they rise.
float arB_rainDir() { return u_rain < 0.0 ? -1.0 : 1.0; }
// A tile mid-flip: the look of ar_rainTile (incoming colour 'to' above the wipe line, soft shadow on the turning edge),
// but with an analytic AA width aa (one sample, in v units: ar_px / tile height) instead of fwidth — v jumps on the
// band blocks' seams and some callers are inside branches. Small tiles: the shadow fades out below ~12 px (no pulsing
// when far away) and below ~3 px the wipe line becomes a plain cross-fade by wipe (its area mean, no shimmer).
// v = 0 at the tile's top edge … 1 at its bottom edge (flipped here for upward rain).
vec3 arB_rainFlip(vec3 from, vec3 to, float wipe, float v, float aa) {
  return ar_rainLook(from, to, wipe, u_rain < 0.0 ? 1.0 - v : v, aa);   // shared Pour / Jacob's-ladder look
}
`;

  M.push({
    key: 'frames',
    label: 'Bevelled Frames',
    order: 4,
    common: COMMON,
    glsl: /* glsl */ `
// Pane cycle (Animate, framesCycle = changes per second): each pane steps through 4 seeded positions on the Glass
// gradient (state 0 = the still pane). A change-over takes the last 45 % of a step and wipes softly down the pane (top
// first, like a passing reflection); steps are staggered diagonally (+ a little per-pane jitter) so the changes ripple
// across the grid from the upper left. Periodic: everything repeats every 4 / rate seconds.
vec3 arB_paneCycle(vec2 id, float v, float span, float flip, float rate) {
  float T = u_time * rate - 0.15 * id.x + 0.1 * id.y + 0.3 * pg_hash12(id + vec2(31.0, -17.0));
  float k = floor(T);
  float p = clamp((T - k - 0.55) / 0.45, 0.0, 1.0);
  float w = smoothstep(0.0, 1.0, clamp(p * 1.7 - (1.0 - clamp(v, 0.0, 1.0)) * 0.7, 0.0, 1.0));
  k = mod(k, 4.0);
  vec3 a = arB_paneH(pg_hash32(id + k * vec2(1031.0, -2087.0)), v, span, flip);
  if (w <= 0.0) return a;
  k = mod(k + 1.0, 4.0);
  return mix(a, arB_paneH(pg_hash32(id + k * vec2(1031.0, -2087.0)), v, span, flip), w);
}

vec3 arB_framesPane(vec2 id, float v) {
  return u_framesCycle > 0.0 ? arB_paneCycle(id, v, u_framesSpan, 0.5, u_framesCycle) : arB_pane(id, v, u_framesSpan, 0.5);
}
// Color rain: frame id shows the pane of the frame 'steps' rows upstream (its glass gradient and, with Pane cycle, that
// frame's current cycle state); during a change the glass slides down one pane, so the next pane comes in from the top
// as the old one leaves at the bottom. The bevels are the same in every frame, so only the glass is handed on.
// v = 0 bottom … 1 top of the pane; ph = pane height (cells).
vec3 arB_framesRain(vec2 id, float v, float ph) {
  vec2 r = ar_rain(vec2(id.x, -id.y));                       // rows count down the facade
  vec2 src = id + vec2(0.0, arB_rainDir() * r.x);
  if (r.y <= 0.0) return arB_framesPane(src, v);
  float vs = v + arB_rainDir() * r.y;                        // the glass slides along with the wipe
  return arB_rainFlip(arB_framesPane(src, vs), arB_framesPane(src + vec2(0.0, arB_rainDir()), vs - arB_rainDir()), r.y, 1.0 - v, ar_px / ph);
}

// Bevelled Frames — palette 0..3 = bevels (ranked by brightness, see arB_init); Glass = panes; Mortar = lines between frames.
vec3 ar_frames(vec2 q) {
  arB_init();
  q = arB_wobble(q, 8.0, 0.02);                              // hand-painted edges, ~8 waves per frame
  vec2 id = floor(q);
  vec2 l = q - id - 0.5;
  float b = clamp(u_framesBevel, 0.02, 0.48);
  vec2 hs = vec2(0.5), gh = vec2(0.5 - b);
  float m = max(b - 0.02, 0.0);
  vec2 gc = clamp(-u_framesShift * arB_lit, -m, m);          // pane pushed away from the bright facets: they look wider
  float vert;
  vec3 col = arB_frame(l, hs, gc, gh, vert);
  vec2 lg = l - gc;
  float inPane = ar_fill(max(abs(lg.x) - gh.x, abs(lg.y) - gh.y));
  if (inPane > 0.0) {
    float v = 0.5 + 0.5 * lg.y / gh.y;
    col = mix(col, u_rain != 0.0 ? arB_framesRain(id, v, 2.0 * gh.y) : arB_framesPane(id, v), inPane);
  }
  col = arB_strokes(col, q, vert * (1.0 - inPane), 24.0);
  col = ar_seam(col, 0.5 - max(abs(l.x), abs(l.y)));
  // far away: the mean colour of a cell
  vec3 mean = mix(arB_frameMean(hs, gc, gh), arB_glassMean(), 4.0 * gh.x * gh.y);
  if (u_gap > 0.0) mean = mix(mean, u_gapColor, clamp(2.0 * u_gap, 0.0, 1.0));
  return mix(col, mean, smoothstep(0.12, 0.35, ar_px));
}
`,
    params: [
      { id: 'framesBevel', label: 'Bevel width', min: 0.04, max: 0.45, default: 0.18, step: 0.005, random: [0.12, 0.26], help: 'Width of the bevelled frame, as a fraction of a cell' },
      { id: 'framesShift', label: 'Pane offset', min: 0, max: 0.12, default: 0.018, step: 0.001, random: [0, 0.04], help: 'Shifts each pane away from the brighter bevels so they look wider, as in a slightly oblique view' },
      { id: 'framesSpan', label: 'Pane gradient', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.3, 0.6], help: 'How far apart along the Glass gradient the top and bottom colours of a pane are (0 = flat panes)' },
      { id: 'framesCycle', label: 'Pane cycle', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, the panes slowly change to new glass colours — each change wipes down the pane like a passing reflection and ripples across the grid (changes per second: 0.25 = every 4 s per pane)' },
    ],
    presets: [
      {
        name: 'Bevelled Frames',
        values: {
          size: 0.44,
          light: 70,
          relief: 0.6,
          colors: ['#f1e2e9', '#b6abbc', '#6d83b0', '#2c5aa2'],
          glass: { stops: [[0, '#634c5d'], [0.12, '#728083'], [0.25, '#7e8e87'], [0.38, '#a4a5a2'], [0.5, '#f0ccd4'], [0.62, '#f5f4ef'], [0.75, '#c2eddf'], [0.88, '#f5f1ea'], [1, '#f1d6db']], mode: 'smooth' },
          gap: 0.011,
          gapColor: '#e9e4f0',
          paint: 0.45,
          framesBevel: 0.19,
          framesShift: 0.018,
          framesSpan: 0.5,
        },
      },
      {
        name: 'Sunset Frames',
        values: {
          size: 0.3,
          light: 70,
          relief: 0.6,
          colors: ['#f7e8d0', '#e2b37c', '#b85a3a', '#6d2a27'],
          glass: { stops: [[0, '#2f4a6b'], [0.3, '#7193b8'], [0.55, '#f3d8bb'], [0.8, '#efa587'], [1, '#8a4a5c']], mode: 'smooth' },
          gap: 0.01,
          gapColor: '#f8eedf',
          paint: 0.35,
          framesBevel: 0.2,
          framesShift: 0.03,
          framesSpan: 0.45,
        },
      },
      {
        name: 'Cloud Reflections',
        play: true,
        values: {
          size: 0.36,
          light: 70,
          relief: 0.6,
          colors: ['#f4efe6', '#c9c3d6', '#8494b8', '#38507e'],
          glass: { stops: [[0, '#4f6f9c'], [0.2, '#86a6cc'], [0.4, '#c9daea'], [0.55, '#f4f1ea'], [0.7, '#e9d3c4'], [0.85, '#b8c4d8'], [1, '#7f93b8']], mode: 'smooth' },
          gap: 0.01,
          gapColor: '#f3eee6',
          paint: 0.4,
          framesBevel: 0.17,
          framesShift: 0.02,
          framesSpan: 0.55,
          framesCycle: 0.25,
        },
      },
      {
        name: 'Tumbling Panes',
        play: true,
        values: {
          size: 0.32,
          light: 70,
          relief: 0.6,
          colors: ['#f3ece2', '#d9c7b8', '#9c8a8f', '#4f4a63'],
          glass: { stops: [[0, '#1f4e5f'], [0.2, '#3f8f8a'], [0.4, '#a8d5ba'], [0.55, '#f2e8cf'], [0.7, '#f4a582'], [0.85, '#c8577a'], [1, '#5b3a6e']], mode: 'smooth' },
          gap: 0.01,
          gapColor: '#f1ebe1',
          paint: 0.4,
          framesBevel: 0.17,
          framesShift: 0.02,
          framesSpan: 0.15,
          rain: 1.5,
          rainStyle: 'ladder',
          rainGap: 3,
          rainStagger: 0.08,
        },
      },
    ],
  });

  M.push({
    key: 'facade',
    label: 'Window Facade',
    order: 5,
    common: COMMON,
    glsl: /* glsl */ `
// Lights (Animate, amt = facadeLights): how lit window id is, 0..1. Each window has 1–4 slots per 12 s cycle (steady, or
// switching every 6 / 4 / 3 s, offset per window) and is lit in a slot with probability amt; a switch takes ~0.2 s. About
// 1 window in 9 has a failing tube that now and then flickers while lit. Periodic: everything repeats every 12 s.
const vec3 ARB_WARM_LO = vec3(0.97, 0.66, 0.34), ARB_WARM_HI = vec3(1.0, 0.95, 0.78);
float arB_lights(vec2 id, float amt) {
  vec3 h = pg_hash32(id + vec2(-71.0, 113.0));
  float n = 1.0 + floor(h.x * 4.0);
  float T = u_time * n / 12.0 + h.y;
  float k = floor(T);
  float s0 = mod(k, n), s1 = mod(k + 1.0, n);
  float on0 = pg_hash12(vec2(id.x * 8.0 + s0, id.y)) < amt ? 1.0 : 0.0;
  float on1 = pg_hash12(vec2(id.x * 8.0 + s1, id.y)) < amt ? 1.0 : 0.0;
  float lit = mix(on0, on1, smoothstep(1.0 - n * 0.2 / 12.0, 1.0, T - k));
  if (h.z < 0.11 && lit > 0.0) {
    // failing tube: now and then (some of the 2/3 s spells) a stutter of 1/6 s dips. Dips fall only on every other
    // 1/6 s tick, so there are never more than 3 flashes a second — under the photosensitive-flash limit even when a
    // window is zoomed up to fill the view
    float burst = pg_hash12(vec2(id.x * 32.0 + mod(floor(u_time * 1.5), 18.0), id.y - 4099.0)) < 0.45 ? 1.0 : 0.0;
    float j = mod(floor(u_time * 6.0), 72.0);
    lit *= 1.0 - 0.65 * burst * (1.0 - mod(j, 2.0)) * step(pg_hash12(vec2(id.x * 128.0 + j, id.y)), 0.6);
  }
  return lit;
}
// A lit pane: warm room light, brightest under the ceiling, in the pane's soft terraces (a little of the glass
// reflection stays); v = 0 bottom … 1 top.
vec3 arB_litPane(vec3 pane, float v, float lit) {
  float s = clamp(v, 0.0, 1.0) * 8.0;
  float st = (floor(s) + smoothstep(0.0, 1.0, fract(s))) / 8.0;
  return mix(pane, mix(ARB_WARM_LO, ARB_WARM_HI, st), 0.82 * lit);
}
// Mean colour of a window (pane share paneA) when it is this lit — lit pane + light spill on the reveals.
vec3 arB_litMean(vec3 m, float lit, float paneA) {
  return mix(m, 0.5 * (ARB_WARM_LO + ARB_WARM_HI), lit * (0.82 * paneA + 0.15 * (1.0 - paneA)));
}

// Ramp band colour at (qx, by) — qx = x along the band (after Ramp flow), by = height above the band's bottom — for the
// block blk containing it; R = ramp length, n = blocks per ramp, ph = the band's offset (ramps), fA = detail → mean.
vec3 arB_band(float qx, float by, vec2 blk, float rowB, float R, float n, float ph, vec3 cD, vec3 cL, vec3 bandMean, float fA) {
  float bw = R / n;
  float s = (qx + 2.0 * by) / R + ph;                        // ramp coordinate: edges where s is a whole number
  // gliding blocks: their vertical edges move, so box-filter them over one sample (ax = −½ … ½ towards the
  // neighbouring block) — otherwise they would creep in whole-pixel jumps. Still image (flow 0): hard, as before.
  float ax = 0.0;
  if (u_facadeFlow != 0.0 && u_tf_aa > 0.5) {
    float fx = fract(qx / bw), e = clamp(ar_px / bw, 1e-4, 1.0);   // e = 1: a linear ramp (blocks under a sample)
    ax = fx < 0.5 ? -max(0.5 - fx / e, 0.0) : max(0.5 - (1.0 - fx) / e, 0.0);
  }
  float sc = (blk.x + ax + blk.y + 1.0) / n + ph;            // s at the block centre (block diagonals lie on the edges)
  float k = floor(s + 0.5);                                  // nearest ramp edge
  float sd = mix(sc, s, fA);                                 // stepped → smooth when blocks get tiny
  float lvL = clamp(sd - k + 1.0, 0.0, 1.0);                 // level on the left (end of the previous ramp)
  float lvR = clamp(sd - k, 0.0, 1.0);                       // level on the right (foot of the next ramp)
  float lv = mix(lvL, lvR, ar_fill((k - s) * R * 0.4472136));
  vec3 band = clamp(mix(bandMean, mix(cD, cL, lv), arB_k), 0.0, 1.0);
  vec2 hb = blk;
  if (u_facadeFlow != 0.0) hb.x = mod(hb.x, n);
  float pv = pg_hash12(hb + vec2(0.0, rowB * 64.0));
  if (ax != 0.0) pv = mix(pv, pg_hash12(vec2(mod(blk.x + sign(ax), n), hb.y) + vec2(0.0, rowB * 64.0)), abs(ax));
  return band * (1.0 + u_paint * (1.0 - fA) * 0.14 * (pv - 0.5));   // hand-painted blocks
}

// Window Facade — palette 0..3 = window bevels (ranked by brightness), 5 / 6 = ramp colours (the darker is the shadowed
// foot of a ramp, the lighter its lit top; 4 unused); Glass = panes; Mortar = outline of the windows.
// Color rain: rows are storeys (window row + band) and the waves run down the whole facade. Each window's glass is
// handed down the column of windows; in the bands each painted block takes the colour of the block above it (the
// band's ramps continued upward), so the stepped ramps walk down the stairs a block per wave. The office lights stay
// with their windows.
vec3 ar_facade(vec2 q) {
  arB_init();
  q = arB_wobble(q, 3.5, 0.03);                              // hand-painted edges (windows are drawn smaller)
  float wh = max(u_facadeWindow, 0.2), bh = max(u_facadeBand, 0.0), P = wh + bh;
  float iP = 1.0 / max(P, 1e-3);   // for Color rain — more "/ P" would let the compiler turn the divisions above into
                                   // reciprocal multiplies and shift the still image by a level here and there
  float b = clamp(u_facadeBevel, 0.01, 0.48);
  float fA = smoothstep(0.1, 0.3, ar_px);                 // detail → mean
  // ---- window row nearest to q (window centre at y = row * P + wh / 2)
  float rowW = floor((q.y - 0.5 * wh) / P + 0.5);
  float cx = floor(q.x);
  vec2 l = vec2(q.x - cx - 0.5, q.y - rowW * P - 0.5 * wh);
  vec2 hs = vec2(0.5, 0.5 * wh);
  vec2 gh = max(hs - b, vec2(1e-3));
  float dWin = abs(l.y) - 0.5 * wh;                          // signed distance to the window row (negative inside)
  float cov = ar_fill(dWin);
  float paneA = gh.x * gh.y * 4.0 / wh;                      // pane share of a window
  vec3 winMean = mix(arB_frameMean(hs, vec2(0.0), gh), arB_glassMean(), paneA);
  vec3 winMeanL = winMean;                                   // ... with this window's light
  float lit = 0.0;
  if (u_facadeLights > 0.0 && cov > 0.0) {
    lit = arB_lights(vec2(cx, rowW), u_facadeLights);
    winMeanL = arB_litMean(winMean, lit, paneA);
  }
  vec3 win = winMeanL;
  if (cov > 0.0 && fA < 1.0) {
    float vert;
    win = arB_frame(l, hs, vec2(0.0), gh, vert);
    float dPane = max(abs(l.x) - gh.x, abs(l.y) - gh.y);
    float inPane = ar_fill(dPane);
    // room light spilling onto the reveals, fading out across the bevel
    if (lit > 0.0) win = mix(win, ARB_WARM_HI, 0.3 * lit * (1.0 - smoothstep(0.0, b, dPane)));
    if (inPane > 0.0) {
      float v = 0.5 + 0.5 * l.y / gh.y;
      vec3 pane;
      if (u_rain != 0.0) {
        vec2 r = ar_rain(vec2(cx, -rowW - 0.5 * wh * iP));    // storeys count down; this row's centre
        float ry = rowW + arB_rainDir() * r.x;
        float vs = v + arB_rainDir() * r.y;                  // the glass slides along with the wipe
        pane = arB_pane(vec2(cx, ry), vs, u_facadeSpan, 0.6);
        if (r.y > 0.0) pane = arB_rainFlip(pane, arB_pane(vec2(cx, ry + arB_rainDir()), vs - arB_rainDir(), u_facadeSpan, 0.6), r.y, 1.0 - v, ar_px / (2.0 * gh.y));
      } else pane = arB_pane(vec2(cx, rowW), v, u_facadeSpan, 0.6);
      if (lit > 0.0) pane = arB_litPane(pane, v, lit);
      win = mix(win, pane, inPane);
    }
    win = arB_strokes(win, q, vert * (1.0 - inPane), 11.0);
    win = mix(win, winMeanL, fA);
  }
  // ---- ramp colours: always dark → light; too little contrast: push the ends apart
  vec3 cD = ar_c(5), cL = ar_c(6);
  if (pg_luma(cD) > pg_luma(cL)) { vec3 t = cD; cD = cL; cL = t; }
  float lc = clamp((0.3 - pg_luma(cL) + pg_luma(cD)) / 0.3, 0.0, 1.0);
  cD *= 1.0 - 0.5 * lc;
  cL += (1.0 - cL) * 0.35 * lc;
  vec3 bandMean = 0.5 * (cD + cL);
  vec3 band = bandMean;
  if (cov < 1.0) {
    // band nearest to q (from y = row * P + wh to (row + 1) * P); by = height above its bottom
    float rowB = floor((q.y - wh - 0.5 * bh) / P + 0.5);
    float by = q.y - rowB * P - wh;
    float R = max(u_facadeRamp, 0.25);
    float n = max(floor(u_facadeSteps + 0.5), 1.0);
    float bw = R / n;                                        // block width; block height bw / 2 (ramp slope 2)
    float ph = floor(pg_hash12(vec2(rowB, 7.0)) * n) / n;    // per-band offset, whole blocks
    // Ramp flow (Animate): the band slides along by facadeFlow ramp lengths per second, wrapped every ramp (the painted
    // blocks' slight variation then repeats every ramp too), so it loops seamlessly every 1 / |flow| s
    float qx = q.x;
    if (u_facadeFlow != 0.0) qx -= fract(u_time * u_facadeFlow) * R;
    vec2 blk = floor(vec2(qx / bw, by / (0.5 * bw)));
    if (u_rain != 0.0) {
      // Color rain: this block shows the block 'steps' rows upstream (its ramp level, diagonal split and paint) and
      // the next one wipes in. Storeys count down the facade; the block's centre gives the moment the wave reaches it.
      float hB = 0.5 * bw;                                   // block row height
      float qxU = q.x - u_time * u_facadeFlow * R;           // gliding blocks keep their place in the stagger
      vec2 r = ar_rain(vec2((floor(qxU / bw) + 0.5) * bw - 0.5, -rowB - (wh + (blk.y + 0.5) * hB) * iP));
      float m = arB_rainDir() * r.x;
      band = arB_band(qx, by + m * hB, blk + vec2(0.0, m), rowB, R, n, ph, cD, cL, bandMean, fA);
      if (r.y > 0.0) {
        m += arB_rainDir();
        vec3 nxt = arB_band(qx, by + m * hB, blk + vec2(0.0, m), rowB, R, n, ph, cD, cL, bandMean, fA);
        band = arB_rainFlip(band, nxt, r.y, 1.0 - (by / hB - blk.y), ar_px / hB);
      }
    } else band = arB_band(qx, by, blk, rowB, R, n, ph, cD, cL, bandMean, fA);
  }
  // ---- composite, mortar around the windows
  vec3 col = mix(band, win, cov);
  col = ar_seam(col, dWin < 0.0 ? min(0.5 - abs(l.x), -dWin) : dWin);
  // very far: the mean colour of the whole facade
  vec3 mean = (winMean * wh + bandMean * bh) / P;
  if (u_facadeLights > 0.0) mean = (arB_litMean(winMean, u_facadeLights, paneA) * wh + bandMean * bh) / P;
  return mix(col, mean, smoothstep(0.6, 1.6, ar_px));
}
`,
    params: [
      { id: 'facadeBevel', label: 'Bevel width', min: 0.03, max: 0.45, default: 0.18, step: 0.005, random: [0.12, 0.22], help: 'Width of the window frames, as a fraction of a window' },
      { id: 'facadeWindow', label: 'Window height', min: 0.5, max: 5, default: 1.75, step: 0.01, random: [1.3, 2.6], help: 'Window height in window widths' },
      { id: 'facadeBand', label: 'Band height', min: 0, max: 4, default: 1.07, step: 0.01, random: [0.6, 1.5], help: 'Height of the ramp bands between window rows' },
      { id: 'facadeRamp', label: 'Ramp length', min: 1, max: 16, default: 4.1, step: 0.1, random: [3, 7], help: 'Length of one diagonal ramp, in window widths' },
      { id: 'facadeSteps', label: 'Ramp steps', type: 'int', min: 2, max: 32, default: 8, random: [6, 12], help: 'Painted blocks across one ramp' },
      { id: 'facadeSpan', label: 'Pane gradient', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.3, 0.6], help: 'How far apart along the Glass gradient the top and bottom colours of a pane are (0 = flat panes)' },
      { id: 'facadeLights', label: 'Office lights', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, office windows switch on and off like a building at dusk — about this share of them is lit at a time, glowing warm, and a few flicker (repeats every 12 s)' },
      { id: 'facadeFlow', label: 'Ramp flow', min: -1, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, the stepped ramps glide along their bands like escalators (ramp lengths per second; negative = the other way)' },
    ],
    presets: [
      {
        name: 'Window Facade',
        values: {
          size: 0.27,
          light: 70,
          relief: 0.6,
          colors: ['#a8d3ba', '#527159', '#294535', '#182d22', '#3a8a94', '#1e4a52', '#57bcdb'],
          glass: { stops: [[0.05, '#4e3e46'], [0.15, '#5a9a64'], [0.25, '#3d6c7c'], [0.35, '#6a8494'], [0.45, '#4f9180'], [0.55, '#bcaeb0'], [0.65, '#b2e6bb'], [0.75, '#c4cacb'], [0.85, '#bcd5cc'], [0.95, '#a8dcc6']], mode: 'steps' },
          gap: 0,
          paint: 0.35,
          facadeBevel: 0.175,
          facadeWindow: 1.72,
          facadeBand: 1.07,
          facadeRamp: 4.1,
          facadeSteps: 8,
          facadeSpan: 0.5,
        },
      },
      {
        name: 'Ochre Facade',
        values: {
          size: 0.24,
          light: 70,
          relief: 0.6,
          colors: ['#f1dcc0', '#c99a66', '#7d4b2f', '#4a2a1d', '#b8703c', '#8a3b22', '#e8a858'],
          glass: { stops: [[0, '#2e4057'], [0.3, '#8fa9c2'], [0.55, '#e9ecef'], [0.8, '#b9c8a8'], [1, '#566a7a']], mode: 'smooth' },
          gap: 0,
          paint: 0.35,
          facadeBevel: 0.17,
          facadeWindow: 1.6,
          facadeBand: 1,
          facadeRamp: 5,
          facadeSteps: 10,
          facadeSpan: 0.5,
        },
      },
      {
        name: 'Facade at Dusk',
        play: true,
        values: {
          size: 0.24,
          light: 70,
          relief: 0.6,
          colors: ['#b9a8cf', '#6b5d8e', '#3d355f', '#231e3b', '#2a2f55', '#2b3463', '#7d76b8'],
          glass: { stops: [[0, '#161a36'], [0.3, '#2a3462'], [0.6, '#4a5288'], [0.85, '#7a6f9f'], [1, '#a98aa8']], mode: 'smooth' },
          gap: 0,
          paint: 0.35,
          facadeBevel: 0.17,
          facadeWindow: 1.7,
          facadeBand: 1.05,
          facadeRamp: 4.5,
          facadeSteps: 9,
          facadeSpan: 0.45,
          facadeLights: 0.4,
          facadeFlow: 0.25,
        },
      },
      {
        name: 'Stairfall Facade',
        play: true,
        values: {
          size: 0.24,
          light: 70,
          relief: 0.6,
          colors: ['#e9eef2', '#9fb4c4', '#4f6b82', '#22344a', '#5e7f99', '#2b4a66', '#8fc0dd'],
          glass: { stops: [[0, '#25304f'], [0.25, '#4f6fa5'], [0.5, '#e7c6a3'], [0.75, '#f08a6c'], [1, '#7b3f61']], mode: 'smooth' },
          gap: 0,
          paint: 0.35,
          facadeBevel: 0.17,
          facadeWindow: 1.7,
          facadeBand: 1.05,
          facadeRamp: 4.5,
          facadeSteps: 9,
          facadeSpan: 0.4,
          rain: 0.8,
          rainStyle: 'ladder',
          rainGap: 2,
          rainStagger: 0,
        },
      },
    ],
  });
})();
