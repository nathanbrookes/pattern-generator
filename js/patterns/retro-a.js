/* Retro styles (a): Tall Triangles, Diamond Lattice, Harlequin Diamonds.
 *
 * Tall Triangles and Harlequin Diamonds share one lattice (studied from the reference prints): diamonds in colour 0
 * sit on a rectangular grid touching at all four vertices; the spaces between them are diamonds too, cut in half by
 * straight horizontal lines. Each band between two lines is a row of triangles alternating colour-0 / coloured, the
 * coloured ones pointing down in the top half and up in the bottom half, tip to tip (an hourglass of one colour), and
 * the colour swaps across every straight line. Tall Triangles uses thin columns (the coloured triangles read as the
 * motif), Harlequin uses wide diamonds (the colour-0 diamonds read as the motif).
 *
 * Diamond Lattice is a checkerboard of leaning rhombi: colour-0 rhombi alternate with gap rhombi that are split along
 * their short diagonal into two triangles.
 *
 * All distances are measured in "iso" space -- (q.x + tan(slant) * q.y, stretch * q.y), i.e. true on-screen distance
 * in units of Size -- rather than in the sheared/stretched cell space, so edges stay one pixel soft and seams keep one
 * width in every direction whatever Stretch and Slant are (the framework's rt_px is a worst-case bound for cell space;
 * rtA_k converts). */
