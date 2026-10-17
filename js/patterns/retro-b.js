/* Retro styles (b): Stair Blocks, Hexagon Stripes, Lattice Hexagons.
 *
 * Stair Blocks — a Schröder-stair lozenge tiling: long 30° rhombi plus two kinds of shorter parallelograms (the three
 *   faces of stepped blocks). The colours cycle along the stairs so no two touching faces share a colour.
 * Hexagon Stripes / Lattice Hexagons — the same 1970s motif in two proportions: tall hexagonal "pencil" prisms seen
 *   end-on in oblique projection. The hexagons are the prism ends; the diagonal stripes between them are the prisms'
 *   receding side faces (three faces per column, two alternating colours — more if the palette has them), cut off by
 *   the hexagons in front. 'Hexagon length' trades hexagon for stripe (0.3 = the prints).
 *   Both were measured from the reference prints (the shapes match to within a pixel or two after removing photo rotation).
 * Helper names are prefixed rtb_ so they cannot collide with the other retro style files. */
(function () {
  const M = (PG.retroModes = PG.retroModes || []);

  /* ---------------------------------------------------------------- shared helpers (emitted once) */
  const COMMON = /* glsl */ `
#ifndef RTB_COMMON
#define RTB_COMMON
// Palette colour i; with a two-colour palette, colour 2 becomes the mid tone of the two (keeps neighbours distinct).
vec3 rtb_pc(float i) {
  int k = int(i + 0.5);
  if (k == 2 && u_colors_count < 3) return mix(rt_c(0), rt_c(1), 0.5);
  return rt_c(k);
}
#endif
`;

  const PRISM = /* glsl */ `
#ifndef RTB_PRISM
#define RTB_PRISM
// Prism frame (set by the style before calling rtb_prism / rtb_hexDist), in column-width units:
// hexagon centres at n*a + m*c with a = (1, A) (chain direction: neighbours touch corner to corner) and c = (1, C)
// (prism axis). Lattice coords (al, ga): p = al*a + ga*c. Hexagon (n, m) = { |g| <= H, |d| + |g| <= 0.5 },
// d = al - n, g = ga - m. H (0.3 in both prints) is the hexagon's half-length along the prism axis; the side faces
// fill the remaining 1 - 2H. The hexagon's vertical sides are the lines al + ga = x = const.
float rtb_A = -0.9;
float rtb_C = 2.5;
float rtb_H = 0.3;

// Number of stripe colours: every palette colour after the first (at least 2; with a two-colour palette the second
// stripe colour is the mid tone). Faces that touch always differ by 1 in their stripe index, so any count >= 2 works.
float rtb_nStripes() { return float(max(u_colors_count - 1, 2)); }

// Region containing p. Returns the colour id (0 = hexagon, 1..N = stripe colours), the signed distance to the
// region's edge (sd < 0 inside, column-width units) and the outward unit normal of the nearest edge.
float rtb_prism(vec2 p, out float sd, out vec2 nrm) {
  float A = rtb_A, C = rtb_C, D = C - A, sg = sign(D), H = rtb_H, E = 0.5 - rtb_H;
  float al = (C * p.x - p.y) / D, ga = (p.y - A * p.x) / D;
  vec2 gA = vec2(C, -1.0), gG = vec2(-A, 1.0), gD = vec2(C + A, -2.0);
  float sA = abs(D) / length(gA), sG = abs(D) / length(gG), sD = abs(D) / length(gD);   // real distance per lattice unit
  vec2 nA = sg * normalize(gA), nG = sg * normalize(gG), nD = sg * normalize(gD), nS = vec2(1.0, 0.0);
  float n = floor(al + 0.5), d = al - n;
  float m = floor(ga + 0.5), g = ga - m;
  float h1 = (abs(g) - H) * sG, h2 = abs(d + g) - 0.5, h3 = (abs(d - g) - 0.5) * sD;
  float hs = max(h1, max(h2, h3));
  if (hs <= 0.0) {
    sd = hs;
    nrm = h1 >= max(h2, h3) ? sign(g) * nG : (h2 >= h3 ? sign(d + g) * nS : sign(d - g) * nD);
    return 0.0;
  }
  // a side face of the prism whose end is the hexagon above (ms); f: 0 = narrow face, 1 = wide face, 2 = narrow face
  float ms = g > 0.0 ? m + 1.0 : m;
  float gu = ga - ms, gl = gu + 1.0;
  float f = d < -E ? 0.0 : (d < E ? 1.0 : 2.0);
  float lo = f < 0.5 ? -0.5 : (f < 1.5 ? -E : E);
  float hi = f < 0.5 ? -E : (f < 1.5 ? E : 0.5);
  float e2, e3; vec2 n2, n3;
  if (f < 0.5)      { e2 = d + gu + 0.5;        n2 = nS;  e3 = (d - gl + 0.5) * sD; n3 = nD; }
  else if (f < 1.5) { e2 = (gu + H) * sG;       n2 = nG;  e3 = (H - gl) * sG;        n3 = -nG; }
  else              { e2 = (0.5 - d + gu) * sD; n2 = -nD; e3 = 0.5 - d - gl;         n3 = -nS; }
  sd = (lo - d) * sA; nrm = -nA;
  float e1 = (d - hi) * sA;
  if (e1 > sd) { sd = e1; nrm = nA; }
  if (e2 > sd) { sd = e2; nrm = n2; }
  if (e3 > sd) { sd = e3; nrm = n3; }
  return 1.0 + mod(n + ms + (f > 0.5 && f < 1.5 ? 1.0 : 0.0), rtb_nStripes());
}

// Distance to the nearest hexagon outline (column-width units) — the seams outline the hexagons only, as in the prints.
float rtb_hexDist(vec2 p) {
  float A = rtb_A, C = rtb_C, D = C - A, H = rtb_H;
  float al = (C * p.x - p.y) / D, ga = (p.y - A * p.x) / D;
  float sG = abs(D) / length(vec2(-A, 1.0)), sD = abs(D) / length(vec2(C + A, -2.0));
  vec2 b = vec2(floor(al + 0.5), floor(ga + 0.5));
  float best = 1e9;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      float d = al - b.x - float(i), g = ga - b.y - float(j);
      best = min(best, abs(max((abs(g) - H) * sG, max(abs(d + g) - 0.5, (abs(d - g) - 0.5) * sD))));
    }
  return best;
}

// Full style: q in cells, cw = column width in cells.
vec3 rtb_prismStyle(vec2 q, float cw) {
  vec2 p = q / cw;
  float px = rt_px / cw;
  // smaller than a few pixels: fade to the area-weighted average tone instead of moiré
  float fade = smoothstep(0.08, 0.25, px);
  vec3 avg = vec3(0.0);
  if (fade > 0.0) {
    float H = rtb_H, ah = 2.0 * H - 2.0 * H * H;   // hexagon area per lattice cell (cell area 1)
    float ns = rtb_nStripes();
    vec3 st = vec3(0.0);
    for (int i = 1; i < 16; i++) { if (float(i) > ns) break; st += rtb_pc(float(i)); }
    avg = ah * rt_c(0) + (1.0 - ah) / ns * st;   // every stripe colour covers the same area
    vec2 a = vec2(1.0, rtb_A), c = vec2(1.0, rtb_C);
    float per = 2.0 * (H * length(a + c) + (1.0 - 2.0 * H) * length(a) + H * length(a - c));   // hexagon perimeter
    avg = mix(avg, u_gapColor, clamp(u_gap / cw * per / abs(rtb_C - rtb_A), 0.0, 1.0));
    if (fade >= 1.0) return avg;
  }
  float sd; vec2 nr;
  float id = rtb_prism(p, sd, nr);
  vec3 col = rtb_pc(id);
  if (-sd < 2.0 * px) {           // near an edge: anti-alias against the region across it
    float sd2; vec2 nr2;
    float id2 = rtb_prism(p + nr * (0.25 * px - sd + 1e-4), sd2, nr2);
    col = mix(rtb_pc(id2), col, rt_fill(sd * cw));
  }
  if (u_gap > 0.0) col = rt_seam(col, rtb_hexDist(p) * cw);
  return mix(col, avg, fade);
}
#endif
`;

  /* ---------------------------------------------------------------- Stair Blocks */
  M.push({
    key: 'blocks',
    label: 'Stair Blocks',
    order: 2,
    glsl:
      COMMON +
      /* glsl */ `
// Stair Blocks. Long edge L = 0.82 cells. Edge vectors (units of L): e1 = (1 - cos30°, -1/2) (short, steep),
// e2 = (cos30°, 1/2), e3 = e1 + e2 = (1, 0). Faces: e1×e2 and e1×e3 parallelograms and the 30° e2×e3 rhombus.
// In (s, t) = coefficients of (e1, e2), every unit cell with (i + j) mod 3 == 2 is a whole e1×e2 face; the others are
// split by their diagonal into halves of a rhombus and an e1×e3 face. That arrangement makes the stairs.
// Colours: palette entries cycle along the stairs (0 → 1 → 2 → 0 …; reference: 0 cream, 1 red, 2 black). Palettes with
// more than three colours cycle through all of them; with two, the third is their mid tone.
float rtb_blocks(vec2 p, out float sd, out vec2 nrm) {
  float s = p.x - 1.7320508 * p.y, t = p.x + 0.2679492 * p.y;
  vec2 c = floor(vec2(s, t)), f = vec2(s, t) - c;
  float k = mod(c.x + c.y, 3.0);
  bool up = f.y >= f.x;
  const vec2 NS = vec2(0.5, -0.8660254), NT = vec2(0.9659258, 0.2588190), ND = vec2(0.0, -1.0);
  float x1, g1, x2, g2, id; vec2 n1, n2;
  if (k > 1.5) {
    x1 = f.x; g1 = 0.5; n1 = NS; x2 = f.y; g2 = 0.9659258; n2 = NT; id = c.y;
  } else {
    bool rh = (k < 0.5) == up;                  // half of a 30° rhombus
    x1 = f.x - f.y + (up ? 1.0 : 0.0); g1 = 0.5; n1 = ND;
    if (rh) { x2 = f.x; g2 = 0.5; n2 = NS; } else { x2 = f.y; g2 = 0.9659258; n2 = NT; }
    id = c.y + ((k < 0.5 && up) ? 1.0 : 0.0) + (rh ? 1.0 : 0.0);
  }
  float d1 = (abs(x1 - 0.5) - 0.5) * g1, d2 = (abs(x2 - 0.5) - 0.5) * g2;
  if (d1 > d2) { sd = d1; nrm = sign(x1 - 0.5) * n1; } else { sd = d2; nrm = sign(x2 - 0.5) * n2; }
  return id;
}
vec3 rtb_bc(float id) {
  float n = float(max(u_colors_count, 3));
  return rtb_pc(mod(id, n));
}
vec3 rt_blocks(vec2 q) {
  const float L = 0.82;
  vec2 p = q / L;
  float px = rt_px / L;
  // smaller than a few pixels: fade to the average tone (every colour covers the same area)
  float fade = smoothstep(0.06, 0.2, px);
  vec3 avg = vec3(0.0);
  if (fade > 0.0) {
    int n = max(u_colors_count, 3);
    for (int i = 0; i < 16; i++) { if (i >= n) break; avg += rtb_pc(float(i)); }
    avg /= float(n);
    avg = mix(avg, u_gapColor, clamp(3.36 * u_gap / L, 0.0, 1.0));   // seam length per area of the tiling
    if (fade >= 1.0) return avg;
  }
  float sd; vec2 nr;
  float id = rtb_blocks(p, sd, nr);
  vec3 col = rtb_bc(id);
  if (-sd < 2.0 * px) {
    float sd2; vec2 nr2;
    col = mix(rtb_bc(rtb_blocks(p + nr * (0.25 * px - sd + 1e-4), sd2, nr2)), col, rt_fill(sd * L));
  }
  col = rt_seam(col, sd * L);
  return mix(col, avg, fade);
}
`,
    presets: [
      {
        name: 'Pillarbox Stairs',
        values: { colors: ['#f5e9cf', '#f31c0b', '#151211'], size: 0.7, stretch: 1, gap: 0, gapColor: '#f5e9cf', print: 0.3 },
      },
      {
        name: 'Harvest Gold Stairs',
        values: { colors: ['#f1e2bd', '#d8962a', '#4a2c18'], size: 0.5, stretch: 1, gap: 0, gapColor: '#f1e2bd', print: 0.35 },
      },
    ],
  });

  /* ---------------------------------------------------------------- Hexagon Stripes */
  M.push({
    key: 'hexstripes',
    label: 'Hexagon Stripes',
    order: 3,
    glsl:
      COMMON +
      PRISM +
      /* glsl */ `
// Hexagon Stripes: tall pointy hexagons in staggered columns (column width 0.55 cells, hexagons ~1 cell tall), with the
// diagonal stripes rising to the right between them.
// Colours: 0 = hexagons, 1 and 2 = the alternating stripe colours (reference: hot pink, green, blue); further palette
// colours join the stripe cycle (1 → 2 → 3 …).
vec3 rt_hexstripes(vec2 q) {
  rtb_A = -0.9074;
  rtb_C = 2.5275;
  rtb_H = u_hexstripesHex;
  return rtb_prismStyle(q, 0.55);
}
`,
    params: [
      { id: 'hexstripesHex', label: 'Hexagon length', min: 0.15, max: 0.42, default: 0.3, step: 0.005, random: [0.22, 0.36], help: 'How much of each column the hexagons take up; the diagonal stripes fill the rest' },
    ],
    presets: [
      {
        name: 'Hot Pink Prisms',
        values: { colors: ['#f8113d', '#4a9e0c', '#075c80'], size: 0.27, stretch: 1, hexstripesHex: 0.3, gap: 0.016, gapColor: '#f7a3b6', print: 0.3 },
      },
      {
        name: 'Tangerine Prisms',
        values: { colors: ['#f06b1c', '#f3e0b4', '#5a2b15'], size: 0.27, stretch: 1, hexstripesHex: 0.3, gap: 0.016, gapColor: '#fbc99c', print: 0.35 },
      },
    ],
  });

  /* ---------------------------------------------------------------- Lattice Hexagons */
  M.push({
    key: 'lattice',
    label: 'Lattice Hexagons',
    order: 6,
    glsl:
      COMMON +
      PRISM +
      /* glsl */ `
// Lattice Hexagons: shorter hexagons on a diagonal lattice rising to the right (column width 0.7 cells, hexagons ~1 cell
// tall), stripes falling to the right between them — the mirror-image arrangement of Hexagon Stripes.
// Colours: 0 = hexagons, 1 and 2 = the alternating stripe colours (reference: cream, red, green); further palette
// colours join the stripe cycle (1 → 2 → 3 …).
vec3 rt_lattice(vec2 q) {
  rtb_A = 0.8876;
  rtb_C = -1.7568;
  rtb_H = u_latticeHex;
  return rtb_prismStyle(q, 0.7);
}
`,
    params: [
      { id: 'latticeHex', label: 'Hexagon length', min: 0.15, max: 0.42, default: 0.3, step: 0.005, random: [0.22, 0.36], help: 'How much of each lattice row the hexagons take up; the diagonal stripes fill the rest' },
    ],
    presets: [
      {
        name: 'Holly Berry Lattice',
        values: { colors: ['#e6d79c', '#a0140a', '#567f12'], size: 0.18, stretch: 1, latticeHex: 0.3, gap: 0.022, gapColor: '#f7dfb0', print: 0.3 },
      },
      {
        name: 'Seaside Lattice',
        values: { colors: ['#f2ead3', '#1e6a87', '#e3a23b'], size: 0.2, stretch: 1, latticeHex: 0.3, gap: 0.02, gapColor: '#fbf5e3', print: 0.3 },
      },
    ],
  });
})();
