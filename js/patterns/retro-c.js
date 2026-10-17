/* Retro styles (c): Pill Ribbons, Square Hourglass, Scallop Waves.
 * Registered into the Retro card (js/patterns/retro.js). Each style is `vec3 rt_<key>(vec2 q)` with q in cell units
 * (Size / Stretch / Slant already applied). Helper names are prefixed rt_<key>_ so they can't collide. */
(function () {
  'use strict';
  const M = (PG.retroModes = PG.retroModes || []);

  // ---------------------------------------------------------------------------------------------------------------
  // Pill Ribbons — columns of right-angled wedges between diagonal ochre ribbons; the pale wedges carry
  // semicircular caps that poke into the next row, so every row boundary becomes a wave of rounded pill ends.
  // Construction (one column W × one row H, H = W × length): the row is split into two half-rows and two
  // half-columns; each of the four rectangles is cut corner-to-corner by a "\" diagonal. Upper half: the upper-right
  // wedges are coloured (pill, dark, pill, dark…), lower half: the lower-left wedges (dark, pill, …); everything else
  // is the ribbon colour. Pill wedges meet tip-to-tip as a bow-tie, so do the dark ones.
  // Colours: 0 = pills (pale cream), 1 = ribbons / field (ochre), 2 = dark wedges (brown).
  // With a 2-colour palette the dark wedges take the field colour, so the pills still read as capsules.
  M.push({
    key: 'pills',
    label: 'Pill Ribbons',
    order: 5,
    params: [
      { id: 'pillsLength', label: 'Pill length', min: 1.5, max: 5, default: 2.95, step: 0.01, random: [2.3, 3.6], help: 'Row height relative to the column width (keeps the caps round, unlike Stretch)' },
    ],
    glsl: /* glsl */ `
// exact SDF of the triangle (-a,b), (0,b), (0,0)  [upper wedge of a bow-tie centred at the origin]
float rt_pills_tri(vec2 p, float a, float b) {
  vec2 p0 = vec2(-a, b), p1 = vec2(0.0, b), p2 = vec2(0.0);
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
// upper pill wedge + its semicircular cap (disk on the base, clipped by the slanted side so it never bulges past it)
float rt_pills_pill(vec2 p, float a, float b) {
  float t = rt_pills_tri(p, a, b);
  float diag = (-b * p.x - a * p.y) * inversesqrt(a * a + b * b);
  float cap = max(length(p - vec2(-0.5 * a, b)) - 0.5 * a, diag);
  return min(t, cap);
}
// bow-tie (upper wedge + the same wedge turned 180°), with or without caps
float rt_pills_bow(vec2 p, float a, float b, bool caps) {
  return caps ? min(rt_pills_pill(p, a, b), rt_pills_pill(-p, a, b)) : min(rt_pills_tri(p, a, b), rt_pills_tri(-p, a, b));
}
vec3 rt_pills(vec2 q) {
  float len = clamp(u_pillsLength, 1.0, 8.0);
  float W = inversesqrt(len);          // column width; one column x row repeat = 1 cell of area
  float H = W * len;
  float a = 0.5 * W, b = 0.5 * H;
  vec2 per = vec2(W, H);
  // pale bow-ties are centred at (a, b) + k*per, dark ones half a column further right
  vec2 pc = q - vec2(a, b);
  pc -= per * floor(pc / per + 0.5);
  vec2 pcn = pc - vec2(0.0, (pc.y > 0.0 ? H : -H));   // the nearer row above/below (caps reach across rows)
  float dPill = min(rt_pills_bow(pc, a, b, true), rt_pills_bow(pcn, a, b, true));
  vec2 pb = q - vec2(W, b);
  pb -= per * floor(pb / per + 0.5);
  vec2 pbn = pb - vec2(0.0, (pb.y > 0.0 ? H : -H));
  float dDark = min(rt_pills_bow(pb, a, b, false), rt_pills_bow(pbn, a, b, false));

  vec3 cDark = u_colors_count > 2 ? rt_c(2) : rt_c(1);   // 2-colour palette: dark wedges merge into the field
  vec3 col = rt_c(1);
  col = mix(col, cDark, rt_fill(dDark));
  col = mix(col, rt_c(0), rt_fill(dPill));
  col = rt_seam(col, min(abs(dPill), abs(max(dDark, -dPill))));

  // far away: settle to the average colour instead of shimmering
  if (u_tf_aa > 0.5) {
    float capShare = 3.14159265 * a / (16.0 * b);
    vec3 avg = rt_c(1) * 0.5 + rt_c(0) * (0.25 + capShare) + cDark * (0.25 - capShare);
    col = mix(col, avg, smoothstep(0.2, 0.7, rt_px / a));
  }
  return col;
}
`,
    presets: [
      {
        name: 'Golden Pill Ribbons',
        // scale measured from the photo (de-rotated 2.5°): column 117 px, row 342 px on a 1168 px tall frame
        values: { colors: ['#ecdf9c', '#b08406', '#38270f'], size: 0.3425, stretch: 1, slant: 0, gap: 0, gapColor: '#ecdf9c', print: 0.3, pillsLength: 2.92 },
      },
      {
        name: 'Avocado Pills',
        values: { colors: ['#f1e8c8', '#7b8a2c', '#2e2a17'], size: 0.42, stretch: 1, slant: 0, gap: 0, gapColor: '#f1e8c8', print: 0.3, pillsLength: 3.2 },
      },
    ],
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Square Hourglass — a checkerboard of mitred square frames. Each cell = a frame of four trapezoid bars around a
  // core square cut into an hourglass by its diagonals. In one cell the horizontal bars are colour 0 and the
  // vertical bars colour 1, and the core's top/bottom triangles are colour 1, left/right colour 0; the neighbouring
  // cells are the same motif turned 90°, so the bars read as two-tone stripes woven over and under.
  // (The colour is the XOR of three splits: diagonals, core-vs-frame and the checkerboard.)
  // Colours: 0 = light (yellow), 1 = dark (orange).
  M.push({
    key: 'hourglass',
    label: 'Square Hourglass',
    order: 7,
    params: [
      { id: 'hourglassCore', label: 'Core size', min: 0.1, max: 0.42, default: 0.25, step: 0.005, random: [0.2, 0.32], help: 'Half-size of the hourglass square in the middle of each frame' },
    ],
    glsl: /* glsl */ `
vec3 rt_hourglass(vec2 q) {
  float k = clamp(u_hourglassCore, 0.02, 0.48);
  vec2 id = floor(q);
  vec2 c = q - id - 0.5;
  vec2 ac = abs(c);
  float dX = (ac.x - ac.y) * 0.70710678;     // + in the left/right quarters (the X through the cell)
  float dS = pg_sdBox(c, vec2(k));            // + in the frame, - in the core
  float dC = 0.5 - max(ac.x, ac.y);           // distance to the cell edge
  float chk = mod(id.x + id.y, 2.0) < 0.5 ? 1.0 : -1.0;
  float s = chk * (2.0 * rt_fill(-dX) - 1.0) * (2.0 * rt_fill(-dS) - 1.0) * (2.0 * rt_fill(-dC) - 1.0);
  vec3 col = mix(rt_c(0), rt_c(1), 0.5 + 0.5 * s);
  col = rt_seam(col, min(min(abs(dX), abs(dS)), dC));
  if (u_tf_aa > 0.5) {
    float f = max(min(k, 0.5 - k), 0.1);   // thinnest band (bars or core), floored so a thin frame doesn't wash out the rest
    col = mix(col, 0.5 * (rt_c(0) + rt_c(1)), smoothstep(0.2, 0.7, rt_px / f));
  }
  return col;
}
`,
    presets: [
      {
        name: 'Marigold Hourglass',
        // fitted to the photo: 74 px cells on a 470 px tall frame, core half-size 0.25 (95% of pixels agree)
        values: { colors: ['#e9d060', '#e59f36'], size: 0.314, stretch: 1, slant: 0, gap: 0, gapColor: '#e9d060', print: 0.3, hourglassCore: 0.25 },
      },
      {
        name: 'Cocoa Hourglass',
        values: { colors: ['#eed6a8', '#8c4a25'], size: 0.26, stretch: 1, slant: 0, gap: 0.006, gapColor: '#f5e6c6', print: 0.35, hourglassCore: 0.25 },
      },
    ],
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Scallop Waves — horizontal rows, each cut by "\" diagonals into dark-red ribbons alternating with a pale wedge
  // (wide at the bottom) and a black wedge (wide at the top). The pale/black border is a circular arc; the arcs
  // alternate convex/concave from row to row, so down the page they join into a smooth wave running down-left.
  // Each row starts 0.82 h further left than the one above (rows h tall, horizontal period = length × h), as measured
  // from the reference print; the arcs pass through both row corners and join with matching tangents.
  // Colours: 0 = scallops (cream), 1 = ribbons (maroon), 2 = wedges (black).
  // With a 2-colour palette the black wedges take the ribbon colour, so the cream scallops still show the wave.
  M.push({
    key: 'scallops',
    label: 'Scallop Waves',
    order: 9,
    params: [
      { id: 'scallopsLength', label: 'Wedge length', min: 3, max: 12, default: 6.5, step: 0.05, random: [5, 8.5], help: 'Horizontal repeat relative to the row height' },
    ],
    glsl: /* glsl */ `
vec3 rt_scallops_c2() { return u_colors_count > 2 ? rt_c(2) : rt_c(1); }   // wedge colour (2-colour fallback)
// colour of one row at local position (x, v): v = depth below the row top (0..h), x already un-shifted.
// odd selects the arc type. sd returns the distance to the nearest edge inside the row (for seams).
vec3 rt_scallops_row(float x, float v, bool odd, float h, float P, float dd, float R, out float sd) {
  float s = 0.5 * P - dd;                         // ribbon drift across one row
  float lx = s * v / h;                           // ribbon left edge
  float kk = inversesqrt(1.0 + (s / h) * (s / h));
  float dm = (abs(mod(x - lx + 0.25 * P, P) - 0.5 * P) - 0.25 * P) * kk;   // < 0 inside the ribbon
  float xz = x - P * floor((x - lx + 0.75 * P) / P);                        // x in [lx - .75P, lx + .25P)
  float xa, dist;
  if (odd) {   // black side convex: circle centred left of the arc, level with the row top
    xa = -R + sqrt(max(R * R - v * v, 0.0));
    dist = abs(length(vec2(xz + R, v)) - R);
  } else {     // cream side convex: circle centred right of the arc, level with the row bottom
    xa = (R - dd) - sqrt(max(R * R - (h - v) * (h - v), 0.0));
    dist = abs(length(vec2(xz - (R - dd), v - h)) - R);
  }
  dist = max(dist, max(-dd - xz, xz));            // the arc only spans x in [-dd, 0]
  float da = xz > xa ? -dist : dist;              // < 0 on the cream side
  vec3 col = rt_scallops_c2();
  col = mix(col, rt_c(0), rt_fill(da));
  col = mix(col, rt_c(1), rt_fill(dm));
  sd = min(abs(dm), max(abs(da), -dm));
  return col;
}
vec3 rt_scallops(vec2 q) {
  float h = 0.5;                                  // row height: two rows (one full wave) per cell
  float P = h * clamp(u_scallopsLength, 2.0, 20.0);
  float dd = 0.82 * h;                            // each row starts this much further left
  float R = (h * h + dd * dd) / (2.0 * dd);       // arc radius through both row corners
  float yd = -q.y;
  float n = floor(yd / h);
  float v = yd - n * h;
  float sd, sdn;
  vec3 col = rt_scallops_row(q.x + n * dd, v, mod(n, 2.0) > 0.5, h, P, dd, R, sd);
  // blend with the neighbouring row across the nearer horizontal boundary
  float nb = v < 0.5 * h ? n - 1.0 : n + 1.0;
  vec3 coln = rt_scallops_row(q.x + nb * dd, v < 0.5 * h ? h : 0.0, mod(nb, 2.0) > 0.5, h, P, dd, R, sdn);
  float e = min(v, h - v);
  col = mix(coln, col, rt_fill(-e));
  col = rt_seam(col, min(sd, e));
  if (u_tf_aa > 0.5) {
    vec3 avg = 0.5 * rt_c(1) + 0.25 * (rt_c(0) + rt_scallops_c2());
    col = mix(col, avg, smoothstep(0.12, 0.45, rt_px / h));
  }
  return col;
}
`,
    presets: [
      {
        name: 'Burgundy Scallop Waves',
        // scale measured from the photo: rows 38 px, horizontal repeat 246 px on a 522 px tall frame
        values: { colors: ['#f4da84', '#722311', '#15180f'], size: 0.293, stretch: 1, slant: 0, gap: 0, gapColor: '#f4da84', print: 0.3, scallopsLength: 6.45 },
      },
      {
        name: 'Ocean Scallops',
        values: { colors: ['#f1e6c8', '#1f6a72', '#0f1d2b'], size: 0.26, stretch: 1, slant: 0, gap: 0, gapColor: '#f1e6c8', print: 0.3, scallopsLength: 7 },
      },
    ],
  });
})();
