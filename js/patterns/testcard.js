/* Test Cards — broadcast / calibration screens built from the published values:
 *   SMPTE EG 1-1990 75 % bars (with −I / +Q and PLUGE), ARIB STD-B28 / SMPTE RP 219 HD bars, EBU 100/0/75/0 bars,
 *   a PM5544-style circle card, convergence crosshatch, 11-step grayscale + PLUGE (−4 / −2 / +2 / +4 % around black),
 *   Fresnel zone plate, multiburst + resolution wedges, Siemens star, the classic 24-patch colour checker
 *   (published sRGB values), a "NO SIGNAL" screen, RGB ramps and overscan / safe-area guides.
 * Colours are exact 8-bit codes (75 % = 191 full range, 180 video range). Text uses a 5×7 bitmap font in GLSL;
 * the message / channel strings reach the shader through a tiny CPU texture of glyph indices. */
(function () {
  'use strict';

  // ---- 5×7 bitmap font (uppercase, digits, punctuation) ---------------------------------------------------------
  const ORDER = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-.:/%+!?,\'()#=_*&<>"';
  const GLYPHS = [
    '.....|.....|.....|.....|.....|.....|.....', // space
    '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', // 0
    '..#..|.##..|..#..|..#..|..#..|..#..|.###.', // 1
    '.###.|#...#|....#|...#.|..#..|.#...|#####', // 2
    '#####|...#.|..#..|...#.|....#|#...#|.###.', // 3
    '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', // 4
    '#####|#....|####.|....#|....#|#...#|.###.', // 5
    '..##.|.#...|#....|####.|#...#|#...#|.###.', // 6
    '#####|....#|...#.|..#..|.#...|.#...|.#...', // 7
    '.###.|#...#|#...#|.###.|#...#|#...#|.###.', // 8
    '.###.|#...#|#...#|.####|....#|...#.|.##..', // 9
    '.###.|#...#|#...#|#####|#...#|#...#|#...#', // A
    '####.|#...#|#...#|####.|#...#|#...#|####.', // B
    '.###.|#...#|#....|#....|#....|#...#|.###.', // C
    '###..|#..#.|#...#|#...#|#...#|#..#.|###..', // D
    '#####|#....|#....|####.|#....|#....|#####', // E
    '#####|#....|#....|####.|#....|#....|#....', // F
    '.###.|#...#|#....|#.###|#...#|#...#|.####', // G
    '#...#|#...#|#...#|#####|#...#|#...#|#...#', // H
    '.###.|..#..|..#..|..#..|..#..|..#..|.###.', // I
    '..###|...#.|...#.|...#.|...#.|#..#.|.##..', // J
    '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', // K
    '#....|#....|#....|#....|#....|#....|#####', // L
    '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', // M
    '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#', // N
    '.###.|#...#|#...#|#...#|#...#|#...#|.###.', // O
    '####.|#...#|#...#|####.|#....|#....|#....', // P
    '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', // Q
    '####.|#...#|#...#|####.|#.#..|#..#.|#...#', // R
    '.####|#....|#....|.###.|....#|....#|####.', // S
    '#####|..#..|..#..|..#..|..#..|..#..|..#..', // T
    '#...#|#...#|#...#|#...#|#...#|#...#|.###.', // U
    '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', // V
    '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', // W
    '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#', // X
    '#...#|#...#|#...#|.#.#.|..#..|..#..|..#..', // Y
    '#####|....#|...#.|..#..|.#...|#....|#####', // Z
    '.....|.....|.....|#####|.....|.....|.....', // -
    '.....|.....|.....|.....|.....|.##..|.##..', // .
    '.....|.##..|.##..|.....|.##..|.##..|.....', // :
    '.....|....#|...#.|..#..|.#...|#....|.....', // /
    '##...|##..#|...#.|..#..|.#...|#..##|...##', // %
    '.....|..#..|..#..|#####|..#..|..#..|.....', // +
    '..#..|..#..|..#..|..#..|..#..|.....|..#..', // !
    '.###.|#...#|....#|...#.|..#..|.....|..#..', // ?
    '.....|.....|.....|.....|.##..|..#..|.#...', // ,
    '.##..|..#..|.#...|.....|.....|.....|.....', // '
    '...#.|..#..|.#...|.#...|.#...|..#..|...#.', // (
    '.#...|..#..|...#.|...#.|...#.|..#..|.#...', // )
    '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.', // #
    '.....|.....|#####|.....|#####|.....|.....', // =
    '.....|.....|.....|.....|.....|.....|#####', // _
    '.....|..#..|#.#.#|.###.|#.#.#|..#..|.....', // *
    '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#', // &
    '...#.|..#..|.#...|#....|.#...|..#..|...#.', // <
    '.#...|..#..|...#.|....#|...#.|..#..|.#...', // >
    '.#.#.|.#.#.|.#.#.|.....|.....|.....|.....', // "
  ];
  // rows 0–3 → FA, rows 4–6 → FB; bit (row * 5 + 4 - col), so the leftmost column is the high bit
  const FA = [];
  const FB = [];
  GLYPHS.forEach((g) => {
    let a = 0;
    let b = 0;
    g.split('|').forEach((row, r) => {
      for (let x = 0; x < 5; x++) {
        if (row[x] !== '#') continue;
        if (r < 4) a |= 1 << (r * 5 + 4 - x);
        else b |= 1 << ((r - 4) * 5 + 4 - x);
      }
    });
    FA.push(a);
    FB.push(b);
  });
  const Q_MARK = ORDER.indexOf('?');
  // typographic punctuation people paste in → the nearest glyph the font has
  const ASCII = [
    [/[‐-―−]/g, '-'], [/[‘’‚′`´]/g, "'"], [/[“”„″]/g, '"'],
    [/…/g, '...'], [/[×✕]/g, '*'], [/[·•]/g, '.'], [/[«‹]/g, '<'], [/[»›]/g, '>'], [/[\[{]/g, '('], [/[\]}]/g, ')'],
    [/[ß]/g, 'SS'], [/[Ææ]/g, 'AE'], [/[Œœ]/g, 'OE'], [/[Øø]/g, 'O'], [/[Łł]/g, 'L'], [/[Đđ]/g, 'D'],
  ];
  const encode = (s) => {
    let t = String(s == null ? '' : s);
    for (const [re, to] of ASCII) t = t.replace(re, to);
    t = t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
    const out = [];
    for (const ch of t) {
      const i = ORDER.indexOf(ch);
      out.push(i < 0 ? Q_MARK : i);
    }
    return out;
  };

  // ---- constant strings, emitted into one GLSL array -------------------------------------------------------------
  const STR = [];
  const strAt = new Map();
  const ref = (text) => {
    const g = encode(text);
    const key = g.join(',');
    if (!strAt.has(key)) {
      strAt.set(key, STR.length);
      STR.push(...g);
    }
    return { off: strAt.get(key), len: g.length };
  };
  const S = (text) => {
    const r = ref(text);
    return `TC_SRC_CONST, ${r.off}, ${r.len}`;
  };

  // ---- classic 24-patch colour checker: published sRGB (D65) values, row by row ----------------------------------
  const CC = [
    ['DARK SKIN', 115, 82, 68], ['LIGHT SKIN', 194, 150, 130], ['BLUE SKY', 98, 122, 157],
    ['FOLIAGE', 87, 108, 67], ['BLUE FLOWER', 133, 128, 177], ['BLUISH GREEN', 103, 189, 170],
    ['ORANGE', 214, 126, 44], ['PURPLISH BLUE', 80, 91, 166], ['MODERATE RED', 193, 90, 99],
    ['PURPLE', 94, 60, 108], ['YELLOW GREEN', 157, 188, 64], ['ORANGE YELLOW', 224, 163, 46],
    ['BLUE', 56, 61, 150], ['GREEN', 70, 148, 73], ['RED', 175, 54, 60],
    ['YELLOW', 231, 199, 31], ['MAGENTA', 187, 86, 149], ['CYAN', 8, 133, 161],
    ['WHITE 9.5', 243, 243, 242], ['NEUTRAL 8', 200, 200, 200], ['NEUTRAL 6.5', 160, 160, 160],
    ['NEUTRAL 5', 122, 122, 121], ['NEUTRAL 3.5', 85, 85, 85], ['BLACK 2', 52, 52, 52],
  ];
  const ccRefs = CC.map((c) => ref(c[0]));

  // ---- cards ------------------------------------------------------------------------------------------------------
  const CARDS = [
    ['smpte', 'SMPTE bars (SD)'],
    ['smptehd', 'HD bars (RP 219)'],
    ['ebu', 'EBU bars'],
    ['circle', 'Circle card'],
    ['grid', 'Convergence grid'],
    ['grayscale', 'Grayscale + PLUGE'],
    ['zoneplate', 'Zone plate'],
    ['resolution', 'Resolution / multiburst'],
    ['siemens', 'Siemens star'],
    ['colorchecker', 'Color checker'],
    ['nosignal', 'No signal'],
    ['rgbramp', 'RGB ramps'],
    ['overscan', 'Overscan / safe areas'],
  ];
  // native frame aspect of each card (0 = fill the screen)
  const NATIVE = {
    smpte: 4 / 3, smptehd: 16 / 9, ebu: 16 / 9, circle: 4 / 3, grid: 16 / 9, grayscale: 16 / 9, zoneplate: 16 / 9,
    resolution: 4 / 3, siemens: 16 / 9, colorchecker: 4 / 3, nosignal: 0, rgbramp: 16 / 9, overscan: 16 / 9,
  };
  const nativeGlsl = CARDS.filter(([k]) => NATIVE[k] > 0)
    .map(([k]) => `  if (u_card == CARD_${k.toUpperCase()}) return ${NATIVE[k].toFixed(6)};`)
    .join('\n');

  const has = (...ks) => (v) => ks.includes(v.card);
  const isNs = has('nosignal');
  // repeat tiles the whole screen, so only a tile gap shows the letterbox colour
  const letterboxVisible = (v) =>
    v.repeat ? v.gap > 0 : v.frame !== 'fill' && !(v.frame === 'native' && NATIVE[v.card] === 0);

  // card GLSL first (it registers its strings), then the header with the string table
  const cardsGlsl = /* glsl */ `
// =============================================================== SMPTE EG 1-1990 (75 % bars, 4:3)
// NTSC YIQ → RGB in percent (gamut-clipped at 0)
vec3 tcYIQ(float Y, float I, float Q) {
  return max(vec3(Y + 0.956 * I + 0.621 * Q, Y - 0.272 * I - 0.647 * Q, Y - 1.106 * I + 1.703 * Q), 0.0);
}
vec3 tcSmpte(vec2 c) {
  float x = c.x, y = c.y, b = tc_A / 7.0;
  // full range uses the familiar 7.5 IRE setup rendering (black = 19); video range puts black at code 16
  float K0 = u_levels == LEVELS_VIDEO ? 0.0 : 7.5;
  vec3 K = tcPct(K0);
  // top 2/3: gray, yellow, cyan, green, magenta, red, blue at 75 %
  vec3 top = tcPct(75.0);
  top = mix(top, tcPct(vec3(75.0, 75.0, 0.0)), tcGE(x, b));
  top = mix(top, tcPct(vec3(0.0, 75.0, 75.0)), tcGE(x, 2.0 * b));
  top = mix(top, tcPct(vec3(0.0, 75.0, 0.0)), tcGE(x, 3.0 * b));
  top = mix(top, tcPct(vec3(75.0, 0.0, 75.0)), tcGE(x, 4.0 * b));
  top = mix(top, tcPct(vec3(75.0, 0.0, 0.0)), tcGE(x, 5.0 * b));
  top = mix(top, tcPct(vec3(0.0, 0.0, 75.0)), tcGE(x, 6.0 * b));
  // 1/12: reverse castellations — blue, black, magenta, black, cyan, black, gray
  vec3 mid = tcPct(vec3(0.0, 0.0, 75.0));
  mid = mix(mid, K, tcGE(x, b));
  mid = mix(mid, tcPct(vec3(75.0, 0.0, 75.0)), tcGE(x, 2.0 * b));
  mid = mix(mid, K, tcGE(x, 3.0 * b));
  mid = mix(mid, tcPct(vec3(0.0, 75.0, 75.0)), tcGE(x, 4.0 * b));
  mid = mix(mid, K, tcGE(x, 5.0 * b));
  mid = mix(mid, tcPct(75.0), tcGE(x, 6.0 * b));
  // bottom 1/4: −I, 100 % white, +Q, black (5/4 bar each), PLUGE −4 / 0 / +4 IRE under the red bar, black
  vec3 bot = tcPct(tcYIQ(K0, -20.0, 0.0));
  bot = mix(bot, tcPct(100.0), tcGE(x, 1.25 * b));
  bot = mix(bot, tcPct(tcYIQ(K0, 0.0, 20.0)), tcGE(x, 2.5 * b));
  bot = mix(bot, K, tcGE(x, 3.75 * b));
  bot = mix(bot, tcPct(K0 - 4.0), tcGE(x, 5.0 * b));
  bot = mix(bot, K, tcGE(x, (5.0 + 1.0 / 3.0) * b));
  bot = mix(bot, tcPct(K0 + 4.0), tcGE(x, (5.0 + 2.0 / 3.0) * b));
  bot = mix(bot, K, tcGE(x, 6.0 * b));
  vec3 col = mix(top, mid, tcGE(y, 2.0 / 3.0));
  return mix(col, bot, tcGE(y, 0.75));
}

// =============================================================== ARIB STD-B28 / SMPTE RP 219 HD bars (16:9)
vec3 tcHd(vec2 c) {
  float x = c.x, y = c.y, A = tc_A;
  float d = A / 8.0, w = 0.75 * A / 7.0;          // side pillar d (240 of 1920 px), bar width c (1440/7 px)
  vec3 W = tcPct(100.0), K = tcPct(0.0), g75 = tcPct(75.0);
  // pattern 1 (7/12): 40 % gray | 75 % bars | 40 % gray
  vec3 r1 = tcPct(40.0);
  r1 = mix(r1, g75, tcGE(x, d));
  r1 = mix(r1, tcPct(vec3(75.0, 75.0, 0.0)), tcGE(x, d + w));
  r1 = mix(r1, tcPct(vec3(0.0, 75.0, 75.0)), tcGE(x, d + 2.0 * w));
  r1 = mix(r1, tcPct(vec3(0.0, 75.0, 0.0)), tcGE(x, d + 3.0 * w));
  r1 = mix(r1, tcPct(vec3(75.0, 0.0, 75.0)), tcGE(x, d + 4.0 * w));
  r1 = mix(r1, tcPct(vec3(75.0, 0.0, 0.0)), tcGE(x, d + 5.0 * w));
  r1 = mix(r1, tcPct(vec3(0.0, 0.0, 75.0)), tcGE(x, d + 6.0 * w));
  r1 = mix(r1, tcPct(40.0), tcGE(x, A - d));
  // pattern 2 (1/12): 100 % cyan | *1 = 100 % white | 75 % white | 100 % blue
  vec3 r2 = tcPct(vec3(0.0, 100.0, 100.0));
  r2 = mix(r2, W, tcGE(x, d));
  r2 = mix(r2, g75, tcGE(x, d + w));
  r2 = mix(r2, tcPct(vec3(0.0, 0.0, 100.0)), tcGE(x, A - d));
  // pattern 3 (1/12): 100 % yellow | *2 = 0 % black | Y ramp 0 → 100 % | 100 % red
  float t = clamp((x - d - w) / (6.0 * w), 0.0, 1.0);
  vec3 r3 = tcPct(vec3(100.0, 100.0, 0.0));
  r3 = mix(r3, K, tcGE(x, d));
  r3 = mix(r3, tcLv(vec3(t * 255.0)), tcGE(x, d + w));
  r3 = mix(r3, tcPct(vec3(100.0, 0.0, 0.0)), tcGE(x, A - d));
  // pattern 4 (3/12): 15 % | 0 % (1.5c) | 100 % (2c) | 0 % (5/6 c) | PLUGE −2 0 +2 0 +4 (c/3 each) | 0 % (c) | 15 %
  vec3 r4 = tcPct(15.0);
  float e = d;
  r4 = mix(r4, K, tcGE(x, e)); e += 1.5 * w;
  r4 = mix(r4, W, tcGE(x, e)); e += 2.0 * w;
  r4 = mix(r4, K, tcGE(x, e)); e += w * 5.0 / 6.0;
  r4 = mix(r4, tcPct(-2.0), tcGE(x, e)); e += w / 3.0;
  r4 = mix(r4, K, tcGE(x, e)); e += w / 3.0;
  r4 = mix(r4, tcPct(2.0), tcGE(x, e)); e += w / 3.0;
  r4 = mix(r4, K, tcGE(x, e)); e += w / 3.0;
  r4 = mix(r4, tcPct(4.0), tcGE(x, e)); e += w / 3.0;
  r4 = mix(r4, K, tcGE(x, e));
  r4 = mix(r4, tcPct(15.0), tcGE(x, A - d));
  vec3 col = mix(r1, r2, tcGE(y, 7.0 / 12.0));
  col = mix(col, r3, tcGE(y, 8.0 / 12.0));
  return mix(col, r4, tcGE(y, 9.0 / 12.0));
}

// =============================================================== EBU 100/0/75/0 (or 100/0/100/0) bars
vec3 tcEbu(vec2 c) {
  float a = u_ebuAmp == EBUAMP_A100 ? 100.0 : 75.0;
  float b = tc_A / 8.0, x = c.x;
  vec3 col = tcPct(100.0);
  col = mix(col, tcPct(vec3(a, a, 0.0)), tcGE(x, b));
  col = mix(col, tcPct(vec3(0.0, a, a)), tcGE(x, 2.0 * b));
  col = mix(col, tcPct(vec3(0.0, a, 0.0)), tcGE(x, 3.0 * b));
  col = mix(col, tcPct(vec3(a, 0.0, a)), tcGE(x, 4.0 * b));
  col = mix(col, tcPct(vec3(a, 0.0, 0.0)), tcGE(x, 5.0 * b));
  col = mix(col, tcPct(vec3(0.0, 0.0, a)), tcGE(x, 6.0 * b));
  return mix(col, tcPct(0.0), tcGE(x, 7.0 * b));
}

// =============================================================== circle card (PM5544-style), grid units: 14 rows
// top edge of band i inside the circle (grid units, y down)
float tcBandTop(int i) {
  return i <= 0 ? -6.0 : i == 1 ? -5.0 : i == 2 ? -3.0 : i == 3 ? -2.0 : i == 4 ? -1.0
       : i == 5 ? 1.0 : i == 6 ? 2.0 : i == 7 ? 3.0 : i == 8 ? 4.0 : 6.0;
}
vec3 tcCircleBand(int b, vec2 g, float hw) {
  float x = g.x, y = g.y;
  vec3 W = tcPct(100.0), K = tcPct(0.0);
  if (b == 0) return mix(K, W, tcSpan(x, -1.0, 1.0));                    // black cap, white bar
  if (b == 1) {                                                         // 75 % colour bars
    vec3 col = tcPct(vec3(75.0, 75.0, 0.0));
    col = mix(col, tcPct(vec3(0.0, 75.0, 75.0)), tcGE(x, -4.0));
    col = mix(col, tcPct(vec3(0.0, 75.0, 0.0)), tcGE(x, -2.0));
    col = mix(col, tcPct(vec3(75.0, 0.0, 75.0)), tcGE(x, 0.0));
    col = mix(col, tcPct(vec3(75.0, 0.0, 0.0)), tcGE(x, 2.0));
    return mix(col, tcPct(vec3(0.0, 0.0, 75.0)), tcGE(x, 4.0));
  }
  if (b == 2) {                                                         // ident box
    vec3 col = mix(W, K, tcSpan(x, -3.5, 3.5));
    return mix(col, W, tcMsgFit(g, vec2(0.0, -2.5), 0.52, 6.4, TC_SRC_MSG));
  }
  if (b == 3) return mix(K, W, tcSquare(0.5 * x, 0.5 * tc_px));         // castellations (step response)
  if (b == 4) {                                                         // centre cross with unit ticks
    float m = max(tcLine(y, hw), tcLine(x, hw));
    m = max(m, tcLine(abs(x - floor(x + 0.5)), hw) * tcSpan(y, -0.22, 0.22));
    return mix(K, W, m);
  }
  if (b == 5) {                                                         // gratings 0.8 … 4.8 MHz (52 µs line)
    float k = clamp(floor((x + 6.0) / 2.4), 0.0, 4.0);
    float x0 = -6.0 + 2.4 * k;
    float f = (0.8 + k) * 52.0 / (14.0 * tc_A);                         // cycles per grid unit
    float v = tcSine((x - x0) * f, f * tc_gw) - 0.5;
    float env = tcSpan(x, x0 + 0.1, x0 + 2.3);
    return tcLv(vec3((0.5 + v * env) * 255.0));
  }
  if (b == 6) {                                                         // 6 gray steps
    vec3 col = tcPct(0.0);
    for (int k = 1; k < 6; k++) col = mix(col, tcPct(20.0 * float(k)), tcGE(x, -6.0 + 2.0 * float(k)));
    return col;
  }
  if (b == 7) {                                                         // clock box
    vec3 col = mix(W, K, tcSpan(x, -2.6, 2.6));
    if (u_clock > 0.5) col = mix(col, W, tcLabel(g, vec2(0.0, 3.5), 0.5, 0.5, TC_SRC_CLOCK, 36000 + int(floor(max(u_time, 0.0))), 8));
    return col;
  }
  return mix(tcPct(vec3(75.0, 75.0, 0.0)), tcPct(vec3(75.0, 0.0, 0.0)), tcSpan(x, -1.5, 1.5)); // yellow / red cap
}
vec3 tcCircle(vec2 c) {
  float s = 1.0 / 14.0;
  vec2 g = (c - vec2(0.5 * tc_A, 0.5)) / s;
  tc_px /= s;
  tc_gw /= s;
  float hw = 0.03;
  vec3 W = tcPct(100.0), K = tcPct(0.0);
  // gray field with a white crosshatch
  vec3 col = tcPct(50.0);
  vec2 gd = abs(g - floor(g + 0.5));
  col = mix(col, W, max(tcLine(gd.x, hw), tcLine(gd.y, hw)));
  // castellated border, half a cell deep: black / white blocks per grid cell
  float hx = 7.0 * tc_A;
  col = mix(col, mix(K, W, tcSquare(0.5 * g.y + (g.x > 0.0 ? 0.5 : 0.0), 0.5 * tc_px)), tcGE(abs(g.x), hx - 0.5));
  col = mix(col, mix(K, W, tcSquare(0.5 * g.x + (g.y > 0.0 ? 0.0 : 0.5), 0.5 * tc_px)), tcGE(abs(g.y), 6.5));
  // the circle
  float r = length(g);
  float inside = tcCov(r - 6.0);
  if (inside > 0.0) {
    int bi = 0;
    for (int i = 1; i < 9; i++) if (g.y >= tcBandTop(i)) bi = i;
    vec3 ic = tcCircleBand(bi, g, hw);
    float dt = g.y - tcBandTop(bi), db = tcBandTop(bi + 1) - g.y;
    if (bi > 0 && dt < tc_px) ic = mix(tcCircleBand(bi - 1, g, hw), ic, tcCov(-dt));
    if (bi < 8 && db < tc_px) ic = mix(ic, tcCircleBand(bi + 1, g, hw), tcCov(db));
    col = mix(col, ic, inside);
  }
  return mix(col, W, tcLine(r - 6.0, hw));
}

// =============================================================== convergence crosshatch
vec3 tcGrid(vec2 c) {
  float n = max(u_gridRows, 2.0);
  vec2 g = (c - vec2(0.5 * tc_A, 0.5)) * n;
  tc_px *= n;
  tc_gw *= n;
  float hw = u_lineW * 0.0005 * n;                       // ‰ of the card height → half width in grid units
  vec2 h = vec2(0.5 * tc_A, 0.5) * n;
  // odd cell counts put a cell (not a line) on the centre, so the lines still land on the picture edges
  vec2 sh = vec2(mod(floor(2.0 * h.x + 0.5), 2.0), mod(n, 2.0)) * 0.5;
  vec2 gs = g + sh;
  vec2 gd = abs(gs - floor(gs + 0.5));
  float m = max(tcLine(gd.x, hw), tcLine(gd.y, hw));
  m = max(m, max(tcLine(g.x, 2.0 * hw) * tcSpan(abs(g.y), 0.0, 0.5), tcLine(g.y, 2.0 * hw) * tcSpan(abs(g.x), 0.0, 0.5)));   // centre cross
  vec2 e = h - abs(g);
  m = max(m, tcCov(min(e.x, e.y) - 3.0 * hw));                       // picture edge
  if (u_gridDots > 0.5) m = max(m, tcCov(length(fract(gs) - 0.5) - max(2.2 * hw, 0.045)));
  if (u_gridCircles > 0.5) {
    m = max(m, tcLine(length(g) - 0.46 * n, hw));
    m = max(m, tcLine(length(abs(g) - (h - 0.17 * n)) - 0.13 * n, hw));
  }
  return mix(u_bgColor, u_lineColor, m);
}

// =============================================================== grayscale: 11 steps, ramp, PLUGE
vec3 tcGray(vec2 c) {
  float A = tc_A, x = c.x, y = c.y;
  vec3 K = tcPct(0.0), W = tcPct(100.0);
  vec3 col = K;
  float sw = A / 11.0;
  vec3 st = K;
  for (int k = 1; k <= 10; k++) st = mix(st, tcPct(10.0 * float(k)), tcGE(x, sw * float(k)));
  if (u_labels > 0.5) {
    float i = clamp(floor(x / sw), 0.0, 10.0);
    int v = int(i) * 10;
    float lab = tcLabel(c, vec2((i + 0.5) * sw, 0.39), 0.03, 0.5, TC_SRC_NUM, v, v < 10 ? 1 : v < 100 ? 2 : 3);
    st = mix(st, i < 5.0 ? W : K, lab);
  }
  col = mix(col, st, tcSpan(y, 0.06, 0.44));
  col = mix(col, tcLv(vec3(clamp(x / A, 0.0, 1.0) * 255.0)), tcSpan(y, 0.49, 0.61));
  float fr = max(tcLine(abs(y - 0.25) - 0.19 - 0.006, 0.0015), tcLine(abs(y - 0.55) - 0.06 - 0.006, 0.0015));
  col = mix(col, tcPct(50.0), fr * tcSpan(x, 0.006, A - 0.006));
  // PLUGE: −4, −2, +2, +4 % bars on black (sub-black clips to 0 in full range, as on a PC display) + 100 % patch
  float pw = 0.028 * A;
  vec3 pc = K;
  pc = mix(pc, tcPct(-4.0), tcSpan(x, 0.20 * A - pw, 0.20 * A + pw));
  pc = mix(pc, tcPct(-2.0), tcSpan(x, 0.30 * A - pw, 0.30 * A + pw));
  pc = mix(pc, tcPct(2.0), tcSpan(x, 0.40 * A - pw, 0.40 * A + pw));
  pc = mix(pc, tcPct(4.0), tcSpan(x, 0.50 * A - pw, 0.50 * A + pw));
  pc = mix(pc, W, tcSpan(x, 0.66 * A, 0.80 * A));
  col = mix(col, pc, tcSpan(y, 0.67, 0.88));
  if (u_labels > 0.5) {
    float lab = tcLabel(c, vec2(0.20 * A, 0.925), 0.026, 0.5, ${S('-4')});
    lab = max(lab, tcLabel(c, vec2(0.30 * A, 0.925), 0.026, 0.5, ${S('-2')}));
    lab = max(lab, tcLabel(c, vec2(0.40 * A, 0.925), 0.026, 0.5, ${S('+2')}));
    lab = max(lab, tcLabel(c, vec2(0.50 * A, 0.925), 0.026, 0.5, ${S('+4')}));
    lab = max(lab, tcLabel(c, vec2(0.73 * A, 0.925), 0.026, 0.5, ${S('100')}));
    lab = max(lab, tcLabel(c, vec2(0.035 * A, 0.775), 0.026, 0.0, ${S('PLUGE')}));
    col = mix(col, tcPct(50.0), lab);
  }
  return col;
}

// =============================================================== zone plate
vec3 tcZone(vec2 c) {
  vec2 q = c - vec2(0.5 * tc_A, 0.5);
  float N = u_zpRings;
  float ph, f;
  if (u_zpShape == ZPSHAPE_HYPER) { ph = 4.0 * N * q.x * q.y; f = 4.0 * N * length(q); }
  else { ph = 4.0 * N * dot(q, q); f = 8.0 * N * length(q); }   // N rings out to the top edge
  float v = tcSine(ph - u_time * u_zpSpeed, f * tc_gw);
  return tcLv(vec3(v * 255.0));
}

// =============================================================== multiburst + resolution wedges (EIA-style)
// 7 black lines across t, converging along a: period P0 at a0 → P1 at a1 (straight lines). Returns ink.
float tcWedge(float a, float a0, float a1, float t, float P0, float P1) {
  float P = mix(P0, P1, clamp((a - a0) / (a1 - a0), 0.0, 1.0));
  float v = tcSquare(t / P + 3.25, tc_gw / P);
  return v * tcSpan(t, -3.5 * P, 3.5 * P) * tcSpan(a, a0, a1);
}
// position along a wedge where the line pitch equals L TV lines per picture height
float tcWedgeAt(float L, float a0, float a1, float L0, float L1) {
  return mix(a0, a1, (2.0 / L - 2.0 / L0) / (2.0 / L1 - 2.0 / L0));
}
float tcWedgeLabels(vec2 c, float a, float a0, float a1, float L0, float L1, vec2 base, bool horiz) {
  // label nearest to this position (by distance along the wedge)
  float best = 0.0, bd = 1e9;
  for (int k = 0; k < 4; k++) {
    float L = mix(L0, L1, float(k) / 3.0);
    float d = abs(tcWedgeAt(L, a0, a1, L0, L1) - a);
    if (d < bd) { bd = d; best = L; }
  }
  float p = tcWedgeAt(best, a0, a1, L0, L1);
  vec2 pos = horiz ? vec2(p, base.y) : vec2(base.x, p);
  float tick = horiz ? tcLine(c.x - p, 0.0012) * tcSpan(c.y, base.y + 0.014, base.y + 0.022)
                     : tcLine(c.y - p, 0.0012) * tcSpan(c.x, base.x + 0.004, base.x + 0.012);
  return max(tick, tcLabel(c, pos, 0.02, horiz ? 0.5 : 1.0, TC_SRC_NUM, int(best + 0.5), 3));
}
vec3 tcRes(vec2 c) {
  float A = tc_A, x = c.x, y = c.y;
  vec3 W = tcPct(100.0), K = tcPct(0.0);
  vec3 col = W;
  // ---- multiburst: white / black flags, then 0.5 1.0 2.0 3.0 3.58 4.2 MHz packets on a 50 % pedestal
  float x0 = 0.05 * A, fw = 0.06 * A, gw = 0.012 * A;
  float pw = (0.9 * A - 2.0 * fw - 6.0 * gw) / 6.0;
  float px0 = x0 + 2.0 * fw + gw;
  float k = clamp(floor((x - px0 + 0.5 * gw) / (pw + gw)), 0.0, 5.0);
  float ps = px0 + k * (pw + gw);
  float mhz = k < 0.5 ? 0.5 : k < 1.5 ? 1.0 : k < 2.5 ? 2.0 : k < 3.5 ? 3.0 : k < 4.5 ? 3.58 : 4.2;
  float f = mhz * 52.66 / A;                                     // cycles per card unit (52.66 µs active line)
  float v = tcSine((x - ps) * f, f * tc_gw) - 0.5;
  vec3 mb = tcLv(vec3((0.5 + v * tcSpan(x, ps, ps + pw)) * 255.0));
  mb = mix(mb, W, tcSpan(x, x0, x0 + fw));
  mb = mix(mb, K, tcSpan(x, x0 + fw, x0 + 2.0 * fw));
  col = mix(col, tcPct(50.0), tcSpan(y, 0.035, 0.325) * tcSpan(x, x0 - 0.025, 0.95 * A + 0.025));
  col = mix(col, mb, tcSpan(y, 0.06, 0.30) * tcSpan(x, x0, 0.95 * A));
  float ink = 0.0;
  if (u_labels > 0.5) {
    float lx = ps + 0.5 * pw, ly = 0.365, lh = 0.024;
    float lab = k < 0.5 ? tcLabel(c, vec2(lx, ly), lh, 0.5, ${S('0.5')})
              : k < 1.5 ? tcLabel(c, vec2(lx, ly), lh, 0.5, ${S('1.0')})
              : k < 2.5 ? tcLabel(c, vec2(lx, ly), lh, 0.5, ${S('2.0')})
              : k < 3.5 ? tcLabel(c, vec2(lx, ly), lh, 0.5, ${S('3.0')})
              : k < 4.5 ? tcLabel(c, vec2(lx, ly), lh, 0.5, ${S('3.58')})
              :           tcLabel(c, vec2(lx, ly), lh, 0.5, ${S('4.2')});
    lab = max(lab, tcLabel(c, vec2(x0 + fw, ly), lh, 0.5, ${S('MHZ')}));
    ink = max(ink, lab);
  }
  // ---- wedges (TV lines per picture height): horizontal wedges read vertical resolution, vertical ones horizontal
  float a0 = 0.06 * A, a1 = 0.46 * A;
  ink = max(ink, tcWedge(x, a0, a1, y - 0.56, 0.01, 0.004));
  ink = max(ink, tcWedge(x, a0, a1, y - 0.81, 0.004, 0.0025));
  float b0 = 0.45, b1 = 0.93;
  ink = max(ink, tcWedge(y, b0, b1, x - 0.66 * A, 0.01, 0.004));
  ink = max(ink, tcWedge(y, b0, b1, x - 0.86 * A, 0.004, 0.0025));
  if (u_labels > 0.5) {
    ink = max(ink, tcWedgeLabels(c, x, a0, a1, 200.0, 500.0, vec2(0.0, 0.56 - 0.035 - 0.032), true));
    ink = max(ink, tcWedgeLabels(c, x, a0, a1, 500.0, 800.0, vec2(0.0, 0.81 - 0.014 - 0.032), true));
    ink = max(ink, tcWedgeLabels(c, y, b0, b1, 200.0, 500.0, vec2(0.66 * A - 0.035 - 0.022, 0.0), false));
    ink = max(ink, tcWedgeLabels(c, y, b0, b1, 500.0, 800.0, vec2(0.86 * A - 0.014 - 0.022, 0.0), false));
    ink = max(ink, tcLabel(c, vec2(0.06 * A, 0.955), 0.02, 0.0, ${S('TV LINES / PICTURE HEIGHT')}));
  }
  vec2 e = vec2(0.5 * A, 0.5) - abs(c - vec2(0.5 * A, 0.5));
  ink = max(ink, tcLine(min(e.x, e.y) - 0.012, 0.0018));                // frame
  return mix(col, K, ink);
}

// =============================================================== Siemens star focus chart
float tcStar(vec2 q, float R, float n, float rot) {
  float r = length(q);
  float ph = (atan(q.y, q.x) / PG_TAU + rot) * n;
  float w = tc_gw * n / (PG_TAU * max(r, 1e-6));
  return tcSquare(ph, w) * tcCov(r - R);
}
vec3 tcSiemens(vec2 c) {
  vec2 h = vec2(0.5 * tc_A, 0.5);
  vec2 q = c - h;
  float n = max(floor(u_spokes + 0.5), 2.0), rot = u_time * u_starSpin / 360.0;
  float ink = tcStar(q, 0.43, n, rot);
  ink = max(ink, tcLine(length(q) - 0.43, 0.0015));
  vec2 cq = abs(q) - (h - 0.165);
  float ns = max(floor(0.5 * n + 0.5), 2.0);
  ink = max(ink, tcStar(cq, 0.125, ns, -rot));
  ink = max(ink, tcLine(length(cq) - 0.125, 0.0012));
  vec2 e = h - abs(q);
  ink = max(ink, tcCov(min(e.x, e.y) - 0.006));
  return mix(tcPct(100.0), tcPct(0.0), ink);
}

// =============================================================== 24-patch colour checker
const vec3 TC_CC[24] = vec3[24](${CC.map((c) => `vec3(${c[1]}.0, ${c[2]}.0, ${c[3]}.0)`).join(', ')});
const int TC_CC_OFF[24] = int[24](${ccRefs.map((r) => r.off).join(', ')});
const int TC_CC_LEN[24] = int[24](${ccRefs.map((r) => r.len).join(', ')});
vec3 tcChecker(vec2 c) {
  float A = tc_A;
  float P = min(A / 7.4, 1.0 / 5.2), gp = 0.2 * P, cs = P + gp;
  // centre the block; with names on, include the label strip under the last row
  vec2 o = 0.5 * (vec2(A, 1.0) - vec2(6.0 * P + 5.0 * gp, 4.0 * P + (u_labels > 0.5 ? 4.0 : 3.0) * gp));
  vec3 frame = tcLv(vec3(24.0));
  vec3 col = frame;
  // patches (cells centred on the patches so every edge gets the same anti-aliasing)
  vec2 q = (c - o + 0.5 * gp) / cs;
  vec2 id = floor(q);
  if (id.x >= 0.0 && id.x <= 5.0 && id.y >= 0.0 && id.y <= 3.0) {
    vec2 f = (q - id - 0.5) * cs;
    int k = int(id.y) * 6 + int(id.x);
    col = mix(frame, tcLv(TC_CC[k]), tcCov(pg_sdRoundBox(f, vec2(0.5 * P), 0.05 * P)));
  }
  // names in the gap under each patch
  if (u_labels > 0.5) {
    vec2 lq = (c - o) / cs;
    vec2 lid = floor(lq);
    if (lid.x >= 0.0 && lid.x <= 5.0 && lid.y >= 0.0 && lid.y <= 3.0) {
      int k = int(lid.y) * 6 + int(lid.x);
      int len = TC_CC_LEN[k];
      float h = min(0.4 * gp, 0.94 * P / float(len * 6 - 1) * 7.0);
      vec2 lf = (lq - lid) * cs;
      col = mix(col, tcLv(vec3(165.0)), tcLabel(lf, vec2(0.5 * P, P + 0.5 * gp), h, 0.5, TC_SRC_CONST, TC_CC_OFF[k], len));
    }
  }
  return col;
}

// =============================================================== NO SIGNAL screen
float tcTri(float u) { return 1.0 - abs(mod(u, 2.0) - 1.0); }
vec3 tcNoSignal(vec2 c) {
  float A = tc_A;
  vec3 col = u_nsBg;
  int len = tcTexLen(TC_SRC_MSG);
  float gp = u_nsSize / 7.0;
  float tw = float(max(len * 6 - 1, 1)) * gp;
  if (tw > 0.9 * A) { gp *= 0.9 * A / tw; tw = 0.9 * A; }
  vec2 hb = vec2(0.5 * tw, 3.5 * gp) + 4.0 * gp;            // box half-size (4 glyph px padding)
  vec2 pos = vec2(0.5 * A, 0.5);
  float vis = 1.0;
  if (u_nsMotion == NSMOTION_BOUNCE) {
    vec2 lo = hb + 0.02;
    vec2 span = max(vec2(A, 1.0) - 2.0 * lo, 1e-3);
    float t = u_time * u_nsSpeed;
    pos = lo + span * vec2(tcTri(t * 0.16 / span.x + 0.5), tcTri(t * 0.12 / span.y + 0.5));
  } else if (u_nsMotion == NSMOTION_BLINK) {
    vis = step(fract(u_time * u_nsSpeed * 0.5), 0.62);
  }
  float ink = tcLabel(c, pos, 7.0 * gp, 0.5, TC_SRC_MSG, 0, len);
  if (u_nsBox > 0.5) ink = max(ink, tcLine(pg_sdBox(c - pos, hb), 0.5 * gp));
  col = mix(col, u_nsInk, ink * vis);
  // channel / input OSD, top right, with a drop shadow
  int cl = tcTexLen(TC_SRC_CH);
  if (cl > 0) {
    float cg = 0.056 / 7.0;
    vec2 qq = (c - vec2(A - 0.06 - float(cl * 6 - 1) * cg, 0.06)) / cg;
    col = mix(col, vec3(0.0), 0.55 * tcText(qq - 0.9, tc_px / cg, TC_SRC_CH, 0, cl));
    col = mix(col, u_chColor, tcText(qq, tc_px / cg, TC_SRC_CH, 0, cl));
  }
  return col;
}

// =============================================================== RGB ramps
vec3 tcRamp(vec2 c) {
  float A = tc_A, x = c.x, y = c.y;
  float n = u_rampSteps, v;
  if (n >= 2.0) {
    float sw = A / n, d = 1.0 / (n - 1.0);
    float i = clamp(floor(x / sw), 0.0, n - 1.0);
    float f = x - i * sw;
    v = i * d + ((i < n - 1.0 ? tcCov(sw - f) : 0.0) - (i > 0.0 ? tcCov(f) : 0.0)) * d;
  } else {
    v = clamp(x / A, 0.0, 1.0);
  }
  float b = clamp(floor(y * 4.0), 0.0, 3.0);
  vec3 m = b < 0.5 ? vec3(1.0, 0.0, 0.0) : b < 1.5 ? vec3(0.0, 1.0, 0.0) : b < 2.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0);
  vec3 col = tcLv(m * v * 255.0);
  // separators
  float sep = abs(fract(y * 4.0 + 0.5) - 0.5) * 0.25;
  col = mix(col, tcPct(0.0), tcLine(sep, 0.004));
  if (u_labels > 0.5) {
    vec2 lp = vec2(0.03, (b + 0.5) * 0.25);
    float lab = b < 0.5 ? tcLabel(c, lp, 0.04, 0.0, ${S('R')}) : b < 1.5 ? tcLabel(c, lp, 0.04, 0.0, ${S('G')})
              : b < 2.5 ? tcLabel(c, lp, 0.04, 0.0, ${S('B')}) : tcLabel(c, lp, 0.04, 0.0, ${S('W')});
    col = mix(col, tcPct(75.0), lab);
  }
  return col;
}

// =============================================================== overscan / safe areas
// ruler running in from an edge: d = distance from the edge, a = offset across, u = 1 % step
float tcRuler(float d, float a, float u, float hw) {
  float m = tcLine(a, hw) * tcSpan(d, 0.0, 10.0 * u);
  float kn = clamp(floor(d / u + 0.5), 1.0, 10.0);
  float len = kn > 9.5 ? 0.03 : abs(kn - 5.0) < 0.5 ? 0.02 : 0.011;
  return max(m, tcLine(d - kn * u, hw) * tcSpan(a, -len, len));
}
vec3 tcOverscan(vec2 c) {
  float A = tc_A, x = c.x, y = c.y;
  float hw = u_lineW * 0.0005;
  vec2 q = c - vec2(0.5 * A, 0.5), H = vec2(0.5 * A, 0.5);
  bool sd = u_safeStd == SAFESTD_SD;
  float act = sd ? 0.90 : 0.93, tit = sd ? 0.80 : 0.90;
  float m = 0.0;
  vec2 e = H - abs(q);
  m = max(m, tcCov(min(e.x, e.y) - 2.0 * hw));                                  // picture edge
  m = max(m, tcLine(pg_sdBox(q, H * act), hw));                                 // action safe (solid)
  vec2 ht = H * tit;
  float along = abs(q.x) > ht.x - 0.01 ? q.y : q.x;
  m = max(m, tcLine(pg_sdBox(q, ht), hw) * tcSquare(along / 0.024 + 0.25, tc_px / 0.024)); // title safe (dashed)
  m = max(m, tcRuler(y, q.x, 0.01, hw));                                        // rulers, 1 % ticks
  m = max(m, tcRuler(1.0 - y, q.x, 0.01, hw));
  m = max(m, tcRuler(x, q.y, 0.01 * A, hw));
  m = max(m, tcRuler(A - x, q.y, 0.01 * A, hw));
  m = max(m, tcLine(q.x, hw) * tcSpan(q.y, -0.06, 0.06));                       // centre
  m = max(m, tcLine(q.y, hw) * tcSpan(q.x, -0.06, 0.06));
  m = max(m, tcLine(length(q) - 0.04, hw));
  bool wide = A > 1.45;
  if (wide) m = max(m, tcLine(abs(q.x) - 2.0 / 3.0, hw) * tcSquare(y / 0.03, tc_px / 0.03)); // 4:3 centre cut
  if (u_labels > 0.5) {
    float lh = 0.022;
    vec2 p1 = vec2(0.5 * A + 0.032, 0.05), p2 = vec2(0.5 * A + 0.042, 0.10);
    vec2 p3 = vec2(0.05 * A + 0.008, 0.5 + 0.03), p4 = vec2(0.10 * A + 0.008, 0.5 - 0.035);
    float pad = 0.006;
    float box = max(max(tcLabelBox(c, p1, lh, 0.0, 2, pad), tcLabelBox(c, p2, lh, 0.0, 3, pad)),
                    max(tcLabelBox(c, p3, lh, 0.0, 2, pad), tcLabelBox(c, p4, lh, 0.0, 3, pad)));
    m *= 1.0 - box;
    m = max(m, tcLabel(c, p1, lh, 0.0, ${S('5%')}));
    m = max(m, tcLabel(c, p2, lh, 0.0, ${S('10%')}));
    m = max(m, tcLabel(c, p3, lh, 0.0, ${S('5%')}));
    m = max(m, tcLabel(c, p4, lh, 0.0, ${S('10%')}));
    vec2 l1 = vec2(0.5 * A, 0.64), l2 = vec2(0.5 * A, 0.69);
    m = max(m, sd ? tcLabel(c, l1, lh, 0.5, ${S('ACTION SAFE 90%  ---')}) : tcLabel(c, l1, lh, 0.5, ${S('ACTION SAFE 93%  ---')}));
    m = max(m, sd ? tcLabel(c, l2, lh, 0.5, ${S('TITLE SAFE 80%  - -')}) : tcLabel(c, l2, lh, 0.5, ${S('TITLE SAFE 90%  - -')}));
    if (wide) m = max(m, tcLabel(c, vec2(0.5 * A - 2.0 / 3.0 + 0.012, 0.16), lh, 0.0, ${S('4:3')}));
  }
  return mix(u_bgColor, u_lineColor, m);
}
`;

  const headerGlsl = /* glsl */ `
#define TC_SRC_CONST 0
#define TC_SRC_MSG 1
#define TC_SRC_CH 2
#define TC_SRC_CLOCK 3
#define TC_SRC_NUM 4
#define TC_G_COLON ${ORDER.indexOf(':')}
const int TC_FA[${FA.length}] = int[${FA.length}](${FA.join(', ')});
const int TC_FB[${FB.length}] = int[${FB.length}](${FB.join(', ')});
const int TC_STR[${STR.length}] = int[${STR.length}](${STR.join(', ')});

float tc_px = 0.001;    // size of one sample in the current card units (a card may rescale it)
float tc_A = 1.333333;  // card aspect (width / height); card coords run x 0..A, y 0..1 from the top
float tc_gw = 0.001;    // one output pixel in card units: filter width for gratings (tc_px × supersampling)

// ---- levels: full-range 8-bit code (unrounded, may be out of range) → quantised code in the chosen range
vec3 tcLv(vec3 code) {
  vec3 v = u_levels == LEVELS_VIDEO ? 16.0 + code * (219.0 / 255.0) : code;
  return clamp(floor(v + 0.5005), 0.0, 255.0) / 255.0;
}
vec3 tcPct(vec3 pct) { return tcLv(pct * 2.55); }
vec3 tcPct(float pct) { return tcLv(vec3(pct * 2.55)); }

// ---- anti-aliased coverage in card units (honours "Smooth edges")
float tcCov(float d) { return u_tf_aa > 0.5 ? clamp(0.5 - d / tc_px, 0.0, 1.0) : step(d, 0.0); }
float tcGE(float x, float e) { return tcCov(e - x); }        // x >= e
float tcSpan(float x, float a, float b) {                    // a <= x <= b, exact box filter
  if (u_tf_aa < 0.5) return step(a, x) * step(x, b);
  float h = 0.5 * tc_px;
  return clamp((min(x + h, b) - max(x - h, a)) / tc_px, 0.0, 1.0);
}
float tcLine(float d, float hw) {                            // energy-conserving thin line
  if (u_tf_aa < 0.5) return step(abs(d), hw);
  float ww = max(hw, 0.5 * tc_px);
  return tcCov(abs(d) - ww) * (hw / ww);
}
// square wave (1 where fract(x) < 0.5), box-filtered over w cycles; fades to 0.5 near the Nyquist limit
float tcSqInt(float x) { return floor(x) * 0.5 + min(fract(x), 0.5); }
float tcSquare(float x, float w) {
  if (u_tf_aa < 0.5) return 1.0 - step(0.5, fract(x));
  w = max(w, 1e-5);
  float v = (tcSqInt(x + 0.5 * w) - tcSqInt(x - 0.5 * w)) / w;
  return mix(v, 0.5, smoothstep(0.35, 0.6, w));
}
// cosine grating 0.5 + 0.5 cos(2πx), box-filtered (sinc) over w cycles and faded out before the Nyquist limit
float tcSine(float x, float w) {
  float a = 1.0;
  if (u_tf_aa > 0.5) a = w < 1e-4 ? 1.0 : w >= 0.6 ? 0.0 : sin(PG_PI * w) / (PG_PI * w) * (1.0 - smoothstep(0.35, 0.6, w));
  return 0.5 + 0.5 * a * cos(PG_TAU * x);
}

// ---- 5×7 bitmap text
float tcGlyphBit(int g, int x, int y) {
  int bits = y < 4 ? TC_FA[g] : TC_FB[g];
  int r = y < 4 ? y : y - 4;
  return float((bits >> (r * 5 + 4 - x)) & 1);
}
int tcTexLen(int src) {
  return int(texelFetch(u_tcText, ivec2(0, src == TC_SRC_MSG ? 1 : 0), 0).g * 255.0 + 0.5);
}
int tcChar(int src, int off, int len, int ci) {
  if (src == TC_SRC_CONST) return TC_STR[off + ci];
  if (src == TC_SRC_CLOCK) {                                 // off = seconds → HH:MM:SS
    if (ci == 2 || ci == 5) return TC_G_COLON;
    int v = ci < 2 ? (off / 3600) % 24 : ci < 5 ? (off / 60) % 60 : off % 60;
    return 1 + ((ci == 0 || ci == 3 || ci == 6) ? v / 10 : v % 10);
  }
  if (src == TC_SRC_NUM) {                                   // off = number, len digits (zero padded)
    int p = 1;
    for (int k = 0; k < 8; k++) { if (k >= len - 1 - ci) break; p *= 10; }
    return 1 + (off / p) % 10;
  }
  // texture rows: data row 0 (message) is the top texel row
  return int(texelFetch(u_tcText, ivec2(ci, src == TC_SRC_MSG ? 1 : 0), 0).r * 255.0 + 0.5);
}
float tcBit(int src, int off, int len, ivec2 p) {          // p: glyph-pixel coords in the string, y down
  if (p.x < 0 || p.y < 0 || p.y > 6) return 0.0;
  int ci = p.x / 6;
  int cx = p.x - ci * 6;
  if (ci >= len || cx > 4) return 0.0;
  return tcGlyphBit(tcChar(src, off, len, ci), cx, p.y);
}
// coverage of a string; q = glyph pixels from the string's top-left (y down), w = sample size in glyph pixels
float tcText(vec2 q, float w, int src, int off, int len) {
  if (len <= 0 || q.x < -1.0 || q.y < -1.0 || q.y > 8.0 || q.x > float(len * 6) + 1.0) return 0.0;
  if (u_tf_aa < 0.5) return tcBit(src, off, len, ivec2(floor(q)));
  vec2 k = floor(q + 0.5);
  vec2 t = clamp((q - k) / max(w, 1e-6) + 0.5, 0.0, 1.0);
  ivec2 i = ivec2(k);
  float a = tcBit(src, off, len, i + ivec2(-1, -1));
  float b = tcBit(src, off, len, i + ivec2(0, -1));
  float c = tcBit(src, off, len, i + ivec2(-1, 0));
  float d = tcBit(src, off, len, i);
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
// text anchored at pos (card units): h = cap height, align 0 left / 0.5 centre / 1 right, vertically centred
float tcLabel(vec2 c, vec2 pos, float h, float align, int src, int off, int len) {
  float gp = h / 7.0;
  vec2 q = (c - pos) / gp + vec2(float(len * 6 - 1) * align, 3.5);
  return tcText(q, tc_px / gp, src, off, len);
}
// background box behind a tcLabel (pad in card units) — knocks lines out from under the text
float tcLabelBox(vec2 c, vec2 pos, float h, float align, int len, float pad) {
  float wid = float(len * 6 - 1) * h / 7.0;
  float x0 = pos.x - wid * align - pad;
  return tcSpan(c.x, x0, x0 + wid + 2.0 * pad) * tcSpan(c.y, pos.y - 0.5 * h - pad, pos.y + 0.5 * h + pad);
}
// texture string centred at pos, shrunk to fit maxW
float tcMsgFit(vec2 c, vec2 pos, float h, float maxW, int src) {
  int len = tcTexLen(src);
  if (len <= 0) return 0.0;
  h = min(h, maxW / float(len * 6 - 1) * 7.0);
  return tcLabel(c, pos, h, 0.5, src, 0, len);
}
`;

  const mainGlsl = /* glsl */ `
float tcAspect(float sa) {
  if (u_frame == FRAME_R43) return 4.0 / 3.0;
  if (u_frame == FRAME_R169) return 16.0 / 9.0;
  if (u_frame == FRAME_FILL) return sa;
${nativeGlsl}
  return sa;
}

vec4 pattern(vec2 p) {
  float sa = u_res.x / max(u_res.y, 1.0);
  float ca = tcAspect(sa);
  float H = ca > sa ? 2.0 * sa / ca : 2.0;                 // the card fits the screen at zoom 1
  vec2 q = p / H;
  bool rep = u_repeat > 0.5;
  float gap = rep ? u_gap : 0.0;
  if (rep) {
    vec2 per = vec2(ca, 1.0) + gap;
    q = mod(q + 0.5 * per, per) - 0.5 * per;
  }
  tc_A = ca;
  tc_px = pg_px / H;
  tc_gw = tc_px * pg_ss;
  vec2 c = vec2(q.x + 0.5 * ca, 0.5 - q.y);
  float mask = (rep && gap <= 0.0) ? 1.0 : tcSpan(c.x, 0.0, ca) * tcSpan(c.y, 0.0, 1.0);
  vec3 col = u_letterbox;
  if (mask > 0.0) {
    vec3 k;
    if (u_card == CARD_SMPTE) k = tcSmpte(c);
    else if (u_card == CARD_SMPTEHD) k = tcHd(c);
    else if (u_card == CARD_EBU) k = tcEbu(c);
    else if (u_card == CARD_CIRCLE) k = tcCircle(c);
    else if (u_card == CARD_GRID) k = tcGrid(c);
    else if (u_card == CARD_GRAYSCALE) k = tcGray(c);
    else if (u_card == CARD_ZONEPLATE) k = tcZone(c);
    else if (u_card == CARD_RESOLUTION) k = tcRes(c);
    else if (u_card == CARD_SIEMENS) k = tcSiemens(c);
    else if (u_card == CARD_COLORCHECKER) k = tcChecker(c);
    else if (u_card == CARD_NOSIGNAL) k = tcNoSignal(c);
    else if (u_card == CARD_RGBRAMP) k = tcRamp(c);
    else k = tcOverscan(c);
    col = mix(u_letterbox, k, mask);
  }
  return vec4(col, 1.0);
}
`;

  PG.registerPattern({
    id: 'testcard',
    name: 'Test Cards',
    category: 'Signal',
    description:
      'Broadcast and calibration screens with standard values: SMPTE / HD / EBU bars, circle card, convergence grid, grayscale + PLUGE, zone plate, resolution wedges, Siemens star, color checker, No Signal.',
    params: [
      { id: 'card', label: 'Card', type: 'select', options: CARDS, default: 'smpte', random: CARDS.map((c) => c[0]) },
      { id: 'message', label: 'Message', type: 'text', default: 'NO SIGNAL', random: false, showIf: has('nosignal', 'circle'), help: 'No Signal text, and the ident box on the circle card (A–Z, 0–9, basic punctuation)' },
      { id: 'channel', label: 'Channel', type: 'text', default: '', random: false, showIf: isNs, help: 'On-screen channel / input, e.g. CH 3 or AV 1 (empty = off)' },
      { id: 'nsMotion', label: 'Motion', type: 'select', options: [['static', 'Static'], ['bounce', 'Bounce'], ['blink', 'Blink']], default: 'static', random: ['static', 'bounce', 'blink'], showIf: isNs, help: 'Used while Animate is on' },
      { id: 'nsSpeed', label: 'Speed', min: 0.1, max: 4, default: 1, step: 0.01, scale: 'log', random: [0.5, 2], showIf: (v) => isNs(v) && v.nsMotion !== 'static' },
      { id: 'nsSize', label: 'Text size', min: 0.03, max: 0.3, default: 0.065, step: 0.001, scale: 'log', random: [0.05, 0.12], showIf: isNs },
      { id: 'nsBox', label: 'Box', type: 'bool', default: false, random: 0.4, showIf: isNs },
      { id: 'nsBg', label: 'Screen color', type: 'color', default: '#0a1ec8', random: 'dark', showIf: isNs },
      { id: 'nsInk', label: 'Text color', type: 'color', default: '#ffffff', random: 'light', showIf: isNs },
      { id: 'chColor', label: 'Channel color', type: 'color', default: '#3cff3c', random: 'light', showIf: (v) => isNs(v) && String(v.channel || '').trim() !== '' },
      { id: 'clock', label: 'Clock', type: 'bool', default: true, random: 0.7, showIf: has('circle'), help: 'Running clock in the lower box (ticks while Animate is on)' },
      { id: 'ebuAmp', label: 'Bars', type: 'select', options: [['a75', '100/0/75/0'], ['a100', '100/0/100/0']], default: 'a75', random: ['a75', 'a75', 'a100'], showIf: has('ebu') },
      { id: 'gridRows', label: 'Divisions', type: 'int', min: 4, max: 40, default: 9, random: [6, 18], showIf: has('grid'), help: 'Cells from top to bottom' },
      { id: 'gridDots', label: 'Dots', type: 'bool', default: true, random: 0.6, showIf: has('grid') },
      { id: 'gridCircles', label: 'Circles', type: 'bool', default: true, random: 0.6, showIf: has('grid') },
      { id: 'safeStd', label: 'Safe areas', type: 'select', options: [['hd', 'HD (93% / 90%)'], ['sd', 'SD (90% / 80%)']], default: 'hd', random: ['hd', 'sd'], showIf: has('overscan') },
      { id: 'lineW', label: 'Line width', min: 0.5, max: 12, default: 3.5, step: 0.1, random: [1.5, 5], showIf: has('grid', 'overscan'), help: 'Thousandths of the card height' },
      { id: 'lineColor', label: 'Line color', type: 'color', default: '#ffffff', random: 'light', showIf: has('grid', 'overscan') },
      { id: 'bgColor', label: 'Background', type: 'color', default: '#000000', random: 'dark', showIf: has('grid', 'overscan') },
      { id: 'zpShape', label: 'Shape', type: 'select', options: [['circular', 'Circular (Fresnel)'], ['hyper', 'Hyperbolic']], default: 'circular', random: ['circular', 'circular', 'hyper'], showIf: has('zoneplate') },
      { id: 'zpRings', label: 'Rings', min: 5, max: 400, default: 28, step: 1, scale: 'log', random: [20, 120], showIf: has('zoneplate'), help: 'Rings from the centre to the top edge; past the pixel limit they fade to grey' },
      { id: 'zpSpeed', label: 'Speed', min: -10, max: 10, default: 2, step: 0.1, random: [-4, 4], showIf: has('zoneplate'), help: 'Rings per second while Animate is on' },
      { id: 'spokes', label: 'Spokes', type: 'int', min: 8, max: 180, default: 36, random: [18, 72], showIf: has('siemens') },
      { id: 'starSpin', label: 'Spin', min: -90, max: 90, default: 10, step: 1, unit: '°/s', random: [-30, 30], showIf: has('siemens'), help: 'Used while Animate is on' },
      { id: 'rampSteps', label: 'Steps', type: 'int', min: 0, max: 64, default: 0, random: [0, 32], showIf: has('rgbramp'), help: '0 = smooth 8-bit ramp' },
      { type: 'heading', label: 'Frame' },
      { id: 'frame', label: 'Aspect', type: 'select', options: [['native', 'Native'], ['r43', '4:3'], ['r169', '16:9'], ['fill', 'Fill screen']], default: 'native', random: ['native', 'native', 'native', 'r43', 'r169', 'fill'] },
      { id: 'repeat', label: 'Repeat', type: 'bool', default: false, random: 0.3, help: 'Tile the card as a pattern (zoom out to see more)' },
      { id: 'gap', label: 'Tile gap', min: 0, max: 0.5, default: 0.05, step: 0.005, random: [0, 0.12], showIf: (v) => v.repeat },
      { id: 'letterbox', label: 'Letterbox', type: 'color', default: '#000000', random: 'dark', showIf: letterboxVisible },
      { type: 'heading', label: 'Signal' },
      { id: 'levels', label: 'Levels', type: 'select', options: [['full', 'Full range (0–255)'], ['video', 'Video range (16–235)']], default: 'full', random: ['full', 'full', 'video'], help: 'Video range shows sub-black PLUGE bars as real codes (black = 16, white = 235)' },
      { id: 'labels', label: 'Labels', type: 'bool', default: true, random: 0.8, showIf: has('grayscale', 'resolution', 'colorchecker', 'rgbramp', 'overscan') },
    ],
    presets: [
      { name: 'SMPTE Bars', thumb: true, values: { card: 'smpte' } },
      { name: 'HD Bars', values: { card: 'smptehd' } },
      { name: 'EBU Bars', values: { card: 'ebu' } },
      { name: 'Circle Card', values: { card: 'circle', message: 'TEST CARD' } },
      { name: 'Convergence Grid', values: { card: 'grid' } },
      { name: 'Grayscale Steps', values: { card: 'grayscale' } },
      { name: 'Zone Plate', values: { card: 'zoneplate' }, play: true },
      { name: 'Focus Star', values: { card: 'siemens' } },
      { name: 'Color Checker', values: { card: 'colorchecker' } },
      { name: 'No Signal', values: { card: 'nosignal', nsMotion: 'bounce', channel: 'AV 1' }, play: true },
    ],
    textures: [
      {
        id: 'tcText', // R = glyph index per character, G of texel 0 = length; row 0 = message, row 1 = channel
        deps: ['message', 'channel'],
        filter: 'nearest',
        wrap: 'clamp',
        build(values) {
          const W = 40;
          const data = new Uint8Array(W * 2 * 4);
          [values.message, values.channel].forEach((s, row) => {
            const g = encode(s).slice(0, W);
            for (let i = 0; i < W; i++) {
              const k = (row * W + i) * 4;
              data[k] = g[i] || 0;
              data[k + 3] = 255;
            }
            data[row * W * 4 + 1] = g.length;
          });
          return { width: W, height: 2, data };
        },
      },
    ],
    glsl: headerGlsl + cardsGlsl + mainGlsl,
  });
})();
