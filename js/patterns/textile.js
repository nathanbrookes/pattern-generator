/* Textiles — two woven-cloth patterns.
 *   plaid : tartan setts (classic thread counts or generated from the seed + palette), woven warp × weft with a
 *           real 2/2 twill (or plain) interlacing, so crossings mix colours like cloth. The sett is built on the CPU
 *           into a small texture: one palette index per thread.
 *   weave : houndstooth (the true woven broken check), pied-de-poule, herringbone, chevron, basketweave, twill. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ plaid */

  // Classic setts as half-setts of [palette index, thread count]. Index meaning follows the 'Tartan Red' palette:
  // 0 red · 1 navy · 2 green · 3 yellow · 4 black · 5 white (any palette works; indices wrap).
  const SETTS = {
    stewart: [[0, 36], [1, 6], [4, 6], [3, 2], [4, 2], [5, 2], [4, 2], [2, 10], [0, 6], [4, 2], [0, 4], [5, 2]],
    blackwatch: [[1, 11], [4, 2], [1, 2], [4, 2], [1, 2], [4, 8], [2, 8], [4, 2], [2, 8], [4, 8], [1, 8], [4, 2]],
    gingham: [[0, 6], [5, 6]],
    buffalo: [[0, 12], [1, 12]],
    tattersall: [[5, 10], [0, 2], [5, 10], [2, 2]],
    glen: [[4, 4], [5, 4], [4, 4], [5, 4], [4, 4], [5, 4], [4, 2], [5, 2], [4, 2], [5, 2], [1, 2], [5, 2], [4, 2], [5, 2]],
  };

  // Random half-sett: wide ground/secondary blocks separated by groups of thin accent lines.
  function randomHalf(rng, n, count, bold) {
    const out = [];
    let prev = -1;
    const majors = Math.max(1, Math.min(count, 3));
    for (let i = 0; i < n; i++) {
      const wide = i % 2 === 0 || rng() < 0.25;
      let c = wide ? Math.floor(rng() * majors) : Math.floor(rng() * count);
      if (c === prev) c = (c + 1 + Math.floor(rng() * (count - 1))) % count;
      prev = c;
      const w = wide ? Math.round(6 + rng() * (6 + 30 * bold)) : 2 + Math.floor(rng() * 3);
      out.push([c, w]);
    }
    return out;
  }

  function expand(half, mirror) {
    const seq = mirror && half.length > 2 ? half.concat(half.slice(1, -1).reverse()) : half;
    const threads = [];
    for (const [c, w] of seq) for (let i = 0; i < w; i++) threads.push(c);
    return threads;
  }

  // Texture: row 0 = warp indices, row 1 = weft indices (one texel per thread),
  // row 2 = share of each palette index (R warp, G weft; texels 0–15) and sett lengths (texels 16, 17).
  function buildSett(v, { rng }) {
    const count = Math.max(1, (v.palette || []).length);
    let warpHalf, weftHalf;
    if (v.sett === 'random') {
      warpHalf = randomHalf(rng, v.stripes, count, v.bold);
      weftHalf = v.weftDiff ? randomHalf(rng, v.stripes, count, v.bold) : warpHalf;
    } else {
      warpHalf = weftHalf = SETTS[v.sett] || SETTS.stewart;
    }
    let warp = expand(warpHalf, v.mirror);
    let weft = expand(weftHalf, v.mirror);
    if (v.sett !== 'random' && count < 6) {
      // too few colours for the classic slots: give the most prominent slots distinct colours instead
      const tally = new Map();
      warp.concat(weft).forEach((c) => tally.set(c, (tally.get(c) || 0) + 1));
      const rank = new Map([...tally.keys()].sort((a, b) => tally.get(b) - tally.get(a)).map((c, i) => [c, i % count]));
      warp = warp.map((c) => rank.get(c));
      weft = weft.map((c) => rank.get(c));
    }
    const W = Math.max(18, warp.length, weft.length);
    const data = new Uint8Array(W * 3 * 4);
    const put = (x, y, r, g) => {
      const o = (y * W + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 3] = 255;
    };
    warp.forEach((c, i) => put(i, 0, c, 0));
    weft.forEach((c, i) => put(i, 1, c, 0));
    for (let k = 0; k < 16; k++) {
      const share = (arr) => Math.round((255 * arr.filter((c) => c === k).length) / arr.length);
      put(k, 2, share(warp), share(weft));
    }
    put(16, 2, warp.length & 255, warp.length >> 8);
    put(17, 2, weft.length & 255, weft.length >> 8);
    return { width: W, height: 3, data };
  }

  const isRandom = (v) => v.sett === 'random';

  PG.registerPattern({
    id: 'plaid',
    name: 'Plaid & Tartan',
    category: 'Textile',
    description: 'Woven tartans and checks: classic setts or seeded ones, with real twill interlacing where warp and weft cross.',
    params: [
      { type: 'heading', label: 'Sett' },
      {
        id: 'sett',
        label: 'Sett',
        type: 'select',
        options: [
          ['random', 'Random (from seed)'],
          ['stewart', 'Royal Stewart'],
          ['blackwatch', 'Black Watch'],
          ['gingham', 'Gingham'],
          ['buffalo', 'Buffalo check'],
          ['tattersall', 'Tattersall'],
          ['glen', 'Glen check'],
        ],
        default: 'stewart',
        random: ['random', 'random', 'random', 'stewart', 'blackwatch', 'gingham', 'tattersall', 'glen'],
        help: 'Stripe sequence. Colours come from the palette (classic setts use slots red, navy, green, yellow, black, white)',
      },
      { id: 'stripes', label: 'Stripes', type: 'int', min: 2, max: 14, default: 7, random: [4, 10], showIf: isRandom },
      { id: 'bold', label: 'Block width', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.2, 0.9], showIf: isRandom },
      { id: 'mirror', label: 'Mirrored sett', type: 'bool', default: true, random: 0.8, help: 'Symmetric sett that reflects at each pivot, like most tartans' },
      { id: 'weftDiff', label: 'Different weft', type: 'bool', default: false, random: 0.2, showIf: isRandom },

      { type: 'heading', label: 'Weave' },
      { id: 'thread', label: 'Thread size', min: 0.002, max: 0.06, default: 0.009, step: 0.0001, scale: 'log', random: [0.005, 0.016] },
      { id: 'weave', label: 'Weave', type: 'select', options: [['twill', '2/2 twill'], ['plain', 'Plain weave']], default: 'twill', random: ['twill', 'twill', 'plain'] },
      { id: 'texture', label: 'Weave texture', min: 0, max: 1, default: 0.75, step: 0.01, random: [0.4, 1], help: '0 = flat printed look, 1 = every thread visible' },
      { id: 'fuzz', label: 'Wool fuzz', min: 0, max: 1, default: 0.35, step: 0.01, random: [0.1, 0.6] },
      { id: 'angle', label: 'Rotation', min: -90, max: 90, default: 0, step: 1, unit: '°', random: false, help: '45° = cut on the bias' },

      { type: 'heading', label: 'Color' },
      { id: 'palette', label: 'Palette', type: 'palette', default: 'Tartan Red' },
    ],
    presets: [
      { name: 'Royal Stewart', thumb: true, values: { sett: 'stewart', palette: 'Tartan Red' } },
      {
        name: 'Black Watch',
        values: { sett: 'blackwatch', thread: 0.0095, palette: ['#7a1018', '#1a2a5c', '#1f4d2e', '#c9a944', '#0b0d0f', '#e9e4d6'] },
      },
      {
        name: 'Dress Stewart',
        values: { sett: 'stewart', angle: 45, thread: 0.008, palette: ['#f1ede4', '#14306b', '#1d5b2f', '#e8c04a', '#141414', '#c2141e'] },
      },
      {
        name: 'Gingham',
        values: { sett: 'gingham', weave: 'plain', thread: 0.016, texture: 0.6, fuzz: 0.12, palette: ['#d8383f', '#fbf7f0'] },
      },
      {
        name: 'Buffalo Check',
        values: { sett: 'buffalo', thread: 0.016, texture: 0.85, fuzz: 0.55, palette: ['#b8141b', '#141212'] },
      },
      {
        name: 'Madras',
        values: { sett: 'random', stripes: 9, bold: 0.45, mirror: false, weftDiff: true, weave: 'plain', thread: 0.008, fuzz: 0.15, palette: ['#f2b705', '#e4572e', '#2a9d8f', '#ff70a6', '#3a86ff', '#fdf6e3', '#8338ec'] },
        seed: 7,
      },
      {
        name: 'Glen Check',
        values: { sett: 'glen', mirror: false, thread: 0.011, texture: 1, fuzz: 0.3, palette: ['#9c3b32', '#4a6fa5', '#5c5c5c', '#8a8a8a', '#262626', '#dcd8cf'] },
      },
      {
        name: 'Tattersall',
        values: { sett: 'tattersall', mirror: false, weave: 'plain', thread: 0.016, texture: 0.65, fuzz: 0.25, palette: ['#a3202a', '#13294b', '#2d5a3a', '#e0b74f', '#1b1b1b', '#f3ecd9'] },
      },
    ],
    textures: [{ id: 'threads', deps: ['sett', 'stripes', 'bold', 'mirror', 'weftDiff', 'palette', '$seed'], filter: 'nearest', wrap: 'clamp', build: buildSett }],
    glsl: /* glsl */ `
float pl_tex(int x, int row, int c) { return texelFetch(u_threads, ivec2(x, int(u_threads_size.y) - 1 - row), 0)[c] * 255.0; }
vec3 pl_col(float idx) { return u_palette[pg_wrapi(int(idx + 0.5), u_palette_count)]; }
// colour of thread i in row (0 warp, 1 weft) of a sett of length len
vec3 pl_thread(int row, float i, float len) { return pl_col(pl_tex(int(mod(i, len)), row, 0)); }

// Stripe colour box-filtered over a footprint of r threads around x.
vec3 pl_stripe(int row, float x, float r, float len) {
  if (r <= 1.0) {
    float x1 = x + 0.5 * r, i1 = floor(x1);
    float w = u_tf_aa > 0.5 ? clamp((x1 - i1) / max(r, 1e-4), 0.0, 1.0) : step(i1, x);
    return mix(pl_thread(row, i1 - 1.0, len), pl_thread(row, i1, len), w);
  }
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 6; k++) acc += pl_thread(row, floor(x + (float(k) - 2.5) / 6.0 * r), len);
  return acc / 6.0;
}

// Average colour of a whole sett row (used once threads are far below pixel size).
vec3 pl_average(int c) {
  vec3 a = vec3(0.0); float n = 0.0;
  for (int k = 0; k < 16; k++) { float w = pl_tex(k, 2, c); a += w * pl_col(float(k)); n += w; }
  return a / max(n, 1.0);
}

vec4 pattern(vec2 p) {
  vec2 t = (pg_rot(radians(u_angle)) * p) / u_thread;    // thread coordinates (x = warp, y = weft)
  float r = pg_px / u_thread;                              // pixel footprint in threads
  float lenW = pl_tex(16, 2, 0) + 256.0 * pl_tex(16, 2, 1);
  float lenF = pl_tex(17, 2, 0) + 256.0 * pl_tex(17, 2, 1);

  // far away: plain average of the cloth
  float far = smoothstep(6.0, 22.0, r);
  vec3 avg = 0.5 * (pl_average(0) + pl_average(1));
  if (far >= 1.0) return vec4(avg, 1.0);

  vec3 warpC = pl_stripe(0, t.x, r, lenW);
  vec3 weftC = pl_stripe(1, t.y, r, lenF);
  vec3 blend = 0.5 * (warpC + weftC);                       // what the eye mixes from a distance

  // individual threads: which one floats on top, and a rounded-thread shading along its float
  vec2 i = floor(t), f = t - i;
  bool twill = u_weave == WEAVE_TWILL;
  float k = twill ? mod(i.x + i.y, 4.0) : mod(i.x + i.y, 2.0);
  bool warpTop = twill ? k < 2.0 : k < 1.0;
  float across = warpTop ? f.x : f.y;
  float along = twill ? ((warpTop ? k : k - 2.0) + (warpTop ? f.y : f.x)) * 0.5 : (warpTop ? f.y : f.x);
  float prof = sqrt(max(1.0 - pow(2.0 * across - 1.0, 2.0), 0.0)) * pow(max(sin(PG_PI * along), 0.0), 0.35);
  vec3 top = warpTop ? pl_thread(0, i.x, lenW) : pl_thread(1, i.y, lenF);
  float tid = warpTop ? i.x : i.y + 7919.0;
  vec3 woven = top * (0.68 + 0.42 * prof) * (1.0 + u_fuzz * 0.14 * (pg_hash12(vec2(tid, 3.1)) - 0.5));

  float detail = u_texture * (1.0 - smoothstep(0.22, 0.5, r));
  vec3 col = mix(blend, woven, detail);
  // woolly mottling at a few threads' scale, fading out with distance
  col *= 1.0 + u_fuzz * 0.12 * pg_fbm(t * 0.18, 3) * (1.0 - smoothstep(1.0, 4.0, r));
  return vec4(mix(col, avg, far), 1.0);
}
`,
  });

  /* ------------------------------------------------------------------ weave */

  const modeIs = (...m) => (v) => m.includes(v.mode);

  PG.registerPattern({
    id: 'weave',
    name: 'Houndstooth & Weaves',
    category: 'Textile',
    description: 'Woven-cloth motifs: true houndstooth and pied-de-poule, herringbone tweed, chevron, basketweave and twill.',
    params: [
      { type: 'heading', label: 'Weave' },
      {
        id: 'mode',
        label: 'Pattern',
        type: 'select',
        options: [
          ['houndstooth', 'Houndstooth'],
          ['pieddepoule', 'Pied-de-poule'],
          ['herringbone', 'Herringbone'],
          ['chevron', 'Chevron'],
          ['basketweave', 'Basketweave'],
          ['twill', 'Twill'],
        ],
        default: 'houndstooth',
      },
      { id: 'size', label: 'Size', min: 0.02, max: 1.5, default: 0.085, step: 0.001, scale: 'log', random: [0.05, 0.3] },
      { id: 'angle', label: 'Rotation', min: -90, max: 90, default: 0, step: 1, unit: '°', random: [-45, 45] },

      { type: 'heading', label: 'Shape' },
      { id: 'tooth', label: 'Tooth shape', min: -0.25, max: 0.25, default: 0, step: 0.005, random: [-0.08, 0.08], showIf: modeIs('houndstooth', 'pieddepoule'), help: 'Shifts the diagonal teeth against the checks' },
      { id: 'duty', label: 'Line / gap', min: 0.15, max: 0.85, default: 0.5, step: 0.01, random: [0.38, 0.62] },
      { id: 'stripes', label: 'Stripes', type: 'int', min: 2, max: 10, default: 4, random: [3, 6], showIf: modeIs('herringbone', 'chevron', 'basketweave'), help: 'Stripes per column (herringbone, chevron) or strips per square (basketweave); Size sets the width of one stripe' },

      { type: 'heading', label: 'Color' },
      { id: 'colorA', label: 'Color A', type: 'color', default: '#161616', random: 'dark' },
      { id: 'colorB', label: 'Color B', type: 'color', default: '#f2eee5', random: 'light' },

      { type: 'heading', label: 'Texture' },
      { id: 'fabric', label: 'Fabric texture', min: 0, max: 1, default: 0.3, step: 0.01, random: [0, 0.6], help: 'Thread grain and mottling' },
      { id: 'relief', label: 'Relief', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.2, 0.8], showIf: modeIs('basketweave', 'twill', 'herringbone') },
    ],
    presets: [
      { name: 'Classic Houndstooth', thumb: true, values: {} },
      { name: 'Giant Houndstooth', values: { size: 0.36, colorA: '#1c2541', colorB: '#efe7d6', fabric: 0.2 } },
      { name: 'Pop Houndstooth', values: { size: 0.15, colorA: '#ff2e7e', colorB: '#ffe45c', fabric: 0 } },
      { name: 'Pied-de-poule', values: { mode: 'pieddepoule', size: 0.11, colorA: '#4a2f1d', colorB: '#efe2c8', fabric: 0.35 } },
      { name: 'Herringbone Tweed', values: { mode: 'herringbone', size: 0.05, stripes: 4, duty: 0.5, colorA: '#3d3a36', colorB: '#a39a8b', fabric: 0.7, relief: 0.55 } },
      { name: 'Chevron', values: { mode: 'chevron', size: 0.068, stripes: 3, duty: 0.5, colorA: '#15314f', colorB: '#f1c24b', fabric: 0 } },
      { name: 'Basketweave', values: { mode: 'basketweave', size: 0.058, stripes: 3, duty: 0.82, colorA: '#d6b27a', colorB: '#4b331d', fabric: 0.35, relief: 0.75 } },
      { name: 'Denim Twill', values: { mode: 'twill', size: 0.045, duty: 0.7, colorA: '#1f3b66', colorB: '#9aa8c2', fabric: 0.9, relief: 0.7 } },
    ],
    glsl: /* glsl */ `
#define PDP_T 4.0
// Box-filtered square wave: 1 where fract(x) < d, averaged over a footprint w (in x units).
float wv_F(float x, float d) { return floor(x) * d + min(fract(x), d); }
float wv_sq(float x, float d, float w) {
  if (u_tf_aa < 0.5) return step(fract(x), d);
  w = max(w, 1e-5);
  float v = (wv_F(x + 0.5 * w, d) - wv_F(x - 0.5 * w, d)) / w;
  // a box filter still rings near one period: settle on the mean before the stripes drop below ~2 px
  return mix(v, d, smoothstep(0.4, 0.8, w * float(max(u_ss, 1))));
}

// Thread-level cloth: value of thread cell c (0 = colour B, 1 = colour A).
//   kind 0: woven check (T threads per dark/light block, 2/2 twill) = pied-de-poule; kind 1: twill;
//   kind 2: herringbone (T threads per column).
float wv_cell(vec2 c, int kind, float T) {
  float ph = floor(u_tooth * 8.0 + 0.5);
  float dir = 1.0;
  if (kind == 2) {                       // herringbone: twill reverses every T threads, broken by half a rib
    float col = mod(floor(c.x / T), 2.0);
    dir = col < 0.5 ? 1.0 : -1.0;
    ph += col * (2.0 * T + 1.0);        // 2T-1 would mirror seamlessly (chevron); +2 more = the break
  }
  bool top = mod(dir * c.x - c.y + ph, 4.0) < floor(4.0 * u_duty + 0.5);
  if (kind != 0) return top ? 1.0 : 0.0;
  float warp = mod(floor(c.x / T), 2.0) < 0.5 ? 1.0 : 0.0;
  float weft = mod(floor(c.y / T), 2.0) < 0.5 ? 1.0 : 0.0;
  return top ? warp : weft;
}
// Box filter over the 4 cells around the nearest grid corner: exact for footprints up to one thread.
float wv_cells(vec2 t, float w, int kind, float T, float mean) {
  vec2 c = floor(t + 0.5);
  vec2 a = u_tf_aa > 0.5 ? clamp((t - c) / max(w, 1e-4) + 0.5, 0.0, 1.0) : step(c, t);
  float v = mix(mix(wv_cell(c - 1.0, kind, T), wv_cell(c - vec2(0.0, 1.0), kind, T), a.x),
                mix(wv_cell(c - vec2(1.0, 0.0), kind, T), wv_cell(c, kind, T), a.x), a.y);
  return mix(v, mean, smoothstep(0.5, 1.0, w * float(max(u_ss, 1))));
}

// True houndstooth, as woven: dark/light warp and weft in blocks of one check, interlaced by a 2/2 twill
// whose diagonal repeats once per check. Where warp is on top we see the warp colour, else the weft's.
float wv_houndstooth(vec2 q, float w) {
  float warp = wv_sq(q.x * 0.5, 0.5, 0.5 * w);
  float weft = wv_sq(q.y * 0.5, 0.5, 0.5 * w);
  float top = wv_sq(q.x - q.y + u_tooth, u_duty, 1.4142 * w);
  return mix(weft, warp, top);
}

vec4 pattern(vec2 p) {
  vec2 q = (pg_rot(radians(u_angle)) * p) / u_size;
  float w = pg_px / u_size;                 // pixel footprint in pattern cells
  float n = u_stripes;
  float v;                                  // 0 = colour B, 1 = colour A
  float shade = 1.0;
  float gk;                                 // threads per cell, for the fabric texture

  if (u_mode == MODE_HOUNDSTOOTH) {
    v = wv_houndstooth(q, w);
    gk = 8.0;
  } else if (u_mode == MODE_PIEDDEPOULE) {
    // the same weave resolved into 4 threads per check: smaller, stepped 'hen's-foot' teeth
    float T = PDP_T;
    v = wv_cells(q * T, w * T, 0, T, 0.5);
    gk = T;
  } else if (u_mode == MODE_HERRINGBONE) {
    // broken twill on a thread grid: one rib per cell (4 threads), 'Stripes' ribs per column
    vec2 t = q * 4.0;
    float mean = floor(4.0 * u_duty + 0.5) * 0.25;
    v = wv_cells(t, 4.0 * w, 2, 4.0 * n, mean);
    float across = v > 0.5 ? fract(t.x) : fract(t.y);
    shade = mix(1.0, 0.7 + 0.4 * sqrt(max(1.0 - pow(2.0 * across - 1.0, 2.0), 0.0)), u_relief * (1.0 - smoothstep(0.12, 0.3, 4.0 * w)));
    // from afar the two twill directions catch the light differently, so the columns stay faintly visible
    float sheen = wv_sq(q.x / (2.0 * n), 0.5, w / (2.0 * n)) - 0.5;
    shade *= 1.0 + 0.12 * sheen * smoothstep(0.2, 0.7, 4.0 * w * float(max(u_ss, 1)));
    gk = 4.0;
  } else if (u_mode == MODE_CHEVRON) {
    // one stripe per cell, zig-zagging every 'Stripes' cells
    float zig = abs(mod(q.x, 2.0 * n) - n);
    v = wv_sq(q.y + zig, u_duty, 1.4142 * w);
    gk = 8.0;
  } else if (u_mode == MODE_BASKETWEAVE) {
    // squares of n parallel strips (one strip per cell), alternately horizontal and vertical
    vec2 sq = q / n;
    float hx = wv_sq(sq.x * 0.5, 0.5, 0.5 * w / n), hy = wv_sq(sq.y * 0.5, 0.5, 0.5 * w / n);
    float horiz = hx + hy - 2.0 * hx * hy;
    // strips are centred in their cell (gap straddles the cell edge), so each square is symmetric
    float off = 0.5 * (1.0 - u_duty);
    v = mix(wv_sq(q.x - off, u_duty, w), wv_sq(q.y - off, u_duty, w), horiz);
    // relief: each strip is rounded across and dips where it passes under the neighbouring square
    vec2 c = fract(sq);
    float rh = sin(PG_PI * clamp(fract(q.y - off) / u_duty, 0.0, 1.0)) * smoothstep(0.0, 0.18, c.x) * smoothstep(1.0, 0.82, c.x);
    float rv = sin(PG_PI * clamp(fract(q.x - off) / u_duty, 0.0, 1.0)) * smoothstep(0.0, 0.18, c.y) * smoothstep(1.0, 0.82, c.y);
    float r = mix(rv * 0.92, rh, horiz);
    shade = mix(1.0, 0.55 + 0.55 * sqrt(max(r, 0.0)), u_relief * (1.0 - smoothstep(0.1, 0.3, w)));
    gk = 6.0;
  } else {
    // twill: warp (A) floats over weft (B) along diagonal ribs, one rib per cell, threads 1/4 cell wide
    vec2 t = q * 4.0;
    v = wv_cells(t, 4.0 * w, 1, 1.0, floor(4.0 * u_duty + 0.5) * 0.25);
    float across = v > 0.5 ? fract(t.x) : fract(t.y);
    shade = mix(1.0, 0.7 + 0.4 * sqrt(max(1.0 - pow(2.0 * across - 1.0, 2.0), 0.0)), u_relief * (1.0 - smoothstep(0.12, 0.3, 4.0 * w)));
    gk = 4.0;
  }

  vec3 col = mix(u_colorB, u_colorA, clamp(v, 0.0, 1.0)) * shade;
  if (u_fabric > 0.0) {
    // fine thread grain + per-thread tone + soft mottling, all fading out once threads go sub-pixel
    vec2 grain = q * gk;
    float vis = 1.0 - smoothstep(0.15, 0.4, w * gk);
    vec2 gi = floor(grain);
    float threads = (0.5 + 0.5 * cos(PG_TAU * grain.x)) * (0.5 + 0.5 * cos(PG_TAU * grain.y));
    float tone = pg_hash12(vec2(gi.x, 1.7)) + pg_hash12(vec2(2.3, gi.y)) - 1.0;
    col *= 1.0 + u_fabric * (vis * (0.16 * (threads - 0.25) + 0.08 * tone) + 0.08 * pg_fbm(q * 1.7, 3));
  }
  return vec4(col, 1.0);
}
`,
  });
})();
