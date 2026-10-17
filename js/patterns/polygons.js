/* Polygon Grids — regular and jittered polygon tilings: low-poly facets, triangle mosaics, hex cubes
 * (tumbling blocks), argyle, harlequin lozenges, flower of life, concentric circle grids and pinwheel quilts.
 * Every mode describes the region under the point the same way (id, centre, distance + outward normal of the
 * two nearest edges), so colouring, gaps, outlines, bevel lighting and edge anti-aliasing are shared. */
(function () {
  const is = (...modes) => (v) => modes.includes(v.mode);
  const usesPalette = (v) => v.colorSrc === 'palette' || v.colorSrc === 'ordered';
  const hasCross = (v) => is('argyle', 'diamonds')(v) && v.cross !== 'none';
  const bevelled = (v) => v.shading > 0 && v.mode !== 'lowpoly' && !(v.mode === 'hexagons' && v.cubes);

  PG.registerPattern({
    id: 'polygons',
    name: 'Polygon Grids',
    category: 'Geometric',
    description: 'Polygon tilings: low-poly facets, triangle mosaics, hex cubes, argyle, harlequin, flower of life, circle grids and pinwheels.',
    params: [
      { type: 'heading', label: 'Tiles' },
      {
        id: 'mode',
        label: 'Grid',
        type: 'select',
        options: [
          ['lowpoly', 'Low poly'],
          ['triangles', 'Triangles'],
          ['hexagons', 'Hexagons'],
          ['diamonds', 'Diamonds / harlequin'],
          ['argyle', 'Argyle'],
          ['pinwheel', 'Pinwheel'],
          ['flower', 'Flower of life'],
          ['circles', 'Circle grid'],
        ],
        default: 'lowpoly',
      },
      { id: 'size', label: 'Cell size', min: 0.02, max: 1.5, default: 0.16, step: 0.001, scale: 'log', random: [0.09, 0.32] },
      { id: 'jitter', label: 'Jitter', min: 0, max: 1, default: 0.8, step: 0.01, random: [0.45, 1], showIf: is('lowpoly'), help: 'How far the mesh vertices wander from the regular triangle grid' },
      { id: 'cubes', label: 'Cube faces', type: 'bool', default: true, random: 0.6, showIf: is('hexagons'), help: 'Split every hexagon into three rhombi (tumbling blocks)' },
      { id: 'stretch', label: 'Stretch', min: 0.5, max: 3, default: 1.5, step: 0.01, scale: 'log', random: [1, 2], showIf: is('argyle', 'diamonds'), help: 'Height of a diamond relative to its width' },
      { id: 'rings', label: 'Rings', type: 'int', min: 1, max: 8, default: 3, random: [1, 5], showIf: is('circles') },
      { id: 'stagger', label: 'Hex packing', type: 'bool', default: false, random: 0.4, showIf: is('circles'), help: 'Offset every other row (densest circle packing)' },
      {
        id: 'cross',
        label: 'Cross lines',
        type: 'select',
        options: [['none', 'None'], ['solid', 'Solid'], ['dashed', 'Dashed']],
        default: 'solid',
        showIf: is('argyle', 'diamonds'),
        help: 'Argyle: overcheck lines through the diamonds. Diamonds: lines through the diagonals',
      },
      { id: 'crossWidth', label: 'Cross width', min: 0.002, max: 0.15, default: 0.022, step: 0.001, scale: 'log', random: [0.01, 0.05], showIf: hasCross },
      { id: 'crossColor', label: 'Cross color', type: 'color', default: '#f3e7c9', random: 'light', showIf: hasCross },

      { type: 'heading', label: 'Edges' },
      { id: 'gap', label: 'Gap', min: 0, max: 0.4, default: 0, step: 0.001, random: [0, 0.1], help: 'Space between tiles (shows the background), relative to the cell size' },
      { id: 'outline', label: 'Outline width', min: 0, max: 0.25, default: 0, step: 0.001, random: [0, 0.06], help: 'Relative to the cell size' },
      { id: 'outlineColor', label: 'Outline color', type: 'color', default: '#15131a', random: 'dark', showIf: (v) => v.outline > 0 },
      { id: 'bgColor', label: 'Background', type: 'color', default: '#101016', random: 'dark', showIf: (v) => v.gap > 0 || v.mode === 'circles' },

      { type: 'heading', label: 'Color' },
      {
        id: 'colorSrc',
        label: 'Color source',
        type: 'select',
        options: [['palette', 'Palette · random'], ['ordered', 'Palette · ordered'], ['noise', 'Gradient · noise'], ['position', 'Gradient · position']],
        default: 'position',
        help: 'Ordered follows the grid: checks, 3-colour hexes, cube faces, ring order…',
      },
      { id: 'palette', label: 'Palette', type: 'palette', default: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'], showIf: usesPalette },
      { id: 'gradient', label: 'Gradient', type: 'gradient', default: 'Sunset', showIf: (v) => !usesPalette(v) },
      { id: 'colorScale', label: 'Color scale', min: 0.1, max: 6, default: 1.15, step: 0.01, scale: 'log', random: [0.5, 2.5], showIf: (v) => !usesPalette(v), help: 'Size of the colour features (noise) or span of the gradient (position)' },
      { id: 'gradAngle', label: 'Gradient angle', min: -180, max: 180, default: -90, step: 1, unit: '°', random: [-180, 180], showIf: (v) => v.colorSrc === 'position' },
      { id: 'variation', label: 'Variation', min: 0, max: 1, default: 0.35, step: 0.01, random: [0.1, 0.6], help: 'Random colour / brightness jitter per tile' },

      { type: 'heading', label: 'Light' },
      { id: 'shading', label: 'Shading', min: 0, max: 1, default: 0.55, step: 0.01, random: [0, 0.8], help: 'Facet lighting: bevels, pyramids, cube faces, low-poly relief' },
      { id: 'bevel', label: 'Bevel width', min: 0.05, max: 1, default: 1, step: 0.01, random: [0.25, 1], showIf: bevelled, help: '1 = full pyramid facets, smaller = bevelled edges with a flat top' },
      { id: 'lightAngle', label: 'Light angle', min: -180, max: 180, default: 120, step: 1, unit: '°', random: [-180, 180], showIf: (v) => v.shading > 0 },

      { type: 'heading', label: 'Animation' },
      { id: 'speed', label: 'Motion', min: 0, max: 3, default: 1, step: 0.01, random: false, help: 'With Animate on: colours drift, the light sways and low-poly vertices breathe. One cycle every 8 s ÷ Motion, so whole cycles loop seamlessly' },
    ],
    presets: [
      { name: 'Low Poly Sunset', thumb: true, values: {} },
      {
        name: 'Triangle Mosaic',
        values: {
          mode: 'triangles', size: 0.15, colorSrc: 'palette', palette: ['#0b3954', '#087e8b', '#bfd7ea', '#ff5a5f', '#c81d25', '#f2c14e'],
          variation: 0.2, outline: 0.035, outlineColor: '#f6f1e7', shading: 0.25, bevel: 1, lightAngle: 110,
        },
      },
      {
        name: 'Hex Cubes',
        values: {
          mode: 'hexagons', cubes: true, size: 0.17, colorSrc: 'noise', gradient: 'Ocean', colorScale: 0.9,
          variation: 0.25, shading: 0.9, lightAngle: 115, outline: 0.012, outlineColor: '#0b1418',
        },
      },
      {
        name: 'Argyle Sweater',
        values: {
          mode: 'argyle', size: 0.42, stretch: 1.45, colorSrc: 'ordered', palette: ['#1f2b45', '#a8323e', '#7a8b99'],
          cross: 'dashed', crossWidth: 0.02, crossColor: '#efe2c4', variation: 0, shading: 0,
        },
      },
      {
        name: 'Flower of Life',
        values: {
          mode: 'flower', size: 0.24, colorSrc: 'ordered', palette: ['#17121f', '#211a2c'], variation: 0,
          outline: 0.03, outlineColor: '#d9b45a', shading: 0,
        },
      },
      {
        name: 'Honeycomb Outline',
        values: {
          mode: 'hexagons', cubes: false, size: 0.13, colorSrc: 'noise', colorScale: 0.8,
          gradient: { stops: [[0, '#2a1300'], [0.55, '#7a3c00'], [1, '#c77800']], mode: 'smooth' },
          variation: 0.4, outline: 0.11, outlineColor: '#f6c445', shading: 0.6, bevel: 0.45, lightAngle: 125,
        },
      },
      {
        name: 'Harlequin',
        values: {
          mode: 'diamonds', size: 0.3, stretch: 1.7, cross: 'none', colorSrc: 'ordered', palette: ['#16141a', '#b0172f', '#e9dcc0'],
          variation: 0, outline: 0.018, outlineColor: '#d4af37', shading: 0.45, bevel: 1, lightAngle: 120,
        },
      },
      {
        name: 'Circle Grid',
        values: {
          mode: 'circles', size: 0.27, rings: 4, stagger: false, gap: 0.04, bgColor: '#f3ead7',
          colorSrc: 'palette', palette: ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#2a6f97'], variation: 0, shading: 0,
        },
      },
    ],
    glsl: /* glsl */ `
const float PL_H = 0.8660254;      // height of a unit equilateral triangle
const float PL_R2 = 0.70710678;

// The region (tile / facet / ring / petal) under a point. Distances are in cell units (pattern units / size).
struct PlReg {
  vec2 key;     // integer-valued id, hashed for random colours
  vec2 c;       // region centre (cell units), drives gradient colouring
  int k;        // structured index for "Palette · ordered" (any integer)
  bool bg;      // background region (between circles)
  float kt;     // offset along the gradient for gradient colour sources
  float rin;    // rough inradius (bevel width + sub-pixel fade)
  float d1; vec2 n1;   // nearest edge: inside distance + outward normal
  float d2; vec2 n2;   // second nearest edge (bevel crease AA)
  int lit;      // 0 = bevel from edges, 1 = flat face with 2D normal face.xy, 2 = 3D facet normal face
  vec3 face;
};

PlReg plNew() {
  PlReg R;
  R.key = vec2(0.0); R.c = vec2(0.0); R.k = 0; R.bg = false; R.kt = 0.0; R.rin = 0.3;
  R.d1 = 1e9; R.n1 = vec2(0.0, 1.0); R.d2 = 1e9; R.n2 = vec2(0.0, 1.0);
  R.lit = 0; R.face = vec3(0.0, 0.0, 1.0);
  return R;
}

void plEdge(inout PlReg R, float d, vec2 n) {
  if (d < R.d1) { R.d2 = R.d1; R.n2 = R.n1; R.d1 = d; R.n1 = n; }
  else if (d < R.d2) { R.d2 = d; R.n2 = n; }
}

// Ordered palette index for the "odd" cells of a two-colour layout: cycles through colours 1..n-1.
int plAlt(float i) { return 1 + pg_wrapi(int(i), max(u_palette_count - 1, 1)); }

// ---- equilateral triangles (side 1)
PlReg plTriangles(vec2 q) {
  PlReg R = plNew();
  vec2 sk = vec2(q.x - 0.5 * q.y / PL_H, q.y / PL_H);
  vec2 ij = floor(sk), f = sk - ij;
  bool up = f.x + f.y < 1.0;
  if (up) {
    plEdge(R, (1.0 - f.x - f.y) * PL_H, vec2(PL_H, 0.5));
    plEdge(R, f.x * PL_H, vec2(-PL_H, 0.5));
    plEdge(R, f.y * PL_H, vec2(0.0, -1.0));
  } else {
    plEdge(R, (f.x + f.y - 1.0) * PL_H, vec2(-PL_H, -0.5));
    plEdge(R, (1.0 - f.y) * PL_H, vec2(0.0, 1.0));
    plEdge(R, (1.0 - f.x) * PL_H, vec2(PL_H, -0.5));
  }
  vec2 cs = ij + (up ? 1.0 / 3.0 : 2.0 / 3.0);
  R.c = vec2(cs.x + 0.5 * cs.y, cs.y * PL_H);
  R.key = vec2(ij.x * 2.0 + (up ? 0.0 : 1.0), ij.y);
  R.k = int(2.0 * (ij.x + ij.y)) + (up ? 0 : 1);
  R.rin = 0.2887;
  return R;
}

// ---- pointy-top hexagons (centres 1 apart), optionally split into 3 cube faces
PlReg plHexagons(vec2 q) {
  PlReg R = plNew();
  vec4 h = pg_hexGrid(q);
  vec2 l = h.xy;
  for (int i = 0; i < 3; i++) {
    float a = float(i) * PG_PI / 3.0;
    vec2 n = vec2(cos(a), sin(a));
    float t = dot(l, n);
    plEdge(R, 0.5 - abs(t), t >= 0.0 ? n : -n);
  }
  vec2 id2 = floor(h.zw * 2.0 + 0.5);                 // integer hex id
  R.c = q - l;
  R.k = pg_wrapi(int(floor(h.z - 3.0 * h.w + 0.5)), 3);   // proper 3-colouring of the hex lattice
  R.key = vec2(id2.x * 3.0, id2.y);
  R.rin = 0.5;
  if (u_cubes > 0.5) {
    // rays from the centre to the vertices at 30°, 150°, 270° split the hex into top / left / right rhombi
    const vec2 v30 = vec2(0.5, 0.2886751), v150 = vec2(-0.5, 0.2886751), v270 = vec2(0.0, -0.5773503);
    float a = degrees(atan(l.y, l.x));
    int face; vec2 fn;
    if (a > 30.0 && a <= 150.0) {
      face = 0; fn = vec2(0.0, 1.0);
      plEdge(R, pg_sdSegment(l, vec2(0.0), v30), vec2(0.5, -PL_H));
      plEdge(R, pg_sdSegment(l, vec2(0.0), v150), vec2(-0.5, -PL_H));
    } else if (a > 150.0 || a <= -90.0) {
      face = 1; fn = vec2(-PL_H, -0.5);
      plEdge(R, pg_sdSegment(l, vec2(0.0), v150), vec2(0.5, PL_H));
      plEdge(R, pg_sdSegment(l, vec2(0.0), v270), vec2(1.0, 0.0));
    } else {
      face = 2; fn = vec2(PL_H, -0.5);
      plEdge(R, pg_sdSegment(l, vec2(0.0), v270), vec2(-1.0, 0.0));
      plEdge(R, pg_sdSegment(l, vec2(0.0), v30), vec2(-0.5, PL_H));
    }
    R.c += 0.2886751 * fn;
    R.key.x += float(face);
    R.k = face;
    R.lit = 1; R.face = vec3(fn, 0.0);
    R.rin = 0.25;
  }
  return R;
}

// ---- diamond lattice shared by argyle + harlequin: diamonds 1 wide, u_stretch tall
vec2 plDiamondUV(vec2 q) { return vec2(q.x + q.y / u_stretch, -q.x + q.y / u_stretch); }

PlReg plDiamonds(vec2 q) {
  PlReg R = plNew();
  float st = u_stretch;
  vec2 ab = plDiamondUV(q);
  vec2 AB = floor(ab + 0.5), f = ab - AB;
  float gl = sqrt(1.0 + 1.0 / (st * st));
  vec2 na = vec2(1.0, 1.0 / st) / gl, nb = vec2(-1.0, 1.0 / st) / gl;
  plEdge(R, (0.5 - abs(f.x)) / gl, f.x >= 0.0 ? na : -na);
  plEdge(R, (0.5 - abs(f.y)) / gl, f.y >= 0.0 ? nb : -nb);
  R.c = vec2(0.5 * (AB.x - AB.y), 0.5 * st * (AB.x + AB.y));
  R.key = AB;
  R.k = mod(AB.x + AB.y, 2.0) < 0.5 ? 0 : plAlt(AB.x);   // checks; the odd diamonds cycle the other colours
  R.rin = 0.5 / gl;
  return R;
}

// Overcheck / diagonal lines for argyle + diamonds (coverage 0..1).
float plCross(vec2 q) {
  float S = u_size, st = u_stretch;
  float hw = 0.5 * u_crossWidth * S;
  if (u_mode == MODE_ARGYLE) {
    // lines parallel to the diamond edges through every diamond centre
    vec2 ab = plDiamondUV(q);
    vec2 f = ab - floor(ab + 0.5);
    float gl = sqrt(1.0 + 1.0 / (st * st));
    float ca = pg_line(abs(f.x) / gl * S, hw), cb = pg_line(abs(f.y) / gl * S, hw);
    if (u_cross == CROSS_DASHED) {
      const float n = 4.0;                                  // stitches per diamond edge
      float len = 0.5 * sqrt(1.0 + st * st) * S / n;        // stitch period, pattern units
      ca *= pg_fill((abs(fract(ab.y * n + 0.5) - 0.5) - 0.3) * len);
      cb *= pg_fill((abs(fract(ab.x * n + 0.5) - 0.5) - 0.3) * len);
    }
    return max(ca, cb);
  }
  // harlequin: horizontal + vertical lines through the centres and vertices (splits each diamond in 4)
  float hy = 0.5 * st, hx = 0.5;
  float dy = abs(fract(q.y / hy + 0.5) - 0.5) * hy * S;
  float dx = abs(fract(q.x / hx + 0.5) - 0.5) * hx * S;
  float c = max(pg_line(dy, hw), pg_line(dx, hw));
  if (u_cross == CROSS_DASHED) {
    const float n = 6.0;
    c *= pg_fill((abs(fract((dy < dx ? q.x / hx : q.y / hy) * n * 0.5) - 0.5) - 0.3) * S * 0.5 / n);
  }
  return c;
}

// ---- low poly: jittered triangle lattice
vec2 plVert(vec2 ij, float ph) {
  vec3 h = pg_hash32(ij);
  float a = h.y * PG_TAU, r = sqrt(h.x) * 0.28 * u_jitter;
  vec2 o = r * vec2(cos(a), sin(a));
  float b = h.z * PG_TAU;
  o += 0.045 * u_jitter * vec2(sin(ph + b) - sin(b), cos(ph + a) - cos(a));   // breathing (periodic, 0 at t = 0)
  return vec2(ij.x + 0.5 * ij.y, ij.y * PL_H) + o;
}
float plHeight(vec2 ij) { return (pg_hash12(ij + vec2(0.0, 7919.0)) - 0.5) * 0.7; }

// Signed distance to edge a→b of a CCW triangle, positive inside.
float plEdgeD(vec2 q, vec2 a, vec2 b) { vec2 e = b - a; return dot(a - q, normalize(vec2(e.y, -e.x))); }
float plTriD(vec2 q, vec2 a, vec2 b, vec2 c) { return min(min(plEdgeD(q, a, b), plEdgeD(q, b, c)), plEdgeD(q, c, a)); }

PlReg plLowPoly(vec2 q, float ph) {
  PlReg R = plNew();
  vec2 i0 = floor(vec2(q.x - 0.5 * q.y / PL_H, q.y / PL_H));
  vec2 V[16];
  for (int y = 0; y < 4; y++)
    for (int x = 0; x < 4; x++) V[y * 4 + x] = plVert(i0 + vec2(float(x - 1), float(y - 1)), ph);

  float best = -1e9; int bi = 0; bool bup = true;
  for (int y = 0; y < 3; y++)
    for (int x = 0; x < 3; x++) {
      int i = y * 4 + x;
      float du = plTriD(q, V[i], V[i + 1], V[i + 4]);
      if (du > best) { best = du; bi = i; bup = true; }
      float dd = plTriD(q, V[i + 1], V[i + 5], V[i + 4]);
      if (dd > best) { best = dd; bi = i; bup = false; }
    }
  vec2 ij = i0 + vec2(float(bi % 4 - 1), float(bi / 4 - 1));
  vec2 A, B, C; vec2 ia, ib, ic;
  if (bup) { A = V[bi]; B = V[bi + 1]; C = V[bi + 4]; ia = ij; ib = ij + vec2(1.0, 0.0); ic = ij + vec2(0.0, 1.0); }
  else { A = V[bi + 1]; B = V[bi + 5]; C = V[bi + 4]; ia = ij + vec2(1.0, 0.0); ib = ij + vec2(1.0, 1.0); ic = ij + vec2(0.0, 1.0); }

  vec2 e;
  e = B - A; plEdge(R, plEdgeD(q, A, B), normalize(vec2(e.y, -e.x)));
  e = C - B; plEdge(R, plEdgeD(q, B, C), normalize(vec2(e.y, -e.x)));
  e = A - C; plEdge(R, plEdgeD(q, C, A), normalize(vec2(e.y, -e.x)));

  vec3 N = normalize(cross(vec3(B - A, plHeight(ib) - plHeight(ia)), vec3(C - A, plHeight(ic) - plHeight(ia))));
  R.c = (A + B + C) / 3.0;
  R.key = vec2(ij.x * 2.0 + (bup ? 0.0 : 1.0), ij.y);
  R.k = int(2.0 * (ij.x + ij.y)) + (bup ? 0 : 1);
  R.lit = 2; R.face = N;
  R.rin = 0.28;
  return R;
}

// ---- flower of life: unit circles centred on a unit hex lattice. Regions = petals and curved triangles.
PlReg plFlower(vec2 q) {
  PlReg R = plNew();
  vec4 h = pg_hexGrid(q);
  vec2 c0 = q - h.xy;
  int count = 0; vec2 sumC = vec2(0.0), sumId = vec2(0.0);
  for (int i = 0; i < 7; i++) {
    vec2 o = i == 0 ? vec2(0.0) : vec2(cos(float(i) * PG_PI / 3.0), sin(float(i) * PG_PI / 3.0));
    vec2 ci = c0 + o;
    vec2 v = q - ci;
    float L = length(v);
    bool inside = L < 1.0;
    if (inside) { count++; sumC += ci; sumId += floor((h.zw + vec2(o.x, o.y / 1.7320508)) * 2.0 + 0.5); }
    plEdge(R, abs(L - 1.0), (inside ? 1.0 : -1.0) * v / max(L, 1e-5));
  }
  R.c = count > 0 ? sumC / float(count) : c0;
  R.key = vec2(sumId.x + 1031.0 * float(count), sumId.y);
  R.k = count % 2;
  R.kt = 0.22 * float(count % 2);
  R.rin = 0.16;
  return R;
}

// ---- circle grid: concentric rings in a square or hex-packed grid; the space between circles is background
PlReg plCircles(vec2 q) {
  PlReg R = plNew();
  vec2 l, cell;
  if (u_stagger > 0.5) { vec4 h = pg_hexGrid(q); l = h.xy; cell = floor(h.zw * 2.0 + 0.5); }
  else { cell = floor(q); l = q - cell - 0.5; }
  float r = length(l);
  vec2 rad = r > 1e-5 ? l / r : vec2(0.0, 1.0);
  float n = max(u_rings, 1.0), w = 0.5 / n;
  R.c = q - l;
  R.key = cell;
  if (r >= 0.5) {
    R.bg = true;
    plEdge(R, r - 0.5, -rad);
    R.rin = 0.1;
    return R;
  }
  float ring = min(floor((0.5 - r) / w), n - 1.0);
  float ro = 0.5 - ring * w;
  plEdge(R, ro - r, rad);
  if (ring < n - 1.0) plEdge(R, r - (ro - w), -rad);
  R.k = int(ring);
  R.kt = 0.16 * ring;
  R.rin = ring < n - 1.0 ? 0.5 * w : w;
  return R;
}

// ---- pinwheel: each 2×2-cell block holds four half-square triangles turned 90° apart
vec2 plQuadBack(int quad, vec2 v) {
  if (quad == 1) return vec2(-v.y, v.x);
  if (quad == 2) return -v;
  if (quad == 3) return vec2(v.y, -v.x);
  return v;
}

PlReg plPinwheel(vec2 q) {
  PlReg R = plNew();
  q *= 0.5;                                              // block units (distances scaled back by 2 below)
  vec2 B = floor(q), u = q - B - 0.5;
  int quad; vec2 v;
  if (u.x >= 0.0 && u.y >= 0.0) { quad = 0; v = u; }
  else if (u.x < 0.0 && u.y >= 0.0) { quad = 1; v = vec2(u.y, -u.x); }
  else if (u.x < 0.0) { quad = 2; v = -u; }
  else { quad = 3; v = vec2(-u.y, u.x); }
  bool blade = v.y >= v.x;
  vec2 cl;
  if (blade) {
    plEdge(R, v.x, plQuadBack(quad, vec2(-1.0, 0.0)));
    plEdge(R, 0.5 - v.y, plQuadBack(quad, vec2(0.0, 1.0)));
    plEdge(R, (v.y - v.x) * PL_R2, plQuadBack(quad, vec2(PL_R2, -PL_R2)));
    cl = vec2(1.0 / 6.0, 1.0 / 3.0);
  } else {
    plEdge(R, v.y, plQuadBack(quad, vec2(0.0, -1.0)));
    plEdge(R, 0.5 - v.x, plQuadBack(quad, vec2(1.0, 0.0)));
    plEdge(R, (v.x - v.y) * PL_R2, plQuadBack(quad, vec2(-PL_R2, PL_R2)));
    cl = vec2(1.0 / 3.0, 1.0 / 6.0);
  }
  R.d1 *= 2.0; R.d2 *= 2.0;
  R.c = 2.0 * (B + 0.5 + plQuadBack(quad, cl));
  R.key = vec2((B.x * 4.0 + float(quad)) * 2.0 + (blade ? 1.0 : 0.0), B.y);
  R.k = blade ? plAlt(B.x + B.y) : 0;
  R.kt = blade ? 0.0 : 0.4;
  R.rin = 0.29;
  return R;
}

PlReg plRegion(vec2 q, float ph) {
  if (u_mode == MODE_LOWPOLY) return plLowPoly(q, ph);
  if (u_mode == MODE_TRIANGLES) return plTriangles(q);
  if (u_mode == MODE_HEXAGONS) return plHexagons(q);
  if (u_mode == MODE_FLOWER) return plFlower(q);
  if (u_mode == MODE_CIRCLES) return plCircles(q);
  if (u_mode == MODE_PINWHEEL) return plPinwheel(q);
  return plDiamonds(q);                                  // diamonds + argyle
}

bool plUsesPalette() { return u_colorSrc == COLORSRC_PALETTE || u_colorSrc == COLORSRC_ORDERED; }

// Gradient position for a point (pattern units), before the per-tile offsets.
float plGradT(vec2 cp, float ph) {
  float t;
  if (u_colorSrc == COLORSRC_NOISE) {
    vec2 drift = 0.8 * vec2(cos(ph) - 1.0, sin(ph));    // circles back to the start every cycle
    t = 0.5 + 0.85 * pg_fbm(cp / u_colorScale + drift, 3);
  } else {
    float a = radians(u_gradAngle);
    float x = dot(cp, vec2(cos(a), sin(a))) / u_colorScale;
    t = 0.5 + 0.5 * x + 0.16 * u_variation * pg_noise(cp * 1.7 / u_colorScale + 11.0);
    t += 0.06 * (sin(ph - 3.0 * x) + sin(3.0 * x));    // shimmer wave travelling along the gradient
  }
  return t;
}

// Apply a shade factor: shadows multiply, highlights lift towards white (keeps light colours clean).
vec3 plLit(vec3 c, float s) { return s >= 1.0 ? mix(c, vec3(1.0), 0.6 * (s - 1.0)) : c * mix(1.0, s, 0.85 + 0.15 * pg_luma(c)); }

vec3 plBase(PlReg R, float ph) {
  if (R.bg) return u_bgColor;
  vec3 h = pg_hash32(R.key);
  if (plUsesPalette()) {
    int i = u_colorSrc == COLORSRC_PALETTE ? int(floor(h.x * float(u_palette_count))) + R.k : R.k;
    float a = h.y * PG_TAU;
    // per-tile jitter + animated pulse, via plLit so bright colours don't clip into a different hue
    return plLit(u_palette[pg_wrapi(i, u_palette_count)], 1.0 + (h.z - 0.5) * 0.5 * u_variation + 0.1 * (sin(ph + a) - sin(a)));
  }
  return pg_grad(u_gradient, plGradT(R.c * u_size, ph) + R.kt + (h.x - 0.5) * 0.3 * u_variation);
}

float plShade(PlReg R, float ph) {
  if (u_shading <= 0.0 || R.bg) return 1.0;
  float la = radians(u_lightAngle) + 0.35 * sin(ph);
  vec2 L = vec2(cos(la), sin(la));
  if (R.lit == 1) return 1.0 + 0.45 * u_shading * dot(R.face.xy, L);
  if (R.lit == 2) return 1.0 + 1.0 * u_shading * dot(R.face.xy, L);
  // bevel / pyramid facets: the facet of the nearest edge tilts outward along its normal
  float w = pg_fill(-(R.d2 - R.d1) * 0.5 * u_size);    // AA'd crease between the two nearest facets
  vec2 n = mix(R.n2, R.n1, w);
  n /= max(length(n), 1e-4);
  float inB = pg_fill((R.d1 - u_bevel * R.rin) * u_size);
  return 1.0 + 0.5 * u_shading * dot(n, L) * inB;
}

vec3 plPal(int i) { return u_palette[pg_wrapi(i, u_palette_count)]; }

// Area-weighted mean tile colour, used when tiles shrink below ~2px (zoomed out / near the horizon).
// "Ordered" layouts don't use the colours evenly (argyle/harlequin/pinwheel: colour 1 fills half the area).
vec3 plPaletteAvg() {
  int n = max(u_palette_count, 1);
  vec3 all = vec3(0.0);
  for (int i = 0; i < 16; i++) { if (i >= n) break; all += u_palette[i]; }
  if (u_colorSrc == COLORSRC_PALETTE) return all / float(n);
  if (u_mode == MODE_HEXAGONS) return (plPal(0) + plPal(1) + plPal(2)) / 3.0;
  if (u_mode == MODE_FLOWER) return mix(plPal(0), plPal(1), 0.372);           // petals 62.8%, curved triangles 37.2%
  if (u_mode == MODE_DIAMONDS || u_mode == MODE_ARGYLE || u_mode == MODE_PINWHEEL)
    return n > 1 ? 0.5 * plPal(0) + 0.5 * (all - plPal(0)) / float(n - 1) : plPal(0);
  if (u_mode == MODE_CIRCLES) {
    float rn = max(u_rings, 1.0), w = 0.5 / rn, ws = 0.0;
    vec3 s = vec3(0.0);
    for (int j = 0; j < 8; j++) {
      if (float(j) >= rn) break;
      float r = 0.5 - float(j) * w, a = r * r - max(r - w, 0.0) * max(r - w, 0.0);
      s += a * plPal(j); ws += a;
    }
    return s / ws;
  }
  return all / float(n);                                                      // triangles, low poly cycle evenly
}

// Edge length per unit area (cell units): turns gap / outline widths into far-away area fractions.
float plEdgeDensity() {
  if (u_mode == MODE_TRIANGLES || u_mode == MODE_LOWPOLY) return 3.464;
  if (u_mode == MODE_HEXAGONS) return u_cubes > 0.5 ? 4.0 : 2.0;
  if (u_mode == MODE_FLOWER) return 6.3;                     // 7.26, less the overlap where six arcs meet
  if (u_mode == MODE_PINWHEEL) return 3.414;
  if (u_mode == MODE_CIRCLES) return 0.5 * PG_PI * (max(u_rings, 1.0) + 1.0) / (u_stagger > 0.5 ? 0.8660254 : 1.0);
  return 2.0 * sqrt(1.0 + u_stretch * u_stretch) / u_stretch;                // diamonds + argyle
}

// Far-away colour: tiles, background between circles, gaps, outlines and cross lines mixed by area.
vec3 plFarColor(vec2 p, float ph) {
  vec3 avg = plUsesPalette() ? plPaletteAvg() : pg_grad(u_gradient, plGradT(p, ph));
  if (u_mode == MODE_CIRCLES) avg = mix(avg, u_bgColor, 1.0 - 0.785398 / (u_stagger > 0.5 ? 0.8660254 : 1.0));
  float P = plEdgeDensity();
  avg = mix(avg, u_bgColor, clamp(u_gap * P, 0.0, 1.0));
  avg = mix(avg, u_outlineColor, clamp((u_gap > 0.0 ? 2.0 : 1.0) * u_outline * P, 0.0, 1.0));
  if ((u_mode == MODE_ARGYLE || u_mode == MODE_DIAMONDS) && u_cross != CROSS_NONE) {
    float st = u_stretch;
    float L = u_mode == MODE_ARGYLE ? 2.0 * sqrt(1.0 + 1.0 / (st * st)) : 2.0 + 2.0 / st;   // line length / area
    avg = mix(avg, u_crossColor, clamp(u_crossWidth * L * (u_cross == CROSS_DASHED ? 0.6 : 1.0), 0.0, 1.0));
  }
  return avg;
}

vec4 pattern(vec2 p) {
  float S = u_size;
  vec2 q = p / S;
  float ph = u_time * u_speed * PG_TAU / 8.0;           // one loop every 8 s / Motion
  float pxq = pg_px / S;                                 // one sample, cell units

  PlReg R = plRegion(q, ph);
  vec3 base = plBase(R, ph);
  vec3 col = plLit(base, plShade(R, ph));
  float d = max(R.d1, 0.0) * S;

  // Anti-alias the boundary by blending with the region on the other side of the nearest edge.
  if (u_tf_aa > 0.5 && d < pg_px) {
    PlReg N = plRegion(q + R.n1 * (max(R.d1, 0.0) + 0.75 * pxq), ph);
    col = mix(plLit(plBase(N, ph), plShade(N, ph)), col, pg_fill(-d));
  }

  float g = 0.5 * u_gap * S;
  if (u_gap > 0.0) col = mix(col, u_bgColor, pg_line(d, g));
  if (u_outline > 0.0) col = mix(col, u_outlineColor, pg_line(d - g, 0.5 * u_outline * S));
  if ((u_mode == MODE_ARGYLE || u_mode == MODE_DIAMONDS) && u_cross != CROSS_NONE) col = mix(col, u_crossColor, plCross(q));

  // Tiles smaller than ~2px: fade to the average colour instead of sparkling.
  if (u_tf_aa > 0.5) {
    float f = smoothstep(0.3, 0.8, pxq / (2.0 * R.rin));
    if (f > 0.0) col = mix(col, plFarColor(p, ph), f);
  }
  return vec4(col, 1.0);
}
`,
  });
})();
