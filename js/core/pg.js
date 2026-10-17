/* Pattern Generator — core namespace, pattern registry and param-schema helpers.
 * Everything hangs off the global `PG` object so the app runs from file:// with plain <script> tags. */
(function () {
  'use strict';

  const PG = (window.PG = window.PG || {});
  PG.patterns = [];
  PG.patternMap = Object.create(null);
  PG.errors = []; // every error ever reported (used by tests)
  PG.activeErrors = new Map(); // errors currently shown in the overlay

  /* ------------------------------------------------------------------ utils */
  const U = (PG.util = {});

  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  U.equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  U.titleCase = (s) =>
    String(s)
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  U.decimalsFor = (step) => {
    const s = String(step);
    if (s.includes('e-')) return parseInt(s.split('e-')[1], 10);
    const i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  };
  U.niceStep = (range) => Math.pow(10, Math.floor(Math.log10(Math.max(range, 1e-9) / 100)));

  U.normalizeHex = function (hex, fallback = '#000000') {
    let h = String(hex == null ? '' : hex).trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
    if (/^[0-9a-f]{8}$/.test(h)) h = h.slice(0, 6);
    return /^[0-9a-f]{6}$/.test(h) ? '#' + h : fallback;
  };
  U.hexToRgb = function (hex) {
    const n = parseInt(U.normalizeHex(hex).slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  U.rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => Math.round(U.clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  U.hslToHex = function (h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = U.clamp(s, 0, 1);
    l = U.clamp(l, 0, 1);
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    };
    return U.rgbToHex(f(0), f(8), f(4));
  };
  U.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.debounce = function (fn, ms) {
    let id;
    return function (...args) {
      clearTimeout(id);
      id = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  /* --------------------------------------------------------------- errors */
  let errorSeq = 0;
  function renderErrors() {
    const el = document.getElementById('pg-errors');
    if (!el) return;
    const msgs = [...PG.activeErrors.values()];
    el.hidden = msgs.length === 0;
    const body = el.querySelector('.err-body') || el;
    body.textContent = msgs.join('\n\n');
  }
  /** Set (msg) or clear (null) a keyed error shown in the overlay. */
  PG.setError = function (key, msg) {
    if (msg) {
      const text = String(msg);
      if (PG.activeErrors.get(key) !== text) {
        PG.errors.push(text);
        console.error('[PG] ' + text);
      }
      PG.activeErrors.set(key, text);
    } else {
      PG.activeErrors.delete(key);
    }
    renderErrors();
  };
  PG.reportError = (msg) => PG.setError('sticky' + errorSeq++, msg);
  PG.dismissErrors = function () {
    for (const k of [...PG.activeErrors.keys()]) if (k.startsWith('sticky')) PG.activeErrors.delete(k);
    renderErrors();
  };
  window.addEventListener('error', (e) => {
    const where = e.filename ? ` (${String(e.filename).split('/').slice(-2).join('/')}:${e.lineno})` : '';
    PG.reportError((e.message || 'Script error') + where);
  });
  window.addEventListener('unhandledrejection', (e) => PG.reportError('Unhandled: ' + ((e.reason && e.reason.message) || e.reason)));

  /* --------------------------------------------------------- param schema */
  const UNIFORM_TYPES = { range: 1, int: 1, bool: 1, select: 1, color: 1, gradient: 1, palette: 1 };
  PG.isUniformParam = (p) => !!UNIFORM_TYPES[p.type] && p.uniform !== false && !!p.id;

  PG.normalizeOptions = function (opts) {
    return (opts || []).map((o) => {
      if (Array.isArray(o)) return { value: String(o[0]), label: String(o[1] != null ? o[1] : U.titleCase(o[0])) };
      if (o && typeof o === 'object') return { value: String(o.value), label: String(o.label != null ? o.label : U.titleCase(o.value)) };
      return { value: String(o), label: U.titleCase(o) };
    });
  };

  PG.normalizeParam = function (p) {
    const q = Object.assign({}, p);
    if (!q.type) q.type = 'range';
    if (q.label == null) q.label = U.titleCase(q.id || '');
    switch (q.type) {
      case 'range':
      case 'int':
        if (q.min == null) q.min = 0;
        if (q.max == null) q.max = 1;
        if (q.step == null) q.step = q.type === 'int' ? 1 : U.niceStep(q.max - q.min);
        if (q.default == null) q.default = q.min;
        break;
      case 'bool':
        q.default = !!q.default;
        break;
      case 'select':
        q.options = PG.normalizeOptions(q.options);
        if (q.default == null) q.default = q.options[0] && q.options[0].value;
        q.default = String(q.default);
        break;
      case 'color':
        q.default = U.normalizeHex(q.default || '#ffffff');
        break;
      case 'gradient':
        if (q.default == null) q.default = 'Mono';
        break;
      case 'palette':
        if (q.max == null || q.max > 16) q.max = 16;
        if (q.min == null) q.min = 1;
        if (!q.default) q.default = ['#000000', '#ffffff'];
        break;
      case 'text':
        if (q.default == null) q.default = '';
        break;
      case 'image':
        if (q.default == null) q.default = '';
        q.uniform = false;
        break;
    }
    return q;
  };

  /** Coerce any input (number, string from a URL, preset name…) into a valid value for param p. */
  PG.resolveValue = function (p, v) {
    if (v === undefined || v === null || v === '') v = p.default;
    switch (p.type) {
      case 'range':
      case 'int': {
        let n = Number(v);
        if (!isFinite(n)) n = Number(p.default);
        if (!p.soft) n = U.clamp(n, p.min, p.max);
        return p.type === 'int' ? Math.round(n) : n;
      }
      case 'bool':
        return v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
      case 'select': {
        const s = String(v);
        return p.options.some((o) => o.value === s) ? s : p.default;
      }
      case 'color':
        return U.normalizeHex(v, U.normalizeHex(p.default));
      case 'gradient':
        return PG.normalizeGradient(v, p.default);
      case 'palette':
        return PG.normalizePalette(v, p.default, p.max);
      case 'text':
        return String(v);
      case 'image':
        return String(v);
      default:
        return v;
    }
  };

  PG.sanitizeValues = function (params, values) {
    const out = {};
    for (const p of params) {
      if (!p.id || p.type === 'heading' || p.type === 'button') continue;
      out[p.id] = PG.resolveValue(p, values ? values[p.id] : undefined);
    }
    return out;
  };
  PG.defaultsFor = (params) => PG.sanitizeValues(params, {});

  /** GLSL uniform declarations for a schema. prefix: 'u_' (pattern), 'u_tf_' (transform), 'u_fx_' (post). */
  PG.uniformDecls = function (params, prefix) {
    const lines = [];
    for (const p of params) {
      if (!PG.isUniformParam(p)) continue;
      const n = prefix + p.id;
      switch (p.type) {
        case 'range':
        case 'int':
        case 'bool':
          lines.push(`uniform float ${n};`);
          break;
        case 'select':
          lines.push(`uniform int ${n};`);
          break;
        case 'color':
          lines.push(`uniform vec3 ${n};`);
          break;
        case 'gradient':
          lines.push(`uniform sampler2D ${n};`);
          break;
        case 'palette':
          lines.push(`uniform vec3 ${n}[16];`, `uniform int ${n}_count;`);
          break;
      }
    }
    return lines.join('\n');
  };

  /** `#define <PREFIX><ID>_<OPTION> <index>` for every select option, e.g. MODE_RINGS 0. */
  PG.selectDefines = function (params, prefix) {
    const lines = [];
    for (const p of params) {
      if (p.type !== 'select' || !PG.isUniformParam(p)) continue;
      p.options.forEach((o, i) => {
        const name = (prefix + p.id + '_' + o.value).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        lines.push(`#define ${name} ${i}`);
      });
    }
    return lines.join('\n');
  };

  /* ------------------------------------------------------------- registry */
  PG.registerPattern = function (def) {
    try {
      if (!def || !def.id) throw new Error('pattern needs an id');
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(def.id)) throw new Error(`bad pattern id "${def.id}"`);
      if (typeof def.glsl !== 'string') throw new Error(`pattern "${def.id}" needs a glsl string`);
      const d = Object.assign({ name: U.titleCase(def.id), category: 'Other', description: '' }, def);
      d.params = (def.params || []).map(PG.normalizeParam);
      for (const p of d.params) {
        if (p.id && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(p.id)) throw new Error(`pattern "${d.id}": param id "${p.id}" must be alphanumeric camelCase`);
      }
      d.presets = def.presets || [];
      d.textures = def.textures || [];
      for (const t of d.textures) {
        if (d.params.some((p) => p.id === t.id)) throw new Error(`pattern "${d.id}": texture id "${t.id}" clashes with a param id (both would be u_${t.id})`);
      }
      const existing = PG.patternMap[d.id];
      if (existing) PG.patterns.splice(PG.patterns.indexOf(existing), 1, d);
      else PG.patterns.push(d);
      PG.patternMap[d.id] = d;
      return d;
    } catch (e) {
      PG.reportError('registerPattern: ' + e.message);
      return null;
    }
  };

  /** Load scripts sequentially; a missing or broken file is reported but never blocks the rest. */
  PG.loadScripts = function (files) {
    return files.reduce(
      (chain, src) =>
        chain.then(
          () =>
            new Promise((resolve) => {
              const s = document.createElement('script');
              s.src = src;
              s.onload = () => resolve();
              s.onerror = () => {
                PG.reportError(`Could not load ${src}`);
                resolve();
              };
              document.head.appendChild(s);
            })
        ),
      Promise.resolve()
    );
  };
})();