(function () {
  const M = (PG.retroModes = PG.retroModes || []);

  const SHARED = /* glsl */ `
// ---- retro-a shared helpers (prefix rtA_) ----
float rtA_k = 1.0;     // rt_px / (one sample in iso units): rt_fill(d * rtA_k) anti-aliases an iso distance exactly
float rtA_ipx = 0.001; // one output pixel in iso units (drives the small-scale fade)
float rtA_sl = 0.0;    // tan(slant)

void rtA_init() {
  float px = pg_px / u_size;
  rtA_k = rt_px / max(px, 1e-9);
  rtA_ipx = px * pg_ss;
  rtA_sl = tan(radians(u_slant));
}
// AA coverage of an iso signed distance (negative inside); honours Smooth edges via rt_fill.
float rtA_fill(float d) { return rt_fill(d * rtA_k); }
// Seam of width u_gap (iso units) on an edge at iso distance d. Energy-conserving like pg_line: a seam thinner than a
// pixel fades instead of spreading to a full pixel.
vec3 rtA_seam(vec3 col, float d) {
  if (u_gap <= 0.0) return col;
  float hw = 0.5 * u_gap;
  float ww = u_tf_aa > 0.5 ? max(hw, 0.5 * rt_px / rtA_k) : hw;
  return mix(col, u_gapColor, rtA_fill(abs(d) - ww) * hw / ww);
}
// Length of a cell-space line normal n once mapped to iso space (divide a cell-space line equation by it).
float rtA_nl(vec2 n) { return length(vec2(n.x, (n.y - rtA_sl * n.x) / u_stretch)); }

// Mean of palette colours 1..n-1 (the triangle colours).
vec3 rtA_meanTri() {
  int n = max(u_colors_count - 1, 1);
  vec3 s = vec3(0.0);
  for (int i = 0; i < 15; i++) {
    if (i >= n) break;
    s += rt_c(1 + i);
  }
  return s / float(n);
}

// One band (j) of the diamond lattice, evaluated at q (cell units); the band may be a neighbour of the one q is in.
// w = column width (triangle base), h = triangle height (half the band), shift = column offset per band (in columns),
// solid = 1 to colour the two halves of each gap diamond alike (classic harlequin), 0 for one-colour hourglasses.
// dd = iso signed distance to the hourglass edge: negative inside the coloured triangles, positive in the colour-0 diamond.
vec3 rtA_band(vec2 q, float j, float w, float h, float shift, float solid, out float dd) {
  float u = q.x / w - shift * j;
  float k = floor(u);
  float s = (u - k - 0.5) * w;                 // offset from the column centre
  float t = q.y - (2.0 * j + 1.0) * h;         // offset from the band mid-line (where the tips meet)
  float a = h * abs(s), b = 0.5 * w * abs(t);  // edge of this quadrant: a - b = 0
  float sg = (s < 0.0) == (t < 0.0) ? 1.0 : -1.0;
  float e1 = (a - b) / rtA_nl(vec2(h, -0.5 * w * sg));  // this quadrant's edge
  float n2 = rtA_nl(vec2(h, 0.5 * w * sg));             // the mirrored edge (differs once slanted)
  // inside a triangle: nearer of its two sides; inside a colour-0 diamond: nearer of its two sides on this column
  dd = a > b ? min(e1, (a + b) / n2) : max(e1, -(a + b) / n2);
  float idx = k + j + solid * step(0.0, t);
  vec3 tri = rt_c(1 + pg_wrapi(int(idx), max(u_colors_count - 1, 1)));
  return mix(tri, rt_c(0), rtA_fill(-dd));
}

vec3 rtA_lattice(vec2 q, float w, float h, float shift, float solid) {
  rtA_init();
  // One output pixel across (fx) and up (fy) in iso units, for the small-scale fade: under tilt the rows shrink much
  // faster than the columns. Derivatives are taken here, in uniform control flow, and clamped to the isotropic
  // footprint so symmetry seams or pixel snapping can't upset them.
  float X = q.x + rtA_sl * q.y, Y = u_stretch * q.y;
  float fx = clamp(length(vec2(dFdx(X), dFdy(X))), 0.1 * rtA_ipx, rtA_ipx);
  float fy = clamp(length(vec2(dFdx(Y), dFdy(Y))), 0.1 * rtA_ipx, rtA_ipx);
  float j = floor(q.y / (2.0 * h));
  float yb = q.y - 2.0 * h * j;                     // 0..2h inside the band
  float dl = min(yb, 2.0 * h - yb) * u_stretch;     // iso distance to the nearest straight line
  float d1;
  vec3 col = rtA_band(q, j, w, h, shift, solid, d1);
  if (u_tf_aa > 0.5 && dl * rtA_k < rt_px) {        // anti-alias against the band across the line
    float d2;
    vec3 c2 = rtA_band(q, j + (yb > h ? 1.0 : -1.0), w, h, shift, solid, d2);
    col = mix(c2, col, rtA_fill(-dl));
  }
  // the straight line is only an edge where the two halves of a gap diamond differ
  col = rtA_seam(col, solid > 0.5 ? abs(d1) : min(abs(d1), dl));
  if (u_tf_aa > 0.5) {
    // Small on screen: thin columns blur into horizontal stripes (each row's average colour across), and rows too
    // short to resolve settle to one flat tone -- how the print reads from across the room, with no moire on the way.
    float band = 2.0 * h * u_stretch;
    float f1 = smoothstep(0.2, 0.45, fx / w);       // column 5 px wide -> 2.2 px
    float f2 = smoothstep(0.25, 0.5, fy / band);    // band 4 px tall -> 2 px
    if (f1 + f2 > 0.0) {
      vec3 c0 = rt_c(0), ct = rtA_meanTri();
      // share of each row covered by the slanted seams (two edges per column)
      float fs = clamp(u_gap * (rtA_nl(vec2(h, 0.5 * w)) + rtA_nl(vec2(h, -0.5 * w))) / (h * w), 0.0, 1.0);
      vec3 rowAvg = mix(mix(c0, ct, abs(yb - h) / h), u_gapColor, fs);  // coloured share grows from tips to lines
      if (solid < 0.5) rowAvg = rtA_seam(rowAvg, dl);
      vec3 tone = mix(mix(0.5 * (c0 + ct), u_gapColor, fs), u_gapColor, solid > 0.5 ? 0.0 : clamp(u_gap / band, 0.0, 1.0));
      col = mix(mix(col, rowAvg, f1), tone, f2);
    }
  }
  return col;
}
`;

  M.push({
    key: 'triangles',
    label: 'Tall Triangles',
    order: 1,
    // Colours: 0 = background (the tall diamonds between the triangles), 1..n-1 = the triangles, cycling along each
    // row; a triangle and the one tip-to-tip with it share a colour, and the colour steps on across each straight line.
    // SHARED rides on this style: it has the lowest order of the three, so its GLSL is emitted before the other two.
    glsl:
      SHARED +
      /* glsl */ `
vec3 rt_triangles(vec2 q) {
  // triangle base 0.5, height 1.25 (cell units): one coloured + one background triangle side by side = one cell wide
  return rtA_lattice(q, 0.5, 1.25, u_trianglesShift, 0.0);
}
`,
    params: [
      // random reaches below min on purpose: Randomize clamps through PG.resolveValue, so about half the rolls keep the
      // signature tips-meet layout (0) and the rest slide the rows by up to half a step
      { id: 'trianglesShift', label: 'Row offset', min: 0, max: 1, default: 0, step: 0.01, random: [-0.5, 0.5], help: 'Slide each row of triangles sideways against the next (0 = tips meet, 0.5 = brick-like half step)' },
    ],
    presets: [
      // matched to the reference: band height / column width 5.25, two bands per screen height
      { name: 'Orange Grove Triangles', values: { colors: ['#f9d685', '#f46c0c', '#104708'], size: 0.38, stretch: 1.05, gap: 0.004, gapColor: '#f9d685', print: 0.3, trianglesShift: 0 } },
      { name: 'Circus Pennants', values: { colors: ['#f4ead2', '#d9412b', '#26487a', '#e8a33d'], size: 0.24, stretch: 1.2, gap: 0.01, gapColor: '#f4ead2', print: 0.35, trianglesShift: 0 } },
    ],
  });

  M.push({
    key: 'diamonds',
    label: 'Diamond Lattice',
    order: 4,
    // Colours: 0 = the pale rhombi, 1 and 2 = the two triangles of each gap rhombus (upper-left / lower-right, swapping
    // every row); with more colours the triangle pairs step through colours 1..n-1.
    glsl: /* glsl */ `
vec3 rt_diamonds(vec2 q) {
  rtA_init();
  const float L = -0.31;                       // lean (measured): the rhombi are sheared, top edge shifted left
  vec2 g = vec2(q.x - L * q.y, q.y);           // un-sheared: every rhombus becomes a unit square
  vec2 ij = floor(g);
  vec2 f = g - ij;
  float nSide = rtA_nl(vec2(1.0, -L));
  float dx = min(f.x, 1.0 - f.x) / nSide;      // iso distance to the slanted sides
  float dy = min(f.y, 1.0 - f.y) * u_stretch;  // iso distance to the horizontal sides
  float dcell = min(dx, dy);
  bool pale = mod(ij.x + ij.y, 2.0) < 0.5;
  // the gap rhombus to colour: this one, or for a pale rhombus the gap across its nearest side
  vec2 gij = ij, gf = f;
  if (pale) {
    if (dx < dy) { float sx = f.x < 0.5 ? -1.0 : 1.0; gij.x += sx; gf.x -= sx; }
    else         { float sy = f.y < 0.5 ? -1.0 : 1.0; gij.y += sy; gf.y -= sy; }
  }
  // split along the short diagonal (bottom-left to top-right corner); negative = upper-left triangle
  float dUL = (gf.x - gf.y) / rtA_nl(vec2(1.0, -(1.0 + L)));
  float r = gij.y;
  if (u_diamondsShade == DIAMONDSSHADE_SAME) r = 0.0;
  else if (u_diamondsShade == DIAMONDSSHADE_CHECKER) r = gij.y + floor(gij.x * 0.5);
  int n = max(u_colors_count - 1, 1);
  vec3 cUL = rt_c(1 + pg_wrapi(int(r), n));
  vec3 cLR = rt_c(1 + pg_wrapi(int(r) + 1, n));
  vec3 gap = mix(cLR, cUL, rtA_fill(dUL));
  float inside = rtA_fill(-dcell);
  vec3 col = pale ? mix(gap, rt_c(0), inside) : mix(rt_c(0), gap, inside);
  col = rtA_seam(col, pale ? dcell : min(dcell, abs(dUL)));
  if (u_tf_aa > 0.5) {
    // small on screen: settle to the average tone (seams included) instead of shimmering
    float m = min(u_stretch, 1.0 / nSide);     // narrowest cell dimension (iso)
    float fade = smoothstep(0.2, 0.5, rtA_ipx / m);
    if (fade > 0.0) {
      vec3 gapAvg = u_diamondsShade == DIAMONDSSHADE_SAME ? 0.5 * (rt_c(1) + rt_c(1 + pg_wrapi(1, n))) : rtA_meanTri();
      float seams = 1.0 + length(vec2(L + rtA_sl, u_stretch)) + 0.5 * length(vec2(1.0 + L + rtA_sl, u_stretch));
      vec3 avg = mix(0.5 * (rt_c(0) + gapAvg), u_gapColor, clamp(u_gap * seams / u_stretch, 0.0, 1.0));
      col = mix(col, avg, fade);
    }
  }
  return col;
}
`,
    params: [
      {
        id: 'diamondsShade',
        label: 'Triangle colours',
        type: 'select',
        options: [
          ['rows', 'Swap every row'],
          ['same', 'Same in every gap'],
          ['checker', 'Checkered'],
        ],
        default: 'rows',
        random: ['rows', 'rows', 'same', 'checker'],
        help: 'How the two triangles in each gap between the pale rhombi are coloured',
      },
    ],
    presets: [
      // matched to the reference: lean -0.31, cell height / width 0.98, about 7.3 rhombi per screen height
      { name: 'Sage & Olive Diamonds', values: { colors: ['#cbd99d', '#30471f', '#7e6b17'], size: 0.273, stretch: 0.98, gap: 0.009, gapColor: '#e4edbe', print: 0.3, diamondsShade: 'rows' } },
      { name: 'Terracotta Rhombi', values: { colors: ['#f1e4cc', '#8a3a1e', '#d58b3a'], size: 0.22, stretch: 1, gap: 0.012, gapColor: '#f6ecd8', print: 0.35, diamondsShade: 'same' } },
    ],
  });

  M.push({
    key: 'harlequin',
    label: 'Harlequin Diamonds',
    order: 8,
    // Colours: 0 = the tall diamonds, 1..n-1 = the triangles between them (with 'Two-tone triangles' a gap diamond is
    // split into two colours along its straight line; with 'Solid diamonds' both halves share one colour).
    glsl: /* glsl */ `
vec3 rt_harlequin(vec2 q) {
  // diamond 1 wide x 2 tall (cell units)
  return rtA_lattice(q, 1.0, 1.0, 0.0, u_harlequinGaps == HARLEQUINGAPS_SOLID ? 1.0 : 0.0);
}
`,
    params: [
      {
        id: 'harlequinGaps',
        label: 'Gaps',
        type: 'select',
        options: [
          ['split', 'Two-tone triangles'],
          ['solid', 'Solid diamonds'],
        ],
        default: 'split',
        random: ['split', 'split', 'solid'],
        help: 'Split each gap between the diamonds into an upper and a lower triangle, or fill it as one diamond',
      },
    ],
    presets: [
      // matched to the reference: diamond height / width 2.16, about 5 rows per screen height
      { name: 'Mustard & Claret Harlequin', values: { colors: ['#c58507', '#5e0604', '#efb893'], size: 0.182, stretch: 1.08, gap: 0.01, gapColor: '#efb893', print: 0.3, harlequinGaps: 'split' } },
      { name: 'Teal Jester', values: { colors: ['#1f6f6b', '#f2e3c6', '#d0573a'], size: 0.2, stretch: 1.25, gap: 0.014, gapColor: '#f2e3c6', print: 0.3, harlequinGaps: 'solid' } },
    ],
  });
})();
