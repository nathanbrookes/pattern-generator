/* Cells & Voronoi — jittered cellular tilings: stained glass, dry earth, crackle glaze, giraffe & leopard
 * coats, honeycomb. Uses the 2-pass "exact border distance" Voronoi (iq) so edges have an even width. */
(function () {
  const organic = (v) => v.mode === 'giraffe' || v.mode === 'leopard';
  const glassPalette = ['#9e1b32', '#1d4e89', '#e8a317', '#2d6a4f', '#5b2a86', '#d95d39', '#2a9d8f', '#c9b037'];

  PG.registerPattern({
    id: 'voronoi',
    name: 'Cells & Voronoi',
    category: 'Organic',
    description: 'Voronoi cells with crisp, even borders: stained glass, cracked earth, crackle glaze, animal coats, honeycomb.',
    params: [
      { type: 'heading', label: 'Cells' },
      {
        id: 'mode',
        label: 'Style',
        type: 'select',
        options: [
          ['cells', 'Flat cells'],
          ['glass', 'Stained glass'],
          ['cracked', 'Cracked earth'],
          ['crackle', 'Crackle (F2 − F1)'],
          ['giraffe', 'Giraffe patches'],
          ['leopard', 'Leopard rosettes'],
          ['hex', 'Hex lattice'],
        ],
        default: 'glass',
      },
      { id: 'size', label: 'Cell size', min: 0.02, max: 1.5, default: 0.22, step: 0.001, scale: 'log', random: [0.1, 0.4] },
      { id: 'jitter', label: 'Jitter', min: 0, max: 1, default: 0.9, step: 0.01, random: [0.55, 1], help: 'Randomness of the cell centres (0 = regular grid / hex lattice)' },
      {
        id: 'metric',
        label: 'Distance',
        type: 'select',
        options: [['euclid', 'Euclidean'], ['manhattan', 'Manhattan'], ['chebyshev', 'Chebyshev']],
        default: 'euclid',
        random: ['euclid', 'euclid', 'euclid', 'manhattan', 'chebyshev'],
      },
      { id: 'rounding', label: 'Rounding', min: 0, max: 1, default: 0.15, step: 0.01, random: [0, 0.5], showIf: (v) => v.mode !== 'crackle', help: 'Rounds the cell corners' },
      { id: 'wobble', label: 'Wobble', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.4], help: 'Organic, hand-drawn distortion of the borders' },

      { type: 'heading', label: 'Edges' },
      { id: 'edge', label: 'Edge width', min: 0, max: 0.5, default: 0.09, step: 0.001, random: [0.03, 0.16], help: 'Relative to the cell size' },
      { id: 'edgeColor', label: 'Edge color', type: 'color', default: '#17171a', random: false },
      { id: 'ring', label: 'Ring width', min: 0.03, max: 0.4, default: 0.15, step: 0.001, random: [0.1, 0.22], showIf: (v) => v.mode === 'leopard' },
      { id: 'ground', label: 'Ground color', type: 'color', default: '#f0e2c2', random: false, showIf: organic, help: 'Shows between the patches / rosettes' },

      { type: 'heading', label: 'Color' },
      {
        id: 'colorSrc',
        label: 'Color source',
        type: 'select',
        options: [['palette', 'Palette'], ['random', 'Gradient · random'], ['distance', 'Gradient · distance']],
        default: 'palette',
      },
      { id: 'palette', label: 'Palette', type: 'palette', default: glassPalette, showIf: (v) => v.colorSrc === 'palette' },
      { id: 'gradient', label: 'Gradient', type: 'gradient', default: 'Sunset', showIf: (v) => v.colorSrc !== 'palette' },
      { id: 'variation', label: 'Shade variation', min: 0, max: 1, default: 0.2, step: 0.01, random: [0, 0.4], help: 'Random brightness per cell' },

      { type: 'heading', label: 'Surface' },
      { id: 'bevel', label: 'Bevel', min: -1, max: 1, default: 0.45, step: 0.01, random: [-0.4, 0.7], help: 'Positive = raised cells, negative = sunken cells' },
      { id: 'texture', label: 'Texture', min: 0, max: 1, default: 0.5, step: 0.01, random: [0, 0.6], help: 'Mottled glass / soil grain' },
      { id: 'speed', label: 'Drift speed', min: 0, max: 2, default: 0.4, step: 0.01, random: [0.1, 0.8], help: 'Used when Animate is on' },
    ],
    presets: [
      { name: 'Stained Glass', thumb: true, values: {} },
      {
        name: 'Dry Earth',
        values: {
          mode: 'cracked', size: 0.32, jitter: 1, rounding: 0.08, wobble: 0.3, edge: 0.04, edgeColor: '#24160c',
          colorSrc: 'palette', palette: ['#c9a273', '#c29a6a', '#cfa97b', '#bb9262'], variation: 0.1, bevel: 0.3, texture: 0.6,
        },
      },
      {
        name: 'Giraffe',
        values: {
          mode: 'giraffe', size: 0.24, jitter: 0.95, rounding: 0.35, wobble: 0.4, edge: 0.13, ground: '#f3e3c3',
          colorSrc: 'palette', palette: ['#8c4a1a', '#9b5523', '#7d3f14', '#a45f2c'], variation: 0.12, bevel: 0.15, texture: 0.3,
        },
      },
      {
        name: 'Leopard',
        values: {
          mode: 'leopard', size: 0.19, jitter: 0.9, rounding: 0.3, wobble: 0.5, edge: 0.15, ring: 0.15, edgeColor: '#1c120b', ground: '#e7b874',
          colorSrc: 'palette', palette: ['#c98a3e', '#bf7f35', '#cf9447'], variation: 0.1, bevel: 0, texture: 0.35,
        },
      },
      {
        name: 'Pastel Cells',
        values: {
          mode: 'cells', size: 0.2, jitter: 1, rounding: 0.6, edge: 0.07, edgeColor: '#fbf7f2',
          colorSrc: 'palette', palette: 'Pastel', variation: 0.06, bevel: 0.2, texture: 0,
        },
      },
      {
        name: 'Honeycomb',
        values: {
          mode: 'hex', size: 0.17, jitter: 0, rounding: 0.3, edge: 0.12, edgeColor: '#f3cf6e',
          colorSrc: 'distance', gradient: { stops: [[0, '#9c4a02'], [0.6, '#d88a0c'], [1, '#f6b62e']], mode: 'smooth' },
          variation: 0.2, bevel: -0.7, texture: 0.25,
        },
      },
      {
        name: 'Crackle Glaze',
        values: {
          mode: 'crackle', size: 0.2, jitter: 1, edge: 0.03, edgeColor: '#33413a',
          colorSrc: 'random', gradient: { stops: [[0, '#a9c8b0'], [0.5, '#c4dcc4'], [1, '#dbe9d6']], mode: 'smooth' },
          variation: 0.08, bevel: 0.65, texture: 0.3,
        },
      },
      {
        name: 'Vapor Mosaic',
        values: { mode: 'cells', size: 0.18, jitter: 0.65, metric: 'manhattan', rounding: 0.25, edge: 0.1, edgeColor: '#07060d', colorSrc: 'random', gradient: 'Vaporwave', variation: 0.25, bevel: 0.6, texture: 0 },
      },
    ],
    glsl: /* glsl */ `
// Site position inside its grid cell (0..1). Bounces around its home spot when animated.
// Hex mode places the sites on a staggered lattice (rows are 0.866 tall, see 'sc' below).
vec2 vorSite(vec2 id) {
  vec3 h = pg_hash32(id);
  bool hex = u_mode == MODE_HEX;
  vec2 home = hex ? vec2(0.25 + 0.5 * mod(id.y, 2.0), 0.5) : vec2(0.5);
  vec2 ph = h.xy + u_time * u_speed * (0.08 + 0.12 * h.z) * vec2(1.0, 0.83);
  vec2 tri = abs(fract(ph) * 2.0 - 1.0);           // triangle wave: uniform in 0..1 like the hash itself
  return home + (tri - 0.5) * u_jitter * (hex ? 0.5 : 1.0);
}

// Distance metrics. Chebyshev is Manhattan in a 45°-rotated, 1/sqrt(2)-scaled frame (see vorL1Border).
float vorMetric(vec2 r) {
  if (u_metric == METRIC_MANHATTAN) return abs(r.x) + abs(r.y);
  if (u_metric == METRIC_CHEBYSHEV) return max(abs(r.x), abs(r.y));
  return length(r);
}

// Exact Euclidean distance to the Manhattan bisector of sites a (own) and b, both given relative to the
// current point. Per axis |u-b|-|u-a| is a clamped ramp, so the bisector is a 45° segment between two
// axis-parallel rays. Returns (signed distance, + inside the own cell; outward normal .yz).
vec3 vorL1Border(vec2 a, vec2 b) {
  vec2 sg = vec2(b.x >= a.x ? 1.0 : -1.0, b.y >= a.y ? 1.0 : -1.0);
  vec2 D = abs(b - a);
  vec2 Q = sg * 0.5 * (a + b);                         // current point in the bisector's local frame
  float F = clamp(2.0 * Q.x, -D.x, D.x) + clamp(2.0 * Q.y, -D.y, D.y);   // = |b|1 - |a|1
  bool sw = D.y > D.x;
  if (sw) { Q = Q.yx; D = D.yx; }
  float m = 0.5 * D.y;
  vec2 P1 = vec2(m, -m), seg = vec2(-2.0 * m, 2.0 * m);
  vec2 c0 = P1 + seg * (m > 0.0 ? clamp(dot(Q - P1, seg) / dot(seg, seg), 0.0, 1.0) : 0.0);
  vec2 c1 = vec2(-m, max(Q.y, m));                     // ray going up from the segment's top end
  vec2 c2 = vec2(m, min(Q.y, -m));                     // ray going down from its bottom end
  vec2 v0 = Q - c0, v1 = Q - c1, v2 = Q - c2;
  vec2 v = dot(v1, v1) < dot(v0, v0) ? v1 : v0;
  v = dot(v2, v2) < dot(v, v) ? v2 : v;
  float u = length(v);
  vec2 g = u > 1e-6 ? v / u : vec2(0.7071, -0.7071);
  if (sw) g = g.yx;
  float s = F < 0.0 ? -1.0 : 1.0;
  return vec3(s * u, s * sg * g);
}

// 2-pass Voronoi. q in cell units, sc scales cell space to true space, k = corner rounding.
// Out: id (cell), mr (vector to own site), r2 (vector to 2nd site), f1/f2 (metric distances),
//      bd (distance to the cell border, smooth-min'd), bn (outward border normal), nid (nearest neighbour cell).
void vorCells(vec2 q, vec2 sc, float k, out vec2 id, out vec2 mr, out vec2 r2, out float f1, out float f2,
              out float bd, out vec2 bn, out vec2 nid) {
  vec2 ip = floor(q), fp = q - ip;
  vec2 mg = vec2(0.0);
  f1 = 1e9; mr = vec2(0.0);
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = (g + vorSite(ip + g) - fp) * sc;
    float d = vorMetric(r);
    if (d < f1) { f1 = d; mr = r; mg = g; }
  }
  id = ip + mg;

  const mat2 cheb = mat2(0.5, 0.5, 0.5, -0.5);          // L-inf(r) == L1(cheb * r)
  float bdMin = 1e9;
  bd = 1e9; f2 = 1e9; r2 = mr; nid = id;
  vec2 nAcc = vec2(0.0);
  for (int y = -2; y <= 2; y++)
  for (int x = -2; x <= 2; x++) {
    vec2 g = mg + vec2(float(x), float(y));
    vec2 r = (g + vorSite(ip + g) - fp) * sc;
    vec2 dr = r - mr;
    if (dot(dr, dr) < 1e-9) continue;
    float m = vorMetric(r);
    if (m < f2) { f2 = m; r2 = r; }
    float d; vec2 n;
    if (u_metric == METRIC_EUCLID) {
      n = normalize(dr);
      d = dot(0.5 * (mr + r), n);                    // exact distance to the bisector
    } else if (u_metric == METRIC_MANHATTAN) {
      vec3 b = vorL1Border(mr, r);
      d = b.x; n = b.yz;
    } else {                                           // Chebyshev: solve in the rotated frame, scale back
      vec3 b = vorL1Border(cheb * mr, cheb * r);
      d = 1.4142136 * b.x; n = normalize(cheb * b.yz);
    }
    if (d < bdMin) { bdMin = d; nid = ip + g; }
    nAcc += n * exp(-max(d, 0.0) * 25.0);            // soft-blended normal: no hard creases in the bevel
    if (k > 1e-4) {
      float h = clamp(0.5 + 0.5 * (d - bd) / k, 0.0, 1.0);
      bd = mix(d, bd, h) - k * h * (1.0 - h);
    } else {
      bd = min(bd, d);
    }
  }
  bn = nAcc / max(length(nAcc), 1e-6);
}

// Cheap 1-pass Voronoi for hairline cracks: distance to the bisector of the two nearest sites.
float vorHairline(vec2 q) {
  vec2 ip = floor(q), fp = q - ip;
  float d1 = 1e9, d2 = 1e9; vec2 r1 = vec2(0.0), r2 = vec2(1.0);
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + pg_hash22(ip + g) - fp;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; r2 = r1; d1 = d; r1 = r; } else if (d < d2) { d2 = d; r2 = r; }
  }
  return dot(0.5 * (r1 + r2), normalize(r2 - r1 + 1e-6));
}

vec3 vorCellColor(vec2 id, float t) {
  vec3 h = pg_hash32(id + vec2(0.37, 0.71));
  vec3 c;
  if (u_colorSrc == COLORSRC_PALETTE) c = u_palette[pg_wrapi(int(floor(h.x * float(u_palette_count))), u_palette_count)];
  else if (u_colorSrc == COLORSRC_RANDOM) c = pg_grad(u_gradient, h.x);
  else c = pg_grad(u_gradient, t);
  return c * (1.0 + (h.y - 0.5) * u_variation);
}

// Average cell colour, used to fade out sub-pixel cells instead of aliasing.
vec3 vorAvgColor() {
  vec3 s = vec3(0.0);
  if (u_colorSrc == COLORSRC_PALETTE) {
    for (int i = 0; i < 16; i++) { if (i >= u_palette_count) break; s += u_palette[i]; }
    return s / float(max(u_palette_count, 1));
  }
  for (int i = 0; i < 8; i++) s += pg_grad(u_gradient, (float(i) + 0.5) / 8.0);
  return s / 8.0;
}

vec4 pattern(vec2 p) {
  float S = u_size;
  bool hex = u_mode == MODE_HEX;
  bool giraffe = u_mode == MODE_GIRAFFE, leopard = u_mode == MODE_LEOPARD;
  vec2 sc = hex ? vec2(1.0, 0.8660254) : vec2(1.0);
  vec2 L = normalize(vec2(-0.6, 0.8));                // light from the top-left

  vec2 q = p / S;
  float wob = u_wobble + (giraffe ? 0.25 : leopard ? 0.3 : 0.0);
  if (wob > 0.0) {
    q += wob * 0.2 * vec2(pg_fbm(q * 1.1 + 3.1, 3), pg_fbm(q * 1.1 - 7.7, 3));
    if (giraffe) q += wob * 0.05 * vec2(pg_noise(q * 5.0 + 1.3), pg_noise(q * 5.0 - 4.1));
  }
  q /= sc;

  float k = u_mode == MODE_CRACKLE ? 0.0 : u_rounding * 0.4 + (giraffe ? 0.12 : leopard ? 0.18 : 0.0);
  vec2 id, mr, r2, bn, nid; float f1, f2, bd;
  vorCells(q, sc, k, id, mr, r2, f1, f2, bd, bn, nid);

  vec3 h = pg_hash32(id + vec2(0.37, 0.71));
  float hw = 0.5 * u_edge;                             // half edge width, cell units
  float tDist = clamp(f1 / max(f1 + max(bd, 0.0), 1e-5), 0.0, 1.0);   // 0 at the site → 1 at the border
  vec3 cell = vorCellColor(id, tDist);
  // AA between neighbouring cells (matters when there is no edge line)
  vec3 ncol = vorCellColor(nid, 1.0);
  if (u_colorSrc != COLORSRC_DISTANCE) cell = mix(ncol, cell, pg_fill(-bd * S));

  // Shared surface terms
  float tex = u_texture > 0.0 ? pg_fbm(q * 2.6 + h.xy * 61.0, 3) : 0.0;
  float prof = 1.0 - smoothstep(0.0, 0.28, bd - hw);  // 1 at the border → 0 inside
  float shade = 1.0 + 0.55 * u_bevel * dot(bn, L) * prof - (u_mode == MODE_CRACKED ? 0.0 : 0.3 * abs(u_bevel) * tDist * tDist);
  float e = u_edge > 0.0 ? pg_fill((bd - hw) * S) : 0.0;   // edge coverage

  vec3 col;
  vec3 avg = vorAvgColor();
  float edgeFrac = clamp(3.6 * hw, 0.0, 1.0);
  vec3 avgCol = mix(avg, u_edgeColor, edgeFrac);

  if (u_mode == MODE_GLASS) {
    float glow = mix(0.58, 1.18, smoothstep(0.0, 0.5, bd - hw));
    float ripple = 0.5 + 0.5 * sin((q.x * 0.7 + q.y) * 9.0 + tex * 7.0 + h.z * 20.0);
    vec3 glass = cell * glow * shade * (1.0 + u_texture * (0.32 * tex + 0.07 * ripple));
    glass *= mix(0.55, 1.0, smoothstep(0.0, 0.07, bd - hw));       // shadow along the lead
    float u = clamp(bd / max(hw, 1e-4), 0.0, 1.0);                 // 0 at came centre → 1 at its edge
    float came = 1.0 - u * u;
    vec3 lead = u_edgeColor * (0.55 + 0.75 * came) + vec3(0.1) * came * (0.6 + 0.4 * dot(bn, -L));
    col = mix(glass, lead, e);
  } else if (u_mode == MODE_CRACKED) {
    vec3 plate = cell * shade * (1.0 + u_texture * (0.22 * tex + 0.12 * pg_noise(q * 23.0)));
    // finer secondary cracks, only in places
    float fine = vorHairline(q * 2.3 + 5.0) * S / 2.3;
    float fw = (0.2 * hw + 0.006) * S * clamp((pg_noise(q * 0.8 + 21.0) - 0.1) * 3.0, 0.0, 1.0);   // tapering hairlines
    plate = mix(plate, u_edgeColor, 0.75 * pg_fill(fine - fw) * step(1e-6, fw));
    float hwc = hw * (0.55 + 0.9 * (0.5 + 0.5 * pg_noise(q * 2.7 + 11.0)));
    plate *= 1.0 - 0.35 * exp(-max(bd - hwc, 0.0) / 0.035);         // inner shadow at the crack lip
    col = mix(plate, u_edgeColor, u_edge > 0.0 ? pg_fill((bd - hwc) * S) : 0.0);
  } else if (u_mode == MODE_CRACKLE) {
    // F2 - F1 drives the glossy height; the exact border distance gives crisp, even crack lines.
    // (L1 / L-inf F2 - F1 has flat plateaus where sites tie, so those metrics use the border distance.)
    float v = f2 - f1;
    vec2 gv = mr / max(length(mr), 1e-6) - r2 / max(length(r2), 1e-6);   // gradient of (F2 - F1)
    if (u_metric != METRIC_EUCLID) { v = 2.0 * bd; gv = -2.0 * bn; }
    float dl = bd;                                               // rounding is off in this mode
    float fall = exp(-v / 0.22);
    vec3 N = normalize(vec3(-gv * fall / 0.22 * 0.35 * u_bevel, 1.0));
    vec3 L3 = normalize(vec3(L, 0.9));
    float diff = 0.8 + 0.3 * dot(N, L3) - 0.25 * abs(u_bevel) * fall;
    float spec = pow(max(dot(reflect(-L3, N), vec3(0.0, 0.0, 1.0)), 0.0), 36.0) * abs(u_bevel);
    vec3 base = u_colorSrc == COLORSRC_DISTANCE ? pg_grad(u_gradient, 1.0 - clamp(v / 0.8, 0.0, 1.0)) : cell;
    base *= 1.0 + u_texture * 0.2 * tex;
    col = base * diff + spec * 0.55;
    // fine crazing between the main cracks, tapering in and out
    float fine = vorHairline(q * 2.6 + 9.0) * S / 2.6;
    float fw = (0.2 * hw + 0.006) * S * clamp(pg_noise(q * 0.7 + 3.0) * 2.5 + 0.4, 0.0, 1.0);
    col = mix(col, u_edgeColor, 0.55 * pg_fill(fine - fw) * step(1e-6, fw));
    col = mix(col, u_edgeColor, 0.25 * exp(-dl / 0.05) + 0.75 * (u_edge > 0.0 ? pg_fill((dl - hw) * S) : 0.0));
    avgCol = mix(avg, u_edgeColor, 0.2);
  } else if (giraffe) {
    vec3 spot = cell * shade * (1.0 + u_texture * 0.25 * tex);
    spot *= 0.88 + 0.12 * smoothstep(0.0, 0.35, bd - hw);
    col = mix(spot, u_ground, e);
    avgCol = mix(avg, u_ground, edgeFrac);
  } else if (leopard) {
    vec3 ground = u_ground * (1.0 + u_texture * 0.12 * pg_fbm(q * 3.0, 2));
    float ringMid = hw + 0.5 * u_ring;
    float ringCov = pg_fill((abs(bd - ringMid) - 0.5 * u_ring) * S);
    float brk = pg_noise(q * 2.4 + h.xy * 40.0) + 0.5 * pg_noise(q * 6.0 + 7.0);
    ringCov *= pg_aastep(-0.22, brk);
    // The tan centre tucks under the ring and pulls back where the ring is broken, so gaps show ground.
    float inner = hw + u_ring * mix(1.3, 0.8, smoothstep(-0.45, -0.1, brk));
    vec3 centre = cell * (1.0 + u_texture * 0.15 * tex);
    col = mix(ground, centre, pg_fill((inner - bd) * S));
    col = mix(col, u_edgeColor, ringCov);
    avgCol = mix(mix(u_ground, avg, 0.4), u_edgeColor, 0.3);
  } else {                                              // flat cells, hex lattice
    vec3 c = cell * shade * (1.0 + u_texture * 0.22 * tex);
    col = mix(c, u_edgeColor, e);
  }

  // Cells smaller than ~2px: fade to the average colour instead of sparkling noise.
  if (u_tf_aa > 0.5) col = mix(col, avgCol, smoothstep(0.25, 0.7, pg_px / S));
  return vec4(col, 1.0);
}
`,
  });
})();
