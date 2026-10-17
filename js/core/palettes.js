/* Pattern Generator — gradient + palette presets and helpers.
 * Gradient value: { stops: [[pos 0..1, '#rrggbb'], ...], mode: 'smooth' | 'steps' }
 *   'steps' = every position takes the colour of the nearest stop (hard bands).
 * Palette value: ['#rrggbb', ...] (1–16 colours). */
(function () {
  'use strict';
  const PG = window.PG;
  const U = PG.util;

  const even = (cols, mode) => ({
    stops: cols.map((c, i) => [mode === 'steps' ? (i + 0.5) / cols.length : cols.length === 1 ? 0 : i / (cols.length - 1), c]),
    mode: mode || 'smooth',
  });

  PG.gradients = [
    { name: 'Holo Film', ...even(['#ff4d5e', '#f4ef4c', '#5af08c', '#52d3ff', '#6a6cff', '#c160ff', '#ff4d5e']) },
    { name: 'Rainbow', ...even(['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#00ffff', '#0040ff', '#ff00ff', '#ff0000']) },
    { name: 'Pastel Prism', ...even(['#ff9aa2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea', '#e0b0ff', '#ff9aa2']) },
    { name: 'Oil Slick', ...even(['#1b1035', '#2b7a78', '#d4a017', '#b03a8a', '#3b5bdb', '#1b1035']) },
    { name: 'Vaporwave', ...even(['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96']) },
    { name: 'Neon', ...even(['#00ffd5', '#ff00e1', '#fff200', '#00ffd5']) },
    { name: 'Sunset', ...even(['#0b1d51', '#7b2d8b', '#e94f64', '#ffb26b', '#ffe9a8']) },
    { name: 'Fire', ...even(['#000000', '#5a0a00', '#d43400', '#ff9c00', '#fff3b0']) },
    { name: 'Ice', ...even(['#020b1a', '#0b3c74', '#2f8fd8', '#a8e6ff', '#ffffff']) },
    { name: 'Ocean', ...even(['#001219', '#005f73', '#0a9396', '#94d2bd', '#e9d8a6']) },
    { name: 'Magma', ...even(['#000004', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf']) },
    { name: 'Viridis', ...even(['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']) },
    { name: 'Toxic', ...even(['#0a0f0a', '#1aff5e', '#e7ff4a']) },
    { name: 'Chrome', ...even(['#151515', '#f2f2f2', '#4a4a4a', '#ffffff', '#202020', '#bdbdbd']) },
    { name: 'Gold', ...even(['#2b1a00', '#8a5a00', '#f5c542', '#fff4c2', '#8a5a00']) },
    { name: 'Blueprint', ...even(['#0d2b5e', '#1d4f9c', '#e8f1ff']) },
    { name: 'Mono', ...even(['#000000', '#ffffff']) },
    { name: 'Ink on Paper', ...even(['#f4efe3', '#1c1b22']) },
    { name: 'Game Boy', ...even(['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], 'steps') },
    { name: 'CMYK', ...even(['#00aeef', '#ec008c', '#fff200', '#1a1a1a'], 'steps') },
    { name: 'Candy Bands', ...even(['#ff5d8f', '#ffd166', '#06d6a0', '#118ab2', '#8338ec'], 'steps') },
    { name: 'Thermal', ...even(['#000000', '#3d00a8', '#c4007a', '#ff6a00', '#ffd400', '#ffffff']) },
  ];

  PG.palettes = [
    { name: 'Game Boy', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
    { name: '1-bit', colors: ['#000000', '#ffffff'] },
    { name: 'CGA', colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'] },
    { name: 'PICO-8', colors: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'] },
    { name: 'C64', colors: ['#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa', '#eeee77', '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66', '#0088ff', '#bbbbbb'] },
    { name: 'Woodland', colors: ['#2c3322', '#4b5a33', '#7a6a43', '#1a1a17'] },
    { name: 'Desert', colors: ['#d8c49a', '#b59a6a', '#8c7350', '#5e4d36'] },
    { name: 'Urban', colors: ['#d6d6d6', '#9a9a9a', '#5c5c5c', '#2a2a2a'] },
    { name: 'Arctic', colors: ['#ffffff', '#dfe6ec', '#aab6c2', '#6c7a88'] },
    { name: 'Vaporwave', colors: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'] },
    { name: 'Neon Night', colors: ['#0d0221', '#ff2a6d', '#05d9e8', '#d1f7ff'] },
    { name: 'Pastel', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#bdb2ff'] },
    { name: 'Sepia', colors: ['#2b1d0e', '#6b4a2b', '#b08a5a', '#efe0c2'] },
    { name: 'Primary', colors: ['#d62828', '#f7c600', '#1d4fd8', '#111111', '#f5f1e6'] },
    { name: 'Tartan Red', colors: ['#b5121b', '#0d2b4e', '#1d5b2f', '#f2d16b', '#111111', '#ffffff'] },
    { name: 'Holo', colors: ['#ff4d5e', '#f4ef4c', '#5af08c', '#52d3ff', '#6a6cff', '#c160ff'] },
  ];

  PG.getGradient = (name) => {
    const n = String(name).toLowerCase();
    const g = PG.gradients.find((x) => x.name.toLowerCase() === n);
    return g ? { stops: U.clone(g.stops), mode: g.mode || 'smooth' } : null;
  };
  PG.getPalette = (name) => {
    const n = String(name).toLowerCase();
    const p = PG.palettes.find((x) => x.name.toLowerCase() === n);
    return p ? p.colors.slice() : null;
  };

  PG.normalizeGradient = function (v, fallback) {
    if (typeof v === 'string') v = PG.getGradient(v);
    if (!v || !Array.isArray(v.stops) || v.stops.length < 1) {
      if (fallback !== undefined && fallback !== null) return PG.normalizeGradient(fallback, null);
      return { stops: [[0, '#000000'], [1, '#ffffff']], mode: 'smooth' };
    }
    const stops = v.stops
      .map((s) => (Array.isArray(s) ? [U.clamp(+s[0] || 0, 0, 1), U.normalizeHex(s[1])] : [U.clamp(+s.pos || 0, 0, 1), U.normalizeHex(s.color)]))
      .sort((a, b) => a[0] - b[0]);
    return { stops, mode: v.mode === 'steps' ? 'steps' : 'smooth' };
  };

  PG.normalizePalette = function (v, fallback, max = 16) {
    if (typeof v === 'string') v = v.includes(',') ? v.split(',') : PG.getPalette(v);
    if (!Array.isArray(v) || v.length === 0) {
      if (fallback !== undefined && fallback !== null) return PG.normalizePalette(fallback, null, max);
      return ['#000000', '#ffffff'];
    }
    return v.slice(0, max).map((c) => U.normalizeHex(c));
  };

  /** Colour of gradient g at t (0..1) as [r,g,b] in 0..1. */
  PG.sampleGradient = function (g, t) {
    const s = g.stops;
    if (s.length === 1) return U.hexToRgb(s[0][1]);
    if (g.mode === 'steps') {
      let best = s[0], bd = Infinity;
      for (const st of s) {
        const d = Math.abs(st[0] - t);
        if (d < bd) { bd = d; best = st; }
      }
      return U.hexToRgb(best[1]);
    }
    if (t <= s[0][0]) return U.hexToRgb(s[0][1]);
    const last = s[s.length - 1];
    if (t >= last[0]) return U.hexToRgb(last[1]);
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i], b = s[i + 1];
      if (t >= a[0] && t <= b[0]) {
        const f = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
        const ca = U.hexToRgb(a[1]), cb = U.hexToRgb(b[1]);
        return [U.lerp(ca[0], cb[0], f), U.lerp(ca[1], cb[1], f), U.lerp(ca[2], cb[2], f)];
      }
    }
    return U.hexToRgb(last[1]);
  };

  PG.sampleGradientHex = (g, t) => U.rgbToHex(...PG.sampleGradient(g, t));

  /** 256×1 RGBA texture data. */
  PG.bakeGradient = function (g, n = 256) {
    const out = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      const c = PG.sampleGradient(g, i / (n - 1));
      out[i * 4] = Math.round(c[0] * 255);
      out[i * 4 + 1] = Math.round(c[1] * 255);
      out[i * 4 + 2] = Math.round(c[2] * 255);
      out[i * 4 + 3] = 255;
    }
    return out;
  };

  PG.gradientToCss = function (g) {
    const s = g.stops;
    if (s.length === 1) return s[0][1];
    if (g.mode === 'steps') {
      const parts = [];
      for (let i = 0; i < s.length; i++) {
        const from = i === 0 ? 0 : (s[i - 1][0] + s[i][0]) / 2;
        const to = i === s.length - 1 ? 1 : (s[i][0] + s[i + 1][0]) / 2;
        parts.push(`${s[i][1]} ${(from * 100).toFixed(2)}%`, `${s[i][1]} ${(to * 100).toFixed(2)}%`);
      }
      return `linear-gradient(90deg, ${parts.join(', ')})`;
    }
    return `linear-gradient(90deg, ${s.map((st) => `${st[1]} ${(st[0] * 100).toFixed(2)}%`).join(', ')})`;
  };

  /** A random but harmonious gradient. */
  PG.randomGradient = function (rng = Math.random) {
    if (rng() < 0.55) {
      const g = PG.gradients[Math.floor(rng() * PG.gradients.length)];
      return { stops: U.clone(g.stops), mode: g.mode || 'smooth' };
    }
    const n = 3 + Math.floor(rng() * 4);
    const h0 = rng() * 360;
    const scheme = Math.floor(rng() * 4);
    const cols = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      let h;
      if (scheme === 0) h = h0 + t * 360; // spectral
      else if (scheme === 1) h = h0 + t * 70; // analogous
      else if (scheme === 2) h = h0 + (i % 2) * 180 + t * 30; // complementary
      else h = h0 + i * 120; // triadic
      const l = scheme === 1 ? 0.15 + 0.7 * t : 0.45 + 0.25 * rng();
      cols.push(U.hslToHex(h, 0.65 + 0.3 * rng(), l));
    }
    if (scheme === 0) cols[cols.length - 1] = cols[0];
    return even(cols, rng() < 0.15 ? 'steps' : 'smooth');
  };

  PG.randomPalette = function (rng = Math.random, count) {
    if (!count && rng() < 0.5) return PG.palettes[Math.floor(rng() * PG.palettes.length)].colors.slice();
    const n = count || 3 + Math.floor(rng() * 4);
    const h0 = rng() * 360;
    const step = [30, 60, 137.5, 180][Math.floor(rng() * 4)];
    const out = [];
    for (let i = 0; i < n; i++) out.push(U.hslToHex(h0 + i * step, 0.4 + 0.5 * rng(), 0.2 + 0.65 * rng()));
    return out;
  };
})();
