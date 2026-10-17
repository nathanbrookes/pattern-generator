/* Architecture styles (a) — Plaid Mosaic and Blurred Mosaic.
 *
 * Both are "stepped plaid" mosaics: lanes of flat painted tiles whose colours step through a cyclic ramp built from
 * the palette; neighbouring lanes sit at different points of the ramp, so the steps weave into a plaid.
 *   Plaid Mosaic   — vertical lanes (columns) in groups [wide | narrow | wide]. The ramp runs top → bottom, the narrow
 *                    middle column runs a step ahead of its neighbours and every other group is shifted along the
 *                    cycle, which builds the woven horizontal bands.
 *   Banded Mosaic — the same weave turned sideways (horizontal bands, ramp running left → right; tall and short
 *                   bands alternate); sharp by default, with a Blur slider for soft, out-of-focus edges.
 *
 * Palette (ar_c): the colours are used IN ORDER as the ramp, c0 → c1 → … → c(n-1) → back to c0 (or, with "Mirror
 * ramp", back down c(n-2) … c1). "Ramp length" is the number of tiles in one full cycle: with more tiles than palette
 * steps, the extra tiles (spread evenly) become blended in-between shades of a colour and the next one.
 * Units: 1 cell = 2 tiles, so a wide-column tile is about one cell wide.
 * Tile edges are dead straight. Paint texture gives the hand-made feel inside the tiles: uneven pigment from tile to
 * tile and, in Blurred Mosaic, dry-brush streaks down each column.
 * Light / Relief: Plaid Mosaic shades a soft gradient round each tile edge (no crisp bevel line); Blurred Mosaic gives
 * each tile a low, soft cushion whose slopes are lit / shaded and spread with the blur (zero at the joint, so no line).
 * Motion (with Animate on; every motion param defaults to 0 = still, and then the output is unchanged):
 *   Plaid Mosaic  — Column scroll: lanes slide along themselves like escalators (all together, column groups in turn,
 *                   or the narrow middle column against its sides); Stepping turns the glide into whole-tile steps that
 *                   ease in (a departure board), Cascade ripples the steps from group to group.
 *   Banded Mosaic — Band drift: the same sliding, sideways; Breathing: the light and dark halves of the ramp swell and
 *                   shrink in turn (4 s per breath; the far-away average colour breathes too).
 * Lanes always move by whole tiles per step, so the colours repeat every (ramp length ÷ speed) seconds.
 * Color rain (shared param, ar_rain): the tiles stay put and the colours step through them, each tile taking the colour
 * of its upstream neighbour and wiping / flipping into it (arA_flip; the wipe is softened like the tile edges, so Blur
 * blurs it too). Plaid Mosaic flows down its columns (+ = down, − = up); Banded Mosaic flows along its bands, the way
 * its ramp runs (+ = to the right, − = to the left). Stagger offsets each lane by its centre position (tile units).
 * With Color rain at 0 the output is unchanged.
 */
