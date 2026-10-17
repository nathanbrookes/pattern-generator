/* Truchet Tiles — randomly turned tiles that link up into mazes, paths, quilts and knots.
 * Styles: Smith quarter arcs (with an exact two-colouring of the regions they enclose), 10 PRINT diagonals,
 * half-square triangles, Carlson-style multi-scale arcs (three nested sizes that still join seamlessly),
 * over/under woven ribbons and dotted paths. Tiles flip one by one when Animate is on. */
(function () {
  const is = (...styles) => (v) => styles.includes(v.style);
  const hasLines = (v) => v.style !== 'triangles' && v.style !== 'multiscale' && v.look !== 'regions';
  const hasRegions = (v) => is('arcs', 'diagonal', 'weave', 'dots')(v) && v.look !== 'lines';
  const usesGrad = (v) => v.colorMode === 'flow' || v.colorMode === 'sweep';

  PG.registerPattern({
    id: 'truchet',
    name: 'Truchet Tiles',
    category: 'Geometric',
    description: 'Randomly turned tiles that join into flowing mazes, 10 PRINT labyrinths, quilts and woven knots.',
    params: [
      { type: 'heading', label: 'Tiles' },
      {
        id: 'style',
        label: 'Style',
        type: 'select',
        options: [
          ['arcs', 'Quarter arcs'],
          ['diagonal', '10 PRINT diagonals'],
          ['triangles', 'Triangles'],
          ['multiscale', 'Multi-scale'],
          ['weave', 'Woven'],
          ['dots', 'Dotted paths'],
        ],
        default: 'arcs',
      },
      { id: 'size', label: 'Tile size', min: 0.02, max: 1, default: 0.15, step: 0.001, scale: 'log', random: [0.07, 0.28] },
      { id: 'bias', label: 'Orientation bias', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.3, 0.7], help: 'Chance of the first tile orientation. 0.5 = fully random; near 0 or 1 gives long regular runs' },
      { id: 'levels', label: 'Scales', type: 'int', min: 2, max: 3, default: 3, showIf: is('multiscale') },
      { id: 'split', label: 'Subdivision', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.3, 0.65], showIf: is('multiscale'), help: 'Chance that a tile splits into four smaller ones' },
      { id: 'cross', label: 'Crossings', min: 0, max: 1, default: 0.45, step: 0.01, random: [0.25, 0.7], showIf: is('weave'), help: 'Share of tiles where two ribbons cross over/under' },

      { type: 'heading', label: 'Lines' },
      {
        id: 'look',
        label: 'Look',
        type: 'select',
        options: [['lines', 'Lines'], ['regions', 'Filled regions'], ['both', 'Regions + lines']],
        default: 'both',
        showIf: is('arcs', 'diagonal', 'weave', 'dots'),
      },
      { id: 'width', label: 'Line width', min: 0.02, max: 0.4, default: 0.16, step: 0.005, random: [0.07, 0.26], showIf: hasLines },
      { id: 'lanes', label: 'Lines per path', type: 'int', min: 1, max: 6, default: 1, random: [1, 3], showIf: (v) => hasLines(v) && v.style !== 'dots' },
      { id: 'dots', label: 'Dots per tile', type: 'int', min: 1, max: 6, default: 3, random: [2, 4], showIf: (v) => v.style === 'dots' && v.look !== 'regions' },
      { id: 'caps', label: 'Rounded joints', type: 'bool', default: true, random: 0.6, showIf: (v) => v.style === 'diagonal' && v.lanes === 1 && v.look !== 'regions' },
      { id: 'shade', label: 'Tube shading', min: 0, max: 1, default: 0.3, step: 0.01, random: [0, 0.7], showIf: (v) => hasLines(v) },
      { id: 'glow', label: 'Glow', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.35], showIf: (v) => hasLines(v) },

      { type: 'heading', label: 'Color' },
      {
        id: 'colorMode',
        label: 'Line color',
        type: 'select',
        options: [['solid', 'Solid'], ['flow', 'Gradient along path'], ['sweep', 'Gradient across plane'], ['palette', 'Palette per tile']],
        default: 'solid',
        random: ['solid', 'solid', 'flow', 'sweep', 'palette'],
      },
      { id: 'lineColor', label: 'Line', type: 'color', default: '#f6efe2', random: 'light', showIf: (v) => v.colorMode === 'solid' },
      { id: 'gradient', label: 'Gradient', type: 'gradient', default: 'Holo Film', showIf: usesGrad },
      { id: 'gradScale', label: 'Gradient scale', min: 0.1, max: 10, default: 1.6, step: 0.01, scale: 'log', random: [0.6, 4], showIf: usesGrad },
      { id: 'palette', label: 'Palette', type: 'palette', default: 'Pastel', showIf: (v) => v.colorMode === 'palette' },
      { id: 'bgColor', label: 'Background', type: 'color', default: '#c4572e', random: 'mid' },
      { id: 'altColor', label: 'Alternate fill', type: 'color', default: '#2f4858', random: 'dark', showIf: hasRegions },

      { type: 'heading', label: 'Animation' },
      { id: 'spin', label: 'Tile flips', min: 0, max: 2, default: 0.5, step: 0.01, random: [0.2, 1], showIf: (v) => v.style !== 'multiscale', help: 'How often tiles flip over while Animate is on' },
    ],
    presets: [
      { name: 'Flowing Maze', thumb: true, values: {} },
      {
        name: '10 PRINT',
        values: { style: 'diagonal', look: 'lines', size: 0.08, width: 0.26, caps: false, shade: 0, lineColor: '#a5a5ff', bgColor: '#3e31a2' },
        post: { pixelate: true, pxSize: 3 },
      },
      {
        name: 'Woven',
        values: { style: 'weave', look: 'lines', size: 0.17, width: 0.3, lanes: 1, cross: 0.55, shade: 0.75, lineColor: '#e9d8b4', bgColor: '#2a1e17' },
      },
      {
        name: 'Multiscale',
        values: { style: 'multiscale', size: 0.11, levels: 3, split: 0.5, lineColor: '#f2efe6', bgColor: '#1b1b1f' },
      },
      {
        name: 'Triangles',
        values: { style: 'triangles', size: 0.16, bias: 0.5, colorMode: 'palette', palette: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#f1ead8'], bgColor: '#f1ead8' },
      },
      {
        name: 'Neon Paths',
        values: { style: 'arcs', look: 'lines', size: 0.16, width: 0.2, lanes: 2, shade: 0.2, glow: 0.65, colorMode: 'flow', gradient: 'Neon', gradScale: 2.2, bgColor: '#07060f' },
      },
      {
        name: 'Beads',
        values: { style: 'dots', look: 'both', size: 0.13, width: 0.2, dots: 3, shade: 0.6, colorMode: 'sweep', gradient: 'Sunset', gradScale: 2.5, bgColor: '#f3ebdd', altColor: '#e6d9c2' },
      },
      {
        name: 'Retro Ribbons',
        values: { style: 'arcs', look: 'both', size: 0.26, width: 0.36, lanes: 4, shade: 0, lineColor: '#f6efe2', bgColor: '#e3a83a', altColor: '#4a1f3d' },
      },
    ],
    glsl: /* glsl */ `
float tr_tri(float x) { return 1.0 - abs(fract(x * 0.5) * 2.0 - 1.0); }   // 0→1→0 triangle wave, period 2

// Tile frame for tile-units point q: id, local f in [0,1)², orientation o (0/1), hashes h.
// While animating, each tile occasionally turns a quarter (k = parity of the quarter turns, for region colours).
void tr_tile(vec2 q, out vec2 id, out vec2 f, out float o, out float k, out vec3 h) {
  id = floor(q);
  f = q - id;
  h = pg_hash32(id);
  o = h.x < u_bias ? 0.0 : 1.0;
  k = 0.0;
  if (u_time > 0.0 && u_spin > 0.0) {
    const float W = 0.12;                              // share of the cycle spent turning
    float ph = u_time * u_spin * 0.3 * (0.6 + 0.8 * h.z) + W + h.y * (1.0 - W);
    float turns = floor(ph) + smoothstep(0.0, W, fract(ph)) - 1.0;   // 0 at time 0
    f = pg_rot(turns * PG_PI * 0.5) * (f - 0.5) + 0.5;
    k = mod(floor(turns + 0.5), 2.0);
  }
}

// Line colour. t = position along the path (0..1, continuous across tiles) or -1 when there is no path.
vec3 tr_ink(vec2 p, float t, float h) {
  if (u_colorMode == COLORMODE_SOLID) return u_lineColor;
  if (u_colorMode == COLORMODE_PALETTE) return u_palette[pg_wrapi(int(floor(h * float(u_palette_count))), u_palette_count)];
  float sweep = dot(p, vec2(0.8, 0.6)) / u_gradScale;
  bool flow = u_colorMode == COLORMODE_FLOW && t >= 0.0;
  vec3 c = pg_grad(u_gradient, tr_tri((flow ? t + 0.35 * sweep : sweep) + u_time * 0.25));
  // where the tiles have shrunk below a pixel (or the colour cycles faster than the pixels), settle on the mean
  float fade = max(smoothstep(0.15, 0.5, pg_px / u_gradScale), smoothstep(0.2, 0.6, pg_px / u_size));
  if (fade > 0.0) {
    vec3 mean = (pg_grad(u_gradient, 0.1) + pg_grad(u_gradient, 0.3) + pg_grad(u_gradient, 0.5) + pg_grad(u_gradient, 0.7) + pg_grad(u_gradient, 0.9)) * 0.2;
    c = mix(c, mean, fade);
  }
  return c;
}

vec3 tr_region(float par) { return mix(u_bgColor, u_altColor, par); }

// One line of half-width hw at distance a (tile units) → (coverage, tube shading, glow).
vec3 tr_line(float a, float hw) {
  float d = a - hw;
  float r = min(a / max(hw, 1e-4), 1.0);
  float shade = mix(1.0, 0.3 + 0.7 * sqrt(1.0 - r * r), u_shade);
  float glow = u_glow * exp(-max(d, 0.0) / (0.03 + 0.12 * u_glow));
  return vec3(pg_fill(d * u_size), shade, glow);
}

// A path of 'Line width', split into n parallel lines. s = signed offset from the path centre (tile units).
vec3 tr_strand(float s, float n) {
  float B = 0.5 * u_width;
  float pitch = 2.0 * B / n;
  float k = clamp(floor((s + B) / pitch), 0.0, n - 1.0);
  float c = -B + (k + 0.5) * pitch;
  return tr_line(abs(s - c), 0.5 * pitch * (n > 1.5 ? 0.62 : 1.0));
}

vec3 tr_paint(vec3 col, vec3 ink, vec3 st) {
  col = mix(col, ink, clamp(st.z, 0.0, 1.0) * 0.85 * (1.0 - st.x));
  vec3 core = mix(ink * st.y, vec3(1.0), 0.35 * u_glow * st.y * st.y);
  return mix(col, core, st.x);
}

// Tiles smaller than ~2 px: fade to the average colour instead of aliasing into noise. scale = smallest tile / u_size.
vec3 tr_far(vec3 col, vec3 avg, float scale) { return mix(col, avg, smoothstep(0.3, 0.75, pg_px / (u_size * scale))); }

// Smith tile: arcs of radius ½ around two opposite corners (local parity o).
// Returns (s = signed offset from the nearer arc, >0 between the arcs; t = 0 at horizontal edges .. 1 at vertical edges; 0).
vec3 tr_smith(vec2 f, float o) {
  vec2 g = o > 0.5 ? vec2(1.0 - f.x, f.y) : f;
  vec2 v0 = g, v1 = 1.0 - g;
  float r0 = length(v0), r1 = length(v1);
  bool first = abs(r0 - 0.5) < abs(r1 - 0.5);
  vec2 v = first ? v0 : v1;
  return vec3((first ? r0 : r1) - 0.5, atan(v.y, v.x) / (0.5 * PG_PI), 0.0);
}

// ---- quarter arcs + dotted paths. Region colour = parity of the lattice corner the region surrounds,
// which makes the 2-colouring consistent across every tile boundary.
vec3 tr_arcs(vec2 p, bool dots) {
  vec2 id, f; float o, k; vec3 h;
  tr_tile(p / u_size, id, f, o, k, h);
  vec3 sm = tr_smith(f, o);
  float par = mod(id.x + id.y + o + k, 2.0);
  vec3 col = u_bgColor;
  if (u_look != LOOK_LINES) col = tr_region(mix(par, 1.0 - par, pg_fill(-sm.x * u_size)));
  vec3 ink = tr_ink(p, sm.y, h.z);
  float N = u_dots;
  float R = min(0.6 * u_width, 0.45 * sin(PG_PI / (4.0 * N)));
  float inkArea = u_look == LOOK_REGIONS ? 0.0
    : dots ? 2.0 * N * PG_PI * R * R : 1.57 * u_width * (u_lanes > 1.5 ? 0.62 : 1.0);
  vec3 avg = mix(u_look == LOOK_LINES ? u_bgColor : mix(u_bgColor, u_altColor, 0.5), ink, min(inkArea, 1.0));
  if (u_look == LOOK_REGIONS) return tr_far(col, avg, 1.0);
  if (!dots) return tr_far(tr_paint(col, ink, tr_strand(sm.x, u_lanes)), avg, 1.0);
  float th = sm.y * 0.5 * PG_PI, r = sm.x + 0.5;
  float a = (min(floor(sm.y * N), N - 1.0) + 0.5) / N * 0.5 * PG_PI;
  float d = length(r * vec2(cos(th), sin(th)) - 0.5 * vec2(cos(a), sin(a)));
  return tr_far(tr_paint(col, ink, tr_line(d, R)), avg, 1.0);
}

// ---- 10 PRINT: one diagonal per tile.
float tr_orient(vec2 t) { return pg_hash32(t).x < u_bias ? 0.0 : 1.0; }

vec3 tr_diagonal(vec2 p) {
  vec2 q = p / u_size;
  vec2 id, f; float o, k; vec3 h;
  tr_tile(q, id, f, o, k, h);
  vec2 g = o > 0.5 ? vec2(1.0 - f.x, f.y) : f;
  float s = (g.y - g.x) * 0.70710678;
  vec3 col = u_bgColor;
  if (u_look != LOOK_LINES) col = mix(u_bgColor, u_altColor, pg_fill(-s * u_size));   // folded-paper shading
  vec3 ink = tr_ink(p, abs(g.x + g.y - 1.0), h.z);
  vec3 avg = mix(u_look == LOOK_LINES ? u_bgColor : mix(u_bgColor, u_altColor, 0.5), ink,
                 u_look == LOOK_REGIONS ? 0.0 : min(1.41 * u_width * (u_lanes > 1.5 ? 0.62 : 1.0), 1.0));
  if (u_look == LOOK_REGIONS) return tr_far(col, avg, 1.0);
  vec2 C = floor(q + 0.5);                 // nearest lattice corner
  vec3 st;
  if (u_lanes < 1.5 && u_caps > 0.5) {
    float a = pg_sdSegment(g, vec2(0.0), vec2(1.0));
    // round joints: add the cap of any diagonal (ours or a neighbour's) that ends on the nearest corner
    bool touch = false;
    for (int j = -1; j <= 0; j++)
    for (int i = -1; i <= 0; i++)
      if (abs(mod(-float(i) - float(j), 2.0) - tr_orient(C + vec2(float(i), float(j)))) < 0.5) touch = true;
    if (touch) a = min(a, length(q - C));
    st = tr_line(a, 0.5 * u_width);
  } else {
    st = tr_strand(s, u_lanes);
    // a wall running straight through the corner also crosses the two side tiles near it: draw it there too
    vec2 l = q - C, rel = floor(q) - C;
    bool side = abs(rel.x - rel.y) > 0.5;
    if (side && tr_orient(C) < 0.5 && tr_orient(C - 1.0) < 0.5) {
      vec3 s2 = tr_strand((l.y - l.x) * 0.70710678, u_lanes);
      if (s2.x > st.x) st = s2;
    }
    if (!side && tr_orient(C - vec2(1.0, 0.0)) > 0.5 && tr_orient(C - vec2(0.0, 1.0)) > 0.5) {
      vec3 s2 = tr_strand((l.x + l.y) * 0.70710678, u_lanes);
      if (s2.x > st.x) st = s2;
    }
  }
  return tr_far(tr_paint(col, ink, st), avg, 1.0);
}

// ---- half-square triangles (four orientations).
vec3 tr_triangles(vec2 p) {
  vec2 id, f; float o, k; vec3 h;
  tr_tile(p / u_size, id, f, o, k, h);
  vec2 g = o > 0.5 ? vec2(1.0 - f.x, f.y) : f;
  vec2 h2 = pg_hash22(id + 0.5);
  float side = h2.x < 0.5 ? 1.0 : -1.0;
  float cov = pg_fill(-side * (g.y - g.x) * 0.70710678 * u_size);
  float far = smoothstep(0.25, 0.6, pg_px / u_size);   // tiles below ~2px: fade to the average colour, not noise
  if (u_colorMode == COLORMODE_PALETTE) {
    int n = u_palette_count;
    int i1 = int(floor(h.z * float(n)));
    int i2 = i1 + 1 + int(floor(h2.y * float(max(n - 1, 1))));
    vec3 avg = vec3(0.0);
    for (int i = 0; i < 16; i++) { if (i >= n) break; avg += u_palette[i]; }
    return mix(mix(u_palette[pg_wrapi(i2, n)], u_palette[pg_wrapi(i1, n)], cov), avg / float(max(n, 1)), far);
  }
  vec3 ink = tr_ink(p, -1.0, h.z);
  return mix(mix(u_bgColor, ink, cov), mix(u_bgColor, ink, 0.5), far);
}

// ---- woven ribbons: Smith tiles mixed with crossing tiles whose over/under alternates like a checkerboard.
vec3 tr_ribbon(vec3 col, vec3 ink, float s) {
  col = mix(col, ink * 0.22, pg_fill((abs(s) - 0.5 * u_width - 0.03) * u_size));   // dark rim
  return tr_paint(col, ink, tr_strand(s, u_lanes));
}

vec3 tr_weave(vec2 p) {
  vec2 id, f; float o, k; vec3 h;
  tr_tile(p / u_size, id, f, o, k, h);
  float par = mod(id.x + id.y + k, 2.0);
  bool cross = pg_hash22(id + 0.5).x < u_cross;
  bool regions = u_look != LOOK_LINES;
  if (!cross) {
    vec3 sm = tr_smith(f, o);
    float p0 = mod(par + o, 2.0);
    vec3 col = regions ? tr_region(mix(p0, 1.0 - p0, pg_fill(-sm.x * u_size))) : u_bgColor;
    if (u_look == LOOK_REGIONS) return col;
    return tr_ribbon(col, tr_ink(p, sm.y, h.z), sm.x);
  }
  vec2 c = f - 0.5;
  float qx = pg_fill(-c.x * u_size), qy = pg_fill(-c.y * u_size);
  float qp = qx + qy - 2.0 * qx * qy;                       // smooth XOR of the quadrant
  vec3 base = regions ? tr_region(abs(par - qp)) : u_bgColor;
  if (u_look == LOOK_REGIONS) return base;
  bool vOver = mod(id.x + id.y, 2.0) < 0.5;
  float sU = vOver ? c.y : c.x, sO = vOver ? c.x : c.y;     // horizontal strands run t=1, vertical t=0
  vec3 col = tr_ribbon(base, tr_ink(p, vOver ? 1.0 : 0.0, h.z), sU);
  // the under ribbon gets a soft shadow and a thin gap next to the over ribbon, so it reads as diving beneath
  float under = pg_fill((abs(sU) - 0.5 * u_width - 0.03) * u_size);
  float dO = abs(sO) - 0.5 * u_width - 0.03;
  col *= 1.0 - under * 0.65 * exp(-max(dO, 0.0) / 0.08) * smoothstep(0.5, 0.32, abs(sO));
  col = mix(col, base * 0.6, under * pg_fill((dO - 0.03) * u_size));
  return tr_ribbon(col, tr_ink(p, vOver ? 0.0 : 1.0, h.z), sO);
}

// ---- multi-scale (after Carlson): arcs 1/3 tile wide, colours invert at every level and smaller tiles
// carry corner "wings" (discs of radius 1/3) that overlap their bigger neighbours, so all scales join up.
// The quadtree is kept 2:1 balanced (neighbours differ by at most one level), which the construction needs.
float tr_split(vec2 id, int l) { return pg_hash12(id + vec2(0.37, 0.71 + 977.0 * float(l))); }
bool tr_divides(vec2 t, int l, int levels) {
  if (l >= levels - 1 || tr_split(t, l) >= u_split) return false;
  if (l == 1) {
    if (tr_split(floor((t + vec2(1.0, 0.0)) * 0.5), 0) >= u_split) return false;
    if (tr_split(floor((t - vec2(1.0, 0.0)) * 0.5), 0) >= u_split) return false;
    if (tr_split(floor((t + vec2(0.0, 1.0)) * 0.5), 0) >= u_split) return false;
    if (tr_split(floor((t - vec2(0.0, 1.0)) * 0.5), 0) >= u_split) return false;
  }
  return true;
}
bool tr_isLeaf(vec2 t, int l, int levels) {
  for (int m = 0; m < 2; m++) {
    if (m >= l) break;
    if (!tr_divides(floor(t / exp2(float(l - m))), m, levels)) return false;
  }
  return !tr_divides(t, l, levels);
}

// Palette mode for multi-scale: a per-tile colour would cut the seamless shapes into visible squares, so
// colour soft zones instead (random palette entries on a coarse lattice, blended across narrow borders).
// corner = integer lattice point. The hash is bit-exact, so only integer offsets here: the compiler may
// reassociate (i + 1.0) + 0.17 into i + 1.17, and the two rounded sums would hash differently (= seams).
vec3 tr_zoneCol(vec2 corner) {
  int n = u_palette_count;
  return u_palette[pg_wrapi(int(floor(pg_hash12(corner + vec2(4099.0, -7919.0)) * float(n))), n)];
}
vec3 tr_palZones(vec2 p) {
  vec2 q = p / (u_size * 5.0);
  vec2 i = floor(q), f = smoothstep(0.3, 0.7, q - i);
  return mix(mix(tr_zoneCol(i), tr_zoneCol(i + vec2(1.0, 0.0)), f.x),
             mix(tr_zoneCol(i + vec2(0.0, 1.0)), tr_zoneCol(i + 1.0), f.x), f.y);
}

vec3 tr_multiscale(vec2 p) {
  int levels = int(u_levels + 0.5);
  float s0 = 2.0 * u_size;
  int leaf = levels - 1;
  for (int l = 0; l < 2; l++) {
    if (l >= levels - 1) break;
    if (!tr_divides(floor(p / (s0 / exp2(float(l)))), l, levels)) { leaf = l; break; }
  }
  float sl = s0 / exp2(float(leaf));
  vec2 id = floor(p / sl);
  vec2 f = p / sl - id;
  vec3 h = pg_hash32(id + vec2(0.0, 0.5 + 977.0 * float(leaf)));
  vec2 g = h.x < u_bias ? f : vec2(1.0 - f.x, f.y);
  float d = min(abs(length(g) - 0.5), abs(length(1.0 - g) - 0.5)) - 1.0 / 6.0;
  vec3 A = u_bgColor, Bc = u_colorMode == COLORMODE_PALETTE ? tr_palZones(p) : tr_ink(p, -1.0, h.z);
  bool odd = leaf == 1;
  vec3 col = mix(odd ? Bc : A, odd ? A : Bc, pg_fill(d * sl));
  for (int l = 1; l < 3; l++) {
    if (l >= levels) break;
    if (l <= leaf) continue;
    float s = s0 / exp2(float(l));
    vec2 C = floor(p / s + 0.5);
    float dist = length(p - C * s) - s / 3.0;
    if (dist > pg_px) continue;
    bool wing = false;
    for (int j = -1; j <= 0; j++)
    for (int i = -1; i <= 0; i++)
      if (tr_isLeaf(C + vec2(float(i), float(j)), l, levels)) wing = true;
    if (wing) col = mix(col, l == 1 ? Bc : A, pg_fill(dist));
  }
  return tr_far(col, mix(A, Bc, 0.5), exp2(2.0 - float(levels)));
}

vec4 pattern(vec2 p) {
  vec3 c;
  if (u_style == STYLE_DIAGONAL) c = tr_diagonal(p);
  else if (u_style == STYLE_TRIANGLES) c = tr_triangles(p);
  else if (u_style == STYLE_MULTISCALE) c = tr_multiscale(p);
  else if (u_style == STYLE_WEAVE) c = tr_weave(p);
  else c = tr_arcs(p, u_style == STYLE_DOTS);
  return vec4(c, 1.0);
}
`,
  });
})();
