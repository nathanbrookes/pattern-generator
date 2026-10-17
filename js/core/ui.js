/* Pattern Generator — control widgets generated from param schemas. */
(function () {
  'use strict';
  const PG = window.PG;
  const U = PG.util;

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return e;
  }

  const ICON = {
    dice: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
    swap: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h13l-4-4M17 17H4l4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    caret: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  };

  /* ---------------------------------------------------------------- popover */
  let openPop = null;
  function closePopover() {
    if (openPop) {
      openPop.remove();
      openPop = null;
    }
  }
  document.addEventListener('pointerdown', (e) => {
    if (openPop && !openPop.contains(e.target) && !e.target.closest('[data-pop-anchor]')) closePopover();
  });
  function popover(anchor, content) {
    const wasOpen = openPop && openPop._anchor === anchor;
    closePopover();
    if (wasOpen) return;
    const pop = el('div', { class: 'popover' }, content);
    pop._anchor = anchor;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const pw = Math.max(r.width, 240);
    pop.style.width = pw + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left)) + 'px';
    const below = r.bottom + 4;
    const h = Math.min(pop.scrollHeight, 360);
    pop.style.top = (below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : below) + 'px';
    openPop = pop;
  }

  /* --------------------------------------------------------------- controls */
  function labelEl(p, reset) {
    return el(
      'label',
      {
        class: 'ctl-label',
        title: (p.help ? p.help + '\n' : '') + 'Double-click to reset',
        ondblclick: reset,
      },
      p.label
    );
  }

  function rangeControl(p, get, set) {
    const isLog = p.scale === 'log' && p.min > 0;
    const dec = U.decimalsFor(p.step);
    const row = el('div', { class: 'ctl ctl-range' });
    const slider = el('input', { type: 'range', class: 'slider' });
    if (isLog) {
      slider.min = 0;
      slider.max = 1000;
      slider.step = 1;
    } else {
      slider.min = p.min;
      slider.max = p.max;
      slider.step = p.step;
    }
    const num = el('input', { type: 'number', class: 'num', step: p.step, spellcheck: 'false' });
    const toPos = (v) => (isLog ? (Math.log(U.clamp(v, p.min, p.max) / p.min) / Math.log(p.max / p.min)) * 1000 : v);
    const fromPos = (s) => {
      let v = isLog ? p.min * Math.pow(p.max / p.min, s / 1000) : +s;
      v = Math.round(v / p.step) * p.step;
      return +v.toFixed(dec);
    };
    const fmt = (v) => (+v).toFixed(dec);
    slider.addEventListener('input', () => {
      const v = fromPos(+slider.value);
      num.value = fmt(v);
      set(v);
    });
    num.addEventListener('change', () => {
      const v = parseFloat(num.value);
      if (isFinite(v)) set(v);
    });
    row.append(labelEl(p, () => set(p.default)), slider, el('div', { class: 'num-wrap' }, num, p.unit ? el('span', { class: 'unit' }, p.unit) : null));
    return {
      el: row,
      p,
      sync(v) {
        if (document.activeElement !== slider) slider.value = toPos(v);
        if (document.activeElement !== num) num.value = fmt(v);
        const t = isLog ? toPos(v) / 1000 : (U.clamp(v, p.min, p.max) - p.min) / (p.max - p.min || 1);
        slider.style.setProperty('--fill', (U.clamp(t, 0, 1) * 100).toFixed(2) + '%');
      },
    };
  }

  function boolControl(p, get, set) {
    const sw = el('button', { type: 'button', class: 'switch', role: 'switch', onclick: () => set(!get()[p.id]) }, el('i'));
    const row = el('div', { class: 'ctl ctl-bool' }, labelEl(p, () => set(p.default)), sw);
    return {
      el: row,
      p,
      sync(v) {
        sw.classList.toggle('on', !!v);
        sw.setAttribute('aria-checked', String(!!v));
      },
    };
  }

  function selectControl(p, get, set) {
    const row = el('div', { class: 'ctl ctl-select' }, labelEl(p, () => set(p.default)));
    const total = p.options.reduce((a, o) => a + o.label.length, 0);
    if (!p.dropdown && p.options.length <= 4 && total <= 22) {
      const seg = el('div', { class: 'seg' });
      const btns = p.options.map((o) => {
        const b = el('button', { type: 'button', class: 'seg-btn', onclick: () => set(o.value) }, o.label);
        seg.appendChild(b);
        return b;
      });
      row.appendChild(seg);
      return { el: row, p, sync: (v) => btns.forEach((b, i) => b.classList.toggle('on', p.options[i].value === v)) };
    }
    const sel = el(
      'select',
      { class: 'select', onchange: () => set(sel.value) },
      p.options.map((o) => el('option', { value: o.value }, o.label))
    );
    row.appendChild(sel);
    return {
      el: row,
      p,
      sync(v) {
        if (sel.value !== v) sel.value = v;
      },
    };
  }

  function colorControl(p, get, set) {
    const inp = el('input', { type: 'color', class: 'swatch' });
    const hex = el('input', { type: 'text', class: 'hex', maxlength: 7, spellcheck: 'false' });
    inp.addEventListener('input', () => set(inp.value));
    hex.addEventListener('change', () => set(U.normalizeHex(hex.value, get()[p.id])));
    const row = el('div', { class: 'ctl ctl-color' }, labelEl(p, () => set(p.default)), el('div', { class: 'color-wrap' }, inp, hex));
    return {
      el: row,
      p,
      sync(v) {
        if (inp.value !== v) inp.value = v;
        if (document.activeElement !== hex) hex.value = v;
      },
    };
  }

  function textControl(p, get, set) {
    const ta = el('textarea', { class: 'text', rows: p.rows || 2, spellcheck: 'false', placeholder: p.placeholder || '' });
    const push = U.debounce(() => set(ta.value), 120);
    ta.addEventListener('input', push);
    const row = el('div', { class: 'ctl ctl-text' }, labelEl(p, () => set(p.default)), ta);
    return {
      el: row,
      p,
      sync(v) {
        if (document.activeElement !== ta && ta.value !== v) ta.value = v;
      },
    };
  }

  /* --------------------------------------------------------- gradient editor */
  function gradientControl(p, get, set) {
    let g = PG.normalizeGradient(get()[p.id]);
    let sel = 0;
    let dragging = false;

    const bar = el('div', { class: 'grad-bar', title: 'Click to add a color stop' });
    const track = el('div', { class: 'grad-track' });
    const color = el('input', { type: 'color', class: 'swatch sm', title: 'Selected stop color' });
    const modeBtn = el('button', { type: 'button', class: 'mini' });
    const presetsBtn = el('button', { type: 'button', class: 'mini', 'data-pop-anchor': '1', html: 'Presets ' + ICON.caret });
    const revBtn = el('button', { type: 'button', class: 'mini icon', title: 'Reverse', html: ICON.swap });
    const rndBtn = el('button', { type: 'button', class: 'mini icon', title: 'Random gradient', html: ICON.dice });
    const delBtn = el('button', { type: 'button', class: 'mini icon', title: 'Delete selected stop (or drag it off the bar)', html: ICON.trash });

    function commit() {
      set(U.clone(g));
      draw();
    }
    function sortKeep() {
      const s = g.stops[sel];
      g.stops.sort((a, b) => a[0] - b[0]);
      sel = Math.max(0, g.stops.indexOf(s));
    }
    function draw() {
      bar.style.background = PG.gradientToCss(g);
      track.innerHTML = '';
      g.stops.forEach((s, i) => {
        const m = el('div', { class: 'grad-stop' + (i === sel ? ' sel' : ''), title: 'Drag to move · drag down to remove · double-click to edit' });
        m.style.left = s[0] * 100 + '%';
        m.style.setProperty('--c', s[1]);
        m.addEventListener('pointerdown', (e) => startDrag(e, i, m));
        m.addEventListener('dblclick', () => color.click());
        track.appendChild(m);
      });
      sel = Math.min(sel, g.stops.length - 1);
      color.value = g.stops[sel][1];
      modeBtn.textContent = g.mode === 'steps' ? 'Steps' : 'Smooth';
      modeBtn.title = 'Toggle smooth blend / hard steps';
      delBtn.disabled = g.stops.length <= 1;
    }
    function startDrag(e, i, m) {
      e.preventDefault();
      sel = i;
      dragging = true;
      const stop = g.stops[i];
      const rect = track.getBoundingClientRect();
      const y0 = e.clientY;
      let remove = false;
      m.setPointerCapture(e.pointerId);
      track.querySelectorAll('.grad-stop').forEach((n, k) => n.classList.toggle('sel', k === i));
      color.value = stop[1];
      const move = (ev) => {
        stop[0] = U.clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        remove = g.stops.length > 1 && ev.clientY - y0 > 28;
        m.style.left = stop[0] * 100 + '%';
        m.classList.toggle('removing', remove);
        bar.style.background = PG.gradientToCss({ stops: [...g.stops].sort((a, b) => a[0] - b[0]), mode: g.mode });
        set(U.clone({ stops: [...g.stops].sort((a, b) => a[0] - b[0]), mode: g.mode }));
      };
      const up = () => {
        m.removeEventListener('pointermove', move);
        m.removeEventListener('pointerup', up);
        m.removeEventListener('pointercancel', up);
        dragging = false;
        if (remove) {
          g.stops.splice(g.stops.indexOf(stop), 1);
          sel = 0;
        } else {
          sel = g.stops.indexOf(stop);
          sortKeep();
        }
        commit();
      };
      m.addEventListener('pointermove', move);
      m.addEventListener('pointerup', up);
      m.addEventListener('pointercancel', up);
    }
    bar.addEventListener('click', (e) => {
      const r = bar.getBoundingClientRect();
      const t = U.clamp((e.clientX - r.left) / r.width, 0, 1);
      const stop = [t, PG.sampleGradientHex(g, t)];
      g.stops.push(stop);
      g.stops.sort((a, b) => a[0] - b[0]);
      sel = g.stops.indexOf(stop);
      commit();
      if (e.detail === 1) setTimeout(() => color.click(), 0);
    });
    color.addEventListener('input', () => {
      g.stops[sel][1] = color.value;
      commit();
    });
    modeBtn.addEventListener('click', () => {
      g.mode = g.mode === 'steps' ? 'smooth' : 'steps';
      commit();
    });
    revBtn.addEventListener('click', () => {
      g.stops = g.stops.map((s) => [+(1 - s[0]).toFixed(4), s[1]]).sort((a, b) => a[0] - b[0]);
      commit();
    });
    rndBtn.addEventListener('click', () => {
      g = PG.randomGradient();
      sel = 0;
      commit();
    });
    delBtn.addEventListener('click', () => {
      if (g.stops.length <= 1) return;
      g.stops.splice(sel, 1);
      sel = Math.max(0, sel - 1);
      commit();
    });
    presetsBtn.addEventListener('click', () => {
      popover(
        presetsBtn,
        PG.gradients.map((pr) =>
          el(
            'button',
            {
              type: 'button',
              class: 'pop-item',
              onclick: () => {
                g = PG.getGradient(pr.name);
                sel = 0;
                closePopover();
                commit();
              },
            },
            el('span', { class: 'pop-grad', style: `background:${PG.gradientToCss(pr)}` }),
            el('span', { class: 'pop-name' }, pr.name)
          )
        )
      );
    });

    const row = el(
      'div',
      { class: 'ctl ctl-gradient' },
      el('div', { class: 'ctl-top' }, labelEl(p, () => set(PG.normalizeGradient(p.default)))),
      el('div', { class: 'grad-wrap' }, bar, track),
      el('div', { class: 'grad-tools' }, color, presetsBtn, modeBtn, el('span', { class: 'flex' }), revBtn, rndBtn, delBtn)
    );
    draw();
    return {
      el: row,
      p,
      sync(v) {
        if (dragging) return;
        if (!U.equal(v, g)) {
          g = PG.normalizeGradient(v);
          draw();
        }
      },
    };
  }

  /* ---------------------------------------------------------- palette editor */
  function paletteControl(p, get, set) {
    let cols = get()[p.id].slice();
    const list = el('div', { class: 'pal-list' });
    const addBtn = el('button', { type: 'button', class: 'pal-add', title: 'Add color', html: ICON.plus });
    const presetsBtn = el('button', { type: 'button', class: 'mini', 'data-pop-anchor': '1', html: 'Presets ' + ICON.caret });
    const rndBtn = el('button', { type: 'button', class: 'mini icon', title: 'Random colors (same count)', html: ICON.dice });
    const commit = () => {
      set(cols.slice());
      draw();
    };
    function draw() {
      list.innerHTML = '';
      cols.forEach((c, i) => {
        const inp = el('input', { type: 'color', value: c });
        inp.addEventListener('input', () => {
          cols[i] = inp.value;
          sw.style.background = inp.value;
          set(cols.slice());
        });
        const x = el(
          'button',
          {
            type: 'button',
            class: 'pal-x',
            title: 'Remove',
            onclick: (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (cols.length > (p.min || 1)) {
                cols.splice(i, 1);
                commit();
              }
            },
          },
          '×'
        );
        const sw = el('label', { class: 'pal-sw', title: c, style: `background:${c}` }, inp, x);
        list.appendChild(sw);
      });
      addBtn.hidden = cols.length >= (p.max || 16);
      list.appendChild(addBtn);
    }
    addBtn.addEventListener('click', () => {
      const last = U.hexToRgb(cols[cols.length - 1] || '#808080');
      cols.push(U.rgbToHex(1 - last[0] * 0.6, last[1] * 0.8 + 0.1, last[2] * 0.5 + 0.4));
      commit();
    });
    rndBtn.addEventListener('click', () => {
      cols = PG.randomPalette(Math.random, cols.length);
      commit();
    });
    presetsBtn.addEventListener('click', () => {
      popover(
        presetsBtn,
        PG.palettes.map((pr) =>
          el(
            'button',
            {
              type: 'button',
              class: 'pop-item',
              onclick: () => {
                cols = pr.colors.slice(0, p.max || 16);
                closePopover();
                commit();
              },
            },
            el('span', { class: 'pop-pal' }, pr.colors.map((c) => el('i', { style: `background:${c}` }))),
            el('span', { class: 'pop-name' }, pr.name)
          )
        )
      );
    });
    const row = el(
      'div',
      { class: 'ctl ctl-palette' },
      el('div', { class: 'ctl-top' }, labelEl(p, () => set(PG.normalizePalette(p.default))), el('span', { class: 'flex' }), presetsBtn, rndBtn),
      list
    );
    draw();
    return {
      el: row,
      p,
      sync(v) {
        if (!U.equal(v, cols)) {
          cols = v.slice();
          draw();
        }
      },
    };
  }

  /* ------------------------------------------------------------ image picker */
  function drawCover(src, dst, contain) {
    const g = dst.getContext('2d');
    g.clearRect(0, 0, dst.width, dst.height);
    const s = contain ? Math.min(dst.width / src.width, dst.height / src.height) : Math.max(dst.width / src.width, dst.height / src.height);
    const w = src.width * s, h = src.height * s;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, (dst.width - w) / 2, (dst.height - h) / 2, w, h);
  }
  async function uploadImage(file, set) {
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(tiff?|png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || '')) {
      if (PG.app && PG.app.toast) PG.app.toast('That file is not an image');
      return;
    }
    try {
      if (PG.app && PG.app.toast) PG.app.toast(`Reading ${file.name || 'image'}…`);
      set(await PG.images.add(file));
      if (PG.app && PG.app.toast) PG.app.toast('Image added');
    } catch (e) {
      PG.reportError(`Couldn't read “${file.name || 'that file'}”: ${e.message}. Try PNG, JPEG, TIFF, WebP, GIF or SVG.`);
      if (PG.app && PG.app.toast) PG.app.toast('Upload failed — see the message above');
    }
  }
  function imageControl(p, get, set) {
    const preview = el('div', { class: 'img-preview' });
    const file = el('input', { type: 'file', accept: 'image/*,.tif,.tiff,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg', hidden: true });
    const nameEl = el('div', { class: 'img-name' });
    const list = el('div', { class: 'img-list' });
    const row = el(
      'div',
      { class: 'ctl ctl-image' },
      el('div', { class: 'ctl-top' }, labelEl(p, () => set(p.default))),
      el(
        'div',
        { class: 'img-main' },
        preview,
        el(
          'div',
          { class: 'img-side' },
          el('button', { type: 'button', class: 'btn primary', onclick: () => file.click() }, 'Upload image…'),
          nameEl,
          el('div', { class: 'img-hint' }, 'or drop / paste an image (PNG with transparency works)')
        )
      ),
      list,
      file
    );
    file.addEventListener('change', () => {
      uploadImage(file.files[0], set);
      file.value = '';
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('drop');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove('drop');
      uploadImage(e.dataTransfer.files[0], set);
    });
    let current = null;
    function thumb(id, removable) {
      const c = PG.images.get(id);
      const b = el('button', { type: 'button', class: 'img-thumb' + (id === current ? ' on' : '') + (c ? '' : ' loading'), title: PG.images.name(id), onclick: () => set(id) });
      if (c) {
        const tc = el('canvas', { width: 64, height: 64 });
        // square-ish images fill the thumb; clearly rectangular ones (planks, banners) are shown whole
        drawCover(c, tc, Math.abs(Math.log(c.width / c.height)) > 0.25);
        b.appendChild(tc);
      }
      if (removable) {
        b.appendChild(
          el(
            'span',
            {
              class: 'img-x',
              title: 'Delete this image',
              onclick: async (e) => {
                e.stopPropagation();
                const name = PG.images.name(id), url = PG.images.dataURL(id), wasCurrent = current === id;
                await PG.images.remove(id);
                if (wasCurrent) set(p.default);
                if (PG.app && PG.app.toast) {
                  PG.app.toast(`Deleted image “${name}”`, {
                    action: {
                      label: 'Undo',
                      fn: async () => {
                        await PG.images.put(id, url, name);
                        if (wasCurrent) set(id);
                      },
                    },
                  });
                }
              },
            },
            '×'
          )
        );
      }
      return b;
    }
    function draw() {
      current = get()[p.id];
      preview.innerHTML = '';
      const c = PG.images.get(current);
      if (c) {
        const pc = el('canvas', { width: 192, height: 192 });
        drawCover(c, pc, true);
        preview.appendChild(pc);
        nameEl.textContent = `${PG.images.name(current)} · ${c.width}×${c.height}`;
      } else {
        preview.appendChild(el('span', {}, PG.images.state(current) === 'loading' ? 'Loading…' : 'No image'));
        nameEl.textContent = PG.images.state(current) === 'missing' ? 'Image not on this computer' : '';
      }
      list.innerHTML = '';
      const ups = PG.images.uploads();
      if (ups.length) {
        list.append(el('div', { class: 'img-group' }, 'Your images'), el('div', { class: 'img-grid' }, ups.map((u) => thumb(u.id, true))));
      }
      const sm = PG.images.samples();
      if (sm.length) list.append(el('div', { class: 'img-group' }, 'Samples'), el('div', { class: 'img-grid' }, sm.map((s) => thumb(s.id, false))));
    }
    const off = PG.images.onChange(() => {
      if (!row.isConnected) return off();
      draw();
    });
    draw();
    return {
      el: row,
      p,
      sync(v) {
        if (v !== current) draw();
      },
    };
  }

  function buttonControl(p) {
    const b = el('button', { type: 'button', class: 'btn wide', onclick: () => p.action && p.action(PG.app) }, p.label);
    return { el: el('div', { class: 'ctl ctl-button' }, b), p, sync() {} };
  }

  const FACTORIES = {
    range: rangeControl,
    int: rangeControl,
    bool: boolControl,
    select: selectControl,
    color: colorControl,
    text: textControl,
    gradient: gradientControl,
    palette: paletteControl,
    image: imageControl,
    button: buttonControl,
  };

  /**
   * Build controls for a schema into container.
   * get() → current values object; set(id, value) applies a change.
   * Returns { refresh() } which re-syncs every control and updates showIf visibility.
   */
  function buildControls(container, schema, get, set) {
    container.innerHTML = '';
    const rows = [];
    let heading = null;
    for (const p of schema) {
      if (p.type === 'heading') {
        heading = { el: el('div', { class: 'ctl-heading' }, p.label), p, children: [] };
        container.appendChild(heading.el);
        rows.push(heading);
        continue;
      }
      const make = FACTORIES[p.type];
      if (!make) continue;
      const row = make(p, get, (v) => set(p.id, v));
      if (heading) heading.children.push(row);
      container.appendChild(row.el);
      rows.push(row);
    }
    function refresh() {
      const vals = get();
      for (const r of rows) {
        if (r.p.type === 'heading') continue;
        let vis = true;
        if (typeof r.p.showIf === 'function') {
          try {
            vis = !!r.p.showIf(vals);
          } catch (e) {
            vis = true;
          }
        }
        r.el.hidden = !vis;
        if (vis && r.p.id && vals[r.p.id] !== undefined) r.sync(vals[r.p.id]);
      }
      for (const r of rows) if (r.p.type === 'heading') r.el.hidden = r.children.length > 0 && r.children.every((c) => c.el.hidden);
    }
    refresh();
    return { refresh };
  }

  PG.ui = { el, buildControls, popover, closePopover, ICON, uploadImage };
})();
