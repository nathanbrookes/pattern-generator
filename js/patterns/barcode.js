/* 2D Barcodes — infinite walls of QR, Data Matrix, Aztec and MaxiCode-style symbols, generated per tile in GLSL
 * from the seeded hash, plus a real, scannable QR code built on the CPU (js/lib/qrcode.js) from your text.
 * Modules are drawn per 2×2 neighbourhood so square modules join seamlessly and "liquid" modules can melt together. */
(function () {
  const isText = (v) => v.mode === 'text';
  const isSingle = (v) => v.mode === 'text' && v.single;
  const tiled = (v) => !isSingle(v);

  PG.registerPattern({
    id: 'barcode',
    name: '2D Barcodes',
    category: 'Digital',
    description: 'Fields of QR, Data Matrix, Aztec and MaxiCode symbols — or a real, scannable QR code from your text.',
    params: [
      { type: 'heading', label: 'Codes' },
      {
        id: 'mode',
        label: 'Type',
        type: 'select',
        options: [
          ['qr', 'QR field'],
          ['datamatrix', 'Data Matrix field'],
          ['aztec', 'Aztec field'],
          ['maxi', 'MaxiCode (hex) field'],
          ['mixed', 'Mixed codes'],
          ['text', 'Real QR from text'],
        ],
        default: 'qr',
        random: ['qr', 'qr', 'datamatrix', 'aztec', 'maxi', 'mixed', 'mixed'],
      },
      { id: 'text', label: 'Text / URL', type: 'text', default: 'https://example.com', rows: 2, showIf: isText, random: false },
      {
        id: 'ecc',
        label: 'Error correction',
        type: 'select',
        options: [
          ['L', 'L — 7%'],
          ['M', 'M — 15%'],
          ['Q', 'Q — 25%'],
          ['H', 'H — 30%'],
        ],
        default: 'M',
        showIf: isText,
        random: false,
      },
      { id: 'single', label: 'Single code', help: 'One centred code on the wall (off = tiled)', type: 'bool', default: true, showIf: isText, random: false },
      { id: 'fit', label: 'Code scale', min: 0.2, max: 1, default: 0.8, step: 0.01, showIf: isSingle, random: [0.6, 0.9], help: 'Size of the code card relative to the view height' },
      { id: 'codeSize', label: 'Code size', type: 'int', min: 10, max: 57, default: 25, showIf: (v) => !isText(v) && v.mode !== 'maxi', random: [15, 33], help: 'Modules per side — snapped to valid symbol sizes for each code type' },
      { id: 'density', label: 'Data density', min: 0.1, max: 0.9, default: 0.5, step: 0.01, showIf: (v) => !isText(v), random: [0.38, 0.62], help: 'Fraction of dark data modules' },
      { id: 'speed', label: 'Data refresh', min: 0, max: 8, default: 1, step: 0.05, showIf: (v) => !isText(v), random: false, help: 'With Animate on: how often data modules flip' },

      { type: 'heading', label: 'Layout' },
      { id: 'moduleSize', label: 'Module size', min: 0.003, max: 0.2, default: 0.016, step: 0.0005, scale: 'log', showIf: tiled, random: [0.011, 0.03] },
      { id: 'quiet', label: 'Quiet zone', min: 0, max: 6, default: 2, step: 0.5, random: [1, 3], help: 'Blank margin around each code, in modules (QR spec: 4)' },
      { id: 'spacing', label: 'Spacing', min: 0, max: 12, default: 1.5, step: 0.5, showIf: tiled, random: [0, 4], help: 'Gap between code cards, in modules' },
      {
        id: 'layout',
        label: 'Layout',
        type: 'select',
        options: [
          ['grid', 'Grid'],
          ['brick', 'Brick'],
          ['mosaic', 'Mosaic (mixed sizes)'],
        ],
        default: 'mosaic',
        showIf: tiled,
      },
      { id: 'merge', label: 'Big codes', min: 0, max: 1, default: 0.45, step: 0.01, showIf: (v) => tiled(v) && v.layout === 'mosaic', random: [0.2, 0.7] },
      { id: 'turn', label: 'Random rotation', type: 'bool', default: false, showIf: (v) => !isText(v), random: 0.4 },
      { id: 'empty', label: 'Empty tiles', min: 0, max: 0.8, default: 0, step: 0.01, showIf: tiled, random: [0, 0.25] },

      { type: 'heading', label: 'Modules' },
      {
        id: 'style',
        label: 'Module style',
        type: 'select',
        options: [
          ['square', 'Square'],
          ['rounded', 'Rounded'],
          ['dots', 'Dots'],
          ['liquid', 'Liquid'],
        ],
        default: 'square',
      },
      { id: 'gap', label: 'Module gap', min: 0, max: 0.6, default: 0, step: 0.01, showIf: (v) => v.style !== 'liquid', random: [0, 0.22] },
      { id: 'eyes', label: 'Solid finders', type: 'bool', default: true, showIf: (v) => v.style === 'rounded' || v.style === 'dots', random: 0.7, help: 'Draw finder patterns (QR eyes, Data Matrix L, Aztec bullseye) as connected shapes — keeps styled codes scannable' },
      { id: 'round', label: 'Roundness', min: 0, max: 1, default: 0.6, step: 0.01, showIf: (v) => v.style === 'rounded' || v.style === 'liquid', random: [0.35, 1] },

      { type: 'heading', label: 'Color' },
      {
        id: 'colorMode',
        label: 'Ink',
        type: 'select',
        options: [
          ['solid', 'Solid'],
          ['code', 'Gradient per code'],
          ['sweep', 'Gradient sweep'],
          ['palette', 'Palette per code'],
        ],
        default: 'solid',
        random: ['solid', 'solid', 'code', 'sweep', 'palette'],
      },
      { id: 'fg', label: 'Ink color', type: 'color', default: '#121418', showIf: (v) => v.colorMode === 'solid', random: false },
      { id: 'fgGrad', label: 'Ink gradient', type: 'gradient', default: 'Vaporwave', showIf: (v) => v.colorMode === 'code' || v.colorMode === 'sweep' },
      { id: 'fgPal', label: 'Ink palette', type: 'palette', default: 'Primary', showIf: (v) => v.colorMode === 'palette' },
      { id: 'bg', label: 'Card color', help: 'Code background (quiet zone and light modules)', type: 'color', default: '#f5f3ee', random: false },
      { id: 'wall', label: 'Wall', type: 'color', default: '#1b1e24', random: false, showIf: (v) => isSingle(v) || v.spacing > 0 || v.empty > 0 },
      { id: 'invert', label: 'Invert', help: 'Light modules on an ink-coloured card', type: 'bool', default: false, random: 0.15 },
      { id: 'safe', label: 'Keep scannable', help: 'Darken (or lighten) ink that is too close to the card color so phones can still read the code', type: 'bool', default: true, showIf: isText, random: false },
    ],
    presets: [
      { name: 'QR Field', thumb: true, values: {} },
      {
        name: 'Data Matrix Wall',
        values: { mode: 'datamatrix', codeSize: 18, layout: 'brick', spacing: 2, quiet: 1, moduleSize: 0.02, fg: '#2a1f14', bg: '#efe6d2', wall: '#9c7a52', turn: true },
      },
      {
        name: 'Aztec Grid',
        values: { mode: 'aztec', codeSize: 23, layout: 'grid', spacing: 0, quiet: 1.5, moduleSize: 0.017, style: 'liquid', round: 0.85, fg: '#0f3d91', bg: '#ffffff' },
      },
      {
        name: 'Mixed Codes',
        values: { mode: 'mixed', codeSize: 24, layout: 'mosaic', merge: 0.5, spacing: 2, quiet: 1.5, moduleSize: 0.014, turn: true, colorMode: 'palette', fgPal: 'Primary', bg: '#f7f3e8', wall: '#202020' },
      },
      {
        name: 'Real QR (scan me)',
        values: { mode: 'text', text: 'https://example.com', ecc: 'M', single: true, fit: 0.82, quiet: 4, fg: '#111111', bg: '#ffffff', wall: '#2b2f38' },
      },
      {
        name: 'Dot Codes',
        values: { mode: 'qr', codeSize: 29, style: 'dots', gap: 0.12, layout: 'grid', spacing: 3, quiet: 1, moduleSize: 0.013, colorMode: 'code', fgGrad: 'Sunset', bg: '#fffaf2', wall: '#efe4d4' },
      },
      {
        name: 'Neon Codes',
        values: { mode: 'mixed', codeSize: 25, style: 'rounded', round: 0.7, gap: 0.14, layout: 'mosaic', merge: 0.45, spacing: 1.5, quiet: 1, moduleSize: 0.016, colorMode: 'sweep', fgGrad: 'Neon', bg: '#07070c', wall: '#000000', turn: true },
      },
      {
        name: 'MaxiCode Hive',
        values: { mode: 'maxi', style: 'square', gap: 0.16, layout: 'brick', spacing: 1.5, quiet: 1, moduleSize: 0.016, fg: '#1a1a1a', bg: '#f2c94c', wall: '#151515' },
      },
    ],
    textures: [
      {
        id: 'qr', // real QR matrix: R = 255 for dark modules
        deps: ['text', 'ecc'],
        filter: 'nearest',
        wrap: 'clamp',
        build(values) {
          // Work-around for a core quirk: the engine uploads this texture on whichever texture unit is active —
          // the one it has just bound the ink gradient to — so that sampler would read the QR matrix for this
          // frame (and in one-shot renders: contact sheet, thumbnails, exports). Park the upload on the last unit.
          const gl = PG.app && PG.app.renderer && PG.app.renderer.gl;
          if (gl) gl.activeTexture(gl.TEXTURE0 + gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) - 1);
          const q = PG.qr.encode(values.text, values.ecc);
          const n = q.size;
          const data = new Uint8Array(n * n * 4);
          for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
              const i = (y * n + x) * 4;
              data[i] = q.modules[y][x] ? 255 : 0;
              data[i + 3] = 255;
            }
          }
          return { width: n, height: n, data };
        },
      },
    ],
    glsl: /* glsl */ `
#define BC_QR 0
#define BC_DM 1
#define BC_AZ 2
#define BC_MAXI 3
#define BC_TEXT 4

// Current code (set once per sample in pattern()).
int   bc_type = BC_QR;
int   bc_N = 21;       // modules per side
float bc_s = 0.0;      // per-code random seed
float bc_mod = 0.02;   // module size in pattern units
float bc_hh = 0.5;     // module half-size after the gap (module units)
float bc_rad = 0.0;    // module corner radius (module units)

// ---- random data module (seeded), optionally flipping over time
float bcData(ivec2 m) {
  vec2 k = vec2(m) + vec2(bc_s, bc_s * 1.618);
  float h = pg_hash12(k);
  if (u_speed > 0.0) h = pg_hash12(k + floor(u_time * u_speed + h * 7.0) * 0.137);
  return h < u_density ? 1.0 : 0.0;
}

// ---- QR alignment-pattern centre on one axis within ±2 of coordinate c (spec layout, versions 2–40), else -1.
// Combinations that would overlap the finders are skipped by the caller.
int bcAlignAxis(int c, int N) {
  int v = (N - 17) / 4;
  if (v < 2) return -1;
  if (abs(c - 6) <= 2) return 6;
  int na = v / 7 + 2;
  int st = ((v * 8 + na * 3 + 5) / (na * 4 - 4)) * 2;
  int k = (N - 7 - c + st / 2) / st;
  int pos = N - 7 - k * st;
  return (k >= 0 && k <= na - 2 && abs(c - pos) <= 2) ? pos : -1;
}

// ---- QR-like: 3 finders + separators, timing, alignment grid, dark module, random data. m is y-up.
float bcQR(ivec2 m) {
  int N = bc_N, c = m.x, r = N - 1 - m.y;
  ivec2 f = ivec2(-1);
  if (c < 8 && r < 8) f = ivec2(3);
  else if (c >= N - 8 && r < 8) f = ivec2(N - 4, 3);
  else if (c < 8 && r >= N - 8) f = ivec2(3, N - 4);
  if (f.x >= 0) { int d = max(abs(c - f.x), abs(r - f.y)); return (d <= 1 || d == 3) ? 1.0 : 0.0; }
  int ax = bcAlignAxis(c, N), ay = bcAlignAxis(r, N), last = N - 7;
  bool corner = (ax == 6 && ay == 6) || (ax == 6 && ay == last) || (ax == last && ay == 6);
  if (ax >= 0 && ay >= 0 && !corner) return max(abs(c - ax), abs(r - ay)) == 1 ? 0.0 : 1.0;
  if (r == 6) return c % 2 == 0 ? 1.0 : 0.0;
  if (c == 6) return r % 2 == 0 ? 1.0 : 0.0;
  if (c == 8 && r == N - 8) return 1.0;
  return bcData(m);
}

// ---- Data Matrix: solid L finder (left + bottom), clock track (top + right); 2×2 regions above 26 modules.
float bcDM(ivec2 m) {
  int R = bc_N > 26 ? bc_N / 2 : bc_N;
  int x = m.x % R, y = m.y % R;
  if (x == 0 || y == 0) return 1.0;
  if (y == R - 1) return x % 2 == 0 ? 1.0 : 0.0;
  if (x == R - 1) return y % 2 == 0 ? 1.0 : 0.0;
  return bcData(m);
}

// ---- Aztec: concentric bullseye, mode ring with orientation marks, reference grid (full-range symbols).
float bcAztec(ivec2 m) {
  int c = (bc_N - 1) / 2;
  ivec2 o = m - ivec2(c);
  ivec2 a = abs(o);
  int d = max(a.x, a.y);
  bool compact = bc_N < 31;
  int ring = compact ? 5 : 7;
  if (d < ring) return d % 2 == 0 ? 1.0 : 0.0;
  if (d == ring) {
    if (a.x >= ring - 1 && a.y >= ring - 1) {          // orientation marks: 3 top-left, 2 top-right, 1 bottom-right
      if (o.x < 0 && o.y > 0) return 1.0;
      if (o.x > 0 && o.y > 0) return o.x == ring ? 1.0 : 0.0;
      if (o.x > 0 && o.y < 0) return (o.x == ring && o.y == 1 - ring) ? 1.0 : 0.0;
      return 0.0;
    }
    if (!compact && (o.x == 0 || o.y == 0)) return 0.0;
    return bcData(m);
  }
  if (!compact) {
    if (a.x % 16 == 0) return a.y % 2 == 0 ? 1.0 : 0.0;
    if (a.y % 16 == 0) return a.x % 2 == 0 ? 1.0 : 0.0;
  }
  return bcData(m);
}

float bcModule(ivec2 m) {
  if (m.x < 0 || m.y < 0 || m.x >= bc_N || m.y >= bc_N) return 0.0;
  if (bc_type == BC_TEXT) return texelFetch(u_qr, m, 0).r > 0.5 ? 1.0 : 0.0;
  if (bc_type == BC_DM) return bcDM(m);
  if (bc_type == BC_AZ) return bcAztec(m);
  return bcQR(m);
}

// Finder structures (QR eyes, Data Matrix L, Aztec bullseye) — drawn connected when "Solid finders" is on.
bool bcIsEye(ivec2 m) {
  if (u_eyes < 0.5 || u_style == STYLE_SQUARE || u_style == STYLE_LIQUID) return false;
  if (m.x < 0 || m.y < 0 || m.x >= bc_N || m.y >= bc_N) return false;
  if (bc_type == BC_DM) { int R = bc_N > 26 ? bc_N / 2 : bc_N; return m.x % R == 0 || m.y % R == 0; }
  if (bc_type == BC_AZ) { ivec2 o = abs(m - ivec2((bc_N - 1) / 2)); return max(o.x, o.y) < (bc_N < 31 ? 5 : 7); }
  int c = m.x, r = bc_N - 1 - m.y, e = bc_N - 7;
  if ((c < 7 && r < 7) || (c >= e && r < 7) || (c < 7 && r >= e)) return true;
  int ax = bcAlignAxis(c, bc_N), ay = bcAlignAxis(r, bc_N);
  return ax >= 0 && ay >= 0 && !((ax == 6 && ay == 6) || (ax == 6 && ay == e) || (ax == e && ay == 6));
}

// Coverage of one cell of the 2×2 block around the nearest module corner.
// w: position in this cell's frame (cell = [-1,0]², shared corner at the origin); n1, n2: its orthogonal neighbours
// in the block, diag: the opposite cell. Connected ("liquid") cells round only their free corners and fill concave ones.
float bcCell(vec2 w, float self, float n1, float n2, float diag, bool eye) {
  float sd;
  if (u_style == STYLE_LIQUID || eye) {
    float R = u_style == STYLE_DOTS ? 0.45 : 0.5 * u_round;
    if (self > 0.5) sd = n1 + n2 < 0.5 ? pg_sdRoundBox(w + 0.5, vec2(0.5), R) : pg_sdBox(w + 0.5, vec2(0.5));
    else if (n1 * n2 * diag > 0.5) sd = max(R - length(w + R), pg_sdBox(w + 0.5 * R, vec2(0.5 * R))); // concave fillet
    else return 0.0;
  } else {
    if (self < 0.5) return 0.0;
    sd = pg_sdRoundBox(w + 0.5, vec2(bc_hh), bc_rad);
  }
  return pg_fill(sd * bc_mod);
}

// Dark coverage at module-space point u (y-up, module units). Shapes never overlap, so coverages add up.
float bcCoverage(vec2 u) {
  vec2 cf = floor(u), f = u - cf;
  ivec2 c = ivec2(cf);
  ivec2 sg = ivec2(f.x < 0.5 ? -1 : 1, f.y < 0.5 ? -1 : 1);
  ivec2 ch = c + ivec2(sg.x, 0), cv = c + ivec2(0, sg.y), cd = c + sg;
  float C = bcModule(c), H = bcModule(ch), V = bcModule(cv), D = bcModule(cd);
  vec2 v = (f - 0.5) * vec2(sg) - 0.5;
  return min(1.0, bcCell(v, C, H, V, D, bcIsEye(c)) + bcCell(vec2(-v.x, v.y), H, C, D, V, bcIsEye(ch))
                + bcCell(vec2(v.x, -v.y), V, C, D, H, bcIsEye(cv)) + bcCell(-v, D, H, V, C, bcIsEye(cd)));
}

// MaxiCode-style: offset rows of hexagonal modules around a ring bullseye. u is centred on the code.
float bcMaxi(vec2 u) {
  vec4 h = pg_hexGrid(u);
  vec2 cc = u - h.xy;
  float cov = 0.0;
  if (abs(cc.x) < 14.75 && abs(cc.y) < 14.3 && length(cc) > 4.7 && bcData(ivec2(floor(cc * 2.0 + 0.5))) > 0.5) {
    float hh = min(bc_hh, 0.44);
    float sd = u_style == STYLE_DOTS ? length(h.xy) - hh : pg_sdHex(h.yx, hh - bc_rad * 0.6) - bc_rad * 0.6;
    cov = pg_fill(sd * bc_mod);
  }
  float r = length(u);
  float ring = min(min(abs(r - 1.05), abs(r - 2.25)), abs(r - 3.45)) - 0.38;
  return max(cov, pg_fill(ring * bc_mod));
}

// Palette ink for a code, skipping colours too close to the code background (they would make a blank card).
vec3 bcPaletteInk(int i) {
  int n = max(u_fgPal_count, 1);
  for (int k = 0; k < 16; k++) {
    if (k >= n) break;
    vec3 c = u_fgPal[pg_wrapi(i + k, n)];
    if (abs(pg_luma(c) - pg_luma(u_bg)) > 0.12 || length(c - u_bg) > 0.45) return c;
  }
  return u_fgPal[pg_wrapi(i, n)];
}

// Real QR: push the ink's brightness away from the card so scanners still see dark vs light (keeps the hue).
vec3 bcScanSafe(vec3 ink, vec3 paper, float gap) {
  float lp = pg_luma(paper), li = pg_luma(ink);
  if (lp >= 0.5) { float hi = max(lp - gap, 0.0); return li > hi ? ink * (hi / max(li, 1e-4)) : ink; }
  float lo = min(lp + gap, 1.0);
  return li < lo ? mix(ink, vec3(1.0), (lo - li) / max(1.0 - li, 1e-4)) : ink;
}

// Gradient sweep: ping-pongs through the gradient (no seam for non-cyclic gradients) and fades to the
// gradient's average where one sample spans much of a cycle, so it doesn't band or crawl near the horizon.
vec3 bcSweep(vec2 p) {
  float t = (p.x + 0.4 * p.y) * 0.22;
  vec3 c = pg_grad(u_fgGrad, 1.0 - abs(1.0 - 2.0 * fract(t * 0.5)));
  float w = pg_px * 0.24;                  // gradient cycles per sample
  if (w < 0.04) return c;
  vec3 avg = vec3(0.0);
  for (int i = 0; i < 16; i++) avg += pg_grad(u_fgGrad, (float(i) + 0.5) / 16.0);
  return mix(c, avg / 16.0, smoothstep(0.04, 0.35, w));
}

int bcSnap(int type, float n) {
  if (type == BC_QR) return 17 + 4 * int(clamp(floor((n - 17.0) / 4.0 + 0.5), 1.0, 10.0));
  if (type == BC_DM) return n < 29.0 ? 2 * int(clamp(floor(n * 0.5 + 0.5), 5.0, 13.0))
                                     : 32 + 4 * int(clamp(floor((n - 32.0) / 4.0 + 0.5), 0.0, 4.0));
  if (type == BC_AZ) return n < 29.0 ? 15 + 4 * int(clamp(floor((n - 15.0) / 4.0 + 0.5), 0.0, 3.0))
                          : n < 34.0 ? 31 : 37 + 4 * int(clamp(floor((n - 37.0) / 4.0 + 0.5), 0.0, 5.0));
  if (type == BC_MAXI) return 30;
  return int(u_qr_size.x);
}

vec4 pattern(vec2 p) {
  bool text = u_mode == MODE_TEXT;
  bool single = text && u_single > 0.5;
  int type0 = text ? BC_TEXT : u_mode == MODE_DATAMATRIX ? BC_DM : u_mode == MODE_AZTEC ? BC_AZ
            : u_mode == MODE_MAXI ? BC_MAXI : BC_QR;
  bool mixed = u_mode == MODE_MIXED;
  float q = u_quiet;
  float sp = single ? 0.0 : u_spacing;
  float N0 = mixed ? u_codeSize : float(bcSnap(type0, u_codeSize));

  // ---- tile layout → local ∈ [0,1]², tile id, scale (mosaic merges 2×2 / 4×4 tiles)
  float tileMods = N0 + 2.0 * q + sp;
  float T = u_moduleSize * tileMods;
  vec2 local, tid;
  float scale = 1.0;
  if (single) {
    T = 2.0 * u_fit;
    local = p / T + 0.5;
    tid = vec2(0.0);
  } else {
    vec2 g = p / T;
    if (u_layout == LAYOUT_BRICK) g.x += 0.5 * mod(floor(g.y), 2.0);
    tid = floor(g);
    if (u_layout == LAYOUT_MOSAIC) {
      vec2 b4 = floor(tid / 4.0), b2 = floor(tid / 2.0);
      if (pg_hash12(b4 + 0.25) < u_merge * 0.3) { scale = 4.0; tid = b4 * 4.0; }
      else if (pg_hash12(b2 + 0.75) < u_merge) { scale = 2.0; tid = b2 * 2.0; }
    }
    local = (g - tid) / scale;
  }
  float TS = T * scale;

  // ---- this tile's code
  vec3 hr = pg_hash32(tid + vec2(0.31, 0.77) * scale);
  bc_s = hr.x * 4096.0;
  bc_type = type0;
  float Nf = N0;
  if (mixed) {
    bc_type = hr.y < 0.36 ? BC_QR : hr.y < 0.66 ? BC_DM : hr.y < 0.9 ? BC_AZ : BC_MAXI;
    Nf = u_codeSize * mix(0.75, 1.3, fract(hr.z * 7.13));
  }
  if (scale > 1.0 && !text && hr.z < 0.5) Nf = Nf * scale + (scale - 1.0) * (2.0 * q + sp); // bigger symbol, same module size
  bc_N = bcSnap(bc_type, Nf);
  float N = float(bc_N);

  float inset = single ? 0.0 : 0.5 * sp / (tileMods * scale);
  vec2 cl = (local - 0.5) / (1.0 - 2.0 * inset);      // card-centred, card = [-0.5, 0.5]²
  float CS = TS * (1.0 - 2.0 * inset);                 // card side (pattern units)
  bc_mod = CS / (N + 2.0 * q);

  vec2 u = (cl + 0.5) * (N + 2.0 * q) - q;             // module coords, code = [0, N)²
  if (u_turn > 0.5 && !text) {
    vec2 c = u - 0.5 * N;
    int k = int(hr.z * 4.0);
    c = k == 1 ? vec2(-c.y, c.x) : k == 2 ? -c : k == 3 ? vec2(c.y, -c.x) : c;
    u = c + 0.5 * N;
  }

  // ---- module shape
  float gap = u_style == STYLE_LIQUID ? 0.0 : u_gap;
  bc_hh = 0.5 * (1.0 - gap);
  bc_rad = u_style == STYLE_DOTS ? bc_hh : u_style == STYLE_ROUNDED ? bc_hh * u_round : 0.0;

  float cov = bc_type == BC_MAXI ? bcMaxi(u - 0.5 * N) : bcCoverage(u);

  // Average dark coverage inside the code, for distance fading.
  float area = u_style == STYLE_LIQUID ? 1.0 : u_style == STYLE_DOTS ? 3.14159 * bc_hh * bc_hh
             : 4.0 * bc_hh * bc_hh - (4.0 - 3.14159) * bc_rad * bc_rad;
  float dark = (text ? 0.5 : mix(u_density, 0.5, 0.3)) * area * (bc_type == BC_MAXI ? 0.75 : 1.0);
  float fadeMod = u_tf_aa > 0.5 ? smoothstep(0.35, 1.0, pg_px / bc_mod) : 0.0;      // modules < 1px
  float fadeTile = single || u_tf_aa < 0.5 ? 0.0 : smoothstep(0.7, 2.5, pg_px / bc_mod); // quiet zone / gaps < 1px
  float inCode = step(0.0, min(u.x, u.y)) * step(max(u.x, u.y), N);
  cov = mix(cov, dark * inCode, fadeMod);

  // ---- colour
  vec3 ink;
  if (u_colorMode == COLORMODE_CODE) ink = pg_grad(u_fgGrad, 0.5 + 0.5 * (cl.x - cl.y));
  else if (u_colorMode == COLORMODE_SWEEP) ink = bcSweep(p);
  else if (u_colorMode == COLORMODE_PALETTE) ink = bcPaletteInk(int(fract(hr.x * 13.7) * 16.0));
  else ink = u_fg;
  if (text && u_safe > 0.5) ink = bcScanSafe(ink, u_bg, u_invert > 0.5 ? 0.6 : 0.42); // inverted: the ink is the dark ground
  vec3 paper = u_bg;
  if (u_invert > 0.5) { paper = ink; ink = u_bg; }
  vec3 col = mix(paper, ink, cov);

  // ---- card on the wall
  bool empty = !single && pg_hash12(tid + vec2(5.3, 1.9) * scale) < u_empty;
  float card;
  if (single || sp > 0.0) {
    float cr = (q > 0.0 || single) ? min(0.5 * q + 0.4, 2.0) * bc_mod : 0.0;
    card = pg_fill(pg_sdRoundBox(cl * CS, vec2(0.5 * CS), cr));
  } else {
    card = 1.0;
  }
  if (empty) card = 0.0;
  col = mix(u_wall, col, card);

  // Whole tile far away → its average colour (wall gaps, quiet zone and code blended by area).
  if (fadeTile > 0.0) {
    float codeFrac = N * N / ((N + 2.0 * q) * (N + 2.0 * q));
    float cardFrac = empty ? 0.0 : (1.0 - 2.0 * inset) * (1.0 - 2.0 * inset);
    vec3 avg = mix(u_wall, mix(paper, ink, dark * codeFrac), cardFrac);
    col = mix(col, avg, fadeTile);
  }
  return vec4(col, 1.0);
}
`,
  });
})();
