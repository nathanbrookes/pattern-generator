/* Pattern Generator — WebGL2 renderer.
 * Pass 1: pattern shader (pattern code + transform) → RGBA8 framebuffer.
 * Pass 2: post shader (pixelate, colour, quantize, effects) → screen or export framebuffer. */
(function () {
  'use strict';
  const PG = window.PG;
  const U = PG.util;

  const VS = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  function mapLog(log, src, userStart, label) {
    const lines = src.split('\n');
    return log
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const m = /ERROR:\s*\d+:(\d+):\s*(.*)/.exec(l);
        if (!m) return l;
        const n = parseInt(m[1], 10);
        const code = (lines[n - 1] || '').trim();
        const where = userStart && n >= userStart ? `${label} line ${n - userStart + 1}` : `engine line ${n}`;
        return `${where}: ${m[2]}\n    > ${code}`;
      })
      .join('\n');
  }

  class Renderer {
    constructor(canvas) {
      const gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        antialias: false,
        depth: false,
        stencil: false,
      });
      if (!gl) throw new Error('WebGL2 is not available in this browser.');
      this.gl = gl;
      this.canvas = canvas;
      this.scratchUnit = Math.min(gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS), 32) - 1;
      this.maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0], 8192);

      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.vs = this._shader(gl.VERTEX_SHADER, VS, 'vertex');
      this.programs = new Map(); // pattern id → { prog, locs } | { error }
      this.textures = new Map(); // key → { tex, sig, w, h }
      this.fbos = new Map(); // name → { fb, tex, w, h }

      try {
        this.post = this._buildPost();
      } catch (e) {
        this.post = { error: e.message };
        PG.setError('post', e.message);
      }
    }

    /* ------------------------------------------------------------ programs */
    _shader(type, src, label, userStart) {
      const gl = this.gl;
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh) || 'unknown error';
        gl.deleteShader(sh);
        throw new Error(`${label} shader failed to compile:\n${mapLog(log, src, userStart, label)}`);
      }
      return sh;
    }

    _program(fsSrc, label, userStart) {
      const gl = this.gl;
      const fs = this._shader(gl.FRAGMENT_SHADER, fsSrc, label, userStart);
      const prog = gl.createProgram();
      gl.attachShader(prog, this.vs);
      gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, 'a_pos');
      gl.linkProgram(prog);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog);
        gl.deleteProgram(prog);
        throw new Error(`${label} failed to link: ${log}`);
      }
      const locs = {};
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(prog, i);
        locs[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name);
      }
      return { prog, locs };
    }

    /** Full fragment source for a pattern (exposed for debugging). Returns { src, userStart }. */
    patternSource(def) {
      const header = [
        '#version 300 es',
        'precision highp float;',
        'precision highp int;',
        'precision highp sampler2D;',
        'uniform vec2 u_res;',
        'uniform float u_time;',
        'uniform float u_seed;',
        'uniform float u_pxScale;',
        'uniform int u_ss;',
        'uniform vec2 u_fcOffset;',
        PG.uniformDecls(PG.transformSchema, 'u_tf_'),
        PG.selectDefines(PG.transformSchema, 'TF_'),
        PG.uniformDecls(def.params, 'u_'),
        PG.selectDefines(def.params, ''),
        def.textures.map((t) => `uniform sampler2D u_${t.id};\nuniform vec2 u_${t.id}_size;`).join('\n'),
        PG.glsl.common,
        PG.glsl.patternLib,
      ].join('\n');
      const userStart = header.split('\n').length + 1;
      return { src: header + '\n' + def.glsl + '\n' + PG.glsl.patternMain, userStart };
    }

    getPatternProgram(def) {
      let entry = this.programs.get(def.id);
      if (entry && entry.def === def) return entry;
      if (entry && entry.prog) this.gl.deleteProgram(entry.prog);
      const { src, userStart } = this.patternSource(def);
      try {
        entry = this._program(src, `${def.name}`, userStart);
      } catch (e) {
        entry = { error: e.message };
      }
      entry.def = def;
      this.programs.set(def.id, entry);
      return entry;
    }

    _buildPost() {
      const header = [
        '#version 300 es',
        'precision highp float;',
        'precision highp int;',
        'uniform sampler2D u_src;',
        'uniform vec2 u_res;',
        'uniform float u_time;',
        'uniform float u_seed;',
        'uniform float u_pxScale;',
        'uniform vec2 u_fcOffset;',
        'uniform vec2 u_srcOffset;',
        'uniform vec2 u_srcSize;',
        'uniform float u_glitchFit;',
        PG.uniformDecls(PG.postSchema, 'u_fx_'),
        PG.selectDefines(PG.postSchema, 'FX_'),
        PG.glsl.common,
      ].join('\n');
      return this._program(header + '\n' + PG.glsl.postMain, 'Post FX', 0);
    }

    /* ------------------------------------------------------------ resources */
    _fbo(name, w, h) {
      const gl = this.gl;
      let f = this.fbos.get(name);
      if (f && f.w === w && f.h === h) return f;
      if (f) {
        gl.deleteFramebuffer(f.fb);
        gl.deleteTexture(f.tex);
      }
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + this.scratchUnit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      f = { fb, tex, w, h };
      this.fbos.set(name, f);
      return f;
    }

    releaseFbos(prefix) {
      const gl = this.gl;
      for (const [name, f] of [...this.fbos]) {
        if (!name.startsWith(prefix)) continue;
        gl.deleteFramebuffer(f.fb);
        gl.deleteTexture(f.tex);
        this.fbos.delete(name);
      }
    }

    _upload(key, sig, w, h, data, filter, wrap, mipmap) {
      const gl = this.gl;
      let e = this.textures.get(key);
      if (e && e.sig === sig) return e;
      if (!e) {
        e = { tex: gl.createTexture() };
        this.textures.set(key, e);
      }
      // upload on a scratch unit so we never clobber a sampler already bound for this frame
      gl.activeTexture(gl.TEXTURE0 + this.scratchUnit);
      gl.bindTexture(gl.TEXTURE_2D, e.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      if (data instanceof HTMLCanvasElement || (typeof ImageData !== 'undefined' && data instanceof ImageData)) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      } else {
        // typed array, rows top-to-bottom → flip so row 0 ends up at the top of the texture
        const flipped = new Uint8Array(w * h * 4);
        for (let y = 0; y < h; y++) flipped.set(data.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, flipped);
      }
      const f = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
      const wr = wrap === 'clamp' ? gl.CLAMP_TO_EDGE : wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.REPEAT;
      if (mipmap) {
        gl.generateMipmap(gl.TEXTURE_2D);
        const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? (filter === 'nearest' ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR) : f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
      e.sig = sig;
      e.w = w;
      e.h = h;
      return e;
    }

    _gradientTexture(key, g) {
      const sig = JSON.stringify(g);
      return this._upload('grad:' + key, sig, 256, 1, PG.bakeGradient(g, 256), 'linear', 'clamp').tex;
    }

    _patternTexture(def, t, values, seed) {
      const deps = t.deps || def.params.map((p) => p.id);
      // image params also key on load state, so the texture rebuilds once an upload finishes decoding
      const imgState = deps.map((id) => {
        const p = def.params.find((q) => q.id === id);
        return p && p.type === 'image' && PG.images ? PG.images.state(values[id]) : '';
      });
      const sig = JSON.stringify(deps.map((id) => (id === '$seed' ? seed : values[id]))) + '|' + imgState.join(',');
      const key = `tex:${def.id}:${t.id}`;
      const cached = this.textures.get(key);
      if (cached && cached.sig === sig) return cached;
      let img;
      try {
        img = t.build(values, { seed, rng: U.mulberry32(seed) });
        if (!img) throw new Error('build() returned nothing');
        PG.setError(key, null);
      } catch (e) {
        PG.setError(key, `${def.name}: texture "${t.id}" failed: ${e.message}`);
        img = { width: 1, height: 1, data: new Uint8Array([255, 0, 255, 255]) };
      }
      const src = img instanceof HTMLCanvasElement || img instanceof ImageData ? img : img.canvas || img.data;
      const w = img.width || (img.canvas && img.canvas.width);
      const h = img.height || (img.canvas && img.canvas.height);
      return this._upload(key, sig, w, h, src, t.filter || img.filter || 'linear', t.wrap || img.wrap || 'repeat', !!(t.mipmap || img.mipmap));
    }

    _setSchemaUniforms(locs, schema, values, prefix, unit, texKey) {
      const gl = this.gl;
      for (const p of schema) {
        if (!PG.isUniformParam(p)) continue;
        const name = prefix + p.id;
        const loc = locs[name];
        const v = values[p.id];
        switch (p.type) {
          case 'range':
          case 'int':
            if (loc) gl.uniform1f(loc, +v);
            break;
          case 'bool':
            if (loc) gl.uniform1f(loc, v ? 1 : 0);
            break;
          case 'select':
            if (loc) gl.uniform1i(loc, Math.max(0, p.options.findIndex((o) => o.value === v)));
            break;
          case 'color':
            if (loc) gl.uniform3fv(loc, U.hexToRgb(v));
            break;
          case 'gradient':
            if (loc) {
              const tex = this._gradientTexture(texKey + ':' + name, v);
              gl.activeTexture(gl.TEXTURE0 + unit.n);
              gl.bindTexture(gl.TEXTURE_2D, tex);
              gl.uniform1i(loc, unit.n++);
            }
            break;
          case 'palette': {
            const cols = v || [];
            if (loc) {
              const arr = new Float32Array(48);
              cols.slice(0, 16).forEach((h, i) => arr.set(U.hexToRgb(h), i * 3));
              gl.uniform3fv(loc, arr);
            }
            const lc = locs[name + '_count'];
            if (lc) gl.uniform1i(lc, Math.max(1, Math.min(16, cols.length)));
            break;
          }
        }
      }
    }

    _setGlobals(locs, o, W, H) {
      const gl = this.gl;
      if (locs.u_res) gl.uniform2f(locs.u_res, W, H);
      if (locs.u_time) gl.uniform1f(locs.u_time, o.time || 0);
      if (locs.u_seed) gl.uniform1f(locs.u_seed, (o.seed >>> 0) % 1000000);
      if (locs.u_pxScale) gl.uniform1f(locs.u_pxScale, o.pxScale || 1);
    }

    /**
     * Render a frame.
     * o = { def, values, transform, post, seed, time, width, height, pxScale, toPixels, fboPrefix }
     * Returns { error, pixels } — pixels (bottom-up RGBA) only when toPixels.
     */
    render(o) {
      const gl = this.gl;
      const W = Math.max(1, o.width | 0);
      const H = Math.max(1, o.height | 0);
      // Tiling: this call renders the W×H rectangle at o.offset (bottom-left origin) of an o.full-sized image.
      const FW = o.full ? o.full[0] : W, FH = o.full ? o.full[1] : H;
      const ox = o.offset ? o.offset[0] : 0, oy = o.offset ? o.offset[1] : 0;
      // extra pattern pixels around the tile for neighbourhood post effects (a number, or [x, y])
      const Mx = (Array.isArray(o.margin) ? o.margin[0] : o.margin) | 0;
      const My = Array.isArray(o.margin) ? o.margin[1] | 0 : Mx;
      const prefix = o.fboPrefix || 'main';
      const def = o.def;
      gl.bindVertexArray(this.vao);
      gl.disable(gl.BLEND);

      // ---- pass 1: pattern
      const PW = W + 2 * Mx, PH = H + 2 * My;
      const pass = this._fbo(prefix + ':pattern', PW, PH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pass.fb);
      gl.viewport(0, 0, PW, PH);
      const entry = this.getPatternProgram(def);
      if (entry.error) {
        gl.clearColor(0.18, 0.02, 0.08, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else {
        gl.useProgram(entry.prog);
        const L = entry.locs;
        this._setGlobals(L, o, FW, FH);
        if (L.u_fcOffset) gl.uniform2f(L.u_fcOffset, ox - Mx, oy - My);
        if (L.u_ss) gl.uniform1i(L.u_ss, Math.max(1, Math.min(4, parseInt(o.transform.ss, 10) || 1)));
        // build/refresh CPU textures before any sampler is bound
        const texEntries = def.textures.map((t) => [t, this._patternTexture(def, t, o.values, o.seed)]);
        const unit = { n: 0 };
        this._setSchemaUniforms(L, PG.transformSchema, o.transform, 'u_tf_', unit, 'tf');
        this._setSchemaUniforms(L, def.params, o.values, 'u_', unit, def.id);
        for (const [t, e] of texEntries) {
          const loc = L['u_' + t.id];
          if (loc) {
            gl.activeTexture(gl.TEXTURE0 + unit.n);
            gl.bindTexture(gl.TEXTURE_2D, e.tex);
            gl.uniform1i(loc, unit.n++);
          }
          const sl = L['u_' + t.id + '_size'];
          if (sl) gl.uniform2f(sl, e.w, e.h);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      // ---- pass 2: post
      const out = o.toPixels ? this._fbo(prefix + ':out', W, H) : null;
      gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
      gl.viewport(0, 0, W, H);
      if (this.post.error) {
        gl.clearColor(0.18, 0.02, 0.08, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else {
        gl.useProgram(this.post.prog);
        const L = this.post.locs;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, pass.tex);
        if (L.u_src) gl.uniform1i(L.u_src, 0);
        this._setGlobals(L, o, FW, FH);
        if (L.u_fcOffset) gl.uniform2f(L.u_fcOffset, ox, oy);
        if (L.u_srcOffset) gl.uniform2f(L.u_srcOffset, ox - Mx, oy - My);
        if (L.u_srcSize) gl.uniform2f(L.u_srcSize, PW, PH);
        if (L.u_glitchFit) gl.uniform1f(L.u_glitchFit, this.postReach(o.post, o.pxScale || 1).fit);
        this._setSchemaUniforms(L, PG.postSchema, o.post, 'u_fx_', { n: 1 }, 'fx');
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      let pixels = null;
      if (o.toPixels) {
        pixels = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { error: entry.error || null, pixels };
    }

    /**
     * How far (px, per axis) the post pass may sample from an output pixel: pixel blocks, RGB split and glitch.
     * fit (0..1) scales the glitch's sizes down only when its reach wouldn't fit a tile margin on this GPU (giant
     * exports); it depends on the settings, pxScale and the GPU limit alone, so tiled and single-pass renders agree.
     */
    postReach(post, ps) {
      const B = post && post.pixelate ? Math.max(1, post.pxSize * ps) : 0;
      const base = 1.6 * B + ((post && post.rgbSplit) || 0) * ps;
      const g = post && post.glitch > 0 ? PG.glsl.glitchReach(post) : null;
      if (!g) return { x: base, y: base, fit: 1, glitch: false };
      const SLACK = 8 + Math.ceil(g.slack || 0); // 2 px block floor ×3, rounding to whole pixels
      const room = (this.maxSize - 512) / 2 - 6 - SLACK - base; // largest reach a margin can carry around a 512 px tile
      const need = Math.max(g.x, g.y) * ps;
      const fit = need > room ? Math.max(0, room / need) : 1;
      return { x: base + g.x * ps * fit + SLACK, y: base + g.y * ps * fit + SLACK, fit, glitch: true };
    }

    /**
     * Render an image of any size in tiles (beyond the GPU's texture limit). Returns { width, height, data } with
     * top-down RGBA rows. onProgress(fraction) is called per tile; yields to the browser between tiles.
     */
    async renderTiled(o, onProgress, tile = 2048) {
      const W = Math.max(1, o.width | 0), H = Math.max(1, o.height | 0);
      const reach = this.postReach(o.post, o.pxScale || 1);
      // even margins keep the GPU's 2×2 derivative quads aligned with a single-pass render
      // (capped so a 256 px tile plus its margins always fits the GPU limit — extreme pixel sizes on giant exports)
      const lim = Math.floor((this.maxSize - 256) / 4) * 2;
      const mx = Math.min(lim, (Math.ceil(reach.x / 2) + 2) * 2), my = Math.min(lim, (Math.ceil(reach.y / 2) + 2) * 2);
      // glitch margins can be wide: widen the tile along that axis so the margin doesn't dominate the work
      const span = (m) => Math.max(256, Math.min(reach.glitch ? Math.max(tile, 2 * m) : tile, this.maxSize - 2 * m));
      const TX = span(mx), TY = span(my);
      const margin = [mx, my];
      const out = new Uint8ClampedArray(W * H * 4);
      const tiles = [];
      for (let y = 0; y < H; y += TY) for (let x = 0; x < W; x += TX) tiles.push([x, y, Math.min(TX, W - x), Math.min(TY, H - y)]);
      let done = 0;
      try {
        for (const [x, y, tw, th] of tiles) {
          const r = this.render(Object.assign({}, o, { width: tw, height: th, full: [W, H], offset: [x, y], margin, toPixels: true, fboPrefix: 'tile' }));
          if (r.error) throw new Error(r.error);
          for (let row = 0; row < th; row++) out.set(r.pixels.subarray(row * tw * 4, (row + 1) * tw * 4), ((H - 1 - (y + row)) * W + x) * 4);
          if (onProgress) onProgress(++done / tiles.length);
          await new Promise((res) => setTimeout(res, 0));
        }
      } finally {
        this.releaseFbos('tile');
      }
      return { width: W, height: H, data: out };
    }

    /** Render to an ImageData (top-down rows). */
    renderImage(o) {
      const r = this.render(Object.assign({}, o, { toPixels: true }));
      const W = Math.max(1, o.width | 0), H = Math.max(1, o.height | 0);
      const img = new ImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(r.pixels.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      return { image: img, error: r.error };
    }
  }

  PG.Renderer = Renderer;
})();
