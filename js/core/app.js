/* Pattern Generator — application: state, panels, interaction, export, presets, history. */
(function () {
  'use strict';
  const PG = window.PG;
  const U = PG.util;
  const { el, ICON } = PG.ui;
  const $ = (s, r = document) => r.querySelector(s);

  const STORE_KEY = 'pg.state.v1';
  const LOOKS_KEY = 'pg.looks.v1'; // legacy, migrated into MINE_KEY
  const MINE_KEY = 'pg.presets.v1';
  const EXPORT_SIZES = [
    ['view', 'Preview ×2'],
    ['1920x1080', '1080p — 1920×1080'],
    ['2560x1440', '1440p — 2560×1440'],
    ['3840x2160', '4K — 3840×2160'],
    ['1024x1024', 'Square 1024'],
    ['2048x2048', 'Square 2048'],
    ['4096x4096', 'Square 4096'],
    ['1179x2556', 'Phone wallpaper'],
    ['2480x3508', 'A4 @ 300dpi'],
    ['custom', 'Custom…'],
  ];

  const app = (PG.app = {});
  let renderer = null;
  let canvas, viewport;
  let state;
  let dirty = true;
  let ready = false;
  let shotMode = false;
  let css = { w: 1, h: 1 };
  const panels = {};
  const refreshQueued = new Set();

  /* =============================================================== state */
  function defaultPatternId() {
    return PG.patternMap.moire ? 'moire' : PG.patterns[0] ? PG.patterns[0].id : null;
  }
  function freshState() {
    return {
      pattern: defaultPatternId(),
      params: {},
      transform: PG.defaultsFor(PG.transformSchema),
      post: PG.defaultsFor(PG.postSchema),
      seed: 1337,
      speed: 1,
      playing: false,
      time: 0,
      preview: 'auto',
      exp: { mode: 'pixels', size: '3840x2160', w: 3840, h: 2160, match: true, dpi: 300, paper: 'letter', pw: 8.5, ph: 11, unit: 'in', format: 'png' },
      vid: { seconds: 6, fps: 30, size: '1920x1080', loop: 'crossfade', blend: 0.25, quality: 'high' },
    };
  }
  const cur = () => PG.patternMap[state.pattern];
  function paramsOf(id) {
    const d = PG.patternMap[id];
    if (!d) return {};
    state.params[id] = PG.sanitizeValues(d.params, state.params[id] || {});
    return state.params[id];
  }
  function schemaFor(scope) {
    return scope === 'pattern' ? cur().params : scope === 'transform' ? PG.transformSchema : PG.postSchema;
  }
  function valuesFor(scope) {
    return scope === 'pattern' ? state.params[state.pattern] : scope === 'transform' ? state.transform : state.post;
  }

  function snapshot() {
    return {
      pattern: state.pattern,
      params: U.clone(state.params),
      transform: U.clone(state.transform),
      post: U.clone(state.post),
      seed: state.seed,
      speed: state.speed,
    };
  }
  function applySnapshot(s) {
    if (!s) return;
    if (s.pattern && PG.patternMap[s.pattern]) state.pattern = s.pattern;
    if (s.params) for (const id in s.params) if (PG.patternMap[id]) state.params[id] = PG.sanitizeValues(PG.patternMap[id].params, s.params[id]);
    if (s.transform) state.transform = PG.sanitizeValues(PG.transformSchema, s.transform);
    if (s.post) state.post = PG.sanitizeValues(PG.postSchema, s.post);
    if (s.seed != null && isFinite(+s.seed)) state.seed = (+s.seed >>> 0) % 1000000;
    if (s.speed != null && isFinite(+s.speed)) state.speed = U.clamp(+s.speed, 0, 3);
    paramsOf(state.pattern);
  }

  /* ---- compact share-link encoding: only values that differ from defaults */
  function diff(schema, values) {
    const d = PG.defaultsFor(schema);
    const out = {};
    for (const k in values) if (!U.equal(values[k], d[k])) out[k] = values[k];
    return out;
  }
  const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  function encodeLink() {
    const d = cur();
    const o = { p: state.pattern, s: state.seed };
    const v = diff(d.params, state.params[state.pattern]);
    const t = diff(PG.transformSchema, state.transform);
    const f = diff(PG.postSchema, state.post);
    if (Object.keys(v).length) o.v = v;
    if (Object.keys(t).length) o.t = t;
    if (Object.keys(f).length) o.f = f;
    if (state.playing) o.a = 1;
    if (state.speed !== 1) o.sp = state.speed;
    return b64e(JSON.stringify(o));
  }
  function decodeLink(str) {
    const o = JSON.parse(b64d(str));
    const s = { pattern: o.p, seed: o.s, speed: o.sp, transform: o.t || {}, post: o.f || {}, params: {} };
    if (o.p) s.params[o.p] = o.v || {};
    applySnapshot(s);
    if (o.a) state.playing = true;
  }

  /** Hash API: #s=<link> or #pattern=moire&preset=Name&seed=3&v.freq=20&tf.tilt=60&fx.pixelate=1&shot=1 */
  function applyHash(hash) {
    const q = new URLSearchParams(hash.replace(/^#/, ''));
    if (q.get('s')) {
      try {
        decodeLink(q.get('s'));
      } catch (e) {
        PG.reportError('Could not read the shared link: ' + e.message);
      }
    }
    if (q.get('pattern') && PG.patternMap[q.get('pattern')]) {
      state.pattern = q.get('pattern');
      paramsOf(state.pattern);
    } else if (q.get('pattern')) {
      PG.reportError(`Unknown pattern "${q.get('pattern')}"`);
    }
    if (q.get('preset')) {
      if (!applyPreset(q.get('preset'), true)) PG.reportError(`Unknown preset "${q.get('preset')}" for ${state.pattern}`);
    }
    if (q.get('seed')) state.seed = (parseInt(q.get('seed'), 10) >>> 0) % 1000000;
    if (q.get('time')) state.time = parseFloat(q.get('time')) || 0;
    if (q.get('play')) state.playing = q.get('play') === '1';
    for (const [k, v] of q) {
      const m = /^(v|tf|fx)\.(\w+)$/.exec(k);
      if (!m) continue;
      const scope = m[1] === 'v' ? 'pattern' : m[1] === 'tf' ? 'transform' : 'post';
      const p = schemaFor(scope).find((x) => x.id === m[2]);
      if (!p) {
        PG.reportError(`Unknown ${scope} param "${m[2]}"`);
        continue;
      }
      valuesFor(scope)[p.id] = PG.resolveValue(p, v);
    }
    return q;
  }

  /* ===================================================== change plumbing */
  function changed(scope, opts = {}) {
    dirty = true;
    updateUploadCard();
    if (scope) refreshQueued.add(scope);
    if (!opts.noHistory) pushHistory();
    saveSoon();
  }

  app.setParam = function (scope, id, value) {
    const p = schemaFor(scope).find((x) => x.id === id);
    if (!p) return false;
    valuesFor(scope)[id] = PG.resolveValue(p, value);
    changed(scope);
    return true;
  };

  const saveSoon = U.debounce(() => {
    if (shotMode) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign(snapshot(), { preview: state.preview, exp: state.exp, vid: state.vid })));
    } catch (e) {
      /* storage unavailable — fine */
    }
    try {
      history.replaceState(null, '', '#s=' + encodeLink());
    } catch (e) {
      /* file:// in some browsers */
    }
  }, 400);

  /* ---- undo / redo */
  const hist = { stack: [], index: -1, lock: false };
  const pushHistory = U.debounce(() => pushHistoryNow(), 300);
  function pushHistoryNow() {
    if (hist.lock) return;
    const snap = JSON.stringify(snapshot());
    if (hist.stack[hist.index] === snap) return;
    hist.stack = hist.stack.slice(0, hist.index + 1);
    hist.stack.push(snap);
    if (hist.stack.length > 150) hist.stack.shift();
    hist.index = hist.stack.length - 1;
    updateUndoButtons();
  }
  function restore(json) {
    hist.lock = true;
    const prevPattern = state.pattern;
    applySnapshot(JSON.parse(json));
    if (prevPattern !== state.pattern) onPatternChanged();
    refreshAll();
    dirty = true;
    saveSoon();
    setTimeout(() => (hist.lock = false), 350);
    updateUndoButtons();
  }
  app.undo = () => {
    if (hist.index > 0) restore(hist.stack[--hist.index]);
  };
  app.redo = () => {
    if (hist.index < hist.stack.length - 1) restore(hist.stack[++hist.index]);
  };
  function updateUndoButtons() {
    const u = $('#btn-undo'), r = $('#btn-redo');
    if (u) u.disabled = hist.index <= 0;
    if (r) r.disabled = hist.index >= hist.stack.length - 1;
  }

  /* ============================================================ patterns */
  app.selectPattern = function (id) {
    if (!PG.patternMap[id] || id === state.pattern) return;
    state.pattern = id;
    paramsOf(id);
    onPatternChanged();
    changed('pattern');
    // patterns that only make sense moving (static, glitches) start animating when picked
    if (PG.patternMap[id].autoplay && !state.playing && !shotMode) {
      app.togglePlay();
      toast('Animating — press Space to pause');
    }
  };
  /** The "Make your own" upload card shows while that pattern is still using a built-in sample tile. */
  let uploadCardDismissed = false;
  function updateUploadCard() {
    const card = $('#upload-card');
    if (!card) return;
    const p = cur().params.find((q) => q.type === 'image');
    const v = p && state.params[state.pattern][p.id];
    card.hidden = shotMode || uploadCardDismissed || !p || /^img-/.test(v || '');
  }
  function onPatternChanged() {
    updateUploadCard();
    buildPatternPanel();
    buildPresets();
    buildMine();
    document.querySelectorAll('.tile').forEach((t) => t.classList.toggle('on', t.dataset.id === state.pattern));
    const active = document.querySelector('.tile.on');
    if (active && !shotMode) active.scrollIntoView({ block: 'nearest' });
  }

  function findPreset(name) {
    const n = String(name).toLowerCase();
    return cur().presets.find((p) => p.name.toLowerCase() === n);
  }
  /** Apply a preset of the current pattern by name ('Default' resets the pattern params). */
  /** Fresh values for a pattern that keep any image the user uploaded (presets change the look, not your tile). */
  function freshParams(d, values) {
    const out = PG.sanitizeValues(d.params, Object.assign(PG.defaultsFor(d.params), values || {}));
    const old = state.params[d.id] || {};
    for (const p of d.params) if (p.type === 'image' && /^img-/.test(old[p.id] || '')) out[p.id] = old[p.id];
    return out;
  }
  function applyPreset(name, quiet) {
    const d = cur();
    if (String(name).toLowerCase() === 'default') {
      state.params[d.id] = freshParams(d);
    } else {
      const pr = findPreset(name);
      if (!pr) return false;
      state.params[d.id] = freshParams(d, pr.values);
      if (pr.transform) state.transform = PG.sanitizeValues(PG.transformSchema, Object.assign(PG.defaultsFor(PG.transformSchema), pr.transform));
      if (pr.post) state.post = PG.sanitizeValues(PG.postSchema, Object.assign(PG.defaultsFor(PG.postSchema), pr.post));
      if (pr.seed != null) state.seed = pr.seed;
      if (pr.play && !state.playing && !shotMode && !quiet) app.togglePlay();
    }
    if (!quiet) {
      refreshAll();
      changed('pattern');
      markPreset(name);
    }
    return true;
  }
  app.applyPreset = (name) => applyPreset(name, false);

  /* ---- randomize */
  function randomValue(p, rng) {
    if (p.random === false) return undefined;
    switch (p.type) {
      case 'range':
      case 'int': {
        const lo = Array.isArray(p.random) ? p.random[0] : p.min;
        const hi = Array.isArray(p.random) ? p.random[1] : p.max;
        const t = rng();
        const v = p.scale === 'log' && lo > 0 ? lo * Math.pow(hi / lo, t) : lo + (hi - lo) * t;
        return p.type === 'int' ? Math.round(v) : +(Math.round(v / p.step) * p.step).toFixed(U.decimalsFor(p.step));
      }
      case 'bool':
        return rng() < (typeof p.random === 'number' ? p.random : 0.5);
      case 'select': {
        const opts = Array.isArray(p.random) ? p.random : p.options.map((o) => o.value);
        return opts[Math.floor(rng() * opts.length)];
      }
      case 'color': {
        // random: 'dark' | 'mid' | 'light' keeps two-colour patterns contrasty
        const l = p.random === 'dark' ? 0.06 + rng() * 0.24 : p.random === 'light' ? 0.72 + rng() * 0.24 : p.random === 'mid' ? 0.35 + rng() * 0.25 : 0.2 + rng() * 0.65;
        return U.hslToHex(rng() * 360, 0.35 + rng() * 0.6, l);
      }
      case 'gradient':
        return PG.randomGradient(rng);
      case 'palette': {
        if (Array.isArray(p.random) && p.random.length) return p.random[Math.floor(rng() * p.random.length)];
        const n = Array.isArray(state.params[state.pattern][p.id]) ? state.params[state.pattern][p.id].length : 4;
        return PG.randomPalette(rng, rng() < 0.5 ? n : undefined);
      }
    }
    return undefined;
  }
  app.randomize = function (all) {
    const rng = Math.random;
    const d = cur();
    const vals = state.params[d.id];
    for (const p of d.params) {
      const v = randomValue(p, rng);
      if (v !== undefined) vals[p.id] = PG.resolveValue(p, v);
    }
    state.seed = Math.floor(rng() * 999999) + 1;
    if (all) {
      const t = PG.defaultsFor(PG.transformSchema);
      t.ss = state.transform.ss;
      t.aa = state.transform.aa;
      if (rng() < 0.5) {
        const w = ['waves', 'noise', 'swirl', 'ripple', 'twist', 'bulge', 'zigzag'];
        t.warp = w[Math.floor(rng() * w.length)];
        t.warpAmt = 0.2 + rng() * 0.8;
        t.warpFreq = 1 + rng() * 6;
      }
      if (rng() < 0.15) {
        t.symmetry = 'kaleido';
        t.segments = 3 + Math.floor(rng() * 9);
      }
      t.rotate = rng() < 0.3 ? Math.round(-45 + rng() * 90) : 0;
      state.transform = PG.sanitizeValues(PG.transformSchema, t);
      const f = PG.defaultsFor(PG.postSchema);
      if (rng() < 0.25) {
        f.pixelate = true;
        f.pxSize = 4 + Math.round(rng() * 20);
        f.pxShape = ['square', 'square', 'round', 'hex', 'rounded'][Math.floor(rng() * 5)];
        f.pxGap = f.pxShape === 'square' ? (rng() < 0.5 ? 0 : 0.12) : 0.1;
      }
      if (rng() < 0.15) {
        f.quantize = 'palette';
        f.qPalette = PG.randomPalette(rng);
      }
      if (rng() < 0.15) f.rgbSplit = 2 + rng() * 6;
      state.post = PG.sanitizeValues(PG.postSchema, f);
    }
    refreshAll();
    changed(null);
    markPreset(null);
  };

  /* ============================================================== render */
  function previewScale() {
    if (shotMode) return 1;
    const dpr = window.devicePixelRatio || 1;
    if (state.preview === '0.5') return 0.5;
    if (state.preview === '1') return 1;
    if (state.preview === '2') return 2;
    return Math.min(dpr, 2);
  }
  function resize() {
    const r = viewport.getBoundingClientRect();
    css = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    const s = previewScale();
    const w = Math.max(1, Math.round(css.w * s));
    const h = Math.max(1, Math.round(css.h * s));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      dirty = true;
    }
  }

  /** Transform at animation time t: Spin rotates and Drift pans continuously. */
  function motion(tf, t) {
    if (!t || (!tf.spin && !tf.drift)) return tf;
    const a = (tf.driftDir * Math.PI) / 180;
    return Object.assign({}, tf, {
      rotate: tf.rotate + tf.spin * t,
      panX: tf.panX + Math.cos(a) * tf.drift * t,
      panY: tf.panY + Math.sin(a) * tf.drift * t,
    });
  }
  function renderOpts(extra = {}) {
    const d = cur();
    const time = extra.time != null ? extra.time : state.time;
    return Object.assign(
      {
        def: d,
        values: state.params[d.id],
        transform: motion(state.transform, time),
        post: state.post,
        seed: state.seed,
        time,
      },
      extra
    );
  }

  let lastFrame = 0;
  let fpsAvg = 0;
  function draw() {
    if (!renderer || !cur()) return;
    resize();
    const r = renderer.render(renderOpts({ width: canvas.width, height: canvas.height, pxScale: canvas.height / css.h }));
    PG.setError('pattern', r.error ? r.error : null);
    if (!ready) {
      ready = true;
      renderer.gl.finish();
      document.documentElement.dataset.pgReady = '1';
    }
  }
  app.render = () => {
    draw();
    dirty = false;
  };

  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = lastFrame ? Math.min(0.1, (ts - lastFrame) / 1000) : 0;
    lastFrame = ts;
    if (state.playing && dt > 0) {
      state.time += dt * state.speed;
      dirty = true;
      fpsAvg = fpsAvg ? fpsAvg * 0.92 + (1 / dt) * 0.08 : 1 / dt;
    }
    if (refreshQueued.size) {
      for (const s of refreshQueued) if (panels[s]) panels[s].refresh();
      refreshQueued.clear();
    }
    if (dirty) {
      dirty = false;
      draw();
      updateStatus();
    }
  }

  function updateStatus() {
    const s = $('#status');
    if (!s) return;
    const d = cur();
    s.textContent = `${d ? d.name : ''} · ${canvas.width}×${canvas.height}${state.playing ? ` · ${Math.round(fpsAvg)} fps` : ''}`;
  }

  /* =============================================================== export */
  const PAPERS = [
    ['custom', 'Custom size'],
    ['letter', 'US Letter — 8.5 × 11 in', 8.5, 11, 'in'],
    ['legal', 'US Legal — 8.5 × 14 in', 8.5, 14, 'in'],
    ['tabloid', 'Tabloid — 11 × 17 in', 11, 17, 'in'],
    ['a5', 'A5 — 148 × 210 mm', 148, 210, 'mm'],
    ['a4', 'A4 — 210 × 297 mm', 210, 297, 'mm'],
    ['a3', 'A3 — 297 × 420 mm', 297, 420, 'mm'],
    ['a2', 'A2 — 420 × 594 mm', 420, 594, 'mm'],
    ['a1', 'A1 — 594 × 841 mm', 594, 841, 'mm'],
    ['4x6', 'Photo — 4 × 6 in', 4, 6, 'in'],
    ['5x7', 'Photo — 5 × 7 in', 5, 7, 'in'],
    ['8x10', 'Print — 8 × 10 in', 8, 10, 'in'],
    ['11x14', 'Print — 11 × 14 in', 11, 14, 'in'],
    ['12x12', 'Square — 12 × 12 in', 12, 12, 'in'],
    ['16x20', 'Poster — 16 × 20 in', 16, 20, 'in'],
    ['18x24', 'Poster — 18 × 24 in', 18, 24, 'in'],
    ['24x36', 'Poster — 24 × 36 in', 24, 36, 'in'],
  ];
  const PER_INCH = { in: 1, cm: 2.54, mm: 25.4 };
  const MAX_SIDE = 30000;
  const MAX_PIXELS = 100e6;
  function exportSize() {
    const e = state.exp;
    if (e.mode === 'print') {
      const k = e.dpi / PER_INCH[e.unit];
      return [Math.max(16, Math.round(e.pw * k)), Math.max(16, Math.round(e.ph * k))];
    }
    if (e.size === 'view') return [Math.round(css.w * 2), Math.round(css.h * 2)];
    if (e.size === 'custom') return [e.w, e.h];
    const [w, h] = e.size.split('x').map(Number);
    return [w, h];
  }
  const tooBig = (w, h) => w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS;

  /** Render the current state at w×h (single pass, ≤ GPU limit). Returns a canvas. */
  app.renderToCanvas = function (w, h, opts = {}) {
    const max = renderer.maxSize;
    w = U.clamp(Math.round(w), 1, max);
    h = U.clamp(Math.round(h), 1, max);
    const match = opts.match != null ? opts.match : state.exp.match;
    const pxScale = match ? h / css.h : 1;
    const { image, error } = renderer.renderImage(renderOpts({ width: w, height: h, pxScale, fboPrefix: 'export' }));
    renderer.releaseFbos('export');
    if (error) throw new Error(error);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').putImageData(image, 0, 0);
    dirty = true;
    return c;
  };
  /** Render any size (tiled above 4096 px — no GPU limit). Returns a canvas. */
  app.renderLarge = async function (w, h, opts = {}, onProgress) {
    w = Math.round(w);
    h = Math.round(h);
    if (tooBig(w, h)) throw new Error(`${w}×${h} is too large (max ${MAX_SIDE} px per side, ${MAX_PIXELS / 1e6} megapixels)`);
    if (Math.max(w, h) <= 4096) return app.renderToCanvas(w, h, opts);
    const match = opts.match != null ? opts.match : state.exp.match;
    const img = await renderer.renderTiled(renderOpts({ width: w, height: h, pxScale: match ? h / css.h : 1 }), onProgress);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').putImageData(new ImageData(img.data, w, h), 0, 0);
    dirty = true;
    return c;
  };

  /* ---- DPI metadata: PNG pHYs chunk / JPEG JFIF density */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  /** Return a copy of a PNG/JPEG blob that declares `dpi` pixels per inch. */
  async function withDpi(blob, dpi) {
    dpi = Math.max(1, Math.min(65535, Math.round(dpi)));
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (blob.type === 'image/png') {
      const ppm = Math.round(dpi / 0.0254);
      const chunk = new Uint8Array(21);
      const dv = new DataView(chunk.buffer);
      dv.setUint32(0, 9);
      chunk.set([0x70, 0x48, 0x59, 0x73], 4); // 'pHYs'
      dv.setUint32(8, ppm);
      dv.setUint32(12, ppm);
      chunk[16] = 1; // unit: metre
      dv.setUint32(17, crc32(chunk.subarray(4, 17)));
      const at = 8 + 25; // after signature + IHDR
      return new Blob([buf.subarray(0, at), chunk, buf.subarray(at)], { type: 'image/png' });
    }
    if (blob.type === 'image/jpeg') {
      const jfif = buf[2] === 0xff && buf[3] === 0xe0 && String.fromCharCode(buf[6], buf[7], buf[8], buf[9]) === 'JFIF';
      if (jfif) {
        buf[13] = 1; // units: dots per inch
        buf[14] = dpi >> 8;
        buf[15] = dpi & 255;
        buf[16] = dpi >> 8;
        buf[17] = dpi & 255;
        return new Blob([buf], { type: 'image/jpeg' });
      }
      const app0 = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0]);
      return new Blob([buf.subarray(0, 2), app0, buf.subarray(2)], { type: 'image/jpeg' });
    }
    return blob;
  }
  app.withDpi = withDpi;
  app.exportDataURL = (w, h) => app.renderToCanvas(w, h).toDataURL('image/png');

  function fileName(ext) {
    const e = state.exp;
    const tag = e.mode === 'print' ? `-${+e.pw.toFixed(2)}x${+e.ph.toFixed(2)}${e.unit}-${e.dpi}dpi` : '';
    return `pattern-${state.pattern}-${state.seed}${tag}.${ext}`;
  }
  function download(blob, name) {
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }
  let exporting = false;
  /** Download the image at the Export panel's size, format and DPI. */
  app.exportImage = async function () {
    if (exporting) return null;
    const [w, h] = exportSize();
    const fmt = state.exp.format === 'jpeg' ? 'jpeg' : 'png';
    if (tooBig(w, h)) {
      toast(`${w}×${h} is too large — lower the DPI or size (max ${MAX_PIXELS / 1e6} MP)`);
      return null;
    }
    exporting = true;
    toast(`Rendering ${w}×${h}…`);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const c = await app.renderLarge(w, h, {}, (f) => toast(`Rendering ${w}×${h}… ${Math.round(f * 100)}%`));
      if (fmt === 'jpeg') {
        // JPEG has no transparency: flatten onto white
        const g = c.getContext('2d');
        g.globalCompositeOperation = 'destination-over';
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, w, h);
      }
      toast(`Encoding ${fmt.toUpperCase()}…`);
      const raw = await new Promise((r) => c.toBlob(r, 'image/' + fmt, 0.93));
      if (!raw) throw new Error('the browser could not encode an image this large');
      const blob = await withDpi(raw, state.exp.dpi);
      const name = fileName(fmt === 'jpeg' ? 'jpg' : 'png');
      download(blob, name);
      toast(`Saved ${name} · ${w}×${h} @ ${state.exp.dpi} DPI`);
      return blob;
    } catch (e) {
      PG.reportError('Export failed: ' + e.message);
      return null;
    } finally {
      exporting = false;
      dirty = true;
    }
  };
  app.exportPNG = app.exportImage;
  /** Live export settings object (size mode, DPI, format…) — for scripting/tests; call app.refreshExport() after changing. */
  app.exportSettings = () => state.exp;
  app.refreshExport = () => panels.exportSync && panels.exportSync();
  /* ---- seamless loop video */
  const VIDEO_SIZES = [
    ['view', 'Preview size'],
    ['1280x720', '720p — 1280×720'],
    ['1920x1080', '1080p — 1920×1080'],
    ['1080x1080', 'Square — 1080×1080'],
    ['1080x1920', 'Vertical — 1080×1920'],
    ['3840x2160', '4K — 3840×2160'],
  ];
  const BITS_PER_PIXEL = { standard: 0.1, high: 0.18, max: 0.32 };
  let videoJob = null;
  function videoSize() {
    const v = state.vid.size;
    let [w, h] = v === 'view' ? [css.w * 2, css.h * 2] : v.split('x').map(Number);
    const s = Math.min(1, renderer.maxSize / Math.max(w, h), 3840 / Math.max(w, h), 2160 / Math.min(w, h));
    return [Math.max(16, Math.round(w * s) & ~1), Math.max(16, Math.round(h * s) & ~1)];
  }
  function hasMotion() {
    const tf = state.transform;
    return state.speed > 0 && (/\bu_time\b/.test(cur().glsl) || tf.spin || tf.drift || (tf.warp !== 'none' && tf.warpSpeed));
  }
  /**
   * Record the current animation as a video that loops seamlessly.
   * loop: 'crossfade' blends the clip's continuation into its start; 'boomerang' plays forward then back; 'straight' = raw.
   */
  app.exportVideo = async function (opts = {}) {
    if (videoJob) return null;
    if (!PG.video || !PG.video.encode) {
      PG.reportError('Video export is not available (js/core/video.js failed to load).');
      return null;
    }
    const o = Object.assign({}, state.vid, opts);
    const sup = await PG.video.supported();
    if (!sup.mp4 && !sup.webm) {
      toast('This browser can’t encode video — use Chrome, Edge or Safari 16.4+');
      return null;
    }
    if (!hasMotion()) toast('Nothing is moving yet — press Animate, or add Spin / Drift / a Warp. Recording a still clip.');
    const [w, h] = o.w && o.h ? [o.w & ~1, o.h & ~1] : videoSize();
    const fps = +o.fps;
    const frames = Math.max(2, Math.round(o.seconds * fps));
    const t0 = state.time;
    const dt = (state.speed || 0) / fps;
    const pxScale = h / css.h;
    const X = o.loop === 'crossfade' ? Math.max(1, Math.round(frames * o.blend)) : 0;
    const shot = (t) => renderer.renderImage(renderOpts({ time: t, width: w, height: h, pxScale, fboPrefix: 'video' })).image;
    const ease = (x) => x * x * (3 - 2 * x);
    const renderFrame = async (i) => {
      if (o.loop === 'boomerang') return shot(t0 + (i <= frames / 2 ? i : frames - i) * dt);
      if (X && i < X) {
        // frame i shows the clip's continuation (t + duration) fading into its own start → last frame flows into the first
        const a = shot(t0 + (i + frames) * dt);
        const b = shot(t0 + i * dt);
        const k = ease(i / X);
        const A = a.data, B = b.data;
        for (let j = 0; j < A.length; j++) A[j] = A[j] + (B[j] - A[j]) * k;
        return a;
      }
      return shot(t0 + i * dt);
    };
    const ctrl = new AbortController();
    videoJob = ctrl;
    if (panels.videoUI) panels.videoUI(0);
    try {
      const blob = await PG.video.encode({
        width: w,
        height: h,
        fps,
        frames,
        renderFrame,
        format: o.format || 'auto',
        bitrate: Math.round(U.clamp(w * h * fps * (BITS_PER_PIXEL[o.quality] || 0.18), 2e6, 80e6)),
        onProgress: (f) => panels.videoUI && panels.videoUI(f),
        signal: ctrl.signal,
      });
      if (!opts.noDownload) {
        const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
        download(blob, `pattern-${state.pattern}-${state.seed}-loop.${ext}`);
        toast(
          ext === 'mp4'
            ? `Saved ${w}×${h} · ${o.seconds}s loop (${(blob.size / 1048576).toFixed(1)} MB)`
            : `Saved as WebM (this browser can't encode MP4 at ${w}×${h}) — plays in Chrome / VLC`
        );
      }
      return blob;
    } catch (e) {
      if (e && e.name === 'AbortError') toast('Video cancelled');
      else PG.reportError('Video export failed: ' + (e && e.message ? e.message : e));
      return null;
    } finally {
      videoJob = null;
      renderer.releaseFbos('video');
      dirty = true;
      if (panels.videoUI) panels.videoUI(null);
    }
  };
  app.cancelVideo = () => videoJob && videoJob.abort();

  app.copyImage = async function () {
    try {
      const [w, h] = exportSize();
      const c = await app.renderLarge(w, h);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Image copied to clipboard');
    } catch (e) {
      toast('Clipboard not available here — use Download PNG');
    }
  };
  app.copyLink = async function () {
    const url = location.href.split('#')[0] + '#s=' + encodeLink();
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch (e) {
      toast('Clipboard is blocked here — copy the link from the address bar');
    }
  };

  /* ---- my presets: user-saved settings for a pattern, kept in localStorage + JSON backup files */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function normalizeMine(p) {
    if (!p || typeof p !== 'object') return null;
    if (p.state && !p.pattern) {
      // legacy "look" format: { name, state: snapshot, thumb }
      const s = p.state;
      p = { name: p.name, pattern: s.pattern, values: s.params && s.params[s.pattern], transform: s.transform, post: s.post, seed: s.seed, thumb: p.thumb };
    }
    if (!p.pattern) return null;
    return {
      id: String(p.id || uid()),
      name: String(p.name || 'Untitled').slice(0, 60),
      pattern: String(p.pattern),
      values: p.values || {},
      transform: p.transform || {},
      post: p.post || {},
      seed: p.seed != null ? p.seed : 1337,
      thumb: typeof p.thumb === 'string' ? p.thumb : '',
      created: String(p.created || new Date().toISOString()),
    };
  }
  function loadMine() {
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(MINE_KEY)) || [];
      const old = JSON.parse(localStorage.getItem(LOOKS_KEY));
      if (Array.isArray(old) && old.length) {
        list = list.concat(old);
        localStorage.setItem(MINE_KEY, JSON.stringify(list.map(normalizeMine).filter(Boolean)));
        localStorage.removeItem(LOOKS_KEY);
      }
    } catch (e) {
      /* storage unavailable */
    }
    return (Array.isArray(list) ? list : []).map(normalizeMine).filter(Boolean);
  }
  function saveMine(list) {
    try {
      localStorage.setItem(MINE_KEY, JSON.stringify(list));
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      return true;
    } catch (e) {
      PG.reportError('Could not save presets — browser storage is full or blocked. Use "Backup to file" to keep them.');
      return false;
    }
  }
  function thumbOf(w, h) {
    const { image } = renderer.renderImage(renderOpts({ width: w, height: h, pxScale: h / css.h, fboPrefix: 'thumb' }));
    const c = el('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').putImageData(image, 0, 0);
    dirty = true;
    return c.toDataURL('image/jpeg', 0.8);
  }
  app.listPresets = () => loadMine();
  /** Save the current pattern + perspective + effects + seed as a named preset. Same name & pattern = update. */
  app.savePreset = function (name) {
    const d = cur();
    const list = loadMine();
    name = String(name || '').trim().slice(0, 60) || `My ${d.name} ${list.filter((p) => p.pattern === d.id).length + 1}`;
    const entry = {
      id: uid(),
      name,
      pattern: d.id,
      values: U.clone(state.params[d.id]),
      transform: U.clone(state.transform),
      post: U.clone(state.post),
      seed: state.seed,
      thumb: thumbOf(192, 120),
      created: new Date().toISOString(),
    };
    const i = list.findIndex((p) => p.pattern === d.id && p.name.toLowerCase() === name.toLowerCase());
    if (i >= 0) {
      entry.id = list[i].id;
      entry.created = list[i].created;
      list[i] = entry;
    } else {
      list.unshift(entry);
    }
    if (saveMine(list)) toast(i >= 0 ? `Updated preset “${name}”` : `Saved preset “${name}”`);
    buildPresets();
    buildMine();
    markPreset('★' + entry.id);
    return entry.id;
  };
  app.loadPreset = function (id) {
    const p = loadMine().find((x) => x.id === id);
    if (!p) return false;
    if (!PG.patternMap[p.pattern]) {
      PG.reportError(`Preset “${p.name}” uses the pattern "${p.pattern}", which isn't available.`);
      return false;
    }
    const prev = state.pattern;
    state.pattern = p.pattern;
    const d = cur();
    state.params[d.id] = PG.sanitizeValues(d.params, p.values);
    state.transform = PG.sanitizeValues(PG.transformSchema, p.transform);
    state.post = PG.sanitizeValues(PG.postSchema, p.post);
    state.seed = (+p.seed >>> 0) % 1000000;
    if (prev !== state.pattern) onPatternChanged();
    refreshAll();
    changed(null);
    markPreset('★' + id);
    toast(`Loaded “${p.name}”`);
    return true;
  };
  app.deletePreset = function (id) {
    const list = loadMine();
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return false;
    const [gone] = list.splice(i, 1);
    saveMine(list);
    buildPresets();
    buildMine();
    toast(`Deleted “${gone.name}”`, {
      action: {
        label: 'Undo',
        fn: () => {
          const l = loadMine();
          if (!l.some((p) => p.id === gone.id)) l.splice(Math.min(i, l.length), 0, gone);
          saveMine(l);
          buildPresets();
          buildMine();
          toast(`Restored “${gone.name}”`);
        },
      },
    });
    return true;
  };
  app.renamePreset = function (id, name) {
    const list = loadMine();
    const p = list.find((x) => x.id === id);
    if (!p || !String(name || '').trim()) return false;
    p.name = String(name).trim().slice(0, 60);
    saveMine(list);
    buildPresets();
    buildMine();
    return true;
  };
  /** Uploaded images referenced by presets, so a backup restores them too. */
  function imagesFor(list) {
    const out = {};
    for (const p of list) {
      const d = PG.patternMap[p.pattern];
      if (!d || !PG.images) continue;
      for (const q of d.params) {
        const id = q.type === 'image' && p.values[q.id];
        const url = id && PG.images.dataURL(id);
        if (url) out[id] = { name: PG.images.name(id), dataURL: url };
      }
    }
    return out;
  }
  app.backupPresets = function () {
    const presets = loadMine();
    const data = { app: 'pattern-generator', kind: 'presets', version: 1, exported: new Date().toISOString(), presets, images: imagesFor(presets) };
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `pattern-presets-${new Date().toISOString().slice(0, 10)}.json`);
  };
  /** Merge presets from a backup (skips ones already present). Returns the number added. */
  app.importPresets = function (data) {
    if (data && data.images && PG.images) for (const id in data.images) PG.images.put(id, data.images[id].dataURL, data.images[id].name);
    const incoming = (Array.isArray(data) ? data : data.presets || data.looks || []).map(normalizeMine).filter(Boolean);
    const list = loadMine();
    let added = 0;
    for (const p of incoming) {
      if (list.some((x) => x.id === p.id)) continue;
      list.push(p);
      added++;
    }
    saveMine(list);
    buildPresets();
    buildMine();
    return added;
  };

  /* ---- contact sheet for testing: every pattern × preset */
  app.contactSheet = function ({ cols = 6, tw = 240, th = 150, presets = true } = {}) {
    const items = [];
    for (const d of PG.patterns) {
      items.push({ d, name: 'Default', values: PG.defaultsFor(d.params) });
      if (presets)
        for (const pr of d.presets)
          items.push({
            d,
            name: pr.name,
            values: PG.sanitizeValues(d.params, Object.assign(PG.defaultsFor(d.params), pr.values || {})),
            transform: pr.transform && PG.sanitizeValues(PG.transformSchema, Object.assign(PG.defaultsFor(PG.transformSchema), pr.transform)),
            post: pr.post && PG.sanitizeValues(PG.postSchema, Object.assign(PG.defaultsFor(PG.postSchema), pr.post)),
            seed: pr.seed,
          });
    }
    const rows = Math.ceil(items.length / cols);
    const lab = 18;
    const sheet = el('canvas');
    sheet.width = cols * tw;
    sheet.height = rows * (th + lab);
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.font = '11px ui-monospace, Menlo, monospace';
    const errors = [];
    items.forEach((it, i) => {
      const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
      const { image, error } = renderer.renderImage({
        def: it.d,
        values: it.values,
        transform: it.transform || PG.defaultsFor(PG.transformSchema),
        post: it.post || PG.defaultsFor(PG.postSchema),
        seed: it.seed != null ? it.seed : 1337,
        time: 0,
        width: tw,
        height: th,
        pxScale: th / 600,
        fboPrefix: 'sheet',
      });
      if (error) errors.push(`${it.d.id}/${it.name}: ${error}`);
      ctx.putImageData(image, x, y + lab);
      ctx.fillStyle = '#ddd';
      ctx.fillText(`${it.d.id} · ${it.name}`.slice(0, 40), x + 4, y + 13);
    });
    renderer.releaseFbos('sheet');
    dirty = true;
    return { dataURL: sheet.toDataURL('image/png'), count: items.length, errors };
  };

  /** Average ms per frame for the current view, synchronised with a 1px readPixels (gl.finish doesn't block everywhere). */
  app.benchmark = function (frames = 8) {
    const gl = renderer.gl;
    const px = new Uint8Array(4);
    const once = () => {
      draw();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    };
    once();
    const t = performance.now();
    for (let i = 0; i < frames; i++) once();
    return +((performance.now() - t) / frames).toFixed(2);
  };

  app.getState = () => Object.assign(snapshot(), { time: state.time, playing: state.playing });
  app.setState = function (s) {
    const prev = state.pattern;
    applySnapshot(s);
    if (s.time != null) state.time = +s.time;
    if (s.playing != null) state.playing = !!s.playing;
    if (prev !== state.pattern) onPatternChanged();
    refreshAll();
    changed(null);
  };

  /* ================================================================== UI */
  /** Show a short message. opts.action = { label, fn } adds a button (e.g. Undo) and keeps the toast up longer. */
  function toast(msg, opts = {}) {
    const t = $('#toast');
    if (!t) return;
    t.innerHTML = '';
    t.appendChild(el('span', {}, msg));
    if (opts.action) {
      t.appendChild(
        el(
          'button',
          {
            type: 'button',
            class: 'toast-btn',
            onclick: () => {
              t.classList.remove('show');
              opts.action.fn();
            },
          },
          opts.action.label
        )
      );
    }
    t.classList.toggle('actionable', !!opts.action);
    t.classList.add('show');
    clearTimeout(toast._id);
    toast._id = setTimeout(() => t.classList.remove('show'), opts.action ? 6000 : 2200);
  }
  app.toast = toast;

  function buildPicker() {
    const box = $('#picker');
    box.innerHTML = '';
    for (const d of PG.patterns) {
      const c = el('canvas', { width: 168, height: 104 });
      const tile = el('button', { type: 'button', class: 'tile', title: d.description || d.name, 'data-id': d.id, onclick: () => app.selectPattern(d.id) }, c, el('span', {}, d.name));
      d._thumb = c;
      box.appendChild(tile);
    }
    document.querySelectorAll('.tile').forEach((t) => t.classList.toggle('on', t.dataset.id === state.pattern));
  }
  function renderThumbs() {
    const list = PG.patterns.slice();
    const step = () => {
      const d = list.shift();
      if (!d) {
        renderer.releaseFbos('pick');
        document.documentElement.dataset.pgThumbs = '1';
        return;
      }
      try {
        const pr = d.presets.find((p) => p.thumb) || null;
        const values = PG.sanitizeValues(d.params, Object.assign(PG.defaultsFor(d.params), (pr && pr.values) || {}));
        const transform = PG.sanitizeValues(PG.transformSchema, Object.assign(PG.defaultsFor(PG.transformSchema), (pr && pr.transform) || {}));
        const { image, error } = renderer.renderImage({
          def: d,
          values,
          transform,
          post: PG.defaultsFor(PG.postSchema),
          seed: 1337,
          time: 0,
          width: 168,
          height: 104,
          pxScale: 0.5,
          fboPrefix: 'pick',
        });
        d._thumb.getContext('2d').putImageData(image, 0, 0);
        d._thumb.parentElement.classList.toggle('broken', !!error);
      } catch (e) {
        PG.reportError(`Thumbnail for ${d.id}: ${e.message}`);
      }
      setTimeout(step, 16);
    };
    setTimeout(step, 60);
  }

  function markPreset(name) {
    document.querySelectorAll('#presets .chip').forEach((c) => c.classList.toggle('on', name != null && c.dataset.name.toLowerCase() === String(name).toLowerCase()));
  }
  function buildPresets() {
    const box = $('#presets');
    if (!box) return;
    box.innerHTML = '';
    const d = cur();
    for (const n of ['Default', ...d.presets.map((p) => p.name)]) {
      box.appendChild(el('button', { type: 'button', class: 'chip', 'data-name': n, onclick: () => app.applyPreset(n) }, n));
    }
    for (const p of loadMine().filter((x) => x.pattern === d.id)) {
      box.appendChild(
        el(
          'button',
          { type: 'button', class: 'chip mine', 'data-name': '★' + p.id, title: `Your preset (saved ${p.created.slice(0, 10)})`, onclick: () => app.loadPreset(p.id) },
          '★ ' + p.name,
          el(
            'span',
            {
              class: 'chip-x',
              role: 'button',
              title: `Delete “${p.name}”`,
              onclick: (e) => {
                e.stopPropagation();
                app.deletePreset(p.id);
              },
            },
            '×'
          )
        )
      );
    }
    box.appendChild(el('button', { type: 'button', class: 'chip add', 'data-name': '+', title: 'Save the current settings as your own preset', onclick: (e) => openSaveBox(e.currentTarget) }, '+ Save'));
  }
  /** Inline name box that replaces the "+ Save" chip. */
  function openSaveBox(chip) {
    if (!chip) return;
    const input = el('input', { type: 'text', class: 'chip-input', maxlength: 60, placeholder: 'Preset name…' });
    const ok = el('button', { type: 'button', class: 'chip add on' }, 'Save');
    const wrap = el('span', { class: 'chip-save' }, input, ok);
    chip.replaceWith(wrap);
    input.focus();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      if (save) app.savePreset(input.value);
      else buildPresets();
    };
    ok.addEventListener('pointerdown', (e) => e.preventDefault());
    ok.addEventListener('click', () => finish(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => setTimeout(() => finish(false), 120));
  }
  app.promptSavePreset = function () {
    document.body.classList.remove('ui-hidden');
    const chip = $('#presets .chip.add');
    if (chip) {
      chip.scrollIntoView({ block: 'center', behavior: 'smooth' });
      openSaveBox(chip);
    }
  };

  /** Rename a preset in place (no prompt dialog). */
  function renameInline(card, p) {
    const nameEl = card && card.querySelector('.look-name');
    if (!nameEl) return;
    const input = el('input', { type: 'text', class: 'look-rename', value: p.name, maxlength: 60 });
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      if (save && input.value.trim() && input.value.trim() !== p.name) app.renamePreset(p.id, input.value);
      else buildMine();
    };
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  }

  let mineFilter = 'all';
  function buildMine() {
    const body = $('#ctl-mine');
    if (!body) return;
    const all = loadMine();
    const d = cur();
    const list = mineFilter === 'this' ? all.filter((p) => p.pattern === d.id) : all;
    const count = $('#mine-count');
    if (count) count.textContent = all.length ? `${all.length} saved` : 'save your own';
    body.innerHTML = '';

    const name = el('input', { type: 'text', class: 'textin', maxlength: 60, placeholder: `Name, e.g. “${d.name} night”` });
    const doSave = () => {
      app.savePreset(name.value);
      name.value = '';
    };
    name.addEventListener('keydown', (e) => e.key === 'Enter' && doSave());
    body.append(el('div', { class: 'btn-row' }, name, el('button', { type: 'button', class: 'btn primary', onclick: doSave }, 'Save current')));

    if (all.length) {
      const seg = el(
        'div',
        { class: 'seg mine-filter' },
        ['all', 'this'].map((f) =>
          el(
            'button',
            {
              type: 'button',
              class: 'seg-btn' + (mineFilter === f ? ' on' : ''),
              onclick: () => {
                mineFilter = f;
                buildMine();
              },
            },
            f === 'all' ? `All patterns (${all.length})` : `${d.name} (${all.filter((p) => p.pattern === d.id).length})`
          )
        )
      );
      body.append(seg);
    }

    const grid = el('div', { class: 'looks' });
    if (!list.length) {
      grid.appendChild(
        el('p', { class: 'muted' }, all.length ? 'No saved presets for this pattern yet.' : 'Presets you save show up here and as ★ chips under Presets. Click one to bring it back exactly as it was.')
      );
    }
    for (const p of list) {
      const pd = PG.patternMap[p.pattern];
      const load = () => app.loadPreset(p.id);
      const btn = (label, title, fn) =>
        el(
          'button',
          {
            type: 'button',
            class: 'look-btn',
            title,
            onclick: (e) => {
              e.stopPropagation();
              fn(e.currentTarget);
            },
          },
          label
        );
      grid.appendChild(
        el(
          'div',
          { class: 'look' + (pd ? '' : ' missing'), title: `Load “${p.name}”` },
          p.thumb ? el('img', { src: p.thumb, alt: '', onclick: load }) : el('div', { class: 'look-ph', onclick: load }),
          el('div', { class: 'look-meta', onclick: load }, el('span', { class: 'look-name' }, p.name), el('span', { class: 'look-pat' }, pd ? pd.name : p.pattern)),
          el(
            'div',
            { class: 'look-actions' },
            btn('✎', 'Rename', (b) => renameInline(b.closest('.look'), p)),
            btn('⟳', 'Overwrite with the current settings', () => {
              if (state.pattern !== p.pattern) return toast(`Switch to ${pd ? pd.name : p.pattern} first`);
              const before = U.clone(p);
              app.savePreset(p.name);
              toast(`Updated “${p.name}” with the current settings`, {
                action: {
                  label: 'Undo',
                  fn: () => {
                    const l = loadMine();
                    const k = l.findIndex((x) => x.id === before.id);
                    if (k >= 0) l[k] = before;
                    saveMine(l);
                    buildPresets();
                    buildMine();
                  },
                },
              });
            }),
            btn('×', 'Delete', () => app.deletePreset(p.id))
          )
        )
      );
    }
    body.append(grid);

    const fileIn = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (data.presets || data.looks || Array.isArray(data)) {
          const n = app.importPresets(data);
          toast(n ? `Restored ${n} preset${n === 1 ? '' : 's'}` : 'Those presets are already here');
        } else if (data.state || data.pattern) {
          app.setState(data.state || data);
          toast('Settings loaded');
        } else throw new Error('not a pattern-generator file');
      } catch (e) {
        PG.reportError('Restore failed: ' + e.message);
      }
      fileIn.value = '';
    });
    body.append(
      el(
        'div',
        { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn', onclick: () => app.backupPresets(), disabled: !all.length }, 'Backup to file'),
        el('button', { type: 'button', class: 'btn', onclick: () => fileIn.click() }, 'Restore from file'),
        fileIn
      ),
      el('p', { class: 'muted note' }, 'Presets are stored in this browser. Back them up to a .json file to keep them safe or move them to another computer.')
    );
  }

  function buildPatternPanel() {
    const d = cur();
    const body = $('#ctl-pattern');
    $('#panel-pattern summary .sum-title').textContent = d.name;
    panels.pattern = PG.ui.buildControls(body, d.params, () => state.params[state.pattern], (id, v) => app.setParam('pattern', id, v));
    if (d.description) body.prepend(el('p', { class: 'desc' }, d.description));
    body.appendChild(resetLink('Reset pattern settings', () => app.resetSection('pattern')));
  }
  function resetLink(label, fn) {
    return el('div', { class: 'reset-row' }, el('button', { type: 'button', class: 'link', onclick: fn }, label));
  }

  function buildTransformPanel() {
    const body = $('#ctl-transform');
    panels.transform = PG.ui.buildControls(body, PG.transformSchema, () => state.transform, (id, v) => app.setParam('transform', id, v));
    body.appendChild(
      resetLink('Reset perspective & warp', () => app.resetSection('transform'))
    );
  }
  function buildPostPanel() {
    const body = $('#ctl-post');
    panels.post = PG.ui.buildControls(body, PG.postSchema, () => state.post, (id, v) => app.setParam('post', id, v));
    body.appendChild(
      resetLink('Reset effects', () => app.resetSection('post'))
    );
  }

  function buildExportPanel() {
    const body = $('#ctl-export');
    body.innerHTML = '';
    const e = state.exp;
    const rows = {};
    const row = (key, label, control, title) => (rows[key] = el('div', { class: 'ctl ctl-select', title: title || '' }, el('label', { class: 'ctl-label' }, label), control));
    const seg = (key, opts, onSet) => {
      const box = el('div', { class: 'seg' });
      const btns = opts.map(([v, l]) => {
        const b = el('button', { type: 'button', class: 'seg-btn', onclick: () => { const prev = e[key]; e[key] = v; if (onSet) onSet(v, prev); syncExp(); saveSoon(); } }, l);
        box.appendChild(b);
        return [v, b];
      });
      box._sync = () => btns.forEach(([v, b]) => b.classList.toggle('on', e[key] === v));
      return box;
    };
    const num = (min, max, step) => el('input', { type: 'number', class: 'num', min, max, step });

    // pixels mode
    const sizeSel = el('select', { class: 'select' }, EXPORT_SIZES.map(([v, l]) => el('option', { value: v }, l)));
    const wIn = num(16, MAX_SIDE, 1), hIn = num(16, MAX_SIDE, 1);
    sizeSel.addEventListener('change', () => {
      if (sizeSel.value === 'custom') {
        const [w, h] = exportSize();
        e.w = w;
        e.h = h;
      }
      e.size = sizeSel.value;
      syncExp();
      saveSoon();
    });
    const customPx = () => {
      e.size = 'custom';
      e.w = U.clamp(Math.round(+wIn.value) || 2048, 16, MAX_SIDE);
      e.h = U.clamp(Math.round(+hIn.value) || 2048, 16, MAX_SIDE);
      syncExp();
      saveSoon();
    };
    wIn.addEventListener('change', customPx);
    hIn.addEventListener('change', customPx);

    // print mode
    const paperSel = el('select', { class: 'select' }, PAPERS.map(([v, l]) => el('option', { value: v }, l)));
    const pwIn = num(0.1, 1000, 0.01), phIn = num(0.1, 1000, 0.01);
    // switching units keeps the physical size
    const unitSeg = seg('unit', [['in', 'in'], ['cm', 'cm'], ['mm', 'mm']], (u, prev) => {
      const k = PER_INCH[u] / PER_INCH[prev];
      e.pw = +(e.pw * k).toFixed(3);
      e.ph = +(e.ph * k).toFixed(3);
    });
    paperSel.addEventListener('change', () => {
      e.paper = paperSel.value;
      const pp = PAPERS.find((x) => x[0] === e.paper);
      if (pp && pp[2]) {
        const landscape = e.pw > e.ph;
        [e.pw, e.ph, e.unit] = [pp[2], pp[3], pp[4]];
        if (landscape) [e.pw, e.ph] = [e.ph, e.pw];
      }
      syncExp();
      saveSoon();
    });
    const customPrint = () => {
      e.paper = 'custom';
      e.pw = Math.max(0.01, +pwIn.value || e.pw);
      e.ph = Math.max(0.01, +phIn.value || e.ph);
      syncExp();
      saveSoon();
    };
    pwIn.addEventListener('change', customPrint);
    phIn.addEventListener('change', customPrint);
    const rot = el('button', { type: 'button', class: 'mini icon', title: 'Swap portrait / landscape', html: ICON.swap, onclick: () => { [e.pw, e.ph] = [e.ph, e.pw]; syncExp(); saveSoon(); } });

    // DPI
    const DPIS = [72, 96, 150, 200, 300, 400, 600];
    const dpiSel = el('select', { class: 'select dpi-sel' }, [...DPIS.map((d) => el('option', { value: String(d) }, `${d} DPI`)), el('option', { value: 'custom' }, 'Custom…')]);
    const dpiIn = num(1, 4800, 1);
    dpiSel.addEventListener('change', () => {
      if (dpiSel.value !== 'custom') e.dpi = +dpiSel.value;
      syncExp();
      saveSoon();
      if (dpiSel.value === 'custom') dpiIn.focus();
    });
    dpiIn.addEventListener('change', () => {
      e.dpi = U.clamp(Math.round(+dpiIn.value) || 300, 1, 4800);
      syncExp();
      saveSoon();
    });

    const modeSeg = seg('mode', [['pixels', 'Pixels'], ['print', 'Print size']]);
    const fmtSeg = seg('format', [['png', 'PNG'], ['jpeg', 'JPEG']]);
    const match = el('button', { type: 'button', class: 'switch', role: 'switch', onclick: () => { e.match = !e.match; syncExp(); saveSoon(); } }, el('i'));
    const info = el('p', { class: 'muted note export-info' });
    const dl = el('button', { type: 'button', class: 'btn primary', onclick: () => app.exportImage() }, 'Download');

    function syncExp() {
      const print = e.mode === 'print';
      for (const k of ['size', 'pixels']) rows[k].hidden = print;
      for (const k of ['paper', 'print', 'unit']) if (rows[k]) rows[k].hidden = !print;
      modeSeg._sync();
      fmtSeg._sync();
      unitSeg._sync();
      sizeSel.value = e.size;
      paperSel.value = e.paper;
      const [w, h] = exportSize();
      if (document.activeElement !== wIn) wIn.value = w;
      if (document.activeElement !== hIn) hIn.value = h;
      if (document.activeElement !== pwIn) pwIn.value = +(+e.pw).toFixed(3);
      if (document.activeElement !== phIn) phIn.value = +(+e.ph).toFixed(3);
      const preset = DPIS.includes(e.dpi);
      dpiSel.value = preset ? String(e.dpi) : 'custom';
      dpiIn.hidden = preset && dpiSel.value !== 'custom';
      if (document.activeElement !== dpiIn) dpiIn.value = e.dpi;
      match.classList.toggle('on', !!e.match);
      const mp = (w * h) / 1e6;
      const inW = w / e.dpi, inH = h / e.dpi;
      const phys = e.unit === 'in' || !print ? `${inW.toFixed(2)} × ${inH.toFixed(2)} in` : `${(inW * PER_INCH[e.unit]).toFixed(e.unit === 'mm' ? 0 : 1)} × ${(inH * PER_INCH[e.unit]).toFixed(e.unit === 'mm' ? 0 : 1)} ${e.unit}`;
      const big = tooBig(w, h);
      info.classList.toggle('warn', big);
      info.textContent = big
        ? `${w} × ${h} px is too large (max ${MAX_PIXELS / 1e6} megapixels, ${MAX_SIDE} px per side). Lower the DPI or the size.`
        : `${w} × ${h} px · ${mp.toFixed(1)} MP · ${print ? '' : 'prints '}${phys} at ${e.dpi} DPI${mp > 40 ? ' · large export, may take a while' : ''}`;
      dl.disabled = big;
      dl.textContent = `Download ${e.format === 'jpeg' ? 'JPEG' : 'PNG'}`;
    }

    body.append(
      el('div', { class: 'ctl-heading' }, 'Image'),
      row('mode', 'Size by', modeSeg),
      row('size', 'Size', sizeSel),
      (rows.pixels = el('div', { class: 'ctl ctl-size' }, el('label', { class: 'ctl-label' }, 'Pixels'), el('div', { class: 'size-wrap' }, wIn, el('span', { class: 'x' }, '×'), hIn))),
      row('paper', 'Paper', paperSel),
      (rows.print = el('div', { class: 'ctl ctl-size' }, el('label', { class: 'ctl-label' }, 'Print size'), el('div', { class: 'size-wrap' }, pwIn, el('span', { class: 'x' }, '×'), phIn, rot))),
      (rows.unit = el('div', { class: 'ctl ctl-select print-only' }, el('label', { class: 'ctl-label' }, 'Units'), unitSeg)),
      el('div', { class: 'ctl ctl-size', title: 'Pixels per inch. In Print size mode it sets the resolution; it is always written into the file so print and layout apps know the physical size.' }, el('label', { class: 'ctl-label' }, 'DPI / PPI'), el('div', { class: 'size-wrap' }, dpiSel, dpiIn)),
      row('format', 'Format', fmtSeg),
      el('div', { class: 'ctl ctl-bool', title: 'Scale pixel-based effects (pixel size, RGB split, scanlines) so the export matches the preview' }, el('label', { class: 'ctl-label' }, 'Match preview'), match),
      info,
      el('div', { class: 'btn-row' }, dl, el('button', { type: 'button', class: 'btn', onclick: () => app.copyImage() }, 'Copy image'))
    );
    panels.exportSync = syncExp;
    syncExp();
    buildVideoSection(body);
  }

  function buildVideoSection(body) {
    const vid = state.vid;
    const rows = {};
    const sel = (key, opts, parse) => {
      const s = el('select', { class: 'select' }, opts.map(([v, l]) => el('option', { value: String(v) }, l)));
      s.value = String(vid[key]);
      s.addEventListener('change', () => {
        vid[key] = parse ? parse(s.value) : s.value;
        saveSoon();
        sync();
      });
      return s;
    };
    const row = (key, label, control, title) => (rows[key] = el('div', { class: 'ctl ctl-select', title: title || '' }, el('label', { class: 'ctl-label' }, label), control));
    const rec = el('button', { type: 'button', class: 'btn primary', onclick: () => app.exportVideo() }, 'Record loop video');
    const cancel = el('button', { type: 'button', class: 'btn', hidden: true, onclick: () => app.cancelVideo() }, 'Cancel');
    const bar = el('div', { class: 'progress', hidden: true }, el('i'));
    const info = el('p', { class: 'muted note' });
    function sync() {
      const [w, h] = videoSize();
      const frames = Math.round(vid.seconds * vid.fps);
      rows.blend.hidden = vid.loop !== 'crossfade';
      info.textContent =
        `${w}×${h} · ${frames} frames · MP4 (H.264). Records the current animation — Speed, Spin, Drift, warp speed and animated patterns. ` +
        (vid.loop === 'crossfade'
          ? 'The end is blended into the start so it loops with no jump.'
          : vid.loop === 'boomerang'
            ? 'Plays forward then backward, so it always loops perfectly.'
            : 'No loop blending.');
    }
    body.append(
      el('div', { class: 'ctl-heading' }, 'Video loop'),
      row('seconds', 'Length', sel('seconds', [2, 3, 4, 6, 8, 10, 15, 20, 30].map((s) => [s, s + ' seconds']), Number)),
      row('fps', 'Frame rate', sel('fps', [[24, '24 fps'], [30, '30 fps'], [60, '60 fps']], Number)),
      row('size', 'Size', sel('size', VIDEO_SIZES)),
      row('loop', 'Loop', sel('loop', [['crossfade', 'Seamless — crossfade'], ['boomerang', 'Seamless — boomerang'], ['straight', 'Straight (no blend)']])),
      row('blend', 'Blend', sel('blend', [[0.1, '10% of clip'], [0.2, '20% of clip'], [0.25, '25% of clip'], [0.33, '33% of clip'], [0.5, '50% of clip']], Number), 'How much of the clip is used to blend the end into the start'),
      row('quality', 'Quality', sel('quality', [['standard', 'Standard'], ['high', 'High'], ['max', 'Max (big file)']])),
      el('div', { class: 'btn-row' }, rec, cancel),
      bar,
      info
    );
    panels.videoUI = (f) => {
      const busy = f != null;
      rec.disabled = busy;
      rec.textContent = busy ? `Recording… ${Math.round(f * 100)}%` : 'Record loop video';
      cancel.hidden = !busy;
      bar.hidden = !busy;
      bar.firstChild.style.width = (busy ? f * 100 : 0).toFixed(1) + '%';
    };
    sync();
  }
  /** Reset one settings section to its defaults: 'pattern' | 'transform' | 'post'. Undoable. */
  app.resetSection = function (scope) {
    if (scope === 'pattern') {
      state.params[state.pattern] = freshParams(cur());
      markPreset('Default');
    } else if (scope === 'transform') {
      state.transform = PG.defaultsFor(PG.transformSchema);
    } else if (scope === 'post') {
      state.post = PG.defaultsFor(PG.postSchema);
    }
    refreshAll();
    changed(scope);
    toast(`${{ pattern: cur().name, transform: 'Perspective & Warp', post: 'Pixelate & Color FX' }[scope]} reset — ⌘Z to undo`);
  };
  /** Reset everything for the current pattern: its settings, perspective/warp/motion, effects and animation. Undoable. */
  app.resetAll = function () {
    state.params[state.pattern] = freshParams(cur());
    state.transform = PG.defaultsFor(PG.transformSchema);
    state.post = PG.defaultsFor(PG.postSchema);
    state.speed = 1;
    state.time = 0;
    state.playing = false;
    refreshAll();
    changed(null);
    markPreset('Default');
    toast('All settings reset — ⌘Z to undo');
  };
  /** Small ↺ button on a panel header. */
  function headerReset(panelId, scope) {
    const sum = $(`#${panelId} summary`);
    if (!sum || sum.querySelector('.sum-reset')) return;
    sum.appendChild(
      el(
        'button',
        {
          type: 'button',
          class: 'sum-reset',
          title: 'Reset this section to defaults',
          onclick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            app.resetSection(scope);
          },
          html: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg><span>Reset</span>',
        }
      )
    );
  }

  function refreshAll() {
    for (const k of ['pattern', 'transform', 'post']) if (panels[k]) panels[k].refresh();
    syncToolbar();
    if (panels.exportSync) panels.exportSync();
  }

  function syncToolbar() {
    const seed = $('#seed');
    if (seed && document.activeElement !== seed) seed.value = state.seed;
    const play = $('#btn-play');
    if (play) {
      play.classList.toggle('on', state.playing);
      play.innerHTML = state.playing
        ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
        : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>';
    }
    const sp = $('#speed');
    if (sp && document.activeElement !== sp) sp.value = state.speed;
    const spin = $('#spin');
    if (spin && document.activeElement !== spin) spin.value = state.transform.spin;
    const sv = $('#spin-val');
    if (sv) sv.textContent = `${Math.round(state.transform.spin)}°/s`;
    const spv = $('#speed-val');
    if (spv) spv.textContent = `${(+state.speed).toFixed(2)}×`;
    const res = $('#res-select');
    if (res) res.value = state.preview;
  }

  function wireToolbar() {
    $('#btn-random').addEventListener('click', (e) => app.randomize(e.shiftKey));
    $('#btn-random-all').addEventListener('click', () => app.randomize(true));
    $('#seed').addEventListener('change', (e) => {
      state.seed = (parseInt(e.target.value, 10) >>> 0) % 1000000;
      changed(null);
    });
    $('#btn-reseed').addEventListener('click', () => {
      state.seed = Math.floor(Math.random() * 999999) + 1;
      syncToolbar();
      changed(null);
    });
    $('#btn-play').addEventListener('click', () => app.togglePlay());
    $('#speed').addEventListener('input', (e) => {
      state.speed = +e.target.value;
      syncToolbar();
      saveSoon();
    });
    $('#speed').addEventListener('dblclick', () => {
      state.speed = 1;
      syncToolbar();
      saveSoon();
    });
    const setSpin = (v) => {
      state.transform.spin = v;
      if (v && !state.playing) app.togglePlay();
      syncToolbar();
      changed('transform');
    };
    $('#spin').addEventListener('input', (e) => setSpin(+e.target.value));
    $('#spin').addEventListener('dblclick', () => setSpin(0));
    $('#btn-rewind').addEventListener('click', () => {
      state.time = 0;
      dirty = true;
    });
    $('#btn-undo').addEventListener('click', app.undo);
    $('#btn-redo').addEventListener('click', app.redo);
    $('#btn-resetview').addEventListener('click', resetView);
    $('#btn-reset').addEventListener('click', app.resetAll);
    $('#res-select').addEventListener('change', (e) => {
      state.preview = e.target.value;
      dirty = true;
      saveSoon();
    });
    $('#btn-link').addEventListener('click', app.copyLink);
    $('#btn-save').addEventListener('click', app.promptSavePreset);
    const fileIn = $('#file-upload');
    const pick = () => fileIn.click();
    fileIn.addEventListener('change', () => {
      if (fileIn.files[0]) app.useImageFile(fileIn.files[0]);
      fileIn.value = '';
    });
    $('#btn-upload').addEventListener('click', pick);
    $('#upload-card .uc-btn').addEventListener('click', pick);
    $('#upload-card .uc-x').addEventListener('click', () => {
      uploadCardDismissed = true;
      updateUploadCard();
    });
    $('#btn-png').addEventListener('click', app.exportPNG);
    $('#pg-errors .err-x').addEventListener('click', PG.dismissErrors);
    $('#btn-hide').addEventListener('click', () => document.body.classList.toggle('ui-hidden'));
  }
  app.togglePlay = function () {
    state.playing = !state.playing;
    lastFrame = 0;
    syncToolbar();
    dirty = true;
  };
  function resetView() {
    Object.assign(state.transform, { zoom: 1, panX: 0, panY: 0, rotate: 0 });
    changed('transform');
  }

  /* ========================================================= interaction */
  const rad = (d) => (d * Math.PI) / 180;
  const rot = (x, y, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [c * x - s * y, s * x + c * y];
  };
  /** CSS px (from viewport top-left) → plane coords; mirrors pg_perspective in GLSL. */
  function screenToPlane(x, y, tf) {
    const uvx = ((x - css.w / 2) / css.h) * 2;
    const uvy = (-(y - css.h / 2) / css.h) * 2;
    const tilt = rad(tf.tilt);
    if (tilt < 1e-4) return [uvx, uvy];
    const k = Math.tan(rad(tf.fov) / 2);
    const dir = rad(tf.tiltDir);
    const [qx, qy] = rot(uvx, uvy, -dir);
    const c = Math.cos(tilt), s = Math.sin(tilt);
    const den = c - s * qy * k;
    if (den <= 1e-5) return null;
    const t = c / den;
    return rot(t * qx, c * t * qy + (s * (t - 1)) / k, dir);
  }
  /** Pattern coords without pan (pan is additive, so deltas of this give pan deltas). */
  function viewPoint(x, y, tf) {
    const pl = screenToPlane(x, y, tf);
    if (!pl) return null;
    const [vx, vy] = rot(pl[0], pl[1], -rad(tf.rotate));
    return [vx / tf.zoom, vy / tf.zoom];
  }

  function wireCanvas() {
    let drag = null;
    const pos = (e) => {
      const r = viewport.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    viewport.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      viewport.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      const mode = e.shiftKey ? 'tilt' : e.altKey ? 'rotate' : 'pan';
      drag = { mode, x, y, x0: x, y0: y };
      viewport.classList.add('dragging');
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const [x, y] = pos(e);
      const tf = state.transform;
      if (drag.mode === 'pan') {
        const a = viewPoint(drag.x, drag.y, tf);
        const b = viewPoint(x, y, tf);
        if (a && b) {
          tf.panX += a[0] - b[0];
          tf.panY += a[1] - b[1];
        }
      } else if (drag.mode === 'tilt') {
        tf.tilt = U.clamp(tf.tilt - (y - drag.y) * 0.25, 0, 88);
        let d = tf.tiltDir + (x - drag.x) * 0.3;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        tf.tiltDir = d;
      } else if (drag.mode === 'rotate') {
        const cx = css.w / 2, cy = css.h / 2;
        const a0 = Math.atan2(drag.y - cy, drag.x - cx), a1 = Math.atan2(y - cy, x - cx);
        let r = tf.rotate - ((a1 - a0) * 180) / Math.PI;
        if (r > 180) r -= 360;
        if (r < -180) r += 360;
        tf.rotate = r;
      }
      drag.x = x;
      drag.y = y;
      changed('transform');
    });
    const end = () => {
      drag = null;
      viewport.classList.remove('dragging');
    };
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);
    viewport.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const [x, y] = pos(e);
        const tf = state.transform;
        const before = viewPoint(x, y, tf);
        const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        tf.zoom = U.clamp(tf.zoom * f, 0.05, 20);
        const after = viewPoint(x, y, tf);
        if (before && after) {
          tf.panX += before[0] - after[0];
          tf.panY += before[1] - after[1];
        }
        changed('transform');
      },
      { passive: false }
    );
    viewport.addEventListener('dblclick', resetView);
  }

  /** Use an image file for the current pattern's image param (switching to Make Your Own if needed). */
  app.useImageFile = async function (file) {
    if (!file || !PG.images || (!/^image\//.test(file.type) && !/\.(tiff?|png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || ''))) return false;
    let p = cur().params.find((q) => q.type === 'image');
    if (!p && PG.patternMap.tile) {
      app.selectPattern('tile');
      p = cur().params.find((q) => q.type === 'image');
    }
    if (!p) {
      toast('No pattern here accepts images');
      return false;
    }
    try {
      toast(`Reading ${file.name || 'image'}…`);
      const id = await PG.images.add(file);
      app.setParam('pattern', p.id, id);
      toast('Image added — try the Layout options');
      return true;
    } catch (e) {
      PG.reportError(`Couldn't read “${file.name || 'that file'}”: ${e.message}. Try PNG, JPEG, TIFF, WebP, GIF or SVG.`);
      toast('Upload failed — see the message above');
      return false;
    }
  };
  function wireDrop() {
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    viewport.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      viewport.classList.add('drop');
    });
    viewport.addEventListener('dragleave', () => viewport.classList.remove('drop'));
    viewport.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      viewport.classList.remove('drop');
      app.useImageFile(e.dataTransfer.files[0]);
    });
    // never let a stray drop navigate away from the app
    window.addEventListener('dragover', (e) => hasFiles(e) && e.preventDefault());
    window.addEventListener('drop', (e) => hasFiles(e) && e.preventDefault());
    window.addEventListener('paste', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const item = e.clipboardData && [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
      if (!item) return;
      e.preventDefault();
      app.useImageFile(item.getAsFile());
    });
  }

  function wireKeys() {
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        app.promptSavePreset();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) app.redo();
        else app.undo();
        return;
      }
      if (mod) return;
      const k = e.key;
      if (k === ' ') {
        e.preventDefault();
        app.togglePlay();
      } else if (k === 'r') app.randomize(false);
      else if (k === 'R') app.randomize(true);
      else if (k === 'p') {
        state.post.pixelate = !state.post.pixelate;
        changed('post');
      } else if (k === 'h') document.body.classList.toggle('ui-hidden');
      else if (k === ']' || k === '[') {
        const i = PG.patterns.indexOf(cur());
        const n = PG.patterns.length;
        app.selectPattern(PG.patterns[(i + (k === ']' ? 1 : -1) + n) % n].id);
      } else if (k === '0') resetView();
    });
  }

  /* ================================================================ boot */
  app.boot = function () {
    canvas = $('#view');
    viewport = $('#viewport');
    if (!PG.patterns.length) {
      PG.reportError('No patterns registered.');
      return;
    }
    const q0 = new URLSearchParams(location.hash.replace(/^#/, ''));
    shotMode = q0.get('shot') === '1';
    if (shotMode) document.body.classList.add('shot');

    try {
      renderer = new PG.Renderer(canvas);
    } catch (e) {
      PG.reportError(e.message);
      return;
    }
    app.renderer = renderer;

    state = freshState();
    if (!shotMode && !q0.get('fresh') && !q0.get('s') && !q0.get('pattern')) {
      try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY));
        if (saved) {
          applySnapshot(saved);
          if (saved.preview) state.preview = saved.preview;
          if (saved.exp) state.exp = Object.assign(state.exp, saved.exp);
          if (saved.vid) state.vid = Object.assign(state.vid, saved.vid);
        }
      } catch (e) {
        /* ignore */
      }
    }
    paramsOf(state.pattern);
    applyHash(location.hash);
    if (q0.get('ui') === '0') document.body.classList.add('ui-hidden');
    if (PG.images) {
      PG.images.init();
      PG.images.onChange(() => (dirty = true));
    }

    buildPicker();
    buildPresets();
    buildPatternPanel();
    buildTransformPanel();
    buildPostPanel();
    buildExportPanel();
    buildMine();
    updateUploadCard();
    headerReset('panel-pattern', 'pattern');
    headerReset('panel-transform', 'transform');
    headerReset('panel-post', 'post');
    wireToolbar();
    wireCanvas();
    wireDrop();
    wireKeys();
    refreshAll();

    window.addEventListener('hashchange', () => {
      applyHash(location.hash);
      onPatternChanged();
      refreshAll();
      dirty = true;
    });
    new ResizeObserver(() => (dirty = true)).observe(viewport);

    draw();
    dirty = false;
    pushHistoryNow();
    requestAnimationFrame(loop);
    if (!shotMode) renderThumbs();
    updateStatus();
  };
})();
