/* CRT & Screens — macro close-ups of display pixel structures: Trinitron aperture grille, delta shadow-mask triads,
 * arcade slot mask, LCD subpixels, PenTile OLED diamonds, LED wall diodes and bare CRT scanlines (colour or mono).
 *
 * A picture (white, colour bars, rainbow, plasma, terminal text…) is shown THROUGH the structure: every phosphor /
 * subpixel is lit by its own channel of the picture, sampled where that subpixel sits (CRT: along the beam lines).
 *
 * Anti-aliasing: every subpixel shape is evaluated pre-filtered — convolved with (intrinsic softness ⊕ pixel
 * footprint) by a mean-preserving kernel (erf-like edges; convex blobs are energy-normalised) — and blends to its
 * exact analytic average once it is only a couple of pixels big. So the mask never moirés, a far / tilted screen
 * shows the true mixed colour, and tone mapping (glowing, over-exposed phosphor cores) stays consistent at all
 * scales. */
(function () {
  const CRT = ['aperture', 'shadowmask', 'slotmask'];
  const isCrt = (v) => CRT.includes(v.mode);
  const hasBeam = (v) => isCrt(v) || v.mode === 'scanlines';
  const usesColor = (v) => v.picture === 'solid' || v.picture === 'gradient' || v.picture === 'text';
  const hasScale = (v) => v.picture !== 'white' && v.picture !== 'solid';
  const moves = (v) => v.picture === 'rainbow' || v.picture === 'gradient' || v.picture === 'plasma' || v.picture === 'text';

  // 5×7 dot-matrix font for the terminal-text picture: A–Z, a–z, 0–9, . , : - = ( ) / > _
  // Each glyph = 7 rows (top first) of 5 columns; packed into two uints (bit = row·5 + col).
  const FONT = (
    '.###.#...##...#######...##...##...#|####.#...##...#####.#...##...#####.|.###.#...##....#....#....#...#.###.|###..#..#.#...##...##...##..#.###..|' +
    '######....#....####.#....#....#####|######....#....####.#....#....#....|.###.#...##....#.####...##...#.####|#...##...##...#######...##...##...#|' +
    '.###...#....#....#....#....#...###.|..###...#....#....#....#.#..#..##..|#...##..#.#.#..##...#.#..#..#.#...#|#....#....#....#....#....#....#####|' +
    '#...###.###.#.##.#.##...##...##...#|#...##...###..##.#.##..###...##...#|.###.#...##...##...##...##...#.###.|####.#...##...#####.#....#....#....|' +
    '.###.#...##...##...##.#.##..#..##.#|####.#...##...#####.#.#..#..#.#...#|.#####....#.....###.....#....#####.|#####..#....#....#....#....#....#..|' +
    '#...##...##...##...##...##...#.###.|#...##...##...##...##...#.#.#...#..|#...##...##...##.#.##.#.##.#.#.#.#.|#...##...#.#.#...#...#.#.#...##...#|' +
    '#...##...#.#.#...#....#....#....#..|#####....#...#...#...#...#....#####|...........###.....#.#####...#.####|#....#....#.##.##..##...##...#####.|' +
    '...........###.#....#....#...#.###.|....#....#.##.##..###...##...#.####|...........###.#...#######.....###.|..##..#..#.#...###...#....#....#...|' +
    '......#####...##...#.####....#.###.|#....#....#.##.##..##...##...##...#|..#........##....#....#....#...###.|...#........##....#....#.#..#..##..|' +
    '#....#....#..#.#.#..##...#.#..#..#.|.##....#....#....#....#....#...###.|..........##.#.#.#.##.#.##...##...#|..........#.##.##..##...##...##...#|' +
    '...........###.#...##...##...#.###.|..........####.#...#####.#....#....|...........##.##..##.####....#....#|..........#.##.##..##....#....#....|' +
    '...........###.#.....###.....#####.|.#....#...###...#....#....#..#..##.|..........#...##...##...##..##.##.#|..........#...##...##...#.#.#...#..|' +
    '..........#...##...##.#.##.#.#.#.#.|..........#...#.#.#...#...#.#.#...#|..........#...##...#.####....#.###.|..........#####...#...#...#...#####|' +
    '.###.#...##..###.#.###..##...#.###.|..#...##....#....#....#....#...###.|.###.#...#....#...#...#...#...#####|#####...#...#.....#.....##...#.###.|' +
    '...#...##..#.#.#..#.#####...#....#.|######....####.....#....##...#.###.|..##..#...#....####.#...##...#.###.|#####....#...#...#...#....#....#...|' +
    '.###.#...##...#.###.#...##...#.###.|.###.#...##...#.####....#...#..##..|..........................##...##..|.....................##....#...#...|' +
    '......##...##........##...##.......|...............#####...............|..........#####.....#####..........|...#...#...#....#....#.....#.....#.|' +
    '.#.....#.....#....#....#...#...#...|.........#...#...#...#...#.........|.#.....#.....#.....#...#...#...#...|..............................#####'
  ).split('|');
  const fontWords = [];
  for (const g of FONT) {
    if (g.length !== 35) throw new Error('screens: bad glyph ' + g);
    let lo = 0, hi = 0;
    for (let b = 0; b < 35; b++) if (g[b] === '#') { if (b < 32) lo = (lo | (1 << b)) >>> 0; else hi |= 1 << (b - 32); }
    fontWords.push(lo + 'u', hi + 'u');
  }
  const FONT_GLSL = `const uint SC_FONT[${fontWords.length}] = uint[${fontWords.length}](${fontWords.join(', ')});`;

  PG.registerPattern({
    id: 'screens',
    name: 'CRT & Screens',
    category: 'Signal',
    description: 'Macro close-ups of display pixels — Trinitron stripes, shadow-mask triads, slot masks, LCD subpixels, PenTile OLED, LED walls and glowing scanlines.',
    params: [
      { type: 'heading', label: 'Display' },
      {
        id: 'mode',
        label: 'Display',
        type: 'select',
        options: [
          ['aperture', 'Aperture grille (Trinitron)'],
          ['shadowmask', 'Shadow mask (delta triads)'],
          ['slotmask', 'Slot mask (arcade)'],
          ['lcd', 'LCD subpixels'],
          ['pentile', 'PenTile OLED'],
          ['led', 'LED wall'],
          ['scanlines', 'CRT scanlines'],
        ],
        default: 'aperture',
        random: ['aperture', 'shadowmask', 'slotmask', 'lcd', 'pentile', 'led', 'scanlines'],
      },
      { id: 'pitch', label: 'Pitch', min: 0.008, max: 1, default: 0.15, step: 0.001, scale: 'log', random: [0.06, 0.2], help: 'Size of one RGB triad / pixel (CRT scanlines: line spacing)' },
      { id: 'gap', label: 'Mask gap', min: 0, max: 0.8, default: 0.3, step: 0.01, random: [0.15, 0.45], showIf: (v) => v.mode !== 'scanlines', help: 'Black space between the phosphors / subpixels' },
      { id: 'beam', label: 'Scanlines', min: 0, max: 1, default: 0.7, step: 0.01, random: [0.25, 0.9], showIf: hasBeam, help: 'Gaussian electron-beam lines — bright lines bloom fatter' },
      { id: 'lines', label: 'Line spacing', min: 0.5, max: 8, default: 2, step: 0.01, scale: 'log', random: [1.4, 3.5], showIf: (v) => isCrt(v) && v.beam > 0, help: 'Scanline pitch, in triads' },
      { id: 'damper', label: 'Damper wires', min: 0, max: 1, default: 0.5, step: 0.01, random: [0, 0.8], showIf: (v) => v.mode === 'aperture', help: 'The thin horizontal wires that hold a Trinitron grille' },
      { id: 'phosphor', label: 'Phosphor', type: 'select', options: [['color', 'RGB colour'], ['mono', 'Monochrome']], default: 'color', random: ['color', 'mono'], showIf: (v) => v.mode === 'scanlines' },
      { id: 'monoColor', label: 'Phosphor color', type: 'color', default: '#33ff66', random: 'light', showIf: (v) => v.mode === 'scanlines' && v.phosphor === 'mono' },

      { type: 'heading', label: 'Picture' },
      {
        id: 'picture',
        label: 'Picture',
        type: 'select',
        options: [
          ['white', 'White'],
          ['solid', 'Solid colour'],
          ['bars', 'Colour bars'],
          ['rainbow', 'Rainbow'],
          ['gradient', 'Gradient'],
          ['plasma', 'Plasma'],
          ['text', 'Terminal text'],
        ],
        default: 'plasma',
        random: ['bars', 'rainbow', 'gradient', 'plasma', 'plasma'],
      },
      { id: 'color', label: 'Color', type: 'color', default: '#ffd9a0', random: 'light', showIf: usesColor },
      { id: 'color2', label: 'Second color', type: 'color', default: '#1a0f6b', random: 'dark', showIf: (v) => v.picture === 'gradient' || v.picture === 'text', help: 'Gradient start / text background' },
      { id: 'picScale', label: 'Picture scale', min: 0.1, max: 10, default: 1, step: 0.01, scale: 'log', random: [0.6, 2], showIf: hasScale, help: 'Terminal text: whole pixels per text pixel' },
      { id: 'speed', label: 'Motion', min: 0, max: 3, default: 0.5, step: 0.01, random: [0.2, 1.2], showIf: moves, help: 'Picture motion while Animate is on' },

      { type: 'heading', label: 'Tube' },
      { id: 'bright', label: 'Brightness', min: 0.1, max: 4, default: 1.15, step: 0.01, scale: 'log', random: [0.75, 1.6], help: 'Exposure — high values blow the phosphor cores out to white' },
      { id: 'glow', label: 'Glow', min: 0, max: 1.5, default: 0.6, step: 0.01, random: [0.3, 1], help: 'Soft halo around the lit phosphors' },
      { id: 'black', label: 'Black level', min: 0, max: 0.4, default: 0.04, step: 0.001, random: [0.01, 0.09], help: 'Ambient light on the unlit phosphors / glass' },
      { id: 'curve', label: 'Tube curvature', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.5], help: 'Glass reflection and edge falloff. For the barrel shape add Warp → Bulge (the CRT presets do)' },
      { id: 'band', label: 'Refresh band', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.3], help: 'Camera-shutter refresh band rolling down the screen (while animating)' },
    ],
    presets: [
      { name: 'Trinitron Close-up', thumb: true, values: {} },
      {
        name: 'Shadow Mask Rainbow',
        values: { mode: 'shadowmask', pitch: 0.085, gap: 0.28, beam: 0.45, lines: 1.7, picture: 'rainbow', picScale: 1.1, glow: 0.7, bright: 1.15 },
      },
      {
        name: 'Arcade Slot Mask',
        values: { mode: 'slotmask', pitch: 0.07, gap: 0.3, beam: 0.85, lines: 3, picture: 'bars', picScale: 1, glow: 0.75, bright: 1.2, curve: 0.45 },
        transform: { warp: 'bulge', warpAmt: 0.1, warpFreq: 4 },
      },
      {
        name: 'LCD Subpixels',
        values: { mode: 'lcd', pitch: 0.075, gap: 0.22, picture: 'text', color: '#f4f4f4', color2: '#0f2c88', picScale: 1, glow: 0.3, bright: 1.35, black: 0.04 },
      },
      {
        name: 'PenTile OLED',
        values: { mode: 'pentile', pitch: 0.095, gap: 0.25, picture: 'plasma', picScale: 1.3, glow: 0.45, bright: 1.1, black: 0 },
      },
      {
        name: 'LED Wall',
        values: { mode: 'led', pitch: 0.13, gap: 0.38, picture: 'plasma', picScale: 0.9, glow: 0.9, bright: 1.1, black: 0.05 },
      },
      {
        name: 'Green Mono CRT',
        values: { mode: 'scanlines', phosphor: 'mono', monoColor: '#38ff6e', pitch: 0.05, beam: 0.85, picture: 'text', color: '#ffffff', color2: '#000000', glow: 0.8, bright: 1.15, black: 0.035, curve: 0.55 },
        transform: { warp: 'bulge', warpAmt: 0.2, warpFreq: 4 },
      },
      {
        name: 'Amber Terminal',
        values: { mode: 'scanlines', phosphor: 'mono', monoColor: '#ff9a1a', pitch: 0.021, beam: 0.65, picture: 'text', color: '#ffffff', color2: '#000000', glow: 0.6, bright: 1.05, black: 0.03, curve: 0.3, band: 0.25 },
        play: true,
      },
    ],
    glsl: /* glsl */ `
// Phosphor / colour-filter primaries as a camera sees them. The slight cross-talk makes over-exposed cores go white.
const vec3 SC_PR = vec3(1.0, 0.11, 0.05);
const vec3 SC_PG = vec3(0.19, 1.0, 0.16);
const vec3 SC_PB = vec3(0.09, 0.15, 1.0);
// The display drive that makes the camera's averaged image reproduce the picture colour: inverse of the cross-talk
// matrix above (columns), ×1.2 so white keeps its exposure. Without it every picture greys out once the mask is
// small (navy #0f2c88 averaged to slate #1e2f56), because each lit phosphor also leaks into the other channels.
const mat3 SC_DRIVE = mat3(1.2258, -0.1287, -0.0407, -0.2205, 1.2503, -0.189, -0.0772, -0.176, 1.2297);

bool sc_mono = false;  // single-phosphor tube: the picture's luminance drives it, no colour correction
float sc_px = 0.0;     // pixel-footprint softness (pattern units; 0 with hard edges)
float sc_pxo = 0.001;  // one output pixel, pattern units
vec2 sc_pxa = vec2(0.001); // one output pixel along the pattern x / y axes (differs under tilt)
float sc_tp = 0.03;    // terminal-text pixel size, pattern units
float sc_curRow = 9.0; // terminal line that is being typed (cursor)

// ---------------------------------------------------------------- pre-filtered shapes
// Odd sigmoid ≈ erf(x), polynomial with compact support (cheap, and no truncated tails). Because it is odd,
// blurred shapes keep their exact area.
float scE(float x) { return 2.0 * smoothstep(-1.35, 1.35, x) - 1.0; }
// Interval |x| < w blurred with softness s (same units). Integral = 2w exactly.
float scBox(float x, float w, float s) { return 0.5 * (scE((x + w) / s) - scE((x - w) / s)); }
// Convex blob from its signed distance d, blurred with softness s; normalised so the integral stays = area
// (blurring an SDF adds 4π·∫t·(1−cov)dt = 1.1451·s² to a convex shape's area, whatever its outline).
float scBlob(float d, float s, float area) { return (0.5 - 0.5 * scE(d / s)) * area / (area + 1.1451 * s * s); }
// Intrinsic softness s0 (pattern units) widened by the pixel footprint, expressed in 'unit's.
float scSoftW(float s0, float unit, float px) { return max(sqrt(s0 * s0 + px * px), 1e-5 * unit) / unit; }
float scSoft(float s0, float unit) { return scSoftW(s0, unit, sc_px); }
// 0 → 1 as a structure whose FUNDAMENTAL period is 'spacing' shrinks from ~4.5 px to 2 px (then only its average
// is shown). It must be gone before the period reaches 2 px (Nyquist): periods of 2–3 px already beat against the
// pixel grid as irregular moiré bands, and the pre-filter alone only softens the fundamental.
float scFadeW(float spacing, float px) { return u_tf_aa > 0.5 ? smoothstep(0.22, 0.5, px / spacing) : 0.0; }
float scFade(float spacing) { return scFadeW(spacing, sc_pxo); }
// Separable structures use the footprint along their own axis (stripes stay resolved under tilt).
float scSoftX(float s0, float unit) { return scSoftW(s0, unit, u_tf_aa > 0.5 ? 0.7 * sc_pxa.x : 0.0); }
float scSoftY(float s0, float unit) { return scSoftW(s0, unit, u_tf_aa > 0.5 ? 0.7 * sc_pxa.y : 0.0); }
float scFadeX(float spacing) { return scFadeW(spacing, sc_pxa.x); }
float scFadeY(float spacing) { return scFadeW(spacing, sc_pxa.y); }
float scEdge() { return u_tf_aa > 0.5 ? 1.0 : 0.0; }

// ---------------------------------------------------------------- the picture
vec3 scBar(float k) {
  k -= 7.0 * floor((k + 0.5) / 7.0);   // (exact integer wrap; mod() can round to 7) SMPTE order: white, yellow, cyan, green, magenta, red, blue (75 %)
  return 0.75 * vec3(mod(k, 4.0) < 2.0 ? 1.0 : 0.0, k < 4.0 ? 1.0 : 0.0, mod(k, 2.0) < 0.5 ? 1.0 : 0.0);
}

${FONT_GLSL}
// English letter frequency order (e t a o i n s h r d l c u m w f g y p b v k j x q z) → letter index
const int SC_FREQ[26] = int[26](4, 19, 0, 14, 8, 13, 18, 7, 17, 3, 11, 2, 20, 12, 22, 5, 6, 24, 15, 1, 21, 10, 9, 23, 16, 25);
// Glyph gi (0–25 A–Z, 26–51 a–z, 52–61 digits, 62–71 punctuation), column x 0..4, row r 0..6 from the top.
float scFontPx(int gi, float x, float r) {
  int b = int(r) * 5 + int(x);
  uint w = b < 32 ? SC_FONT[gi * 2] : SC_FONT[gi * 2 + 1];
  return float((w >> uint(b & 31)) & 1u);
}

// Hex digit 0–15 → glyph index (0–9 digits, 10–15 → A–F).
int scHex(int v) { return v < 10 ? 52 + v : v - 10; }

// One text pixel (integer coords, y up) of a procedural 80-column terminal screen → 0 / 1.
// Lines are hex dumps (address, 16 bytes, ASCII column) or upper-case '>' command lines, plus the line being typed.
float scTextPx(vec2 ip) {
  vec2 cell = floor((ip + 0.5) / vec2(6.0, 10.0));
  vec2 g = ip - cell * vec2(6.0, 10.0);
  float scr = floor((cell.x + 0.5) / 84.0);
  float col = cell.x - scr * 84.0;
  float row = -1.0 - cell.y;                    // 0 = top line
  vec3 rh = pg_hash32(vec2(row, scr));
  bool typing = row == sc_curRow && scr == 0.0;
  if (typing) {                                 // the line being typed, with a blinking block cursor
    float typed = 4.0 + mod(floor(u_time * u_speed * 8.0), 40.0);
    if (col == typed) return (fract(u_time * 1.1) < 0.55 && g.x <= 4.0 && g.y >= 1.0 && g.y <= 8.0) ? 1.0 : 0.0;
    if (col > typed) return 0.0;
  }
  if (g.x > 4.0 || g.y < 2.0 || g.y > 8.0 || col >= 80.0) return 0.0;
  int c = int(col);
  int gi;
  float kind = typing ? 1.0 : rh.z;
  if (kind < 0.14) return 0.0;                  // blank line
  if (kind < 0.62) {                            // hex dump: AAAA  XX XX … XX  ASCII
    if (c < 4) {
      int addr = int(mod(row + scr * 64.0, 4096.0)) * 16;
      gi = scHex((addr >> (4 * (3 - c))) & 15);
    } else if (c >= 6 && c < 54) {
      int k = c - 6, bi = k / 3, nib = k - bi * 3;
      if (nib == 2) return 0.0;
      int v = int(pg_hash12(vec2(row * 31.0 + float(bi), scr)) * 255.99);
      gi = scHex(nib == 0 ? v >> 4 : v & 15);
    } else if (c >= 56 && c < 72) {
      float h = pg_hash12(vec2(row * 31.0 + float(c - 56), scr + 7.0));
      gi = h < 0.55 ? SC_FREQ[min(int(h / 0.55 * 26.0), 25)] : (h < 0.8 ? 62 : 52 + int(h * 97.0) % 10);  // '.' = unprintable
    } else return 0.0;
  } else {                                      // command / log line, upper case
    float len = typing ? 80.0 : 6.0 + floor(rh.y * rh.y * 58.0);
    if (col >= len) return 0.0;
    if (c == 0) gi = 70;                        // '>'
    else if (c == 1) return 0.0;
    else {
      vec3 h = vec3(pg_hashBits(cell) >> 8u) / 16777216.0;
      if (h.z < 0.17) return 0.0;               // spaces between words
      gi = h.y < 0.1 ? 52 + int(h.x * 10.0) : (h.y < 0.14 ? 62 + int(h.x * 10.0) : SC_FREQ[min(int(pow(h.x, 1.6) * 26.0), 25)]);
    }
  }
  return scFontPx(gi, g.x, 8.0 - g.y);
}

// Terminal text at q. soft = horizontally band-limited (CRT beam), else exact pixels (LCD / OLED / LED).
float scText(vec2 q, bool soft) {
  float far = u_tf_aa > 0.5 ? smoothstep(0.45, 1.1, sc_pxo / sc_tp) : 0.0;
  if (far > 0.999) return 0.15;
  vec2 o = vec2(0.1 - u_res.x / u_res.y, 0.94);  // top-left of the view at zoom 1
  vec2 u = (q - o) / sc_tp;
  float j = floor(u.y), i = floor(u.x);
  float v;
  if (!soft) v = scTextPx(vec2(i, j));
  else {
    float f = u.x - i;
    float w = 0.5 + 0.5 * smoothstep(0.0, 0.3, min(f, 1.0 - f));
    v = mix(scTextPx(vec2(f < 0.5 ? i - 1.0 : i + 1.0, j)), scTextPx(vec2(i, j)), w);
  }
  return mix(v, 0.15, far);
}

// fp = pixel footprint in picture units. The picture is band-limited too: far away (zoomed out, toward a tilted
// horizon) its finest ripples fade first, then it settles on its average colour instead of aliasing into noise.
vec3 scPlasma(vec2 r, float t, float fp) {
  vec3 mean = mix(vec3(0.39), pg_hsv2rgb(vec3(t * 0.03, 0.92, 0.72)), 0.45);   // (fitted to the sampled average)
  float fh = smoothstep(0.2, 0.6, fp);
  if (fh > 0.999) return mean;
  float v = sin(r.x * 3.1 + t) + sin(r.y * 2.3 - t * 0.7) + sin((r.x + r.y) * 2.2 + t * 1.3)
          + sin(length(r - vec2(sin(t * 0.4), cos(t * 0.33))) * 4.2 - t);
  float val = 0.72 + 0.28 * (1.0 - smoothstep(0.08, 0.2, fp)) * sin(v * 1.9 + t * 0.4);
  return mix(pg_hsv2rgb(vec3(v * 0.14 + t * 0.03, 0.92, val)), mean, fh);
}

// The picture at q (pattern units). soft: band-limit hard horizontal edges (CRT beam).
vec3 scPicRaw(vec2 q, bool soft) {
  if (u_picture == PICTURE_WHITE) return vec3(1.0);
  if (u_picture == PICTURE_SOLID) return u_color;
  if (u_picture == PICTURE_TEXT) return mix(u_color2, u_color, scText(q, soft));
  float t = u_time * u_speed;
  vec2 r = q / u_picScale;
  float fp = u_tf_aa > 0.5 ? sc_pxo / u_picScale : 0.0;
  if (u_picture == PICTURE_BARS) {                // 7 bars of 0.486 → 75 % bars average 4/7 · 0.75 per channel
    float x = (r.x / 3.4 + 0.5) * 7.0;
    float k = floor(x), f = x - k;
    vec3 c = scBar(k);
    if (soft) {
      float w = max(0.04, sc_pxo / u_picScale / 3.4 * 7.0);
      c = mix(c, scBar(k + 1.0), smoothstep(1.0 - w, 1.0 + w, f));
      c = mix(c, scBar(k - 1.0), 1.0 - smoothstep(-w, w, f));
    }
    return mix(c, vec3(0.75 * 4.0 / 7.0), smoothstep(0.12, 0.32, fp));
  }
  if (u_picture == PICTURE_RAINBOW) return mix(pg_hsv2rgb(vec3(r.x / 3.4 + 0.5 + t * 0.05, 1.0, 1.0)), vec3(0.5), smoothstep(0.7, 1.7, fp));
  if (u_picture == PICTURE_GRADIENT) {
    float g = 1.0 - abs(fract((r.x / 3.4 + 0.5) * 0.5 + t * 0.03) * 2.0 - 1.0);
    return mix(u_color2, u_color, mix(g, 0.5, smoothstep(1.4, 3.4, fp)));
  }
  return scPlasma(r, t, fp);
}
// … as the drive of each phosphor / subpixel (colour-corrected for the cross-talk, see SC_DRIVE).
vec3 scPic(vec2 q, bool soft) {
  vec3 c = scPicRaw(q, soft);
  return sc_mono ? c : max(SC_DRIVE * c, 0.0);
}

// ---------------------------------------------------------------- CRT raster
// Gaussian beam of one scanline: picture value v at vertical distance dy (line units); bright lines are fatter.
// fy = footprint blur (line units). Integral over dy = v · σ · √(2π), whatever the blur.
float scSigma(float v) { return 0.07 + 0.14 * sqrt(max(v, 0.0)); }
float scBeam(float dy, float v, float fy) {
  float sg = scSigma(v);
  float se2 = sg * sg + fy * fy;
  return 1.5 * v * sg * inversesqrt(se2) * exp(-0.5 * dy * dy / se2);
}

// Picture of the two nearest scanlines (x continuous), shaped by the beam; mixed with flat lines by u_beam.
// halo = wide beam halo amount (bare scanlines mode). mn = local mean.
vec3 scRaster(vec2 p, float L, bool mono, float halo, out vec3 mn) {
  float yl = p.y / L - 0.5;
  float j0 = floor(yl + 0.5);
  float dy0 = yl - j0;
  float j1 = j0 + (dy0 > 0.0 ? 1.0 : -1.0);
  float dy1 = yl - j1;
  float fL = scFadeY(L);                        // lines too small to see: sample the picture continuously
  vec3 v0 = max(scPic(vec2(p.x, mix((j0 + 0.5) * L, p.y, fL)), true), 0.0);
  vec3 v1 = max(scPic(vec2(p.x, mix((j1 + 0.5) * L, p.y, fL)), true), 0.0);
  if (mono) { v0 = vec3(pg_luma(v0)); v1 = vec3(pg_luma(v1)); }
  float fy = (u_tf_aa > 0.5 ? 0.75 * sc_pxa.y : 0.0) / L;   // footprint blur (σ ≈ ¾ px: tames the near-Nyquist beat)
  float hs = 0.45 * 0.45 + fy * fy;
  float h0 = 0.45 * inversesqrt(hs) * exp(-0.5 * dy0 * dy0 / hs), h1 = 0.45 * inversesqrt(hs) * exp(-0.5 * dy1 * dy1 / hs);
  // local means blend continuously between the two lines (equal weights on the boundary between them)
  float w1 = 0.5 * smoothstep(0.0, 0.5, abs(dy0));
  vec3 b, m;
  for (int c = 0; c < 3; c++) {
    b[c] = scBeam(dy0, v0[c], fy) + scBeam(dy1, v1[c], fy) + halo * 0.3 * (v0[c] * h0 + v1[c] * h1);
    m[c] = mix(v0[c] * (1.5 * scSigma(v0[c]) + halo * 0.135), v1[c] * (1.5 * scSigma(v1[c]) + halo * 0.135), w1) * 2.5066;
  }
  b = mix(b, m, fL);
  vec3 even = mix(v0, v1, w1);                  // no beam shaping: lines still blend into each other
  mn = mix(even, m, u_beam);
  return mix(even, b, u_beam);
}

// ---------------------------------------------------------------- CRT masks (P = triad pitch)
// Each returns the mask light per channel (core + glow·halo); core = phosphor coverage, area = their averages.

// Aperture grille: continuous vertical R / G / B phosphor stripes.
vec3 scAperture(vec2 p, float P, out vec3 core, out vec3 area) {
  float w = (1.0 - u_gap) / 6.0;
  float sC = scSoftX(0.018 * P * scEdge(), P), sH = scSoftX(0.11 * P, P);
  float f = scFadeX(P);
  vec3 halo;
  for (int c = 0; c < 3; c++) {
    float t = p.x / P - (float(c) + 0.5) / 3.0;
    t -= floor(t + 0.5);
    float t2 = t - (t > 0.0 ? 1.0 : -1.0);
    core[c] = mix(scBox(t, w, sC) + scBox(t2, w, sC), 2.0 * w, f);
    halo[c] = mix(scBox(t, w, sH) + scBox(t2, w, sH), 2.0 * w, f);
  }
  area = vec3(2.0 * w);
  return core + u_glow * halo;
}

// Delta shadow mask: round dots on a triangular lattice, 3-coloured so every triangle is an R-G-B triad.
// Each colour's dots form a triangular sub-lattice (spacing √3 dots, rotated 30°): nearest dot per channel.
vec3 scShadow(vec2 p, float P, out vec3 core, out vec3 area) {
  float d = 0.5 * P;
  vec2 q = p / d;
  float r = 0.5 * (1.0 - 0.85 * u_gap);
  float A = PG_PI * r * r;
  float sC = scSoft(0.03 * d * scEdge(), d), sH = scSoft(0.2 * d, d);
  vec3 halo;
  for (int c = 0; c < 3; c++) {
    vec2 qc = pg_rot(-PG_PI / 6.0) * (q - vec2(float(c), 0.0)) * 0.57735027;
    float dist = length(pg_hexGrid(qc).xy) * 1.7320508 - r;
    core[c] = scBlob(dist, sC, A);
    halo[c] = scBlob(dist, sH, A);
  }
  area = vec3(A / 2.5980762);
  return core + u_glow * halo;
}

// Slot mask: R / G / B columns of rounded slots; neighbouring triads staggered by half a slot.
vec3 scSlot(vec2 p, float P, out vec3 core, out vec3 area) {
  const float V = 1.0;                              // slot pitch, in P
  float w = (1.0 - u_gap) / 6.0;
  float hh = 0.5 * V - (0.05 + 0.2 * u_gap) * V;
  float rr = 0.85 * w;
  float A = 4.0 * w * hh - (4.0 - PG_PI) * rr * rr;
  float sC = scSoft(0.018 * P * scEdge(), P), sH = scSoft(0.11 * P, P);
  vec3 halo;
  for (int c = 0; c < 3; c++) {
    float t = p.x / P - (float(c) + 0.5) / 3.0;
    float k = floor(t + 0.5);
    float tx = t - k;
    float ty = p.y / (P * V) - 0.5 * mod(k, 2.0);
    float ly = ty - floor(ty + 0.5);
    float ly2 = ly - (ly > 0.0 ? 1.0 : -1.0);
    float d1 = pg_sdRoundBox(vec2(tx, ly * V), vec2(w, hh), rr);
    float d2 = pg_sdRoundBox(vec2(tx, ly2 * V), vec2(w, hh), rr);
    core[c] = scBlob(d1, sC, A) + scBlob(d2, sC, A);
    halo[c] = scBlob(d1, sH, A) + scBlob(d2, sH, A);
  }
  area = vec3(A / V);
  return core + u_glow * halo;
}

// ---------------------------------------------------------------- flat panels (sample the picture per pixel)
// Return the emitted light per channel; unlit = subpixel coverage, area = mean light for a full-white picture.

// Picture bilinearly interpolated between pixel centres (for the smooth veiling glare over a panel).
vec3 scPicSmooth(vec2 p, float P) {
  vec2 g = p / P - 0.5;
  vec2 i = floor(g), f = g - i;
  return mix(mix(scPic((i + 0.5) * P, false), scPic((i + vec2(1.5, 0.5)) * P, false), f.x),
             mix(scPic((i + vec2(0.5, 1.5)) * P, false), scPic((i + 1.5) * P, false), f.x), f.y);
}

// LCD: square pixels of three vertical subpixels, black matrix, TFT notch in each subpixel's corner.
vec3 scLcd(vec2 p, float P, out vec3 unlit, out vec3 area, out vec3 vpic) {
  float wx = (1.0 - u_gap) / 6.0;
  float wy = 0.5 - u_gap / 6.0 - 0.03;
  float nw = 0.42 * wx, nh = 0.15 * wy;
  float A = 4.0 * (wx * wy - nw * nh);
  float sCx = scSoftX(0.006 * P * scEdge(), P), sHx = scSoftX(0.09 * P, P);
  float sCy = scSoftY(0.006 * P * scEdge(), P), sHy = scSoftY(0.09 * P, P);
  float fx = scFadeX(P), fy = scFadeY(P);
  float y = p.y / P;
  float j0 = floor(y);
  float ly0 = y - j0 - 0.5;
  float j1 = j0 + (ly0 > 0.0 ? 1.0 : -1.0);
  float ly1 = ly0 - (j1 - j0);
  // vertical profiles shared by the channels (body / notch × core / halo × both rows); once the rows are too
  // small they fade to their means, split continuously between the two rows
  vec2 rw = vec2(1.0, 0.0) + vec2(-0.5, 0.5) * smoothstep(0.0, 0.5, abs(ly0));
  vec4 yb = mix(vec4(scBox(ly0, wy, sCy), scBox(ly1, wy, sCy), scBox(ly0, wy, sHy), scBox(ly1, wy, sHy)), 2.0 * wy * rw.xyxy, fy);
  float n0 = ly0 + wy - nh, n1 = ly1 + wy - nh;
  vec4 yn = mix(vec4(scBox(n0, nh, sCy), scBox(n1, nh, sCy), scBox(n0, nh, sHy), scBox(n1, nh, sHy)), 2.0 * nh * rw.xyxy, fy);
  // Each channel's nearest subpixel belongs to this pixel or to the neighbour on the near side, so 2×2 picture
  // samples cover all channels — and give the bilinear picture for the veiling glare too.
  float kc = floor(p.x / P), fr = p.x / P - kc;
  float kn = kc + (fr < 0.5 ? -1.0 : 1.0);
  vec3 a0 = scPic(vec2(kc + 0.5, j0 + 0.5) * P, false), a1 = scPic(vec2(kc + 0.5, j1 + 0.5) * P, false);
  vec3 b0 = scPic(vec2(kn + 0.5, j0 + 0.5) * P, false), b1 = scPic(vec2(kn + 0.5, j1 + 0.5) * P, false);
  vpic = mix(mix(a0, b0, abs(fr - 0.5)), mix(a1, b1, abs(fr - 0.5)), abs(ly0));
  vec3 em;
  for (int c = 0; c < 3; c++) {
    float t = p.x / P - (float(c) + 0.5) / 3.0;
    float k = floor(t + 0.5), tx = t - k;
    float bC = mix(scBox(tx, wx, sCx), 2.0 * wx, fx), nC = mix(scBox(tx + wx - nw, nw, sCx), 2.0 * nw, fx);
    float bH = mix(scBox(tx, wx, sHx), 2.0 * wx, fx), nH = mix(scBox(tx + wx - nw, nw, sHx), 2.0 * nw, fx);
    vec2 cC = bC * yb.xy - nC * yn.xy;
    vec2 cH = bH * yb.zw - nH * yn.zw;
    bool own = k == kc;
    float v0 = own ? a0[c] : b0[c], v1 = own ? a1[c] : b1[c];
    em[c] = v0 * (cC.x + u_glow * cH.x) + v1 * (cC.y + u_glow * cH.y);
    unlit[c] = cC.x + cC.y;
  }
  area = vec3(A * (1.0 + u_glow));
  return em;
}

// Diamond PenTile OLED: red / blue rounded diamonds on a checkerboard, small green ovals (alternately tilted)
// on the square lattice between them. Every subpixel samples the picture at its own centre.
vec3 scPentile(vec2 p, float P, out vec3 unlit, out vec3 area) {
  vec2 q = p / P;
  float g = 1.0 - 0.6 * u_gap;
  float aR = 0.42 * g, aB = 0.48 * g;              // diamond half-diagonals
  vec2 ga = vec2(0.25, 0.155) * g;                 // green semi-axes
  float sC = scSoft(0.02 * P * scEdge(), P), sH = scSoft(0.12 * P, P);
  // red / blue in the 45° frame: red on the integer lattice, blue on the half-integer one
  vec2 uv = vec2(q.x + q.y, q.x - q.y) * 0.5;
  vec2 uR = floor(uv + 0.5), uB = floor(uv) + 0.5;
  float rR = 0.3 * aR, rB = 0.3 * aB;              // corner rounding (uv units)
  float dR = pg_sdRoundBox(uv - uR, vec2(0.5 * aR), rR) * 1.41421356;
  float dB = pg_sdRoundBox(uv - uB, vec2(0.5 * aB), rB) * 1.41421356;
  float AR = 2.0 * (aR * aR - (4.0 - PG_PI) * rR * rR);
  float AB = 2.0 * (aB * aB - (4.0 - PG_PI) * rB * rB);
  // green ovals: long axis toward the two red neighbours
  vec2 gid = floor(q);
  vec2 lg = q - gid - 0.5;
  float sg = mod(gid.x + gid.y, 2.0) < 0.5 ? 1.0 : -1.0;
  vec2 e = vec2(lg.x + sg * lg.y, lg.y - sg * lg.x) * 0.70710678;
  vec2 ea = e / ga;
  float k0 = length(ea), k1 = length(ea / ga);
  // (k0·(k0−1)/k1 has a finite limit at the centre, but 0/ε there would put a dark speck in every oval whose
  // centre lands exactly on a sample — which happens at zoom 1 for half of them)
  float dG = k1 > 1e-6 ? k0 * (k0 - 1.0) / k1 : -min(ga.x, ga.y);
  float AG = PG_PI * ga.x * ga.y;
  // picture per subpixel (red / blue sit on pixel corners: they belong to the pixel up-right of them)
  float vR = scPic((vec2(uR.x + uR.y, uR.x - uR.y) + 0.25) * P, false).r;
  float vB = scPic((vec2(uB.x + uB.y, uB.x - uB.y) + 0.25) * P, false).b;
  float vG = scPic((gid + 0.5) * P, false).g;
  vec3 cC = vec3(scBlob(dR, sC, AR), scBlob(dG, sC, AG), scBlob(dB, sC, AB));
  vec3 cH = vec3(scBlob(dR, sH, AR), scBlob(dG, sH, AG), scBlob(dB, sH, AB));
  vec3 v = vec3(vR, vG, vB);
  vec3 cov = vec3(AR * 0.5, AG, AB * 0.5);
  vec3 wb = (cov.r + cov.g + cov.b) / (3.0 * cov);   // white balance: small subpixels are driven brighter
  float f = scFade(P);
  area = cov * wb * (1.0 + u_glow);
  unlit = mix(cC, cov, f);
  return mix(v * wb * (cC + u_glow * cH), v * area, f);
}

// LED wall: one diffused round lens per pixel with three tiny R/G/B dies inside, on black plastic.
vec3 scLed(vec2 p, float P, out vec3 unlit, out vec3 area) {
  vec2 q = p / P;
  vec2 id = floor(q);
  vec2 l = q - id - 0.5;
  float rl = 0.5 * (1.0 - u_gap);
  float AL = PG_PI * rl * rl;
  float rd = 0.14 * rl;
  float AD = PG_PI * rd * rd;
  float sC = scSoft(0.02 * P * scEdge(), P), sH = scSoft(0.16 * P, P), sD = scSoft(0.3 * rd * P * scEdge(), P);
  float dl = length(l) - rl;
  float lens = scBlob(dl, sC, AL), lensH = scBlob(dl, sH, AL);
  vec2 o = rl * vec2(0.3, 0.2);
  vec3 die = vec3(scBlob(length(l - vec2(-o.x, o.y)) - rd, sD, AD),
                  scBlob(length(l - vec2(o.x, o.y)) - rd, sD, AD),
                  scBlob(length(l - vec2(0.0, -1.3 * o.y)) - rd, sD, AD));
  // SMD package around the lens (only visible through the black level)
  float hp = min(0.48, rl + 0.07);
  float Apk = 4.0 * hp * hp - (4.0 - PG_PI) * 0.0576 * hp * hp * 4.0;
  float pk = scBlob(pg_sdRoundBox(l, vec2(hp), 0.24 * hp * 2.0), sC, Apk);
  vec3 pic = scPic((id + 0.5) * P, false);
  vec3 e = pic * (0.55 * lens + 1.8 * die + u_glow * lensH);
  float f = scFade(P);
  area = vec3(0.55 * AL + 1.8 * AD + u_glow * AL);
  unlit = vec3(mix(0.35 * pk + 0.65 * lens, 0.35 * Apk + 0.65 * AL, f));
  return mix(e, pic * area, f);
}

// ---------------------------------------------------------------- main
vec4 pattern(vec2 p) {
  float P = u_pitch;
  sc_pxo = pg_px * pg_ss;
  sc_px = u_tf_aa > 0.5 ? 0.7 * sc_pxo : 0.0;
  sc_pxa = min(fwidth(p), vec2(sc_pxo));           // clamp: fwidth spikes on symmetry folds
  bool mono = u_mode == MODE_SCANLINES && u_phosphor == PHOSPHOR_MONO;
  sc_mono = mono;
  bool panel = u_mode == MODE_LCD || u_mode == MODE_PENTILE || u_mode == MODE_LED;
  float L = u_mode == MODE_SCANLINES ? P : P * u_lines;
  sc_tp = (panel ? P : L) * max(1.0, floor(u_picScale + 0.5));
  sc_curRow = floor((0.94 + 0.45) / (10.0 * sc_tp));   // the typed line sits a little below the middle

  vec3 em, unlit, mn;
  float tint = 0.25;                                // how coloured the unlit subpixels look
  if (panel) {
    vec3 area;
    if (u_mode == MODE_LCD) { vec3 vp; em = scLcd(p, P, unlit, area, vp); mn = vp * area; tint = 0.8; }
    else {
      if (u_mode == MODE_PENTILE) { em = scPentile(p, P, unlit, area); tint = 0.6; }
      else { em = scLed(p, P, unlit, area); tint = 0.0; }
      mn = u_glow > 0.0 ? scPicSmooth(p, P) * area : vec3(0.0);
    }
  }
  else if (u_mode == MODE_SCANLINES) {
    em = scRaster(p, L, mono, u_glow, mn);
    // phosphor coating grain, only while it is big enough to see
    float gr = 1.0 - smoothstep(0.004, 0.015, sc_pxo / L * 0.1);
    em *= 1.0 + 0.12 * gr * (pg_vnoise(p / (0.09 * L)) - 0.5);
    unlit = vec3(1.0);
  } else {
    vec3 core, area, m;
    float f;
    if (u_mode == MODE_APERTURE) { m = scAperture(p, P, core, area); f = 0.0; }     // (fades along x itself)
    // fundamental periods: a channel's triangular dot lattice (spacing 0.866 P) repeats every 0.75 P across its
    // rows; the staggered slot lattice every 0.894 P along its oblique axis
    else if (u_mode == MODE_SHADOWMASK) { m = scShadow(p, P, core, area); f = scFade(0.75 * P); }
    else { m = scSlot(p, P, core, area); f = scFade(0.894 * P); }
    m = mix(m, area * (1.0 + u_glow), f);
    core = mix(core, area, f);
    // grainy phosphor powder (macro detail)
    float gr = 1.0 - smoothstep(0.012, 0.05, sc_pxo / P);
    if (gr > 0.0) m *= 1.0 + 0.22 * gr * (pg_vnoise(p / (0.045 * P)) - 0.5);
    if (u_mode == MODE_APERTURE && u_damper > 0.0) {
      const float D = 17.0;                         // a damper wire every D triads
      float dw = (p.y / P / D - 0.35);
      dw = (dw - floor(dw + 0.5)) * D;
      float wire = mix(scBox(dw, 0.045, scSoftY(0.012 * P * scEdge(), P)), 0.09 / D, scFadeY(P));
      float k = 1.0 - 0.85 * u_damper * wire;
      m *= k; core *= k;
    }
    vec3 rmn;
    em = scRaster(p, L, false, 0.0, rmn) * m;
    unlit = core;
    mn = rmn * area * (1.0 + u_glow);
  }

  float k = 1.45 * u_bright;
  if (u_band > 0.0) {                               // rolling refresh, as caught by a fast shutter
    float age = fract(u_time * 0.35 + pg_screen.y);
    k *= mix(1.0, exp(-2.0 * age) / 0.4323, u_band);
  }
  vec3 col;
  if (mono) {
    // single phosphor: tone-map the intensity and keep the phosphor's hue; only blown-out cores go whiter
    float e = (em.r + u_glow * 0.16 * mn.r) * k * 1.2;
    col = u_monoColor * (1.0 - exp(-e));
    col = mix(col, vec3(1.0), clamp(0.1 * (e - 1.6), 0.0, 0.45));
    col += u_black * (0.3 + 0.7 * unlit.r) * mix(vec3(1.0), u_monoColor, 0.35);
  } else {
    vec3 E = em.r * SC_PR + em.g * SC_PG + em.b * SC_PB;
    E += u_glow * 0.16 * (mn.r * SC_PR + mn.g * SC_PG + mn.b * SC_PB);   // veiling glare: light scattered into the gaps
    E *= k;
    E += 0.22 * max(max(E.r, max(E.g, E.b)) - 1.4, 0.0);                // blown-out cores bleed toward white, like on film
    vec3 ul = unlit.r * mix(vec3(1.0), SC_PR, tint) + unlit.g * mix(vec3(1.0), SC_PG, tint) + unlit.b * mix(vec3(1.0), SC_PB, tint);
    E += u_black * (0.3 + 0.7 * ul);
    col = 1.0 - exp(-E);
  }

  if (u_curve > 0.0) {                              // curved glass: edge falloff + soft window reflection
    float asp = u_res.x / u_res.y;
    vec2 v = (pg_screen - 0.5) * 2.0;
    col *= 1.0 - u_curve * 0.6 * smoothstep(0.55, 1.6, length(v * vec2(0.9, 1.0)));
    vec2 h = (v - vec2(-0.5, 0.55)) * vec2(asp, 1.0);
    float sheen = exp(-dot(h, h) * 2.2) * 0.07 + 0.018;
    col += u_curve * sheen * vec3(0.85, 0.92, 1.0) * (1.0 - col);
  }
  return vec4(col, 1.0);
}
`,
  });
})();
