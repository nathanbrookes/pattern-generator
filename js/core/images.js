/* Pattern Generator — image store for uploaded tiles.
 * Uploaded images are downscaled (max 1024px), kept in IndexedDB (memory fallback) and referenced from
 * 'image' params by id ('img-…'). Patterns can register procedural samples: PG.images.registerSample(). */
(function () {
  'use strict';
  const PG = window.PG;
  const MAX_SIDE = 2048; // enough for crisp tiles in large print exports
  const SAMPLE_SIZE = 512;

  const cache = new Map(); // id → canvas (decoded, ready)
  const loading = new Set();
  const records = new Map(); // id → { id, name, added, w, h, dataURL }  (uploads)
  const samples = new Map(); // id → { name, draw }
  const listeners = new Set();
  let db = null;

  const notify = (id) => listeners.forEach((fn) => {
    try {
      fn(id);
    } catch (e) {
      console.error(e);
    }
  });

  /* ------------------------------------------------------------ IndexedDB */
  function openDB() {
    return new Promise((resolve) => {
      let req;
      try {
        if (!window.indexedDB) return resolve(null);
        req = indexedDB.open('pattern-generator', 1);
      } catch (e) {
        return resolve(null);
      }
      req.onupgradeneeded = () => req.result.createObjectStore('images', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }
  function store(mode) {
    return db.transaction('images', mode).objectStore('images');
  }
  const idb = {
    all: () =>
      new Promise((res) => {
        if (!db) return res([]);
        try {
          const r = store('readonly').getAll();
          r.onsuccess = () => res(r.result || []);
          r.onerror = () => res([]);
        } catch (e) {
          res([]);
        }
      }),
    put: (rec) =>
      new Promise((res) => {
        if (!db) return res(false);
        try {
          const r = store('readwrite').put(rec);
          r.onsuccess = () => res(true);
          r.onerror = () => res(false);
        } catch (e) {
          res(false);
        }
      }),
    del: (id) =>
      new Promise((res) => {
        if (!db) return res(false);
        try {
          const r = store('readwrite').delete(id);
          r.onsuccess = () => res(true);
          r.onerror = () => res(false);
        } catch (e) {
          res(false);
        }
      }),
  };

  /* -------------------------------------------------------------- helpers */
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('the file is damaged or not a supported image'));
      img.src = src;
    });
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error || new Error('could not read file'));
      fr.readAsDataURL(file);
    });
  }
  /** True for TIFF files (by magic bytes) — browsers other than Safari can't decode them natively. */
  function isTiffBytes(b) {
    return b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && (b[2] === 42 || b[2] === 43) && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && (b[3] === 42 || b[3] === 43)));
  }
  /** Decode a TIFF with js/lib/tiff.js into a canvas. */
  async function tiffToCanvas(buf) {
    if (!PG.tiff || !PG.tiff.decode) throw new Error('TIFF support (js/lib/tiff.js) is not loaded');
    const img = await PG.tiff.decode(buf, { maxSide: MAX_SIDE });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.width * img.height * 4), img.width, img.height), 0, 0);
    return c;
  }
  function toCanvas(img, max) {
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    const s = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * s));
    c.height = Math.max(1, Math.round(h0 * s));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  async function decode(id) {
    const rec = records.get(id);
    if (!rec || loading.has(id)) return;
    loading.add(id);
    try {
      cache.set(id, toCanvas(await loadImage(rec.dataURL), MAX_SIDE));
    } catch (e) {
      PG.reportError(`Image "${rec.name}" could not be decoded.`);
    }
    loading.delete(id);
    notify(id);
  }

  /* ------------------------------------------------------------------ API */
  PG.images = {
    /** Open storage and index saved uploads (decoded lazily). */
    init: async function () {
      db = await openDB();
      for (const r of await idb.all()) if (r && r.id && r.dataURL) records.set(r.id, r);
      notify(null);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Procedural sample tile. draw(ctx, w, h) paints a w×h canvas — 512×512 unless opts = { w, h } asks for
     *  another size (e.g. a 2:1 plank); square samples can treat the second argument as the size. */
    registerSample(key, name, draw, opts) {
      const o = opts || {};
      const w = Math.max(1, Math.round(o.w || SAMPLE_SIZE)), h = Math.max(1, Math.round(o.h || SAMPLE_SIZE));
      samples.set('sample:' + key, { name, draw, w, h });
    },
    samples: () => [...samples].map(([id, s]) => ({ id, name: s.name, w: s.w, h: s.h })),
    uploads: () => [...records.values()].sort((a, b) => (b.added || 0) - (a.added || 0)).map((r) => ({ id: r.id, name: r.name, w: r.w, h: r.h })),
    /** 'ready' | 'loading' | 'missing' */
    state(id) {
      if (!id) return 'missing';
      if (cache.has(id)) return 'ready';
      if (samples.has(id)) return 'ready';
      if (records.has(id)) return 'loading';
      return 'missing';
    },
    /** Decoded canvas for an id, or null (starts decoding uploads on first request). */
    get(id) {
      if (!id) return null;
      if (cache.has(id)) return cache.get(id);
      const s = samples.get(id);
      if (s) {
        const c = document.createElement('canvas');
        c.width = s.w;
        c.height = s.h;
        try {
          s.draw(c.getContext('2d'), s.w, s.h);
        } catch (e) {
          PG.reportError(`Sample tile "${s.name}" failed: ${e.message}`);
        }
        cache.set(id, c);
        return c;
      }
      if (records.has(id)) decode(id);
      return null;
    },
    name(id) {
      return (records.get(id) || samples.get(id) || {}).name || id;
    },
    /** Store an uploaded File/Blob/dataURL. Returns its id. Identical images share one id. */
    async add(src, name) {
      let source;
      if (typeof src !== 'string') {
        const head = new Uint8Array(await src.slice(0, 8).arrayBuffer());
        source = isTiffBytes(head) ? await tiffToCanvas(await src.arrayBuffer()) : await loadImage(await readFile(src));
      } else {
        source = await loadImage(src);
      }
      const canvas = toCanvas(source, MAX_SIDE);
      let dataURL = canvas.toDataURL('image/png');
      if (dataURL.length > 3e6) dataURL = canvas.toDataURL('image/jpeg', 0.92);
      const id = 'img-' + hash(dataURL);
      const rec = { id, name: String(name || (src && src.name) || 'Uploaded tile').slice(0, 80), added: Date.now(), w: canvas.width, h: canvas.height, dataURL };
      records.set(id, rec);
      cache.set(id, canvas);
      await idb.put(rec);
      notify(id);
      return id;
    },
    /** Restore an image under a known id (backups). */
    async put(id, dataURL, name) {
      if (!id || !dataURL || records.has(id)) return;
      const rec = { id, name: name || 'Restored tile', added: Date.now(), w: 0, h: 0, dataURL };
      records.set(id, rec);
      await idb.put(rec);
      notify(id);
    },
    dataURL: (id) => (records.get(id) || {}).dataURL || null,
    async remove(id) {
      records.delete(id);
      cache.delete(id);
      await idb.del(id);
      notify(id);
    },
    /** A grey "missing image" placeholder canvas. */
    placeholder() {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#3a3d45';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#4a4e58';
      g.fillRect(0, 0, 64, 64);
      g.fillRect(64, 64, 64, 64);
      g.fillStyle = '#c9ccd4';
      g.font = 'bold 54px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('?', 64, 68);
      return c;
    },
  };
})();
