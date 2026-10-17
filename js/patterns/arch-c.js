/* Architecture styles (c): Studded Facade, Slate Shingles.
 * Registered into the Architecture card (js/patterns/architecture.js). Each style is `vec3 ar_<key>(vec2 q)` with q in
 * cell units (Size / Stretch / Slant already applied). Private helpers are prefixed arC_. */
(function () {
  'use strict';
  const M = (PG.archModes = PG.archModes || []);
  // Each style's body is written once and emitted three times: as the still style, as an animated copy (moving parts
  // swapped in) that runs only while one of its motion params is on, and as a Color rain copy (colours carried in
  // from the tiles above; its own motions still run) used while Color rain is on — so the still image stays bit-identical.
  const swap = (s, a, b) => {
    if (!s.includes(a)) throw new Error('arch-c: template is missing ' + a);
    return s.split(a).join(b);
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Studded Facade — a wall of square pyramid studs (four flat facets meeting at a small light dot), with square
  // inset windows replacing one stud every few columns / rows. Each window: a flat painted frame, a shallow reveal
  // and a glass pane with its own vertical gradient picked from Glass.
  // Colours: 0 = stud body (the hue of the lit facets), 1 = stud shadow (the hue of the facets turned from the light),
  // 2 = window frame, 3 = apex dot.

  // body of ar_studs (still) / arC_studsM (animated: the studs and windows under the passing lamps / twinkling)
  const STUDS = /* glsl */ `  float H = max(u_studsHeight, 0.0);
  float h = 2.0 * H * inversesqrt(1.0 + 4.0 * H * H);   // pyramid with half-width 0.5 and height H
  float C = max(floor(u_studsCols + 0.5), 1.0), R = max(floor(u_studsRows + 0.5), 1.0);
  float hw = 0.53;                                       // window outer half-size: the frame overlaps the studs a little
  float pin = hw - clamp(u_studsFrame, 0.0, 0.48);
  float fd = smoothstep(0.1, 0.3, ar_px);                // facets / reveals / dots → flat averages
  float fg = smoothstep(0.45, 1.3, ar_px);               // whole wall → one average colour (no moiré far away)

  vec3 mean = vec3(0.0);
  if (fg > 0.0) {
    vec3 dk = arC_studDark();
    vec3 sm = 0.25 * (arC_shade(ar_c(0), dk, vec2(0.0, h)) + arC_shade(ar_c(0), dk, vec2(0.0, -h)) +
                      arC_shade(ar_c(0), dk, vec2(-h, 0.0)) + arC_shade(ar_c(0), dk, vec2(h, 0.0)));
    mean = mix(sm, arC_winMean(pin, hw), clamp(u_studsWindows / (C * R), 0.0, 1.0));
    if (fg >= 1.0) return mean;
  }

  // studs, with each cell edge anti-aliased against the neighbouring stud
  vec2 id = floor(q), f = q - id - 0.5;
  vec2 o = vec2(f.x >= 0.0 ? 1.0 : -1.0, f.y >= 0.0 ? 1.0 : -1.0);
  float ax = ar_fill(abs(f.x) - 0.5), ay = ar_fill(abs(f.y) - 0.5);
  vec3 col = arC_stud(id, f, h, fd);
  if (ax < 1.0) col = mix(arC_stud(id + vec2(o.x, 0.0), f - vec2(o.x, 0.0), h, fd), col, ax);
  if (ay < 1.0) {
    vec3 c1 = arC_stud(id + vec2(0.0, o.y), f - vec2(0.0, o.y), h, fd);
    if (ax < 1.0) c1 = mix(arC_stud(id + o, f - o, h, fd), c1, ax);
    col = mix(c1, col, ay);
  }
  // apex dot (energy-conserving when smaller than a pixel)
  float r = 0.055, rr = max(r, 0.5 * ar_px);
  col = mix(col, ar_c(3), ar_fill(length(f) - rr) * (r * r) / (rr * rr) * (1.0 - fd));
  col = ar_seam(col, 0.5 - max(abs(f.x), abs(f.y)));

  // nearest window place: window rows every R rows, a window every C studs, shifted by Row stagger per window row
  float jr = floor((q.y - 0.5) / R + 0.5);
  float sh = floor(u_studsShift + 0.5) * jr;
  float mx = floor((q.x - 0.5 - sh) / C + 0.5);
  vec2 wid = vec2(mx, jr);
  if (pg_hash12(wid + vec2(0.0, 0.5)) < u_studsWindows) {
    vec2 w = q - (vec2(mx * C + sh, jr * R) + 0.5);
    float cov = ar_fill(max(abs(w.x), abs(w.y)) - hw);
    if (cov > 0.0) col = mix(col, arC_window(wid, w, hw, pin, fd), cov);
  }
  return mix(col, mean, fg);
`;
  const STUDS_M = swap(swap(STUDS, 'arC_stud(', 'arC_studM('), 'arC_window(wid, w, hw, pin, fd)', 'arC_windowM(wid, w, q - w, hw, pin, fd)');
  // Color rain copy: studs and windows wear the tones / glass of the ones above them (lamps and twinkle still run)
  const STUDS_R = swap(swap(STUDS, 'arC_stud(', 'arC_studR('), 'arC_window(wid, w, hw, pin, fd)', 'arC_windowR(wid, w, vec2(mx * C + sh, jr * R), hw, pin, fd)');

  // Color rain helpers shared by both styles
  const RAIN = /* glsl */ `
// Color rain: +1 when the colours rain down, −1 when they rise (rows / window rows / column heights grow upward in q)
float arC_rainDir() { return u_rain < 0.0 ? -1.0 : 1.0; }
// A tile mid-flip — ar_rainTile with the wipe edge anti-aliased from ar_px instead of fwidth (these tiles are also
// evaluated inside the neighbour anti-aliasing branches, where derivatives are undefined). aa = ar_px in v units.
vec3 arC_flip(vec3 from, vec3 to, float wipe, float v, float aa) {
  return ar_rainLook(from, to, wipe, u_rain < 0.0 ? 1.0 - v : v, aa);   // shared Pour / Jacob's-ladder look
}
`;

  M.push({
    key: 'studs',
    label: 'Studded Facade',
    order: 2,
    common: RAIN,
    params: [
      { id: 'studsHeight', label: 'Stud height', min: 0.05, max: 2, default: 0.6, step: 0.01, random: [0.35, 1.1], help: 'Pyramid height — steeper studs have stronger lit / shaded facets' },
      { id: 'studsCols', label: 'Window spacing', type: 'int', min: 1, max: 12, default: 3, random: [2, 5], help: 'A window every N studs along a row' },
      { id: 'studsRows', label: 'Window rows', type: 'int', min: 1, max: 8, default: 2, random: [1, 3], help: 'A row of windows every N rows of studs' },
      { id: 'studsShift', label: 'Row stagger', type: 'int', min: 0, max: 6, default: 0, random: [0, 2], help: 'Shift the windows sideways by N studs on each successive window row' },
      { id: 'studsWindows', label: 'Windows', min: 0, max: 1, default: 1, step: 0.01, random: [0.65, 1], help: 'Share of the window places that actually hold a window' },
      { id: 'studsFrame', label: 'Frame width', min: 0, max: 0.3, default: 0.125, step: 0.005, random: [0.07, 0.15], help: 'Width of the painted window frame (in studs)' },
      { id: 'studsWave', label: 'Light ripple', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, lamps glide along the wall: each stud brightens and its facets swing round as a light passes by (loops every 4 s)' },
      { id: 'studsTwinkle', label: 'Window twinkle', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, windows now and then catch the light and fade to another colour from Glass (higher = more often; loops every 8 s)' },
    ],
    glsl: /* glsl */ `
// Painted facet, gouache-style: the value follows the light (lit facets pale toward white, shaded ones sink to the
// shadow colour) while the hue flips like a painter's warm / cool split — facets turned toward the light keep the body
// hue, facets turned away take the shadow hue, even when they are only slightly darker. n = outward 2D normal.
vec3 arC_shade(vec3 body, vec3 dark, vec2 n) {
  float k = clamp(dot(n, ar_light) * u_relief * 1.8, -1.0, 1.0);
  float lb = pg_luma(body), ld = pg_luma(dark);
  float L = k >= 0.0 ? mix(lb, lb + 0.36 * (1.0 - lb), k) : mix(lb, ld, -k);
  vec3 ch = mix(dark - ld, (body - lb) * (1.0 - 0.25 * max(k, 0.0)), smoothstep(-0.2, 0.2, k));
  return max(vec3(L) + ch, 0.0);
}
// Shadow colour (palette 1), kept clearly darker than the body even when the palette has it lighter.
vec3 arC_studDark() {
  vec3 b = ar_c(0), d = ar_c(1);
  float lb = pg_luma(b), ld = pg_luma(d);
  return ld > 0.72 * lb ? d * (0.72 * lb / max(ld, 1e-3)) : d;
}
// One pyramid stud. id = cell, f = position from the apex (may lie a little outside the cell, for edge AA),
// h = 2D length of the facet normals (from the stud height), fd = 1 → flatten to the stud's average colour.
float arC_tone = 0.06;                                   // stud-to-stud tone spread (raised while Color rain carries it)
vec3 arC_stud(vec2 id, vec2 f, float h, float fd) {
  vec3 hv = pg_hash32(id) - 0.5, hw = pg_hash32(id + vec2(0.5, 0.0)) - 0.5;
  float v = arC_tone * hv.x;                           // hand-painted: each stud a touch lighter / darker…
  vec3 body = ar_c(0) * (1.0 + v), dark = arC_studDark() * (1.0 + v);
  vec3 top = arC_shade(body, dark, vec2(0.0, h)) * (1.0 + 0.045 * hv.y);   // …and each facet laid on separately
  vec3 bot = arC_shade(body, dark, vec2(0.0, -h)) * (1.0 + 0.045 * hv.z);
  vec3 lef = arC_shade(body, dark, vec2(-h, 0.0)) * (1.0 + 0.045 * hw.x);
  vec3 rig = arC_shade(body, dark, vec2(h, 0.0)) * (1.0 + 0.045 * hw.y);
  // the facets meet on the two diagonals |x| = |y|
  vec3 col = mix(f.y >= 0.0 ? top : bot, f.x >= 0.0 ? rig : lef, ar_fill((abs(f.y) - abs(f.x)) * 0.70710678));
  return mix(col, 0.25 * (top + bot + lef + rig), fd);
}

// pale end of a pane's gradient: the glass colour greyed and lightened, like sky reflected in it
vec3 arC_pale(vec3 c) { return mix(vec3(pg_luma(c)), c, 0.5) + 0.2; }

// Average window colour (frame + glass) for the far-away fade.
vec3 arC_winMean(float pin, float hw) {
  vec3 g = vec3(0.0);
  for (int k = 0; k < 4; k++) { vec3 c = ar_glass(0.125 + 0.25 * float(k)); g += 0.6 * c + 0.4 * arC_pale(c); }
  return mix(ar_c(2), 0.25 * g, clamp(pin * pin / (hw * hw), 0.0, 1.0));
}

// Window centred on the origin (w = position, cell units): frame, shallow reveal, gradient glass. wid = window id.
vec3 arC_window(vec2 wid, vec2 w, float hw, float pin, float fd) {
  float rv = min(0.03, pin * 0.25);                     // reveal width
  float m = max(abs(w.x), abs(w.y));
  vec2 nf = abs(w.x) > abs(w.y) ? vec2(sign(w.x), 0.0) : vec2(0.0, sign(w.y));   // outward side of the square
  vec3 frame = ar_face(ar_c(2), nf * 0.12);
  // the reveal slopes down into the window: its normal points inward, so the sides facing the light's source fall in shadow
  float kw = clamp(-dot(-nf, ar_light) * u_relief * 1.8, 0.0, 1.0);
  vec3 wall = mix(frame, mix(arC_studDark(), ar_c(2), 0.35) * 0.85, 0.7 * kw);

  // glass: a vertical gradient per pane. Most panes run from a deep colour of Glass at the top to a pale, greyed
  // reflection at the bottom; about a third are reversed — pale at the top, sinking to a second, deeper colour.
  vec3 g = pg_hash32(wid);
  float gi = pin - rv;
  float e = clamp(0.5 - w.y / max(2.0 * gi, 1e-4), 0.0, 1.0);   // 0 at the top .. 1 at the bottom
  float N = 6.0;                                                 // softly stepped, like layered gouache
  float es = (floor(e * N) + smoothstep(0.2, 0.8, fract(e * N))) / N;
  vec3 deep = ar_glass(g.x);
  float amt = 0.5 + 0.5 * g.y;
  vec3 c0, c1;
  if (g.z < 0.33) { c0 = mix(deep, arC_pale(deep), 0.85); c1 = ar_glass(fract(g.x + 0.25 + 0.5 * g.y)) * 0.85; }
  else { c0 = deep; c1 = mix(deep, arC_pale(deep), amt); }
  vec3 glass = mix(mix(c0, c1, es), 0.5 * (c0 + c1), fd);
  // a soft shadow cast on the glass by the reveal (toward the side away from the light)
  vec2 wl = w + ar_light * (0.05 * u_relief);
  float sh = 1.0 - ar_fill(max(abs(wl.x), abs(wl.y)) - gi);
  glass *= 1.0 - 0.22 * sh * (1.0 - fd);

  vec3 col = mix(frame, wall, ar_fill(m - pin) * (1.0 - fd));
  return mix(col, glass, ar_fill(m - gi));
}

// --- motion: used only by the animated copy of the style (arC_studsM below) ---
// Light ripple: lamps glide diagonally along the wall, one every 11 studs, each passing a given stud every 4 s (so it
// loops). As a lamp goes by, a stud's light swings round from the lamp's side, over the top, to the other side while
// the stud brightens. Returns the light (2D) a stud / window centred at c sees, and how much the lamp lights it
// (0..1). Constant per stud, so the facets stay flat and the studs' edges stay anti-aliased.
vec3 arC_lamp(vec2 c) {
  vec2 dir = vec2(0.9104, 0.4138);                       // travel direction (≈ 24° above the horizontal)
  float u = fract(dot(c, dir) / 11.0 - u_time * 0.25) - 0.5;  // position relative to the nearest lamp, −0.5..0.5
  float a = clamp(u_studsWave, 0.0, 1.0) * (1.0 - smoothstep(0.06, 0.3, abs(u)));   // a band ~6 studs wide
  vec2 v = -dir * (11.0 * u) + vec2(-dir.y, dir.x) * 1.1;    // toward the lamp, which passes a little above the studs
  float r = inversesqrt(dot(v, v) + 1.0);                    // …at a distance of one stud from the wall
  return vec3(mix(ar_light, v * r, a), a * 2.1 * r * r);
}
// lamp light on a surface (g = arC_lamp().z): lifts darks and mid tones, eases pale ones toward white without clipping
// (cream frames keep their bevels); g = 0 leaves col unchanged
vec3 arC_lampLit(vec3 col, float g) {
  vec3 k = vec3(0.42 * g);
  return col * (1.0 + k) / (1.0 + k * col) + 0.04 * g * (1.0 - col);
}
// a stud under the passing lamps
// (one arC_stud per call: with Light ripple at 0 the lamp is (ar_light, 0), which leaves the stud as it is)
vec3 arC_studM(vec2 id, vec2 f, float h, float fd) {
  vec2 L0 = ar_light;
  vec3 lp = arC_lamp(id + 0.5);
  ar_light = lp.xy;
  vec3 col = arC_stud(id, f, h, fd);
  ar_light = L0;
  return arC_lampLit(col, lp.z);
}
// a window under the lamps (c = its centre) and / or twinkling: each window runs its own 2 s cycle (random offset);
// in each of the four cycles of an 8 s loop it shows its own glass or, with probability Twinkle, another one, and the
// change is a 0.6 s cross-fade with a soft flash of light on the pane.
vec3 arC_windowM(vec2 wid, vec2 w, vec2 c, float hw, float pin, float fd) {
  vec2 L0 = ar_light;
  vec3 lp = arC_lamp(c);
  ar_light = lp.xy;
  float ph = 0.5 * u_time + pg_hash12(wid + vec2(0.25, 0.75));
  float k = mod(floor(ph), 4.0), kp = mod(k + 3.0, 4.0), e = fract(ph) / 0.3;
  float pt = clamp(u_studsTwinkle, 0.0, 1.0);             // 0 → every window keeps its own glass (g0 = g1 = wid)
  vec2 g1 = pg_hash12(wid + vec2(0.5, k + 1.0)) < pt ? wid + vec2(0.0, 1024.0 * (k + 1.0)) : wid;
  vec2 g0 = pg_hash12(wid + vec2(0.5, kp + 1.0)) < pt ? wid + vec2(0.0, 1024.0 * (kp + 1.0)) : wid;
  vec3 col = arC_window(g1, w, hw, pin, fd);
  if (e < 1.0 && g0 != g1) {
    col = mix(arC_window(g0, w, hw, pin, fd), col, smoothstep(0.0, 1.0, e));
    float gi = pin - min(0.03, pin * 0.25);
    float fl = sin(PG_PI * e);
    col = mix(col, arC_pale(col) + 0.1, 0.55 * fl * fl * ar_fill(max(abs(w.x), abs(w.y)) - gi));
  }
  ar_light = L0;
  return arC_lampLit(col, lp.z);
}

// --- Color rain: used only by the rain copy of the style (arC_studsR below) ---
// While the rain carries the studs' tones they are spread wider, so the falling tones read
const float ARC_RAIN_TONE = 0.2;
// A stud in cell id wearing the tones of stud tid (the lamps of Light ripple still light it where it stands).
vec3 arC_studT(vec2 id, vec2 tid, vec2 f, float h, float fd) {
  arC_tone = ARC_RAIN_TONE;
  vec3 col;
  if (u_studsWave <= 0.0) col = arC_stud(tid, f, h, fd);
  else {
    vec2 L0 = ar_light;
    vec3 lp = arC_lamp(id + 0.5);
    ar_light = lp.xy;
    col = arC_lampLit(arC_stud(tid, f, h, fd), lp.z);
    ar_light = L0;
  }
  arC_tone = 0.06;
  return col;
}
// A stud under Color rain: it wears the tones of the stud 'steps' rows above it and, as a wave passes, flips over to
// those of the next stud up (rows count down the facade; upward rain mirrors it).
vec3 arC_studR(vec2 id, vec2 f, float h, float fd) {
  vec2 rn = ar_rain(vec2(id.x, -id.y));
  vec2 up = vec2(0.0, arC_rainDir());
  vec2 src = id + up * rn.x;
  if (rn.y >= 1.0) return arC_studT(id, src + up, f, h, fd);
  vec3 col = arC_studT(id, src, f, h, fd);
  return rn.y > 0.0 ? arC_flip(col, arC_studT(id, src + up, f, h, fd), rn.y, 0.5 - f.y, ar_px) : col;
}
// A window under Color rain: its pane shows the glass of the window place 'steps' window rows above and wipes over to
// the next one's as a wave passes; sid = the stud cell it stands in, so it flips with its row of studs.
vec3 arC_windowR(vec2 wid, vec2 w, vec2 sid, float hw, float pin, float fd) {
  vec2 rn = ar_rain(vec2(sid.x, -sid.y));
  vec2 up = vec2(0.0, arC_rainDir());
  vec2 g = wid + up * rn.x;
  if (rn.y >= 1.0) return arC_windowM(g + up, w, sid + 0.5, hw, pin, fd);
  vec3 col = arC_windowM(g, w, sid + 0.5, hw, pin, fd);
  return rn.y > 0.0 ? arC_flip(col, arC_windowM(g + up, w, sid + 0.5, hw, pin, fd), rn.y, 0.5 - 0.5 * w.y / hw, 0.5 * ar_px / hw) : col;
}

// the style: rain copy and animated copy (only while a motion param is on) and the still original (see swap() at the top)
vec3 arC_studsR(vec2 q) {
${STUDS_R}}
vec3 arC_studsM(vec2 q) {
${STUDS_M}}
vec3 ar_studs(vec2 q) {
  if (u_rain != 0.0) return arC_studsR(q);
  if (u_studsWave > 0.0 || u_studsTwinkle > 0.0) return arC_studsM(q);
${STUDS}}`,
    presets: [
      {
        name: 'Studded Facade',
        // measured from the painting: studs 29 × 28.7 px on a 200 px tall frame; a window every 3 studs, every 2 rows;
        // lit facets cool grey-green, shaded facets warm mauve / maroon
        values: {
          size: 0.29, stretch: 0.99, slant: 0, light: 98, relief: 0.75, gap: 0, paint: 0.7,
          colors: ['#7c8182', '#5f5058', '#e6b1b9', '#e2c7cd'],
          glass: { stops: [[0, '#5a2630'], [0.14, '#6b3540'], [0.26, '#8a5a62'], [0.34, '#2e2a5e'], [0.46, '#1d4088'], [0.58, '#2050a0'], [0.66, '#6f93c2'], [0.74, '#2a4a8c'], [0.84, '#4d4888'], [0.92, '#6e3a48'], [1, '#5a2630']], mode: 'smooth' },
          studsHeight: 0.6, studsCols: 3, studsRows: 2, studsShift: 0, studsWindows: 1, studsFrame: 0.12,
        },
      },
      {
        name: 'Sandstone Studs',
        values: {
          size: 0.24, stretch: 1, slant: 0, light: 120, relief: 0.7, gap: 0, paint: 0.45,
          colors: ['#c6b190', '#7a4c3c', '#efe3cc', '#f6ecd8'],
          glass: { stops: [[0, '#1d4549'], [0.3, '#2e7a74'], [0.6, '#86bdb0'], [0.8, '#d39a5c'], [1, '#2a3f5e']], mode: 'smooth' },
          studsHeight: 0.55, studsCols: 4, studsRows: 2, studsShift: 2, studsWindows: 0.85, studsFrame: 0.1,
        },
      },
      {
        // motion showcase: lamps gliding along a dusk facade, windows catching the light now and then
        name: 'Lamplit Studs',
        play: true,
        values: {
          size: 0.26, stretch: 1, slant: 0, light: 105, relief: 0.75, gap: 0, paint: 0.5,
          colors: ['#808b9c', '#3a3450', '#eadcc4', '#f4e3b6'],
          glass: { stops: [[0, '#1c2547'], [0.3, '#2d4f8a'], [0.55, '#7d9fc8'], [0.75, '#e0a85e'], [1, '#6b3a52']], mode: 'smooth' },
          studsHeight: 0.65, studsCols: 3, studsRows: 2, studsShift: 1, studsWindows: 0.9, studsFrame: 0.11,
          studsWave: 0.8, studsTwinkle: 0.45,
        },
      },
      {
        // Color rain showcase (Jacob's ladder): waves of studs and windows flip down the wall; with each wave every
        // pane takes the glass of the pane above it and every stud the tone of the stud above
        name: 'Glass Cascade',
        play: true,
        values: {
          size: 0.22, stretch: 1, slant: 0, light: 110, relief: 0.75, gap: 0, paint: 0.5,
          colors: ['#8b8f9c', '#3d3550', '#efe2cc', '#f6e6c2'],
          glass: { stops: [[0, '#173a5e'], [0.2, '#2f80a8'], [0.38, '#8fd1cf'], [0.55, '#f1c36a'], [0.7, '#e06f58'], [0.86, '#8b3b6b'], [1, '#173a5e']], mode: 'smooth' },
          studsHeight: 0.6, studsCols: 2, studsRows: 1, studsShift: 0, studsWindows: 1, studsFrame: 0.1,
          rain: 2.2, rainStyle: 'ladder', rainGap: 4, rainStagger: 0.08,
        },
      },
    ],
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Slate Shingles — columns of small parallelogram blocks: vertical sides, joints slanting down across each column,
  // in blue-grey tones. As in the painting, each column is a run of short dark blocks (1 cell tall) separated by one
  // to three field blocks that alternate mid (≈ 1.65 cells) and light (≈ 2.45 cells) — so the light blocks read as
  // broken vertical stripes. The dark blocks sit in places on a lattice (spacing "Shadow spacing") that is staggered
  // half a place against the neighbouring columns, so they never line up level with the next column's (they step
  // diagonally, corner to corner). Places come in pairs, each holding both / one / no dark block, which gives the
  // painting's mix of gaps (about half single blocks, 40 % pairs — mid directly above the dark block, light below it —
  // and a few triples, never more).
  // Colours are assigned by brightness, whatever their order: the darkest = dark blocks; of the others, the darker
  // half are mid tones and the lighter half light tones, picked at random per block.

  // body of ar_shingles (still) / arC_shinglesM (animated: the block colours with wind and tone drift)
  const SHINGLES = /* glsl */ `  arC_rank();                                             // rank the palette by brightness (n ≤ 10)

  float fg = smoothstep(0.3, 1.1, ar_px);
  vec3 mean = vec3(0.0);
  if (fg > 0.0) {
    mean = arC_shMean();
    if (fg >= 1.0) return mean;
  }
  // columns: unit width, each side nudged a little (hand-painted, uneven widths)
  float cw = 0.3 * clamp(u_shinglesJitter, 0.0, 1.0);
  float i = floor(q.x);
  float bl = i + cw * (pg_hash12(vec2(i, 0.5)) - 0.5);
  float br = i + 1.0 + cw * (pg_hash12(vec2(i + 1.0, 0.5)) - 0.5);
  if (q.x < bl) { i -= 1.0; br = bl; bl = i + cw * (pg_hash12(vec2(i, 0.5)) - 0.5); }
  else if (q.x >= br) { i += 1.0; bl = br; br = i + 1.0 + cw * (pg_hash12(vec2(i + 1.0, 0.5)) - 0.5); }
  float y = arC_shY(q);
  vec4 b = arC_shGet(i, y);
  vec3 col = arC_shCol(i, b, y);
  // AA across the nearest joint (perpendicular distance to the slanted line)
  float sj = inversesqrt(1.0 + u_shinglesDrop * u_shinglesDrop);
  float d0 = (y - b.y) * sj, d1 = (b.z - y) * sj;
  float dj = min(d0, d1);
  float aj = ar_fill(-dj);
  if (aj < 1.0) {
    // the block across the joint is usually known from the lookup above; otherwise look it up
    bool dn = d0 < d1;
    vec2 nb = dn ? arC_nb.xy : arC_nb.zw;
    vec4 b2 = dn ? vec4(nb.x, b.y - 2.0, b.y, nb.y) : vec4(nb.x, b.z, b.z + 2.0, nb.y);
    if (nb.x < -0.5) b2 = arC_shGet(i, dn ? b.y - 1e-3 : b.z + 1e-3);
    col = mix(arC_shCol(i, b2, y), col, aj);
  }
  // AA across the column side
  float dl = q.x - bl, dr = br - q.x;
  float dx = min(dl, dr);
  float ax = ar_fill(-dx);
  if (ax < 1.0) {
    float i2 = dl < dr ? i - 1.0 : i + 1.0;
    col = mix(arC_shCol(i2, arC_shGet(i2, y), y), col, ax);
  }
  col = ar_seam(col, min(dx, dj));
  return mix(col, mean, fg);
`;
  const SHINGLES_M = swap(SHINGLES, 'arC_shCol(', 'arC_shColM(');
  // Color rain copy: block tones travel down the columns (with Jacob's ladder the block across a joint is always looked
  // up properly: its true extent sets when a wave reaches it)
  const SHINGLES_R = swap(swap(SHINGLES, 'arC_shCol(', 'arC_shColR('), 'if (nb.x < -0.5) b2 = ', 'if (nb.x < -0.5 || u_rainStyle != RAINSTYLE_POUR) b2 = ');

  M.push({
    key: 'shingles',
    label: 'Slate Shingles',
    order: 3,
    params: [
      { id: 'shinglesDrop', label: 'Joint slant', min: -1.5, max: 1.5, default: 0.53, step: 0.01, random: [0.3, 0.8], help: 'How far each joint drops across one column, in dark-block heights' },
      { id: 'shinglesSpace', label: 'Shadow spacing', min: 2, max: 10, default: 2.85, step: 0.01, scale: 'log', random: [2.5, 3.6], help: 'Distance between the places for dark blocks along a column, in dark-block heights' },
      { id: 'shinglesDark', label: 'Shadow blocks', min: 0, max: 1, default: 0.64, step: 0.01, random: [0.45, 0.85], help: 'How many places hold a dark block (darkest colour): 0.5 = every other place, 1 = all of them' },
      { id: 'shinglesJitter', label: 'Irregularity', min: 0, max: 1, default: 0.9, step: 0.01, random: [0.5, 1], help: 'Hand-painted unevenness: block positions and lengths, column widths' },
      { id: 'shinglesWave', label: 'Wind', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, gusts sweep across the roof: the blocks they pass lift, catch the light and cast a shadow on the block below, then settle (loops every 8 s)' },
      { id: 'shinglesDrift', label: 'Tone drift', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'With Animate on, each block slowly lightens and darkens on its own rhythm, like light shifting over wet slate (loops every 8 s)' },
    ],
    glsl: /* glsl */ `
// Brightness ranks of the palette colours 0–9 (0 = darkest), packed in vectors and set once per pixel by arC_rank()
// (vector maths with constant indices instead of sorting an array in nested loops).
vec4 arC_ra = vec4(0.0), arC_rb = vec4(0.0), arC_rc = vec4(0.0);
int arC_n = 2;
vec3 arC_dk = vec3(0.0);                                 // the darkest colour
vec3 arC_col(int j) { return u_colors[j]; }              // j < 10 ≤ array size; unused slots are ranked last
// palette colour with brightness rank R
vec3 arC_byRankF(float R) {
  vec4 ma = 1.0 - step(0.5, abs(arC_ra - R)), mb = 1.0 - step(0.5, abs(arC_rb - R)), mc = 1.0 - step(0.5, abs(arC_rc - R));
  return arC_col(0) * ma.x + arC_col(1) * ma.y + arC_col(2) * ma.z + arC_col(3) * ma.w +
         arC_col(4) * mb.x + arC_col(5) * mb.y + arC_col(6) * mb.z + arC_col(7) * mb.w + arC_col(8) * mc.x + arC_col(9) * mc.y;
}
vec3 arC_byRank(int R) { return arC_byRankF(float(R)); }
void arC_rank() {
  arC_n = clamp(u_colors_count, 2, 10);
  vec3 W = vec3(0.2126, 0.7152, 0.0722);                // = pg_luma
  // luma + a tiny index term (breaks ties); colours past the palette's end go to the back
  vec4 la = vec4(dot(arC_col(0), W), dot(arC_col(1), W), dot(arC_col(2), W), dot(arC_col(3), W)) + vec4(0.0, 1.0, 2.0, 3.0) * 1e-5;
  vec4 lb = vec4(dot(arC_col(4), W), dot(arC_col(5), W), dot(arC_col(6), W), dot(arC_col(7), W)) + vec4(4.0, 5.0, 6.0, 7.0) * 1e-5;
  vec4 lc = vec4(dot(arC_col(8), W), dot(arC_col(9), W), 0.0, 0.0) + vec4(8.0, 9.0, 0.0, 0.0) * 1e-5;
  float n = float(arC_n);
  la += 10.0 * step(n, vec4(0.0, 1.0, 2.0, 3.0));
  lb += 10.0 * step(n, vec4(4.0, 5.0, 6.0, 7.0));
  lc = mix(lc + 10.0 * step(n, vec4(8.0, 9.0, 10.0, 11.0)), vec4(100.0), vec4(0.0, 0.0, 1.0, 1.0));
  vec4 one = vec4(1.0);
  #define ARC_RK(l) (dot(step(la, vec4(l)), one) + dot(step(lb, vec4(l)), one) + dot(step(lc, vec4(l)), one) - 1.0)
  arC_ra = vec4(ARC_RK(la.x), ARC_RK(la.y), ARC_RK(la.z), ARC_RK(la.w));
  arC_rb = vec4(ARC_RK(lb.x), ARC_RK(lb.y), ARC_RK(lb.z), ARC_RK(lb.w));
  arC_rc = vec4(ARC_RK(lc.x), ARC_RK(lc.y), 99.0, 99.0);
  #undef ARC_RK
  arC_dk = arC_byRankF(0.0);
}

// The block of column i containing height y (y measured along the slanted joints).
// Returns (role, bottom, top, key); role 0 = dark, 1 = mid, 2 = light field block.
// Dark-block places: slot m (length P) of a column; slots pair up (2k, 2k+1) and each pair holds both / the first /
// the second / no dark block. A single dark block leans toward its pair's centre, which keeps pair and triple gaps
// close to the natural block lengths; the two blocks of a full pair sit a random distance apart (so the single gap
// between them is sometimes mid, sometimes light). An empty pair gets a "virtual joint" at its centre (a plain joint
// between two field blocks) so gaps stay bounded; the roles on both sides of it are fixed by its hash so they still
// alternate. Neighbouring columns are offset ~half a place (plus a slow wander that bends the diagonal rows), so a
// dark block's nearest dark neighbours in the next columns sit well above / below it — mostly isolated, as painted.
vec4 arC_nb = vec4(-1.0);   // set by arC_shGet: (role, key) of the blocks just below / above the one returned; role −1 = unknown
vec4 arC_gap = vec4(0.0);   // set by arC_shGet for a field block: its gap (slot below, slot above, block count, kind below) — for Color rain
vec4 arC_shGet(float i, float y) {
  // straight-line code: constant loop bounds, no early exits
  float P = max(u_shinglesSpace, 2.0);
  float jt = clamp(u_shinglesJitter, 0.0, 1.0);
  float pd = clamp(u_shinglesDark, 0.0, 1.0);
  float pe = max(1.0 - 2.0 * pd, 0.0), pdd = max(2.0 * pd - 1.0, 0.0);
  float phi = 0.56 * P * i + 0.5 * P * jt * pg_vnoise(vec2(i * 0.3, 3.5));  // ~half a place per column + a slow wander
  float al = 0.06 * P, av = 0.09 * P * jt, sh = 0.148 * P, J = 0.12 * jt;
  float fs = min(1.0, (0.5 * P - 0.6) / (al + av + sh + J));           // keep every dark block inside its slot
  al *= fs; av *= fs; sh *= fs; J *= fs;
  float k0 = floor((y - phi) / (2.0 * P));

  // the dark blocks / virtual joints of three pairs, in order: find the dark block holding y, or the gap [lo, hi]
  float lo = -1e9, hi = 1e9, loK = 0.0, hiK = 0.0, loR = 0.0, hiR = 0.0, loM = 0.0, hiM = 0.0;
  vec4 dark = vec4(-1.0);
  for (int t = 0; t < 3; t++) {
    float k = k0 - 1.0 + float(t);
    vec3 hp = pg_hash32(vec2(i, 2.0 * k));
    float pat = hp.x < pe ? 0.0 : (hp.x < pe + pdd ? 3.0 : (hp.y < 0.5 ? 1.0 : 2.0));
    for (int s = 0; s < 2; s++) {
      float m = 2.0 * k + float(s);
      vec3 hs = pg_hash32(vec2(i, 2.0 * m + 1.0));
      bool virt = pat < 0.5;
      bool on = virt ? s == 0 : (pat > 2.5 || (pat < 1.5 && s == 0) || (pat > 1.5 && pat < 2.5 && s == 1));
      float c = virt ? (m + 1.0) * P + phi
                     : (m + 0.5) * P + phi + (s == 1 ? 1.0 : -1.0) * (al + av * (2.0 * hs.x - 1.0)) + (pat < 1.5 ? sh : (pat < 2.5 ? -sh : 0.0)) + J * (2.0 * hs.y - 1.0);
      float hd = virt ? 0.0 : 0.5 + 0.06 * jt * (hs.z - 0.5);
      float kind = virt ? 0.5 : 1.0;
      if (on) {
        if (!virt && dark.x < 0.0 && abs(y - c) <= hd) dark = vec4(0.0, c - hd, c + hd, m * 8.0);
        if (c < y) { lo = c + hd; loK = kind; loM = m; loR = hp.z < 0.5 ? 1.0 : 2.0; }
        else if (hi > 1e8) { hi = c - hd; hiK = kind; hiM = m; hiR = hp.z < 0.5 ? 2.0 : 1.0; }
      }
    }
  }
  arC_nb = vec4(-1.0);
  if (dark.x > -0.5) return dark;

  // fill the gap [lo, hi] with 1–6 alternating field blocks, choosing the count / first role that fits best
  float rF = loK > 0.25 && loK < 0.75 ? loR : 0.0;      // after a virtual joint: role fixed by its hash
  float rL = hiK > 0.25 && hiK < 0.75 ? hiR : 0.0;      // before one: the opposite role
  float g = hi - lo;
  vec3 h = pg_hash32(vec2(i + 0.5, loM));
  float best = 1e9, nb = 1.0, rb = 1.0;
  for (int r = 1; r <= 2; r++) {
    float fr = float(r);
    for (int k = 0; k < 6; k++) {
      float n = float(k + 1), nOdd = mod(n, 2.0);
      float nFirst = 0.5 * (n + nOdd);                  // blocks with the first role (they alternate)
      float s = r == 1 ? 1.65 * nFirst + 2.45 * (n - nFirst) : 2.45 * nFirst + 1.65 * (n - nFirst);
      float last = nOdd > 0.5 ? fr : 3.0 - fr;
      // small biases: fewer blocks; mid first above a dark block; half the triples mid–light–mid
      float e = abs(g - s) / (g + s) + 0.06 * float(k) * h.x + (r == 2 && loK > 0.75 ? 0.02 * h.y + (k == 2 && h.y > 0.5 ? 0.1 : 0.0) : 0.0);
      if ((rF == 0.0 || fr == rF) && (rL == 0.0 || last == rL) && e < best) { best = e; nb = n; rb = fr; }
    }
  }
  float jl = 0.25 * jt;
  float sum = 0.0;
  for (int k = 0; k < 6; k++) {
    float l = (mod(rb + float(k), 2.0) > 0.5 ? 1.65 : 2.45) * (1.0 + jl * (fract(h.z * float(k + 3) * 7.13) - 0.5));
    sum += float(k) < nb ? l : 0.0;
  }
  float sc = g / sum, pos = lo, kk = 0.0;
  vec4 res = vec4(rb, lo, hi, loM * 8.0 + 1.0);
  bool done = false;
  for (int k = 0; k < 6; k++) {
    float r = mod(rb + float(k), 2.0) > 0.5 ? 1.0 : 2.0;
    float l = (r < 1.5 ? 1.65 : 2.45) * (1.0 + jl * (fract(h.z * float(k + 3) * 7.13) - 0.5)) * sc;
    if (!done && float(k) < nb) {
      res = vec4(r, pos, pos + l, loM * 8.0 + float(k + 1));
      kk = float(k);
      done = y < pos + l || float(k) >= nb - 1.0;
      pos += l;
    }
  }
  if (res.z > hi - 1e-4) res.z = hi;                  // exact closing joint (no round-off sliver)
  // neighbours for the joint anti-aliasing: the next field block of this gap, or the dark block closing it
  // (left unknown across a virtual joint, where the caller looks the neighbour up properly)
  float rr = 3.0 - res.x;                              // roles alternate within a gap
  arC_nb.xy = kk > 0.5 ? vec2(rr, res.w - 1.0) : (loK > 0.75 ? vec2(0.0, loM * 8.0) : vec2(-1.0));
  arC_nb.zw = kk < nb - 1.5 ? vec2(rr, res.w + 1.0) : (hiK > 0.75 ? vec2(0.0, hiM * 8.0) : vec2(-1.0));
  arC_gap = vec4(loM, hiM, nb, loK);
  return res;
}
// height of q along column i, measured along the slanted joints (joints are lines of constant value)
float arC_shY(vec2 q) { return q.y + u_shinglesDrop * q.x; }
// field tones: role 1 = mid (darker half of the non-darkest colours), 2 = light (lighter half); t picks one
vec3 arC_shTone(float role, float t) {
  int nf = arC_n - 1, nm = nf / 2, nl = nf - nm;
  if (role > 1.5 || nm == 0) {
    vec3 c = arC_byRank(1 + nm + min(int(t * float(nl)), nl - 1));
    return role > 1.5 || nm > 0 ? c : mix(c, arC_dk, 0.35);
  }
  return arC_byRank(1 + min(int(t * float(nm)), nm - 1));
}
// colour of block b (from arC_shGet) of column i at height y
vec3 arC_shCol(float i, vec4 b, float y) {
  vec3 hh = pg_hash32(vec2(i, b.w + 0.25));
  vec3 c = b.x < 0.5 ? arC_dk : arC_shTone(b.x, hh.x);
  c *= 1.0 + 0.06 * (hh.y - 0.5);
  // relief: each block a slightly tilted plate, with a soft shadow under the overlapping block above it
  float v = clamp((y - b.y) / max(b.z - b.y, 1e-4), 0.0, 1.0);
  c = ar_face(c, vec2(0.0, 0.35 * (v - 0.5)));
  return c * (1.0 - u_relief * 0.3 * max(ar_light.y, 0.0) * (1.0 - smoothstep(0.0, 0.16, b.z - y)));
}
// area-weighted average colour (far-away fade)
vec3 arC_shMean() {
  int nf = arC_n - 1, nm = nf / 2, nl = nf - nm;
  vec3 md = vec3(0.0), lt = vec3(0.0);
  for (int j = 1; j < 10; j++) { if (j > nf) break; if (j <= nm) md += arC_byRank(j); else lt += arC_byRank(j); }
  lt /= float(nl);
  md = nm > 0 ? md / float(nm) : mix(lt, arC_dk, 0.35);
  float pd = clamp(u_shinglesDark, 0.0, 1.0);
  float d = (1.0 + max(2.0 * pd - 1.0, 0.0) - max(1.0 - 2.0 * pd, 0.0)) / (2.0 * max(u_shinglesSpace, 2.0));   // area share of dark blocks
  return arC_dk * d + (md * 1.65 + lt * 2.45) / 4.1 * (1.0 - d);
}

// --- motion: used only by the animated copy of the style (arC_shinglesM below) ---
// Smooth periodic bump, a cheap stand-in for 0.5 + 0.5 cos(2πx): 1 at whole x, 0 halfway between (no trig: it runs
// several times per pixel).
float arC_bump(float x) { float u = abs(fract(x) - 0.5) * 2.0; return u * u * (3.0 - 2.0 * u); }
// Wind: gusts sweep across the roof, one every 14 columns, each passing a given column every 2 s; gust strengths
// cycle through four values (so the whole loops every 8 s) and the gust fronts are bent by a fixed wobble.
// Returns the lifts (0..1) of block b of column i and of the block overlapping its top — one value per block, so
// each block lifts as a flat plate.
vec2 arC_lifts(float i, vec4 b) {
  float yc = 0.5 * (b.y + b.z);
  float ph = (i + 0.5) / 14.0 + 0.025 * yc + 0.2 * arC_bump(0.059 * i + 0.033 * yc) - 0.5 * u_time;
  vec2 p2 = vec2(ph, ph + 0.025 * (b.z + 0.8 - yc));
  vec2 u = abs(fract(p2) - 0.5) * 2.0;
  vec2 c = u * u * (3.0 - 2.0 * u);                      // = arC_bump, for both
  vec2 g = mod(floor(p2 + 0.5), 4.0);                    // gust number (changes where c = 0)
  return c * c * c * (0.45 + 0.55 * fract(0.618 * g + 0.3));
}
// arC_shCol with the wind and the tone drift
vec3 arC_shColM(float i, vec4 b, float y) {
  vec3 hh = pg_hash32(vec2(i, b.w + 0.25));
  vec3 c = b.x < 0.5 ? arC_dk : arC_shTone(b.x, hh.x);
  c *= 1.0 + 0.06 * (hh.y - 0.5);
  // tone drift: each block slowly lightens and darkens on its own 8 s cycle
  c *= 1.0 + 0.2 * clamp(u_shinglesDrift, 0.0, 1.0) * (arC_bump(0.125 * u_time + hh.z) - 0.5);
  float v = clamp((y - b.y) / max(b.z - b.y, 1e-4), 0.0, 1.0);
  vec2 lift = u_shinglesWave > 0.0 ? clamp(u_shinglesWave, 0.0, 1.0) * arC_lifts(i, b) : vec2(0.0);
  c *= 1.0 + lift.x * (0.14 + 0.2 * (1.0 - v));          // a lifted plate catches the light, most at its raised lower edge
  c = ar_face(c, vec2(0.0, 0.35 * (v - 0.5)));
  float top = b.z - y;
  return c * (1.0 - u_relief * 0.3 * max(ar_light.y, 0.0) * (1.0 - smoothstep(0.0, 0.16, top)))
           * (1.0 - 0.38 * lift.y * (1.0 - smoothstep(0.0, 0.12 + 0.55 * lift.y, top)));   // shadow of the lifted block above
}

// --- Color rain: used only by the rain copy of the style (arC_shinglesR below) ---
// The blocks are irregular, so each one gets a place n in its column's chain of blocks from its key: the dark block of
// slot m is n = A·m and the field blocks above it follow on (A·m + 1, + 2 …), with A ≈ the blocks per slot. Tones then
// run down the chain: under the rain a block shows the tone of chain place n + 'steps' (counting up the column) and,
// as a wave passes, wipes over to the tone of the next place up — so within each run of field blocks every block
// takes exactly the tone of the block above it; where a run is shorter than A·(slots) a tone skips a beat at the dark
// block. The chain's tones are drawn at random with the roof's own shares (dark / mid / light by area, so the
// far-away mean is unchanged); a block's relief, wind lift and shadows stay where it lies.
const int ARC_SHV = 1;
float arC_shA() { return max(2.0, floor((max(u_shinglesSpace, 2.0) - 1.0) / 2.05 + 0.5) + 1.0); }
float arC_shOrd(vec4 b, float A) {
  float m = floor(b.w * 0.125);
  if (b.x < 0.5) return A * m;
  float k = b.w - 8.0 * m - 1.0;
  if (ARC_SHV == 1) return A * m + k + 1.0;
  if (ARC_SHV == 3) {
    float pd = clamp(u_shinglesDark, 0.0, 1.0);
    float ps = 0.5 * (1.0 + max(2.0 * pd - 1.0, 0.0) - max(1.0 - 2.0 * pd, 0.0));
    float F = max(0.5, floor(2.0 * (max(u_shinglesSpace, 2.0) - ps) / 2.05 + 0.5) * 0.5);
    return floor(F * m + 0.5) + k;
  }
  float lv = arC_gap.w > 0.25 && arC_gap.w < 0.75 ? 1.0 : 0.0;
  float e = A * (arC_gap.y - arC_gap.x) - 1.0 + lv - arC_gap.z;
  return A * m + 1.0 - lv + max(e, -1.0) + k;
}
vec3 arC_shRainTone(float i, float n, float A) {
  bool dk = false;
  float pd = clamp(u_shinglesDark, 0.0, 1.0);
  float pm = 1.65 / 4.1;
  if (ARC_SHV == 1) {
    float d = (1.0 + max(2.0 * pd - 1.0, 0.0) - max(1.0 - 2.0 * pd, 0.0)) / (2.0 * max(u_shinglesSpace, 2.0));
    vec3 hr = pg_hash32(vec2(i + 0.375, n));
    dk = hr.x < d;
    pm = d + (1.0 - d) * (1.65 / 4.1);
  } else if (ARC_SHV == 2) {
    float m = floor((n + 0.5) / A);
    if (n - A * m < 0.5) {
      float k = floor(m * 0.5);
      vec3 hp = pg_hash32(vec2(i, 2.0 * k));
      float pe = max(1.0 - 2.0 * pd, 0.0), pdd = max(2.0 * pd - 1.0, 0.0);
      dk = hp.x >= pe && (hp.x < pe + pdd || (hp.y < 0.5 ? m - 2.0 * k < 0.5 : m - 2.0 * k > 0.5));
    }
  }
  vec3 hr = pg_hash32(vec2(i + 0.375, n));
  vec3 c = dk ? arC_dk : arC_shTone(hr.x < pm ? 1.0 : 2.0, hr.y);
  c *= 1.0 + 0.06 * (hr.z - 0.5);
  if (u_shinglesDrift <= 0.0) return c;
  return c * (1.0 + 0.2 * clamp(u_shinglesDrift, 0.0, 1.0) * (arC_bump(0.125 * u_time + pg_hash12(vec2(i + 0.625, n))) - 0.5));
}
// arC_shColM with the tone carried in by the rain
vec3 arC_shColR(float i, vec4 b, float y) {
  float len = max(b.z - b.y, 1e-4);
  vec3 c;
  if (ARC_SHV == 3 && b.x < 0.5) {
    vec3 hh = pg_hash32(vec2(i, b.w + 0.25));
    c = arC_dk * (1.0 + 0.06 * (hh.y - 0.5));
  } else {
    float A = arC_shA();
    vec2 rn = ar_rain(vec2(i, -0.5 * (b.y + b.z)));        // heights count down the roof
    float up = arC_rainDir(), n = arC_shOrd(b, A) + up * rn.x;
    if (rn.y >= 1.0) c = arC_shRainTone(i, n + up, A);
    else {
      c = arC_shRainTone(i, n, A);
      if (rn.y > 0.0) c = arC_flip(c, arC_shRainTone(i, n + up, A), rn.y, (b.z - y) / len, ar_px * sqrt(1.0 + u_shinglesDrop * u_shinglesDrop) / len);
    }
  }
  float v = clamp((y - b.y) / len, 0.0, 1.0);
  vec2 lift = u_shinglesWave > 0.0 ? clamp(u_shinglesWave, 0.0, 1.0) * arC_lifts(i, b) : vec2(0.0);
  c *= 1.0 + lift.x * (0.14 + 0.2 * (1.0 - v));
  c = ar_face(c, vec2(0.0, 0.35 * (v - 0.5)));
  float top = b.z - y;
  return c * (1.0 - u_relief * 0.3 * max(ar_light.y, 0.0) * (1.0 - smoothstep(0.0, 0.16, top)))
           * (1.0 - 0.38 * lift.y * (1.0 - smoothstep(0.0, 0.12 + 0.55 * lift.y, top)));
}

// the style: rain copy and animated copy (only while a motion param is on) and the still original (see swap() at the top)
vec3 arC_shinglesR(vec2 q) {
${SHINGLES_R}}
vec3 arC_shinglesM(vec2 q) {
${SHINGLES_M}}
vec3 ar_shingles(vec2 q) {
  if (u_rain != 0.0) return arC_shinglesR(q);
  if (u_shinglesWave > 0.0 || u_shinglesDrift > 0.0) return arC_shinglesM(q);
${SHINGLES}}`,
    presets: [
      {
        name: 'Slate Shingles',
        // measured from the painting (196 px frame): columns 9.3 px (8–12), dark blocks ~10.3 px, mid ~17 px, light
        // ~26 px, joints drop 0.6 px per px; gaps between dark blocks: ~48 % one block, ~40 % two, ~13 % three
        values: {
          size: 0.095, stretch: 1.15, slant: 0, light: 100, relief: 0.15, gap: 0, paint: 0.45,
          colors: ['#878ca1', '#50576d', '#81879b', '#585f75', '#1e2435'],
          shinglesDrop: 0.56, shinglesSpace: 2.85, shinglesDark: 0.64, shinglesJitter: 0.9,
        },
      },
      {
        name: 'Verdigris Shingles',
        values: {
          size: 0.11, stretch: 1.2, slant: 0, light: 110, relief: 0.3, gap: 0.006, gapColor: '#1f3b3a', paint: 0.4,
          colors: ['#a9cdbf', '#5f978a', '#bad8ca', '#4b8074', '#183433'],
          shinglesDrop: 0.45, shinglesSpace: 2.8, shinglesDark: 0.62, shinglesJitter: 0.8,
        },
      },
      {
        // motion showcase: gusts lifting the slates as they sweep across, tones slowly drifting
        name: 'Windswept Slate',
        play: true,
        values: {
          size: 0.1, stretch: 1.15, slant: 0, light: 105, relief: 0.25, gap: 0, paint: 0.45,
          colors: ['#7d8797', '#465063', '#929cab', '#5a6477', '#1b2230'],
          shinglesDrop: 0.5, shinglesSpace: 2.9, shinglesDark: 0.6, shinglesJitter: 0.9,
          shinglesWave: 0.85, shinglesDrift: 0.3,
        },
      },
      {
        // Color rain showcase (Pour): the slates' tones pour down the columns, each shingle taking the tone of the one
        // above, the columns a little out of step so the cascade runs on a diagonal
        name: 'Rain on Slate',
        play: true,
        values: {
          size: 0.1, stretch: 1.15, slant: 0, light: 105, relief: 0.25, gap: 0, paint: 0.45,
          colors: ['#8a98ab', '#4a576d', '#a5b1c0', '#5f6d83', '#1b2333'],
          shinglesDrop: 0.5, shinglesSpace: 2.85, shinglesDark: 0.6, shinglesJitter: 0.9,
          rain: 0.9, rainStyle: 'pour', rainStagger: 0.2,
        },
      },
    ],
  });
})();