(function () {
  const M = (PG.archModes = PG.archModes || []);

  const common = /* glsl */ `
// ---- arch-a: stepped plaid mosaics -------------------------------------------------------
// Colour of tile k of a T-tile cycle through the palette, in order (mir = ping-pong c0 → c(n-1) → c1). Each palette
// step gets T/m tiles, spread evenly; the extra tiles are blended in-between shades of that colour and the next.
// A fractional k blends linearly between tile floor(k) and the next one (used by breathing).
vec3 arA_ramp(float k, float T, bool mir) {
  int n = max(u_colors_count, 1);
  float m = mir ? max(2.0 * float(n) - 2.0, 1.0) : float(n);
  T = max(T, m);
  k = mod(k, T);
  float j = min(floor(floor(k) * m / T), m - 1.0);
  float s0 = ceil(j * T / m), s1 = ceil((j + 1.0) * T / m);
  float f = clamp((k - s0) / max(s1 - s0, 1.0), 0.0, 1.0);
  int a = int(j), b = a + 1;
  if (mir) {
    if (n == 1) b = 0;
    else if (a >= n - 1) { a = 2 * n - 2 - a; b = a - 1; }
  }
  return mix(ar_c(a), ar_c(b), f);
}
// Tiles in one colour cycle (at least one per palette step).
float arA_cycle(float T, bool mir) {
  float n = float(max(u_colors_count, 1));
  return max(floor(T + 0.5), mir ? max(2.0 * n - 2.0, 1.0) : n);
}
// Average colour of the whole cycle (what the mosaic reads as from far away), averaged in ~linear light.
vec3 arA_mean(bool mir) {
  int n = max(u_colors_count, 1);
  vec3 s = vec3(0.0);
  float w = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= n) break;
    float wi = (mir && n > 1 && (i == 0 || i == n - 1)) ? 0.5 : 1.0;
    vec3 c = ar_c(i);
    s += c * c * wi;
    w += wi;
  }
  return sqrt(s / max(w, 1e-4));
}
// Lanes across coordinate a, in groups [wide W | narrow 1 | wide W]; every other group is shifted sh tiles along the
// ramp, the narrow lane ld tiles. Returns (lane start, lane width, ramp phase, id of the visible band — the wide lanes
// either side of a group boundary share one, so they read as one band when the groups are not shifted).
vec4 arA_lane(float a, float W, float sh, float ld) {
  float G = 2.0 * W + 1.0;
  float g = floor(a / G);
  float u = a - g * G;
  vec4 L = vec4(g * G, W, mod(g, 2.0) * sh, g * 4.0);   // ids are small integers: exact float compares
  if (u >= W + 1.0) { L.x += W + 1.0; L.w += 4.0; }
  else if (u >= W) { L.x += W; L.y = 1.0; L.z += ld; L.w += 2.0; }
  return L;
}
// Weight of the neighbouring tile at distance d (tile units) from the shared edge: AA coverage, widened by softness s.
float arA_w(float d, float s, float px) {
  float aa = u_tf_aa > 0.5 ? clamp(0.5 - d / max(px, 1e-6), 0.0, 0.5) : (d <= 0.0 ? 0.5 : 0.0);
  return s > 0.0 ? max(aa, 0.5 - 0.5 * smoothstep(0.0, s, d)) : aa;
}
// ---- motion (all off when the style's speed / breathing params are 0) ----
// Breathing: tile k shows the ramp at k + br·sin(2πk/st) — the fixed points are the cycle start and middle (the dark
// and light ends of a mirrored ramp), so as br swings ± the light part of the ramp swells while the dark part
// shrinks, then the other way. |br| < st/2π keeps the colours in order.
vec3 arA_tileCol(float k, float st, bool mir, float br) {
  return arA_ramp(br == 0.0 ? k : k + br * sin(PG_TAU * k / st), st, mir);
}
// Eased step count at x steps: stepping s = 0 glides (returns x); s → 1 rests for most of each step, then eases into
// the next whole tile (a departure board / kinetic facade).
float arA_go(float x, float s) {
  if (s <= 0.0) return x;
  float k = floor(x), p = 0.75 * s;
  float a = clamp((x - k - p) / (1.0 - p), 0.0, 1.0);
  return k + mix(a, a * a * (3.0 - 2.0 * a), s);
}
// Scroll of lane L along itself (tiles) and a key that is equal for lanes moving identically.
// mo = (speed in tiles/s, pattern: 0 together · 1 alternate groups · 2 narrow lanes against the wide ones,
//       stepping 0..1, cascade = steps of delay from one group to the next).
// Offsets start at 0 (time 0 = the still image; with cascade, groups caught mid-step start within half a tile of it),
// every lane rests on whole tiles and moves one tile per step, so the colour structure repeats exactly every
// (tiles per cycle) / speed seconds.
vec2 arA_off(vec4 L, float W, vec4 mo) {
  if (mo.x == 0.0) return vec2(0.0);
  float g = floor((L.x + 0.5 * L.y) / (2.0 * W + 1.0));     // group index (lane centre: robust to rounding)
  float dir = mo.y == 1.0 ? 1.0 - 2.0 * mod(g, 2.0) : (mo.y == 2.0 && mod(L.w, 4.0) == 2.0 ? -1.0 : 1.0);
  float d = g * mo.w;
  // subtract a whole number of tiles (not go(-d) itself): a cascaded group can be part-way through a step at time 0,
  // and its resting positions must still be whole tiles so the rows line up across groups
  float o = dir * sign(mo.x) * (arA_go(u_time * abs(mo.x) - d, mo.z) - floor(arA_go(-d, mo.z) + 0.5));
  return vec2(o, dir + (mo.w != 0.0 ? 4.0 * g : 0.0));
}
// Color rain samples the ramp several times per pixel, so it uses this copy of arA_tileCol (same colours): the palette
// indices it needs are already in 0..n, so it skips ar_c's integer wrap (two % per lookup — the slow part on GPUs).
vec3 arA_pc(int i, int n) { return u_flow != 0.0 ? ar_c(i) : u_colors[i >= n ? i - n : i]; }
vec3 arA_tileColF(float k, float st, bool mir, float br) {
  if (br != 0.0) k += br * sin(PG_TAU * k / st);
  int n = max(u_colors_count, 1);
  float m = mir ? max(2.0 * float(n) - 2.0, 1.0) : float(n);
  float T = max(st, m);
  k = mod(k, T);
  float j = min(floor(floor(k) * m / T), m - 1.0);
  float s0 = ceil(j * T / m), s1 = ceil((j + 1.0) * T / m);
  float f = clamp((k - s0) / max(s1 - s0, 1.0), 0.0, 1.0);
  int a = int(j), b = a + 1;
  if (mir) {
    if (n == 1) b = 0;
    else if (a >= n - 1) { a = 2 * n - 2 - a; b = a - 1; }
  }
  return mix(arA_pc(a, n), arA_pc(b, n), f);
}
// Color rain: ramp tile k of a tile whose rain state is rn = ar_rain(...) = (steps, wipe), at v = position along the
// tile in the flow direction (0 = upstream edge … 1 = downstream edge). The tile shows the colour 'steps' tiles
// upstream ('from') while the next one ('to', one tile further upstream) wipes in from the upstream edge, with a soft
// shadow on the turning edge (as ar_rainTile). s = edge softness in tile units (AA / Blur): the wipe line is softened
// the same way as the tile edges, and its travel is stretched by s at both ends so it starts and ends cleanly.
vec3 arA_flip(float k, vec2 rn, float v, float st, bool mir, float br, float s) {
  float dn = u_rain < 0.0 ? -1.0 : 1.0;
  k -= dn * rn.x;
  if (rn.y <= 0.0) return arA_tileColF(k, st, mir, br);                 // from
  if (rn.y >= 1.0) return arA_tileColF(k - dn, st, mir, br);            // to
  // shared look (Pour glide / Jacob's-ladder tumble); edges as soft as the tile edges (Blur), at least one sample
  return ar_rainLook(arA_tileColF(k, st, mir, br), arA_tileColF(k - dn, st, mir, br), rn.y, u_rain < 0.0 ? 1.0 - v : v,
                     max(s, 2.0 * ar_px));
}
// Colour of lane L at along-coordinate y (tile units), anti-aliased / softened across its tile rows.
// cx = the lane's across-coordinate for Color rain's stagger (its centre, in tile units).
vec3 arA_laneCol(vec4 L, float y, float st, bool mir, float br, float s, float jit, float px, float cx) {
  float r = floor(y), fy = y - r;
  float dB = min(fy, 1.0 - fy);
  float rN = fy < 0.5 ? r - 1.0 : r + 1.0;
  vec3 a0, a1;
  if (u_rain == 0.0) {
    a0 = arA_tileCol(r + L.z, st, mir, br);
    a1 = arA_tileCol(rN + L.z, st, mir, br);
  } else {
    // the tiles stay put, the colours move through them; the neighbour row is seen at its shared edge
    a0 = arA_flip(r + L.z, ar_rain(vec2(cx, r)), fy, st, mir, br, s);
    a1 = arA_w(dB, s, px) > 0.0 ? arA_flip(rN + L.z, ar_rain(vec2(cx, rN)), clamp(y - rN, 0.0, 1.0), st, mir, br, s) : a0;
  }
  if (jit > 0.0) {
    a0 *= 1.0 + jit * (pg_hash12(vec2(L.w, r)) - 0.5);
    a1 *= 1.0 + jit * (pg_hash12(vec2(L.w, rN)) - 0.5);
  }
  return mix(a0, a1, arA_w(dB, s, px));
}
// The woven mosaic. t = (across lanes, along lanes) in tile units, shF = group shift as a fraction of the cycle,
// T = tiles per colour cycle, soft = blend half-width (tile units, ≤ 0.5), jit = per-tile pigment variation,
// px = pixel size in tile units, mo = lane motion (see arA_off), br = breathing swing (tiles, see arA_tileCol).
// tile = (offset from the tile centre across, along; tile half-width across; distance to the nearest visible tile edge).
// mv = (along-coordinate in this lane's moving frame, the same in the neighbouring lane, weight of that neighbour) —
// for texture that should travel with the tiles.
vec3 arA_plaid(vec2 t, float W, float shF, float ld, float T, bool mir, float soft, float jit, float px, vec4 mo,
               float br, out vec4 tile, out vec3 mv) {
  float st = arA_cycle(T, mir);
  float sh = floor(shF * st + 0.5);
  vec4 L = arA_lane(t.x, W, sh, ld);
  float dl = t.x - L.x, dr = L.x + L.y - t.x;
  float dA = max(min(dl, dr), 0.0);
  vec4 N = arA_lane(dl < dr ? L.x - 0.25 : L.x + L.y + 0.25, W, sh, ld);
  vec2 oL = arA_off(L, W, mo), oN = arA_off(N, W, mo);
  float yL = t.y - oL.x, yN = t.y - oN.x;
  float fy = yL - floor(yL);
  float dB = min(fy, 1.0 - fy);
  float s = clamp(max(soft, u_tf_aa > 0.5 ? 0.75 * px : 0.0), 0.0, 0.5);   // "Smooth edges" off: hard tile edges
  float wA = arA_w(dA, min(s, 0.5 * min(L.y, N.y)), px);
  float cL = L.x + 0.5 * L.y, cN = N.x + 0.5 * N.y;   // lane centres (Color rain stagger)
  vec3 col;
  if (u_rain == 0.0) col = mix(arA_laneCol(L, yL, st, mir, br, s, jit, px, cL), arA_laneCol(N, yN, st, mir, br, s, jit, px, cN), wA);
  else {
    col = arA_laneCol(L, yL, st, mir, br, s, jit, px, cL);   // (the neighbouring lane only where it shows)
    if (wA > 0.0) col = mix(col, arA_laneCol(N, yN, st, mir, br, s, jit, px, cN), wA);
  }
  // the wide lanes either side of a group boundary read as one band when they are at the same point of the ramp
  // (and move together; with Color rain staggered they flip at different moments, so they stay two tiles — the tile
  // layout never changes over time)
  bool merged = L.w == N.w && oL.y == oN.y && mod(L.z - N.z, st) < 0.5 && (u_rain == 0.0 || u_rainStagger == 0.0);
  float bs = merged ? min(L.x, N.x) : L.x, bw = merged ? L.y + N.y : L.y;
  float dS = merged ? min(t.x - bs, bs + bw - t.x) : dA;
  tile = vec4(t.x - bs - 0.5 * bw, fy - 0.5, 0.5 * bw, min(dS, dB));
  mv = vec3(yL, yN, wA);
  return col;
}
// Breathing swing (tiles) for amount a (0..1) at the current time: one slow breath every 4 s.
float arA_breath(float a, float st) { return a == 0.0 ? 0.0 : a * 0.9 * st / PG_TAU * sin(u_time * PG_TAU / 4.0); }
// Far-away colour of the mosaic: the cycle average, shifted by how breathing changes it (sampled at 12 points of the
// cycle, in ~linear light) so the horizon breathes with the tiles.
vec3 arA_far(bool mir, float st, float br) {
  vec3 m = arA_mean(mir);
  if (br == 0.0) return m;
  vec3 d = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float k = st * (float(i) + 0.5) / 12.0;
    vec3 a = arA_tileCol(k, st, mir, br), b = arA_ramp(k, st, mir);
    d += a * a - b * b;
  }
  return sqrt(max(m * m + d / 12.0, 0.0));
}
`;

  // ---------------------------------------------------------------- 1. Plaid Mosaic
  M.push({
    key: 'mosaic',
    label: 'Plaid Mosaic',
    order: 1,
    common,
    params: [
      { id: 'mosaicTiles', label: 'Ramp length', type: 'int', min: 2, max: 40, default: 14, random: [9, 18], help: 'Tiles in one full colour cycle — tiles beyond one per palette colour become blended in-between shades' },
      { id: 'mosaicWide', label: 'Wide columns', min: 0.5, max: 4, default: 2, step: 0.05, random: [1.5, 2.5], help: 'Width of the two outer columns of each group (the middle column is one tile wide)' },
      { id: 'mosaicShift', label: 'Group offset', min: 0, max: 1, default: 0.67, step: 0.01, random: [0.2, 0.8], help: 'How far every other column group is moved along the colour cycle (0 = aligned, 0.5 = opposite)' },
      { id: 'mosaicLead', label: 'Middle lead', type: 'int', min: -3, max: 3, default: 1, random: [-2, 2], help: 'Tiles the narrow middle column runs ahead of (or behind) its neighbours' },
      { id: 'mosaicMirror', label: 'Mirror ramp', type: 'bool', default: false, random: 0.3, help: 'Walk the palette forward then back again instead of wrapping round' },
      { id: 'mosaicScroll', label: 'Column scroll', min: -3, max: 3, default: 0, step: 0.01, random: false, help: 'With Animate on, the columns slide along like escalators, in tiles per second (+ = downward, − = upward)' },
      { id: 'mosaicScrollDir', label: 'Scroll pattern', type: 'select', options: [['together', 'All together'], ['groups', 'Groups in turn'], ['middle', 'Middle against sides']], default: 'groups', random: false, showIf: (v) => v.mosaicScroll !== 0, help: 'With Animate on, which columns run which way: all the same way, every other column group the opposite way, or each narrow middle column against its wide neighbours' },
      { id: 'mosaicStep', label: 'Stepping', min: 0, max: 1, default: 0, step: 0.01, random: false, showIf: (v) => v.mosaicScroll !== 0, help: 'With Animate on, 0 = the columns glide continuously; higher = they pause, then ease on by one whole tile, like a departure board' },
      { id: 'mosaicCascade', label: 'Cascade', min: 0, max: 1, default: 0, step: 0.01, random: false, showIf: (v) => v.mosaicScroll !== 0 && v.mosaicStep > 0, help: 'With Animate on, each column group steps a little after the one to its left (fraction of a step), so the steps ripple across the facade' },
    ],
    glsl: /* glsl */ `
// Plaid Mosaic — palette = the colour ramp, read top → bottom (c0 first).
vec3 ar_mosaic(vec2 q) {
  float px = ar_px * 2.0;
  bool mir = u_mosaicMirror > 0.5;
  vec2 t = vec2(q.x, -q.y) * 2.0;
  vec4 tile;
  vec3 mv;
  float dir = u_mosaicScrollDir == MOSAICSCROLLDIR_GROUPS ? 1.0 : u_mosaicScrollDir == MOSAICSCROLLDIR_MIDDLE ? 2.0 : 0.0;
  vec4 mo = vec4(u_mosaicScroll, dir, u_mosaicStep, u_mosaicCascade);
  vec3 col = arA_plaid(t, u_mosaicWide, u_mosaicShift, u_mosaicLead, u_mosaicTiles, mir, 0.0,
                       0.08 * u_paint, px, mo, 0.0, tile, mv);
  // flat brush strokes running across each tile (travelling with the tiles when the columns scroll)
  float bf = u_paint * (1.0 - smoothstep(0.025, 0.06, px));
  if (bf > 0.0) {
    float ns = pg_noise(vec2(t.x * 1.3, mv.x * 7.0) + 2.7);
    if (mv.y != mv.x) ns = mix(ns, pg_noise(vec2(t.x * 1.3, mv.y * 7.0) + 2.7), mv.z);
    col *= 1.0 + 0.05 * bf * ns;
  }
  // soft painted relief round each tile (Relief × light): the lit edges lighten and the shadowed edges darken over a
  // short gradient, like a slightly pillowed gouache tile — no crisp bevel line
  float bw = 0.16;
  float rf = 1.0 - smoothstep(0.3 * bw, 0.8 * bw, px);
  if (rf > 0.0 && u_relief > 0.0) {
    vec2 e = max(vec2(tile.z, 0.5) - abs(tile.xy), 0.0);
    vec2 c = 1.0 - smoothstep(0.0, bw, e);
    vec2 n = sign(tile.xy) * c * c;
    col = ar_face(col, vec2(n.x, -n.y) * 0.5 * rf);
  }
  col = ar_seam(col, tile.w * 0.5);
  float fd = smoothstep(0.8, 3.0, px);
  return fd > 0.0 ? mix(col, arA_mean(mir), fd) : col;
}
`,
    presets: [
      {
        name: 'Plaid Mosaic',
        values: {
          colors: ['#697b7e', '#aab2cd', '#d2d2db', '#f0eaee', '#f5d0a6', '#c6a691', '#8f7976', '#6f6265', '#33422a', '#4f5e48'],
          size: 0.146, stretch: 1, slant: 0, mosaicTiles: 12, mosaicWide: 2, mosaicShift: 0.67, mosaicLead: 1, mosaicMirror: false,
          gap: 0, relief: 0.1, paint: 0.45,
        },
      },
      {
        name: 'Riviera Mosaic',
        values: {
          colors: ['#f6efe4', '#f0b98d', '#c96f5f', '#5b3a5e', '#23476b', '#6fa7a8'],
          size: 0.16, stretch: 1, slant: 0, mosaicTiles: 12, mosaicWide: 2, mosaicShift: 0.67, mosaicLead: 1, mosaicMirror: false,
          gap: 0, relief: 0.2, paint: 0.4,
        },
      },
      {
        // kinetic facade: column groups tick one tile at a time in opposite directions, the steps rippling across
        name: 'Departure Board',
        play: true,
        values: {
          colors: ['#f3ece0', '#e9c46a', '#e07a3f', '#9c3b3b', '#2b3a55', '#3f7f8c', '#a8cbc4'],
          size: 0.15, stretch: 1, slant: 0, mosaicTiles: 14, mosaicWide: 2, mosaicShift: 0.5, mosaicLead: 1, mosaicMirror: false,
          gap: 0.008, gapColor: '#1f2230', relief: 0.35, paint: 0.35,
          mosaicScroll: 0.8, mosaicScrollDir: 'groups', mosaicStep: 0.7, mosaicCascade: 0.25,
        },
      },
      {
        // Color rain, Jacob's ladder: the tiles stay put while waves of flips run down the columns; every wave moves
        // each colour down one tile (a wave every 3 s)
        name: "Jacob's Ladder",
        play: true,
        values: {
          colors: ['#1d2b4f', '#2f5d8a', '#5fa3b8', '#bfe0d4', '#f6efd9', '#f3c27a', '#e0844a', '#a8433c', '#5a2741'],
          size: 0.15, stretch: 1, slant: 0, mosaicTiles: 16, mosaicWide: 2, mosaicShift: 0.5, mosaicLead: 1, mosaicMirror: false,
          gap: 0.006, gapColor: '#1c1f2a', relief: 0.35, paint: 0.35,
          rain: 3, rainStyle: 'ladder', rainGap: 9, rainStagger: 0,
        },
      },
    ],
  });

  // ---------------------------------------------------------------- 2. Blurred Mosaic
  M.push({
    key: 'blurmosaic',
    label: 'Banded Mosaic',
    order: 6,
    common,
    params: [
      { id: 'blurmosaicSoft', label: 'Blur', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.25], help: 'Soften the tile edges (0 = sharp)' },
      { id: 'blurmosaicTiles', label: 'Ramp length', type: 'int', min: 2, max: 40, default: 12, random: [8, 18], help: 'Tiles in one full colour cycle — tiles beyond one per palette colour become blended in-between shades' },
      { id: 'blurmosaicWide', label: 'Wide bands', min: 0.5, max: 3, default: 1, step: 0.05, random: [0.75, 1.5], help: 'Height of the wide bands (the narrow bands are one tile high)' },
      { id: 'blurmosaicLead', label: 'Band offset', type: 'int', min: -3, max: 3, default: -1, random: [-2, -1], help: 'Tiles the narrow bands are moved along the colour ramp (0 = no weave, just stripes)' },
      { id: 'blurmosaicMirror', label: 'Mirror ramp', type: 'bool', default: true, random: 0.7, help: 'Walk the palette forward then back again (dark → light → dark) instead of wrapping round' },
      { id: 'blurmosaicDrift', label: 'Band drift', min: -3, max: 3, default: 0, step: 0.01, random: false, help: 'With Animate on, the bands slide sideways, in tiles per second (+ = to the right)' },
      { id: 'blurmosaicDriftDir', label: 'Drift pattern', type: 'select', options: [['together', 'All together'], ['groups', 'Groups in turn'], ['middle', 'Narrow against wide']], default: 'groups', random: false, showIf: (v) => v.blurmosaicDrift !== 0, help: 'With Animate on, which bands run which way: all the same way, every other band group the opposite way, or each narrow band against the wide bands round it' },
      { id: 'blurmosaicBreathe', label: 'Breathing', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, the light and dark parts of the colour ramp swell and shrink in turn: one slow breath every 4 s' },
    ],
    glsl: /* glsl */ `
// Blurred Mosaic — palette = the colour ramp, read left → right (c0 first; mirrored by default).
vec3 ar_blurmosaic(vec2 q) {
  float px = ar_px * 2.0;
  bool mir = u_blurmosaicMirror > 0.5;
  vec2 t = q.yx * 2.0;
  vec4 tile;
  vec3 mv;
  float dir = u_blurmosaicDriftDir == BLURMOSAICDRIFTDIR_GROUPS ? 1.0 : u_blurmosaicDriftDir == BLURMOSAICDRIFTDIR_MIDDLE ? 2.0 : 0.0;
  float br = arA_breath(u_blurmosaicBreathe, arA_cycle(u_blurmosaicTiles, mir));
  vec3 col = arA_plaid(t, u_blurmosaicWide, 0.0, u_blurmosaicLead, u_blurmosaicTiles, mir,
                       0.5 * u_blurmosaicSoft, 0.25 * u_paint, px, vec4(u_blurmosaicDrift, dir, 0.0, 0.0), br, tile, mv);
  float sb = max(0.5 * u_blurmosaicSoft, 0.0);
  // soft painted modelling (Relief × light): each tile is a low cushion whose rim slopes down into the joint — the
  // slope facing the light is a touch lighter, the other a touch darker. The slope is zero right at the joint, so the
  // shading crosses it smoothly and stays as soft as the blur.
  float rw = 0.14 + 0.8 * sb;
  float rf = 1.0 - smoothstep(0.3 * rw, 0.8 * rw, px);
  if (rf > 0.0 && u_relief > 0.0) {
    vec2 e = clamp(vec2(0.5 - abs(tile.y), tile.z - abs(tile.x)) / rw, 0.0, 1.0);   // (side edges, band edges)
    vec2 k = 4.0 * e * (1.0 - e);
    col = ar_face(col, vec2(sign(tile.y), sign(tile.x)) * k * 0.22 * rf);
  }
  // dry-brush streaks down each column, restarting in every band — faint while sharp, fuller as Blur goes up
  float bf = u_paint * (1.0 - smoothstep(0.07, 0.16, px)) * mix(0.25, 1.0, smoothstep(0.0, 0.3, u_blurmosaicSoft));
  if (bf > 0.0) {
    float band = arA_lane(t.x, u_blurmosaicWide, 0.0, u_blurmosaicLead).w;
    vec2 sp = vec2(mv.x * 5.0, t.x * 0.6 + band * 1.7);   // mv.x: along the band, travelling with it
    float s = pg_noise(sp) + 0.5 * pg_noise(sp * vec2(2.3, 1.6) + 5.3) + 0.5 * pg_noise(vec2(t.x, mv.x) * 1.3 + band * 0.9);
    col += bf * s * (0.04 + 0.03 * col);
  }
  // mortar, blurred like the tiles (spread over the softness but keeping its weight)
  if (u_gap > 0.0 && sb > 0.02) {
    float w = u_gap;                                   // half-width in tile units (1 cell = 2 tiles)
    vec2 c = 1.0 - smoothstep(0.0, w + sb, vec2(tile.z - abs(tile.x), 0.5 - abs(tile.y)));
    col = mix(col, u_gapColor, min(1.0, 2.0 * w / (w + sb)) * (1.0 - (1.0 - c.x) * (1.0 - c.y)));
  } else col = ar_seam(col, tile.w * 0.5);
  float fd = smoothstep(0.8, 3.0, px);
  return fd > 0.0 ? mix(col, arA_far(mir, arA_cycle(u_blurmosaicTiles, mir), br), fd) : col;
}
`,
    presets: [
      {
        name: 'Banded Mosaic',
        values: {
          colors: ['#16111a', '#212230', '#20334a', '#22445c', '#265671', '#2b6688', '#35799f'],
          size: 0.18, stretch: 1.1, slant: 0, blurmosaicSoft: 0, blurmosaicTiles: 12, blurmosaicWide: 1, blurmosaicLead: -1, blurmosaicMirror: true,
          gap: 0, relief: 0.2, paint: 0.2,
        },
      },
      {
        name: 'Ember Mosaic',
        values: {
          colors: ['#170c12', '#33121f', '#5e1d2c', '#8e3134', '#b9543a', '#d98447', '#ecb466'],
          size: 0.2, stretch: 1, slant: 0, blurmosaicSoft: 0, blurmosaicTiles: 12, blurmosaicWide: 1, blurmosaicLead: -1, blurmosaicMirror: true,
          gap: 0, relief: 0.2, paint: 0.2,
        },
      },
      {
        name: 'Soft Focus Mosaic',
        values: {
          colors: ['#16111a', '#212230', '#20334a', '#22445c', '#265671', '#2b6688', '#35799f'],
          size: 0.18, stretch: 1.1, slant: 0, blurmosaicSoft: 0.35, blurmosaicTiles: 12, blurmosaicWide: 1, blurmosaicLead: -1, blurmosaicMirror: true,
          gap: 0, relief: 0.2, paint: 0.5,
        },
      },
      {
        // glowing bands sliding past each other while the ramp breathes
        name: 'Ember Breath',
        play: true,
        values: {
          colors: ['#170c12', '#33121f', '#5e1d2c', '#8e3134', '#b9543a', '#d98447', '#ecb466'],
          size: 0.2, stretch: 1, slant: 0, blurmosaicSoft: 0.15, blurmosaicTiles: 12, blurmosaicWide: 1, blurmosaicLead: -1, blurmosaicMirror: true,
          gap: 0, relief: 0.2, paint: 0.3,
          blurmosaicDrift: 0.5, blurmosaicDriftDir: 'groups', blurmosaicBreathe: 0.6,
        },
      },
      {
        // Color rain, Pour: the colours flow left → right through soft, fixed tiles; a slight stagger sends a ripple
        // of wipes across the bands
        name: 'Lagoon Pour',
        play: true,
        values: {
          colors: ['#0e1b26', '#123447', '#16586a', '#2f8a86', '#7fbf9c', '#e6d9a2', '#f2b880'],
          size: 0.2, stretch: 1, slant: 0, blurmosaicSoft: 0.3, blurmosaicTiles: 12, blurmosaicWide: 1, blurmosaicLead: -1, blurmosaicMirror: true,
          gap: 0, relief: 0.25, paint: 0.35,
          rain: 0.6, rainStyle: 'pour', rainStagger: 0.1,
        },
      },
    ],
  });
})();
