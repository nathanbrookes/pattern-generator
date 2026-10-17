/* TIFF decoder — pure JS, no dependencies. Chrome and Firefox cannot show TIFF in <img>, so uploads are decoded here.
 *
 *   PG.tiff.isTiff(bytes)                     → boolean (magic bytes; classic TIFF or BigTIFF)
 *   PG.tiff.decode(arrayBuffer, { page })     → Promise<{ width, height, data: Uint8ClampedArray RGBA (rows top-down),
 *                                                          pages, info }>
 *   options: page, maxPixels (default 64e6, larger images are box-filtered down), workers (false / 'force'),
 *            icc (false = ignore embedded profiles), jsJpeg (true = test switch: built-in JPEG decoder for every strip),
 *            maxSide (optional, default none = full resolution: also box-filter by a whole factor until the longer
 *            side is ≤ maxSide — e.g. { maxSide: 2048 } decodes a 8000 × 6000 photo straight to 2000 × 1500 and
 *            needs 1/16 of the output memory), maxInputPixels (default 2^30 ≈ 1074 MP: larger images are refused).
 *
 * Hostile / damaged files: every loop is bounded by the input size, nothing is allocated from header values alone (a
 * header claiming 100000 × 100000 pixels in a small file is rejected up front, each strip/tile buffer is sized by
 * what its compressed bytes can expand to), IFD loops are detected, and every failure rejects with a readable
 * 'Corrupt TIFF: …' / 'Unsupported TIFF: …' message. Missing or damaged strips are left transparent (info.damaged);
 * a file with no readable image data at all is rejected.
 *
 * Supported: little/big-endian, classic + BigTIFF, multi-page (page 0 by default, or the largest full-resolution page
 * when page 0 is a reduced-resolution thumbnail), strips + tiles, chunky + planar; compression none, LZW (new + old
 * style), Deflate, PackBits, JPEG (strips/tiles decoded by the browser, with JPEGTables; a built-in baseline decoder
 * handles what browsers can't: CMYK without an Adobe marker, JPEG with alpha, 12-bit), old-style JPEG when it carries
 * a complete JPEG stream, CCITT RLE / RLEW / Group 3 (1D + 2D) / Group 4; predictor 2 + 3; 1–32-bit integer samples,
 * 16/32/64-bit float (clamped, HDR tone-mapped); WhiteIsZero, BlackIsZero, RGB, Palette, CMYK, YCbCr (JPEG or
 * uncompressed with subsampling), CIELab / ICCLab; associated + unassociated alpha; Orientation 1–8; embedded RGB / gray
 * matrix-TRC ICC profiles (Adobe RGB, ProPhoto, Display P3, Dot Gain …) converted to sRGB as browsers do for JPEG/PNG.
 * Decoding works strip by strip / tile by tile straight into the RGBA output and yields to the event loop regularly,
 * so very large images neither freeze the tab nor need an intermediate full-size buffer. A damaged strip/tile is left
 * transparent (info.damaged) rather than failing the whole image. */
(function () {
  'use strict';
  const PG = (window.PG = window.PG || {});

  /* -------------------------------------------------------------------------------------------- errors / yield */
  class TiffError extends Error {}
  const fail = (msg) => {
    throw new TiffError(msg);
  };
  const unsupported = (what) => fail('Unsupported TIFF: ' + what);
  const corrupt = (what) => fail('Corrupt TIFF: ' + what);

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // A macrotask yield that isn't throttled like setTimeout in background tabs.
  const yieldTask = (function () {
    if (typeof MessageChannel === 'undefined') return () => new Promise((r) => setTimeout(r, 0));
    const ch = new MessageChannel();
    const queue = [];
    ch.port1.onmessage = () => {
      const r = queue.shift();
      if (r) r();
    };
    return () =>
      new Promise((r) => {
        queue.push(r);
        ch.port2.postMessage(0);
      });
  })();
  const YIELD_MS = 24;

  /* ------------------------------------------------------------------------------------- robustness limits */
  // A header can claim any size, so sizes are checked against the bytes really in the file: no codec expands data by
  // more than RATIO:1 (LZW ≈ 2730 with a full table, Deflate 1032, PackBits 64, baseline JPEG ≈ 860 with 1-bit
  // Huffman codes and 4×4 sampling; uncompressed allows a file truncated to 1/64 to show what it has). CCITT fax can
  // code a whole row in 1 bit, so it is checked by rows instead.
  const RATIO = { 1: 64, 5: 4096, 6: 1024, 7: 1024, 8: 2048, 32946: 2048, 32773: 130 };
  const MAX_INPUT_PIXELS = 2 ** 30; // ~1074 MP (a 900 MP file already takes ~10 s, responsive but slow)
  const MAX_CHUNK_BYTES = 2 ** 30; // one decompressed strip/tile (Chrome refuses ArrayBuffers much over 2 GB)
  const kb = (n) => (n < 1e6 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(n < 1e8 ? 1 : 0) + ' MB');

  /* ---------------------------------------------------------------------------------------------- constants */
  const COMPRESSION = {
    1: 'none', 2: 'CCITT RLE', 3: 'CCITT Group 3 fax', 4: 'CCITT Group 4 fax', 5: 'LZW', 6: 'old-style JPEG', 7: 'JPEG',
    8: 'Deflate', 9: 'JBIG (T.85)', 10: 'JBIG (T.43)', 32766: 'NeXT 2-bit RLE', 32771: 'CCITT RLEW', 32773: 'PackBits',
    32809: 'ThunderScan', 32895: 'IT8 CT', 32896: 'IT8 LW', 32897: 'IT8 HC', 32898: 'IT8 BL', 32908: 'Pixar film',
    32909: 'Pixar log', 32946: 'Deflate', 32947: 'Kodak DCS', 34661: 'JBIG', 34676: 'SGI LogL', 34677: 'SGI LogLuv',
    34712: 'JPEG 2000', 34887: 'LERC', 34892: 'lossy JPEG (DNG)', 34925: 'LZMA', 50000: 'Zstandard', 50001: 'WebP',
    50002: 'JPEG XL', 52546: 'JPEG XL', 65000: 'Kodak DCR',
  };
  const PHOTOMETRIC = {
    0: 'WhiteIsZero', 1: 'BlackIsZero', 2: 'RGB', 3: 'Palette', 4: 'Transparency mask', 5: 'CMYK', 6: 'YCbCr', 8: 'CIELab',
    9: 'ICCLab', 10: 'ITULab', 32803: 'CFA (camera raw)', 32844: 'LogL', 32845: 'LogLuv', 34892: 'LinearRaw', 51177: 'Depth',
  };
  //                 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18
  const TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8, 4, 0, 0, 8, 8, 8];
  const T = {
    NewSubfileType: 254, SubfileType: 255, ImageWidth: 256, ImageLength: 257, BitsPerSample: 258, Compression: 259,
    Photometric: 262, FillOrder: 266, StripOffsets: 273, Orientation: 274, SamplesPerPixel: 277, RowsPerStrip: 278,
    StripByteCounts: 279, PlanarConfig: 284, T4Options: 292, T6Options: 293, Software: 305, Predictor: 317, ColorMap: 320,
    TileWidth: 322, TileLength: 323, TileOffsets: 324, TileByteCounts: 325, InkSet: 332, NumberOfInks: 334, ExtraSamples: 338, ICCProfile: 34675,
    SampleFormat: 339, JPEGTables: 347, JPEGIFOffset: 513, JPEGIFByteCount: 514, YCbCrCoefficients: 529,
    YCbCrSubSampling: 530, ReferenceBlackWhite: 532,
  };

  /* --------------------------------------------------------------------------------------------- byte reader */
  function toU8(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    return null;
  }
  function isTiff(input) {
    const b = toU8(input);
    if (!b || b.length < 8) return false;
    const II = b[0] === 0x49 && b[1] === 0x49, MM = b[0] === 0x4d && b[1] === 0x4d;
    if (!II && !MM) return false;
    const v = II ? b[2] | (b[3] << 8) : (b[2] << 8) | b[3];
    return v === 42 || (v === 43 && b.length >= 16);
  }

  function makeReader(u8) {
    const n = u8.length;
    const le = u8[0] === 0x49;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const check = (o, len) => {
      if (!(o >= 0) || o + len > n) corrupt('data points past the end of the file (truncated download?)');
    };
    const R = {
      u8, n, le, dv,
      u16(o) {
        check(o, 2);
        return dv.getUint16(o, le);
      },
      u32(o) {
        check(o, 4);
        return dv.getUint32(o, le);
      },
      u64(o) {
        check(o, 8);
        const lo = dv.getUint32(o + (le ? 0 : 4), le), hi = dv.getUint32(o + (le ? 4 : 0), le);
        if (hi >= 0x200000) corrupt('64-bit offset too large');
        return hi * 4294967296 + lo;
      },
    };
    R.big = R.u16(2) === 43;
    if (R.big && (R.u16(4) !== 8 || R.u16(6) !== 0)) corrupt('bad BigTIFF header');
    return R;
  }

  /** Parse one IFD: Map tag → { type, count, off } (off = absolute position of the value bytes). Values are read lazily. */
  function readIFD(R, pos) {
    const big = R.big;
    const count = big ? R.u64(pos) : R.u16(pos);
    const esz = big ? 20 : 12, base = pos + (big ? 8 : 2);
    if (count === 0 || count > 10000 || base + count * esz > R.n) corrupt('bad image directory');
    const tags = new Map();
    for (let i = 0; i < count; i++) {
      const e = base + i * esz;
      const tag = R.u16(e), type = R.u16(e + 2);
      const cnt = big ? R.u64(e + 4) : R.u32(e + 4);
      const sz = TYPE_SIZE[type] || 0;
      if (!sz || cnt === 0) continue; // unknown type: ignore (e.g. private tags)
      const bytes = sz * cnt;
      const inline = bytes <= (big ? 8 : 4);
      const off = inline ? e + (big ? 12 : 8) : big ? R.u64(e + 12) : R.u32(e + 8);
      if (!tags.has(tag)) tags.set(tag, { type, count: cnt, off });
    }
    const nextPos = base + count * esz;
    let next = 0;
    if (nextPos + (big ? 8 : 4) <= R.n) next = big ? R.u64(nextPos) : R.u32(nextPos);
    return { tags, next, pos };
  }

  /** Numeric values of a tag as an array (Float64Array), or null. Out-of-file values → error for required tags. */
  function tagValues(R, ifd, tag) {
    const e = ifd.tags.get(tag);
    if (!e) return null;
    const { type, count, off } = e;
    const sz = TYPE_SIZE[type];
    if (off + sz * count > R.n) corrupt('tag ' + tag + ' points past the end of the file');
    const dv = R.dv, le = R.le, out = new Float64Array(count);
    let o = off;
    switch (type) {
      case 1: case 2: case 7:
        for (let i = 0; i < count; i++) out[i] = R.u8[o + i];
        break;
      case 6:
        for (let i = 0; i < count; i++) out[i] = dv.getInt8(o + i);
        break;
      case 3:
        for (let i = 0; i < count; i++, o += 2) out[i] = dv.getUint16(o, le);
        break;
      case 8:
        for (let i = 0; i < count; i++, o += 2) out[i] = dv.getInt16(o, le);
        break;
      case 4: case 13:
        for (let i = 0; i < count; i++, o += 4) out[i] = dv.getUint32(o, le);
        break;
      case 9:
        for (let i = 0; i < count; i++, o += 4) out[i] = dv.getInt32(o, le);
        break;
      case 5: case 10:
        for (let i = 0; i < count; i++, o += 8) {
          const a = type === 5 ? dv.getUint32(o, le) : dv.getInt32(o, le), b = type === 5 ? dv.getUint32(o + 4, le) : dv.getInt32(o + 4, le);
          out[i] = b ? a / b : 0;
        }
        break;
      case 11:
        for (let i = 0; i < count; i++, o += 4) out[i] = dv.getFloat32(o, le);
        break;
      case 12:
        for (let i = 0; i < count; i++, o += 8) out[i] = dv.getFloat64(o, le);
        break;
      case 16: case 18:
        for (let i = 0; i < count; i++, o += 8) out[i] = R.u64(o);
        break;
      case 17:
        for (let i = 0; i < count; i++, o += 8) out[i] = Number(dv.getBigInt64(o, le));
        break;
      default:
        return null;
    }
    return out;
  }
  function tagBytes(R, ifd, tag) {
    const e = ifd.tags.get(tag);
    if (!e) return null;
    const len = TYPE_SIZE[e.type] * e.count;
    if (e.off + len > R.n) return null;
    return R.u8.subarray(e.off, e.off + len);
  }
  function tagString(R, ifd, tag) {
    const b = tagBytes(R, ifd, tag);
    if (!b) return '';
    let s = '';
    for (let i = 0; i < b.length && i < 200 && b[i]; i++) s += String.fromCharCode(b[i]);
    return s.trim();
  }

  function readChain(R) {
    let pos = R.big ? R.u64(8) : R.u32(4);
    const ifds = [], seen = new Set();
    while (pos && !seen.has(pos) && ifds.length < 4096) {
      seen.add(pos);
      if (pos + 2 > R.n) {
        if (!ifds.length) corrupt('first image directory points past the end of the file (truncated download?)');
        break;
      }
      let ifd;
      try {
        ifd = readIFD(R, pos);
      } catch (e) {
        if (!ifds.length) throw e;
        break; // a broken later page shouldn't stop us showing the first
      }
      ifds.push(ifd);
      pos = ifd.next;
    }
    if (!ifds.length) corrupt('no images in file');
    return ifds;
  }

  function choosePage(R, ifds, page) {
    if (page != null) {
      const p = Math.floor(page);
      if (!(p >= 0 && p < ifds.length)) fail(`TIFF has ${ifds.length} page${ifds.length === 1 ? '' : 's'}; page ${page} does not exist`);
      return p;
    }
    const num = (ifd, tag, def) => {
      try {
        const v = tagValues(R, ifd, tag);
        return v && v.length ? v[0] : def;
      } catch (e) {
        return def;
      }
    };
    const pages = ifds.map((ifd, i) => ({
      i,
      reduced: (num(ifd, T.NewSubfileType, 0) & 1) === 1 || num(ifd, T.SubfileType, 1) === 2,
      area: num(ifd, T.ImageWidth, 0) * num(ifd, T.ImageLength, 0),
    }));
    if (!pages[0].reduced) return 0;
    const full = pages.filter((p) => !p.reduced && p.area > 0);
    const pool = full.length ? full : pages;
    return pool.reduce((a, b) => (b.area > a.area ? b : a)).i;
  }

  /* ------------------------------------------------------------------------------------------ decompressors */
  const REV = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let r = 0;
    for (let b = 0; b < 8; b++) if (i & (1 << b)) r |= 0x80 >> b;
    REV[i] = r;
  }
  function reverseBits(src) {
    const out = new Uint8Array(src.length);
    for (let i = 0; i < src.length; i++) out[i] = REV[src[i]];
    return out;
  }

  /** PackBits → the bytes it really produced (a short result leaves the missing rows transparent). Huge strips are
   * unpacked in slices with yields so a single-strip 300 MB image doesn't block the tab. */
  async function unpackBits(src, expected) {
    const out = new Uint8Array(expected), n = src.length, SLICE = 1 << 23;
    let i = 0, o = 0, last = now();
    while (o < expected && i < n) {
      const stop = Math.min(expected, o + SLICE);
      while (o < stop && i < n) {
        const c = src[i++];
        if (c < 128) {
          let len = c + 1;
          if (i + len > n) len = n - i;
          if (o + len > expected) len = expected - o;
          out.set(src.subarray(i, i + len), o);
          i += c + 1;
          o += len;
        } else if (c !== 128) {
          const e = Math.min(expected, o + 257 - c);
          if (i >= n) break;
          out.fill(src[i++], o, e);
          o = e;
        }
      }
      if (o < expected && now() - last > YIELD_MS) {
        await yieldTask();
        last = now();
      }
    }
    return o < expected ? out.subarray(0, o) : out;
  }

  /** LZW. New style (MSB-first codes, "early change" width switch) and the pre-1990 libtiff style (LSB-first, late
   * change), detected the way libtiff does. `out` needs 4096 bytes of slack past `expected` (strings are copied
   * whole). Returns a stepper, step(limit) → true when finished, so huge strips can be decoded in slices.
   * Self-contained: it is also shipped to the worker pool as source text. */
  function lzwStepper(src, out, expected) {
    const compat = src.length >= 2 && src[0] === 0 && (src[1] & 1) === 1;
    const early = compat ? 0 : 1;
    const n = src.length, totalBits = n * 8;
    const offs = new Int32Array(4096), lens = new Int32Array(4096);
    let bitPos = 0, width = 9, next = 258, prevPos = -1, prevLen = 0, op = 0, done = false;
    const step = function (limit) {
      if (done) return true;
      const S = src, O = out, OF = offs, LN = lens;
      let bp = bitPos, w = width, nx = next, pp = prevPos, pl = prevLen, o = op;
      let mask = (1 << w) - 1, bump = (1 << w) - early;
      const stop = limit < expected ? limit : expected;
      const fastEnd = (n - 3) * 8; // below this a 3-byte window is always inside src
      while (o < stop) {
        let code;
        const q = bp >> 3;
        if (bp < fastEnd) {
          if (compat) code = ((S[q] | (S[q + 1] << 8) | (S[q + 2] << 16)) >> (bp & 7)) & mask;
          else code = (((S[q] << 16) | (S[q + 1] << 8) | S[q + 2]) >> (24 - w - (bp & 7))) & mask;
        } else {
          if (bp + w > totalBits) {
            done = true;
            break;
          }
          const b0 = S[q], b1 = q + 1 < n ? S[q + 1] : 0, b2 = q + 2 < n ? S[q + 2] : 0;
          if (compat) code = ((b0 | (b1 << 8) | (b2 << 16)) >> (bp & 7)) & mask;
          else code = (((b0 << 16) | (b1 << 8) | b2) >> (24 - w - (bp & 7))) & mask;
        }
        bp += w;
        let len;
        if (code < 256) {
          O[o] = code;
          len = 1;
        } else if (code > 257) {
          if (code < nx) {
            const s = OF[code];
            len = LN[code];
            if (len > 16) O.copyWithin(o, s, s + len);
            else for (let j = 0; j < len; j++) O[o + j] = O[s + j];
          } else if (code === nx && pp >= 0) {
            len = pl + 1; // KwKwK: previous string + its first byte (forward copy reads what it just wrote)
            for (let j = 0; j < len; j++) O[o + j] = O[pp + j];
          } else {
            done = true; // corrupt code: keep what decoded so far
            break;
          }
        } else if (code === 256) {
          w = 9;
          mask = 511;
          bump = 512 - early;
          nx = 258;
          pp = -1;
          continue;
        } else {
          done = true; // EOI
          break;
        }
        if (pp >= 0 && nx < 4096) {
          OF[nx] = pp;
          LN[nx] = pl + 1;
          if (++nx >= bump && w < 12) {
            w++;
            mask = (1 << w) - 1;
            bump = (1 << w) - early;
          }
        }
        pp = o;
        pl = len;
        o += len;
      }
      bitPos = bp;
      width = w;
      next = nx;
      prevPos = pp;
      prevLen = pl;
      op = o;
      if (op >= expected) done = true;
      return done;
    };
    step.produced = () => (op < expected ? op : expected); // a truncated / damaged strip yields fewer bytes
    return step;
  }
  /** LZW on the main thread, in slices with yields for huge strips. */
  async function lzwMain(src, expected) {
    const out = new Uint8Array(expected + 4096);
    const step = lzwStepper(src, out, expected);
    const SLICE = 1 << 22;
    if (expected <= SLICE) step(expected);
    else for (let lim = SLICE; !step(lim); lim += SLICE) await yieldTask();
    return out.subarray(0, step.produced());
  }

  /* LZW is the one codec that is CPU-bound in JS, so big LZW images are decoded by a small worker pool (strips are
   * independent). Built from a Blob of lzwStepper's own source; anything going wrong falls back to the main thread. */
  const pool = { workers: null, failed: false, jobs: new Map(), seq: 0, rr: 0, idle: 0 };
  function workerPool() {
    if (pool.failed) return null;
    if (pool.workers) return pool.workers;
    try {
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') throw new Error('no workers');
      const code = [
        "'use strict';",
        lzwStepper.toString(),
        streamDecompress.toString(),
        undoPredictor.toString(),
        'onmessage = async function (e) {',
        '  const d = e.data;',
        '  try {',
        '    let out;',
        "    if (d.kind === 'lzw') { out = new Uint8Array(d.expected + 4096); const st = lzwStepper(d.src, out, d.expected); st(d.expected); out = out.subarray(0, st.produced()); }",
        "    else { try { out = await streamDecompress(d.src, 'deflate', d.expected); } catch (x) { out = await streamDecompress(d.src, 'deflate-raw', d.expected); } }",
        '    if (d.pred) for (let o = 0; o + d.rowBytes <= out.length; o += d.rowBytes) undoPredictor(out.subarray(o, o + d.rowBytes), d.nSamples, d.stride, d.bps, d.le, 2, null);',
        '    postMessage({ id: d.id, out: out.buffer, n: out.length }, [out.buffer]);',
        '  } catch (err) { postMessage({ id: d.id, error: String((err && err.message) || err) }); }',
        '};',
      ].join('\n');
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      const n = Math.max(1, Math.min(6, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 1));
      pool.workers = [];
      for (let i = 0; i < n; i++) {
        const w = new Worker(url);
        w.onmessage = (e) => {
          const j = pool.jobs.get(e.data.id);
          if (!j) return;
          pool.jobs.delete(e.data.id);
          clearTimeout(j.timer);
          if (e.data.error) j.fallback();
          else j.resolve({ data: new Uint8Array(e.data.out, 0, Math.min(e.data.n, j.expected)), predDone: !!j.pred });
          scheduleIdle();
        };
        w.onerror = (e) => {
          if (e && e.preventDefault) e.preventDefault();
          killPool(true);
        };
        pool.workers.push(w);
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      killPool(true);
    }
    return pool.workers;
  }
  function killPool(failed) {
    if (failed) pool.failed = true;
    if (pool.workers) pool.workers.forEach((w) => w.terminate());
    pool.workers = null;
    const jobs = [...pool.jobs.values()];
    pool.jobs.clear();
    jobs.forEach((j) => {
      clearTimeout(j.timer);
      j.fallback(); // finish anything in flight on the main thread
    });
  }
  function scheduleIdle() {
    clearTimeout(pool.idle);
    pool.idle = setTimeout(() => {
      if (!pool.jobs.size) killPool(false);
    }, 15000);
  }
  /** LZW / Deflate (+ predictor 2) in the worker pool → { data, predDone }. Falls back to the main thread. */
  function offThread(kind, src, expected, pred) {
    const main = () => (kind === 'lzw' ? lzwMain(src, expected) : inflate(src, expected)).then((data) => ({ data, predDone: false }));
    const workers = workerPool();
    if (!workers) return main();
    return new Promise((resolve, reject) => {
      const id = ++pool.seq;
      const job = { expected, pred, resolve, fallback: () => main().then(resolve, reject) };
      pool.jobs.set(id, job);
      // watchdog: a worker that died (e.g. out of memory) must not leave the decode hanging
      job.timer = setTimeout(() => {
        if (pool.jobs.has(id)) killPool(true);
      }, 20000 + expected / 2e4);
      const copy = src.slice(); // transferable copy of the compressed bytes
      try {
        workers[pool.rr++ % workers.length].postMessage(Object.assign({ id, kind, src: copy, expected }, pred || {}), [copy.buffer]);
      } catch (e) {
        pool.jobs.delete(id);
        job.fallback();
      }
    });
  }

  async function streamDecompress(src, format, expected, pause) {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    // Feed the input in slices: one big write is inflated in a single task (Deflate can expand 1000:1), which would
    // freeze the tab; between slices the reader below can pause (backpressure holds the next slice until it reads).
    for (let i = 0; i < src.length; i += 1 << 15) writer.write(src.subarray(i, i + (1 << 15))).catch(() => {});
    writer.close().catch(() => {});
    const reader = ds.readable.getReader();
    const out = new Uint8Array(expected);
    let o = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const m = Math.min(value.length, expected - o);
        out.set(m === value.length ? value : value.subarray(0, m), o);
        o += m;
        if (o >= expected) {
          reader.cancel().catch(() => {});
          break;
        }
        if (pause) await pause();
      }
    } catch (e) {
      if (o === 0) throw e; // junk after the stream end / truncated data: keep what decoded
    }
    return o < expected ? out.subarray(0, o) : out;
  }
  async function inflate(src, expected) {
    if (typeof DecompressionStream === 'undefined') unsupported('Deflate needs a newer browser (DecompressionStream)');
    let last = now();
    const pause = () => {
      if (now() - last > YIELD_MS) return yieldTask().then(() => (last = now()));
    };
    try {
      return await streamDecompress(src, 'deflate', expected, pause);
    } catch (e) {
      try {
        return await streamDecompress(src, 'deflate-raw', expected, pause);
      } catch (e2) {
        corrupt('a Deflate-compressed strip/tile could not be decompressed');
      }
    }
  }

  /* ----------------------------------------------------------------------------------------------- CCITT fax */
  const CCITT = (function () {
    const WT = '00110101 000111 0111 1000 1011 1100 1110 1111 10011 10100 00111 01000 001000 000011 110100 110101 101010 101011 0100111 0001100 0001000 0010111 0000011 0000100 0101000 0101011 0010011 0100100 0011000 00000010 00000011 00011010 00011011 00010010 00010011 00010100 00010101 00010110 00010111 00101000 00101001 00101010 00101011 00101100 00101101 00000100 00000101 00001010 00001011 01010010 01010011 01010100 01010101 00100100 00100101 01011000 01011001 01011010 01011011 01001010 01001011 00110010 00110011 00110100';
    const WM = '11011 10010 010111 0110111 00110110 00110111 01100100 01100101 01101000 01100111 011001100 011001101 011010010 011010011 011010100 011010101 011010110 011010111 011011000 011011001 011011010 011011011 010011000 010011001 010011010 011000 010011011';
    const BT = '0000110111 010 11 10 011 0011 0010 00011 000101 000100 0000100 0000101 0000111 00000100 00000111 000011000 0000010111 0000011000 0000001000 00001100111 00001101000 00001101100 00000110111 00000101000 00000010111 00000011000 000011001010 000011001011 000011001100 000011001101 000001101000 000001101001 000001101010 000001101011 000011010010 000011010011 000011010100 000011010101 000011010110 000011010111 000001101100 000001101101 000011011010 000011011011 000001010100 000001010101 000001010110 000001010111 000001100100 000001100101 000001010010 000001010011 000000100100 000000110111 000000111000 000000100111 000000101000 000001011000 000001011001 000000101011 000000101100 000001011010 000001100110 000001100111';
    const BM = '0000001111 000011001000 000011001001 000001011011 000000110011 000000110100 000000110101 0000001101100 0000001101101 0000001001010 0000001001011 0000001001100 0000001001101 0000001110010 0000001110011 0000001110100 0000001110101 0000001110110 0000001110111 0000001010010 0000001010011 0000001010100 0000001010101 0000001011010 0000001011011 0000001100100 0000001100101';
    const XM = '00000001000 00000001100 00000001101 000000010010 000000010011 000000010100 000000010101 000000010110 000000010111 000000011100 000000011101 000000011110 000000011111';
    const MODES = '0001 001 1 011 000011 0000011 010 000010 0000010 0000001'; // P H V0 VR1 VR2 VR3 VL1 VL2 VL3 EXT
    function trie(list) {
      const t = [0, 0];
      for (const [code, val] of list) {
        let node = 0;
        for (let k = 0; k < code.length; k++) {
          const b = code.charCodeAt(k) - 48, slot = node * 2 + b;
          if (k === code.length - 1) t[slot] = -(val + 1);
          else {
            if (t[slot] <= 0) {
              t[slot] = t.length / 2;
              t.push(0, 0);
            }
            node = t[slot];
          }
        }
      }
      return Int32Array.from(t);
    }
    const sp = (s) => s.split(' ');
    const runs = (term, makeup) => [
      ...sp(term).map((c, i) => [c, i]),
      ...sp(makeup).map((c, i) => [c, (i + 1) * 64]),
      ...sp(XM).map((c, i) => [c, 1792 + i * 64]),
    ];
    return { white: trie(runs(WT, WM)), black: trie(runs(BT, BM)), mode: trie(sp(MODES).map((c, i) => [c, i])) };
  })();

  /** Decode CCITT data to packed 1-bit rows, black runs = 1 bits (libtiff convention; Photometric decides the look).
   * kind: 2 = Modified Huffman (RLE), 32771 = RLEW, 3 = T.4 (Group 3), 4 = T.6 (Group 4). */
  async function ccittDecode(src, width, rows, kind, t4opts) {
    const rowBytes = (width + 7) >> 3;
    const out = new Uint8Array(rowBytes * rows);
    const nbits = src.length * 8;
    const twoD = kind === 4 || (kind === 3 && (t4opts & 1) === 1);
    let bp = 0;
    const WHITE = CCITT.white, BLACK = CCITT.black, MODE = CCITT.mode;
    const readCode = (tr) => {
      let node = 0;
      for (;;) {
        if (bp >= nbits) return -2;
        node = tr[node * 2 + ((src[bp >> 3] >> (7 - (bp & 7))) & 1)];
        bp++;
        if (node < 0) return -node - 1;
        if (node === 0) return -1;
      }
    };
    const readRun = (black) => {
      let total = 0;
      for (;;) {
        const c = readCode(black ? BLACK : WHITE);
        if (c < 0) return c;
        total += c;
        if (c < 64) return total;
      }
    };
    // EOL = ≥11 zero bits then a 1 (fill bits allowed). Consumes it if present.
    const skipEOL = () => {
      let z = 0, p = bp;
      while (p < nbits && ((src[p >> 3] >> (7 - (p & 7))) & 1) === 0) {
        z++;
        p++;
      }
      if (z >= 11 && p < nbits) {
        bp = p + 1;
        return true;
      }
      return false;
    };
    const cap = 2 * width + 16;
    let ref = new Int32Array(cap + 4), refLen = 0;
    let cur = new Int32Array(cap + 4), curLen = 0;
    ref[0] = ref[1] = ref[2] = width; // imaginary all-white line
    refLen = 0;
    let ok = true, last = now();
    for (let y = 0; y < rows && ok; y++) {
      if ((y & 63) === 63 && now() - last > YIELD_MS) {
        await yieldTask(); // a whole-page scan is often a single strip: keep the tab responsive
        last = now();
      }
      let use2D = kind === 4;
      if (kind === 3) {
        let sawEOL = false;
        while (skipEOL()) {
          sawEOL = true;
          if (twoD) {
            if (bp >= nbits) break;
            use2D = ((src[bp >> 3] >> (7 - (bp & 7))) & 1) === 0;
            bp++;
          }
        }
        if (!sawEOL && twoD) use2D = false; // no EOL/tag bit: assume 1D
      }
      if (bp >= nbits) break;
      curLen = 0;
      if (!use2D) {
        let a0 = 0, black = 0;
        while (a0 < width) {
          const r = readRun(black);
          if (r < 0) {
            ok = false;
            break;
          }
          a0 += r;
          if (a0 > width) a0 = width;
          if (a0 < width) cur[curLen++] = a0;
          black ^= 1;
          if (curLen >= cap) {
            ok = false;
            break;
          }
        }
      } else {
        // reference line with sentinels
        ref[refLen] = ref[refLen + 1] = ref[refLen + 2] = width;
        let a0 = -1, black = 0, bi = 0;
        while (a0 < width) {
          const m = readCode(MODE);
          if (m < 0 || m === 9) {
            ok = false;
            break;
          }
          // b1: first changing element on the reference line right of a0 with the opposite colour
          while (bi > 0 && ref[bi - 1] > a0) bi--;
          while (ref[bi] <= a0 && bi < refLen) bi++;
          if ((bi & 1) !== black) bi++;
          const b1 = ref[bi], b2 = ref[bi + 1];
          const start = a0 < 0 ? 0 : a0;
          if (m === 0) {
            a0 = b2; // pass
          } else if (m === 1) {
            const r1 = readRun(black);
            const r2 = r1 < 0 ? r1 : readRun(black ^ 1);
            if (r1 < 0 || r2 < 0) {
              ok = false;
              break;
            }
            let a1 = start + r1;
            if (a1 > width) a1 = width;
            let a2 = a1 + r2;
            if (a2 > width) a2 = width;
            if (a1 < width) cur[curLen++] = a1;
            if (a2 < width) cur[curLen++] = a2;
            a0 = a2;
            if (curLen >= cap) {
              ok = false;
              break;
            }
          } else {
            const d = m === 2 ? 0 : m <= 5 ? m - 2 : -(m - 5);
            let a1 = b1 + d;
            if (a1 < start) a1 = start;
            if (a1 > width) a1 = width;
            if (a1 < width) cur[curLen++] = a1;
            a0 = a1;
            black ^= 1;
            if (curLen >= cap) {
              ok = false;
              break;
            }
          }
          if (a0 >= width) break;
        }
      }
      // paint black runs (between cur[2k] and cur[2k+1])
      const ro = y * rowBytes;
      for (let k = 0; k < curLen; k += 2) {
        const s = cur[k], e = k + 1 < curLen ? cur[k + 1] : width;
        for (let x = s; x < e; x++) out[ro + (x >> 3)] |= 0x80 >> (x & 7);
      }
      const t = ref;
      ref = cur;
      refLen = curLen;
      cur = t;
      if (kind === 2) bp = (bp + 7) & ~7;
      else if (kind === 32771) bp = (bp + 15) & ~15;
    }
    return out;
  }

  /* ------------------------------------------------------------------------------- JPEG (browser decoder) */
  function jpegInfo(b) {
    const r = { jfif: false, adobe: false, comps: 0, w: 0, h: 0 };
    let i = 2;
    while (i + 4 <= b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      if (m === 0xd9 || m === 0xda) break;
      const len = (b[i + 2] << 8) | b[i + 3];
      if (m === 0xe0 && b[i + 4] === 0x4a && b[i + 5] === 0x46) r.jfif = true;
      if (m === 0xee && b[i + 4] === 0x41 && b[i + 5] === 0x64) r.adobe = true;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && i + 9 < b.length) {
        r.comps = b[i + 9];
        r.h = (b[i + 5] << 8) | b[i + 6];
        r.w = (b[i + 7] << 8) | b[i + 8];
      }
      i += 2 + len;
    }
    return r;
  }
  /** Drop APP1 "Exif" segments from the marker section (before SOS) of a JPEG fragment that starts at `start`.
   * Browsers rotate JPEGs by their EXIF orientation even with imageOrientation 'none' (Chrome), which would turn and
   * mis-crop a strip; the TIFF Orientation tag is what counts and is applied later. Returns `b` itself when unchanged. */
  function dropExif(b, start) {
    const cut = [];
    let i = start;
    while (i + 4 <= b.length && b[i] === 0xff) {
      const m = b[i + 1];
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      if (m === 0xda || m === 0xd9) break;
      const end = i + 2 + ((b[i + 2] << 8) | b[i + 3]);
      if (m === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) cut.push([i, Math.min(end, b.length)]);
      i = end;
    }
    if (!cut.length) return b;
    const parts = [];
    let p = 0;
    for (const [s, e] of cut) {
      parts.push(b.subarray(p, s));
      p = e;
    }
    parts.push(b.subarray(p));
    const out = new Uint8Array(parts.reduce((a, q) => a + q.length, 0));
    let o = 0;
    for (const q of parts) {
      out.set(q, o);
      o += q.length;
    }
    return out;
  }
  /** Splice JPEGTables + an abbreviated strip/tile into one stream, adding an Adobe marker so the browser applies (or
   * skips) the YCbCr→RGB transform according to Photometric, like libtiff does. */
  function buildJpeg(tables, seg, transform) {
    const hasTables = tables && tables.length > 4 && tables[0] === 0xff && tables[1] === 0xd8;
    const head = hasTables ? dropExif(tables.subarray(0, tables[tables.length - 2] === 0xff && tables[tables.length - 1] === 0xd9 ? tables.length - 2 : tables.length), 0) : null;
    const body = dropExif(seg[0] === 0xff && seg[1] === 0xd8 ? seg.subarray(2) : seg, 0);
    const infoT = head ? jpegInfo(head) : { jfif: false, adobe: false };
    const infoS = jpegInfo(seg);
    const addAdobe = transform >= 0 && !infoT.jfif && !infoT.adobe && !infoS.jfif && !infoS.adobe;
    const adobe = addAdobe ? [0xff, 0xee, 0, 14, 0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, transform] : [];
    const parts = [new Uint8Array([0xff, 0xd8].concat(adobe))];
    if (head) parts.push(head.subarray(2));
    parts.push(body);
    return { blob: new Blob(parts, { type: 'image/jpeg' }), adobe: infoT.adobe || infoS.adobe, comps: infoS.comps || infoT.comps, w: infoS.w || infoT.w, h: infoS.h || infoT.h };
  }
  let scratchCanvas = null;
  const newCanvas = (w, h) => {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  /** Decode a JPEG blob with the browser and hand its RGBA rows to sink(px, w, y0, n, h) in bands. Big strips are
   * copied out of the decoded bitmap ~1 MP at a time through a small band canvas, yielding in between, so a whole-page
   * single-strip JPEG neither blocks the tab nor needs a second full-size canvas. */
  async function browserDecode(blob, sink) {
    if (typeof createImageBitmap === 'undefined') unsupported('JPEG compression needs a browser with createImageBitmap');
    let bmp;
    try {
      // imageOrientation 'none': a JPEG stream may carry its own EXIF orientation (old-style JPEG / complete JPEG
      // strips); the TIFF Orientation tag is applied separately, so the browser must not rotate the strip as well.
      bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'none' });
    } catch (e) {
      corrupt('a JPEG strip/tile could not be decoded by the browser');
    }
    try {
      const w = bmp.width, h = bmp.height, band = Math.max(1, Math.min(h, ((1 << 20) / w) | 0)), big = band < h;
      // small strips share one canvas (used synchronously, so concurrent decodes can't interleave); big ones get a band canvas
      const cv = big ? newCanvas(w, band) : scratchCanvas || (scratchCanvas = newCanvas(w, h));
      if (cv.width !== w || cv.height !== band) {
        cv.width = w;
        cv.height = band;
      }
      const g = cv.getContext('2d', { willReadFrequently: true });
      if (!g || cv.width !== w) unsupported(`a ${w} × ${h} JPEG strip is too wide for this browser's canvas`);
      g.imageSmoothingEnabled = false;
      let last = now();
      for (let y0 = 0; y0 < h; y0 += band) {
        const n = Math.min(band, h - y0);
        g.clearRect(0, 0, w, n);
        g.drawImage(bmp, 0, y0, w, n, 0, 0, w, n);
        sink(g.getImageData(0, 0, w, n).data, w, y0, n, h);
        if (big && now() - last > YIELD_MS) {
          await yieldTask();
          last = now();
        }
      }
      if (big) cv.width = cv.height = 1;
      return { w, h };
    } finally {
      if (bmp.close) bmp.close();
    }
  }
  function releaseScratch() {
    // a huge single-strip JPEG must not keep a full-size canvas alive after the decode
    if (scratchCanvas) scratchCanvas.width = scratchCanvas.height = 1;
  }

  /* ------------------------------------------------------------------ JPEG (pure-JS baseline decoder, fallback) */
  // For JPEG data browsers can't decode correctly: CMYK without an Adobe marker (plain ink values, which is what
  // libtiff, ImageMagick and Pillow write — browsers assume Adobe-inverted CMYK), JPEG with an alpha channel (RGBA,
  // gray + alpha) and 12-bit JPEG. Baseline / extended sequential Huffman only (all TIFF writers use it).
  // Returns raw components (no colour transform except YCbCr → RGB when asked), 12-bit scaled to 8 bits.
  const ZIGZAG = new Int32Array([0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
    35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63]);
  const AAN = [1, 1.387039845, 1.306562965, 1.175875602, 1, 0.785694958, 0.5411961, 0.275899379];
  function huffTable(counts, symbols) {
    const look = new Uint16Array(512); // 9-bit lookahead: (length << 8) | symbol, 0 = longer code
    const maxcode = new Int32Array(18).fill(-1), valptr = new Int32Array(17), mincode = new Int32Array(17);
    let code = 0, k = 0;
    for (let len = 1; len <= 16; len++) {
      valptr[len] = k;
      mincode[len] = code;
      for (let i = 0; i < counts[len - 1]; i++, k++, code++)
        if (len <= 9) for (let j = 0, sh = 9 - len; j < 1 << sh; j++) look[(code << sh) | j] = (len << 8) | symbols[k];
      maxcode[len] = counts[len - 1] ? code - 1 : -1;
      code <<= 1;
    }
    return { look, maxcode, valptr, mincode, symbols };
  }
  /** Inverse DCT of one dequantised block (float AAN, as libjpeg's jidctflt) into `plane` at `o`. */
  function idct(blk, ws, plane, o, stride, center, maxv) {
    for (let c = 0; c < 8; c++) {
      const i0 = blk[c], i1 = blk[8 + c], i2 = blk[16 + c], i3 = blk[24 + c], i4 = blk[32 + c], i5 = blk[40 + c], i6 = blk[48 + c], i7 = blk[56 + c];
      if (!(i1 || i2 || i3 || i4 || i5 || i6 || i7)) {
        for (let r = 0; r < 8; r++) ws[r * 8 + c] = i0;
        continue;
      }
      let t10 = i0 + i4, t11 = i0 - i4, t13 = i2 + i6, t12 = (i2 - i6) * 1.414213562 - t13;
      const t0 = t10 + t13, t3 = t10 - t13, t1 = t11 + t12, t2 = t11 - t12;
      const z13 = i5 + i3, z10 = i5 - i3, z11 = i1 + i7, z12 = i1 - i7;
      const t7 = z11 + z13;
      t11 = (z11 - z13) * 1.414213562;
      const z5 = (z10 + z12) * 1.847759065;
      t10 = 1.0823922 * z12 - z5;
      t12 = -2.61312593 * z10 + z5;
      const t6 = t12 - t7, t5 = t11 - t6, t4 = t10 + t5;
      ws[c] = t0 + t7;
      ws[56 + c] = t0 - t7;
      ws[8 + c] = t1 + t6;
      ws[48 + c] = t1 - t6;
      ws[16 + c] = t2 + t5;
      ws[40 + c] = t2 - t5;
      ws[32 + c] = t3 + t4;
      ws[24 + c] = t3 - t4;
    }
    for (let r = 0; r < 8; r++, o += stride) {
      const p = r * 8;
      const i0 = ws[p], i1 = ws[p + 1], i2 = ws[p + 2], i3 = ws[p + 3], i4 = ws[p + 4], i5 = ws[p + 5], i6 = ws[p + 6], i7 = ws[p + 7];
      let t10 = i0 + i4, t11 = i0 - i4, t13 = i2 + i6, t12 = (i2 - i6) * 1.414213562 - t13;
      const t0 = t10 + t13, t3 = t10 - t13, t1 = t11 + t12, t2 = t11 - t12;
      const z13 = i5 + i3, z10 = i5 - i3, z11 = i1 + i7, z12 = i1 - i7;
      const t7 = z11 + z13;
      t11 = (z11 - z13) * 1.414213562;
      const z5 = (z10 + z12) * 1.847759065;
      t10 = 1.0823922 * z12 - z5;
      t12 = -2.61312593 * z10 + z5;
      const t6 = t12 - t7, t5 = t11 - t6, t4 = t10 + t5;
      put(plane, o, t0 + t7, center, maxv);
      put(plane, o + 1, t1 + t6, center, maxv);
      put(plane, o + 2, t2 + t5, center, maxv);
      put(plane, o + 3, t3 - t4, center, maxv);
      put(plane, o + 4, t3 + t4, center, maxv);
      put(plane, o + 5, t2 - t5, center, maxv);
      put(plane, o + 6, t1 - t6, center, maxv);
      put(plane, o + 7, t0 - t7, center, maxv);
    }
  }
  function put(plane, o, v, center, maxv) {
    const s = v * 0.125 + center + 0.5;
    plane[o] = s <= 0 ? 0 : s >= maxv ? maxv : s | 0;
  }
  /** Decode a complete baseline JPEG → { w, h, nc, data (chunky 8-bit), adobe (APP14 transform or -1) }. maxW / maxH:
   * the strip/tile size — a frame much bigger than that is damage, not something to spend seconds decoding. */
  async function jpegDecodeJS(b, ycbcr, maxW, maxH) {
    const n = b.length, qt = [], dcT = [], acT = [];
    let frame = null, ri = 0, adobe = -1, jfif = false, pos = 2, last = now();
    if (b[0] !== 0xff || b[1] !== 0xd8) corrupt('a JPEG strip/tile has no start-of-image marker');
    const bad = () => corrupt('a JPEG strip/tile is damaged');
    while (pos + 4 <= n) {
      if (b[pos] !== 0xff) {
        pos++;
        continue;
      }
      const m = b[pos + 1];
      if (m === 0xff) {
        pos++;
        continue;
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0) {
        pos += 2;
        continue;
      }
      if (m === 0xd9) break;
      const s = pos + 4, e = pos + 2 + ((b[pos + 2] << 8) | b[pos + 3]);
      if (e > n) bad();
      if (m === 0xdb) {
        for (let p = s; p < e; ) {
          const pq = b[p] >> 4, t = new Float32Array(64), raw = new Int32Array(64);
          qt[b[p++] & 3] = { raw, t };
          for (let i = 0; i < 64; i++, p += pq ? 2 : 1) raw[ZIGZAG[i]] = pq ? (b[p] << 8) | b[p + 1] : b[p];
          for (let i = 0; i < 64; i++) t[i] = raw[i] * AAN[i >> 3] * AAN[i & 7];
        }
      } else if (m === 0xc4) {
        for (let p = s; p + 17 <= e; ) {
          const tc = b[p] >> 4, th = b[p] & 3, counts = b.subarray(p + 1, p + 17);
          let cnt = 0;
          for (let i = 0; i < 16; i++) cnt += counts[i];
          (tc ? acT : dcT)[th] = huffTable(counts, b.subarray(p + 17, p + 17 + cnt));
          p += 17 + cnt;
        }
      } else if (m === 0xdd) ri = (b[s] << 8) | b[s + 1];
      else if (m === 0xee && b[s] === 0x41 && b[s + 1] === 0x64 && e - s >= 12) adobe = b[s + 11];
      else if (m === 0xe0 && b[s] === 0x4a && b[s + 1] === 0x46) jfif = true;
      else if (m === 0xc0 || m === 0xc1) {
        const P = b[s], H = (b[s + 1] << 8) | b[s + 2], W = (b[s + 3] << 8) | b[s + 4], nf = b[s + 5];
        if (P !== 8 && P !== 12) unsupported(`${P}-bit JPEG`);
        if (!H) unsupported('JPEG with the height in a DNL marker');
        if (!W || !nf) bad();
        if (nf > 4) unsupported(`JPEG with ${nf} components`);
        if (W > maxW + 16 || H > maxH + 16) corrupt(`a JPEG strip/tile is ${W} × ${H}, larger than the ${maxW} × ${maxH} it should be`);
        // the entropy decoder feeds zeros past the end of the data, so a tiny stream could claim a huge frame
        if (W * H * nf > n * RATIO[7] + (1 << 22)) corrupt(`a JPEG strip/tile claims ${W} × ${H} pixels, far more than its ${kb(n)} of data can hold`);
        const comps = [];
        let hmax = 1, vmax = 1;
        for (let i = 0; i < nf; i++) {
          const q = s + 6 + i * 3, c = { id: b[q], h: b[q + 1] >> 4 || 1, v: b[q + 1] & 15 || 1, tq: b[q + 2] & 3, pred: 0 };
          hmax = Math.max(hmax, c.h);
          vmax = Math.max(vmax, c.v);
          comps.push(c);
        }
        const mcux = Math.ceil(W / (8 * hmax)), mcuy = Math.ceil(H / (8 * vmax));
        for (const c of comps) {
          c.bpl = mcux * c.h;
          c.stride = c.bpl * 8;
          c.plane = new (P > 8 ? Uint16Array : Uint8Array)(c.stride * mcuy * c.v * 8);
          c.cw = Math.ceil((W * c.h) / hmax);
          c.ch = Math.ceil((H * c.v) / vmax);
        }
        frame = { P, W, H, comps, hmax, vmax, mcux, mcuy };
      } else if (m >= 0xc2 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        unsupported('progressive, lossless or arithmetic-coded JPEG');
      } else if (m === 0xda) {
        if (!frame) bad();
        const ns = b[s], sc = [];
        for (let i = 0; i < ns; i++) {
          const c = frame.comps.find((q) => q.id === b[s + 1 + i * 2]);
          if (!c) bad();
          const t = b[s + 2 + i * 2];
          c.dc = dcT[t >> 4];
          c.ac = acT[t & 3];
          c.q = qt[c.tq];
          if (!c.dc || !c.ac || !c.q) bad();
          c.pred = 0;
          sc.push(c);
        }
        const Ss = b[s + 1 + ns * 2], Se = b[s + 2 + ns * 2];
        if (Ss !== 0 || Se !== 63) unsupported('progressive JPEG');
        pos = e;
        // ---- entropy-coded segment
        let bb = 0, bc = 0, eod = false;
        const fill = () => {
          while (bc <= 24) {
            let byte = 0;
            if (!eod && pos < n) {
              byte = b[pos];
              if (byte === 0xff) {
                if (b[pos + 1] === 0) pos += 2;
                else {
                  eod = true; // a marker: feed zeros
                  byte = 0;
                }
              } else pos++;
            }
            bb = (bb << 8) | byte;
            bc += 8;
          }
        };
        const bits = (k) => {
          if (bc < k) fill();
          bc -= k;
          return (bb >>> bc) & ((1 << k) - 1);
        };
        const huff = (t) => {
          if (bc < 16) fill();
          const e9 = t.look[(bb >>> (bc - 9)) & 511];
          if (e9) {
            bc -= e9 >> 8;
            return e9 & 255;
          }
          let len = 10, code = (bb >>> (bc - 10)) & 1023;
          while (len <= 16 && code > t.maxcode[len]) code = (bb >>> (bc - ++len)) & ((1 << len) - 1);
          if (len > 16) return 0; // damaged data: decode as zeros
          bc -= len;
          return t.symbols[t.valptr[len] + code - t.mincode[len]];
        };
        const ext = (v, k) => (v < 1 << (k - 1) ? v - (1 << k) + 1 : v);
        const blk = new Float32Array(64), ws = new Float32Array(64);
        const center = frame.P > 8 ? 2048 : 128, maxv = frame.P > 8 ? 4095 : 255;
        const block = (c, bx, by) => {
          blk.fill(0);
          const fq = c.q.t;
          const t = huff(c.dc);
          c.pred += t && t <= 16 ? ext(bits(t), t) : 0; // > 16: damaged data
          blk[0] = c.pred * fq[0];
          for (let k = 1; k < 64; ) {
            const rs = huff(c.ac), sz = rs & 15, r = rs >> 4;
            if (!sz) {
              if (r !== 15) break;
              k += 16;
              continue;
            }
            k += r;
            if (k > 63) break;
            const z = ZIGZAG[k++];
            blk[z] = ext(bits(sz), sz) * fq[z];
          }
          idct(blk, ws, c.plane, by * 8 * c.stride + bx * 8, c.stride, center, maxv);
        };
        const single = ns === 1;
        const c0 = sc[0];
        const bw = single ? Math.ceil(c0.cw / 8) : frame.mcux, nmcu = single ? bw * Math.ceil(c0.ch / 8) : frame.mcux * frame.mcuy;
        for (let mcu = 0; mcu < nmcu; mcu++) {
          if (ri && mcu && mcu % ri === 0) {
            // restart: realign on the RSTn marker, reset DC predictors
            while (pos + 1 < n && !(b[pos] === 0xff && b[pos + 1] >= 0xd0 && b[pos + 1] <= 0xd7)) pos++;
            pos += 2;
            bb = bc = 0;
            eod = false;
            for (const c of sc) c.pred = 0;
          }
          const mx = mcu % bw, my = (mcu / bw) | 0;
          if (single) block(c0, mx, my);
          else for (const c of sc) for (let v = 0; v < c.v; v++) for (let h = 0; h < c.h; h++) block(c, mx * c.h + h, my * c.v + v);
          if ((mcu & 255) === 255 && now() - last > YIELD_MS) {
            await yieldTask();
            last = now();
          }
        }
        // skip to the next marker
        while (pos + 1 < n && !(b[pos] === 0xff && b[pos + 1] !== 0 && !(b[pos + 1] >= 0xd0 && b[pos + 1] <= 0xd7))) pos++;
        continue;
      }
      pos = e;
    }
    if (!frame) bad();
    if (adobe === 2) unsupported('YCCK JPEG (12-bit or with extra channels)'); // the browser path handles 8-bit YCCK
    // ---- upsample (replicate) + interleave; YCbCr → RGB at full precision; 12-bit → 8-bit
    const { W, H, comps, hmax, vmax } = frame, nc = comps.length;
    const out = new Uint8Array(W * H * nc);
    const maxin = frame.P > 8 ? 4095 : 255, sc = 255 / maxin;
    const xmaps = comps.map((c) => {
      const xm = new Int32Array(W);
      for (let x = 0; x < W; x++) xm[x] = ((x * c.h) / hmax) | 0;
      return xm;
    });
    const rowOf = (c, y) => (((y * c.v) / vmax) | 0) * c.stride;
    // YCbCr → RGB like the browser path: Adobe transform 1, or no Adobe marker and Photometric YCbCr / a JFIF stream
    if (nc === 3 && (adobe >= 0 ? adobe === 1 : ycbcr || jfif)) {
      const [c0, c1, c2] = comps, [m0, m1, m2] = xmaps, half = (maxin + 1) / 2;
      const q = (v) => (v <= 0 ? 0 : v >= maxin ? 255 : v * sc + 0.5);
      for (let y = 0, o = 0; y < H; y++) {
        if ((y & 31) === 31 && now() - last > YIELD_MS) {
          await yieldTask();
          last = now();
        }
        const r0 = rowOf(c0, y), r1 = rowOf(c1, y), r2 = rowOf(c2, y);
        for (let x = 0; x < W; x++, o += 3) {
          const Y = c0.plane[r0 + m0[x]], cb = c1.plane[r1 + m1[x]] - half, cr = c2.plane[r2 + m2[x]] - half;
          out[o] = q(Y + 1.402 * cr);
          out[o + 1] = q(Y - 0.344136 * cb - 0.714136 * cr);
          out[o + 2] = q(Y + 1.772 * cb);
        }
      }
    } else {
      const lut = frame.P > 8 ? new Uint8Array(4096).map((_, i) => i * sc + 0.5) : null;
      for (let ci = 0; ci < nc; ci++) {
        const c = comps[ci], xm = xmaps[ci], P = c.plane;
        for (let y = 0; y < H; y++) {
          if ((y & 31) === 31 && now() - last > YIELD_MS) {
            await yieldTask();
            last = now();
          }
          const row = rowOf(c, y);
          for (let x = 0, o = y * W * nc + ci; x < W; x++, o += nc) out[o] = lut ? lut[P[row + xm[x]]] : P[row + xm[x]];
        }
      }
    }
    return { w: W, h: H, nc, data: out, adobe };
  }
  /** JPEGTables + abbreviated strip/tile → one complete JPEG stream. */
  function joinJpeg(tables, seg) {
    const head = tables && tables.length > 4 && tables[0] === 0xff && tables[1] === 0xd8 ? tables.subarray(0, tables[tables.length - 2] === 0xff && tables[tables.length - 1] === 0xd9 ? tables.length - 2 : tables.length) : null;
    if (!head) return seg;
    const body = seg[0] === 0xff && seg[1] === 0xd8 ? seg.subarray(2) : seg;
    const out = new Uint8Array(head.length + body.length);
    out.set(head);
    out.set(body, head.length);
    return out;
  }

  /* -------------------------------------------------------------------------------------- sample readers */
  let HALF = null;
  function halfTable() {
    if (HALF) return HALF;
    HALF = new Float32Array(65536);
    for (let h = 0; h < 65536; h++) {
      const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
      HALF[h] = e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15);
    }
    return HALF;
  }
  /** Returns read(src, off, count, dst, dOff, dStride): reads `count` consecutive samples of a row starting at byte off. */
  function makeSampleReader(bps, sf, le) {
    if (bps === 8)
      return sf === 2
        ? (s, o, n, d, k, st) => {
            for (let i = 0; i < n; i++, k += st) d[k] = (s[o + i] << 24) >> 24;
          }
        : (s, o, n, d, k, st) => {
            for (let i = 0; i < n; i++, k += st) d[k] = s[o + i];
          };
    if (bps === 16) {
      if (sf === 3) {
        const H = halfTable();
        return le
          ? (s, o, n, d, k, st) => {
              for (let i = 0; i < n; i++, k += st, o += 2) d[k] = H[s[o] | (s[o + 1] << 8)];
            }
          : (s, o, n, d, k, st) => {
              for (let i = 0; i < n; i++, k += st, o += 2) d[k] = H[(s[o] << 8) | s[o + 1]];
            };
      }
      const sh = sf === 2 ? 16 : 0;
      return le
        ? (s, o, n, d, k, st) => {
            for (let i = 0; i < n; i++, k += st, o += 2) d[k] = ((s[o] | (s[o + 1] << 8)) << sh) >> sh;
          }
        : (s, o, n, d, k, st) => {
            for (let i = 0; i < n; i++, k += st, o += 2) d[k] = (((s[o] << 8) | s[o + 1]) << sh) >> sh;
          };
    }
    if (bps === 24 && sf !== 3) {
      const sh = sf === 2 ? 8 : 0;
      return (s, o, n, d, k, st) => {
        for (let i = 0; i < n; i++, k += st, o += 3) {
          const v = le ? s[o] | (s[o + 1] << 8) | (s[o + 2] << 16) : (s[o] << 16) | (s[o + 1] << 8) | s[o + 2];
          d[k] = (v << sh) >> sh;
        }
      };
    }
    if (bps === 32 || bps === 64) {
      return (s, o, n, d, k, st) => {
        const dv = new DataView(s.buffer, s.byteOffset, s.byteLength);
        if (bps === 64) for (let i = 0; i < n; i++, k += st, o += 8) d[k] = dv.getFloat64(o, le);
        else if (sf === 3) for (let i = 0; i < n; i++, k += st, o += 4) d[k] = dv.getFloat32(o, le);
        else if (sf === 2) for (let i = 0; i < n; i++, k += st, o += 4) d[k] = dv.getInt32(o, le);
        else for (let i = 0; i < n; i++, k += st, o += 4) d[k] = dv.getUint32(o, le);
      };
    }
    if (bps === 1 || bps === 2 || bps === 4) {
      const mask = (1 << bps) - 1, per = 8 / bps;
      return (s, o, n, d, k, st) => {
        for (let i = 0; i < n; i++, k += st) {
          const byte = s[o + ((i / per) | 0)];
          d[k] = (byte >> (8 - bps - (i % per) * bps)) & mask;
        }
      };
    }
    // any other width (3, 5, 6, 7, 10, 12, 14 …): MSB-first bit packing
    const sh = sf === 2 ? 32 - bps : 0;
    return (s, o, n, d, k, st) => {
      let bit = 0;
      for (let i = 0; i < n; i++, k += st) {
        let v = 0;
        for (let b = 0; b < bps; b++, bit++) v = (v << 1) | ((s[o + (bit >> 3)] >> (7 - (bit & 7))) & 1);
        d[k] = sh ? (v << sh) >> sh : v >>> 0;
      }
    };
  }

  /** Undo predictor 2 / 3 on one row (in place). Returns false when the row is now big-endian (predictor 3). */
  function undoPredictor(row, nSamples, stride, bps, le, pred, tmp) {
    if (pred === 2) {
      if (bps === 8) {
        for (let i = stride; i < nSamples; i++) row[i] = row[i] + row[i - stride];
      } else if (bps === 16) {
        const st = stride * 2, end = nSamples * 2;
        if (le)
          for (let i = st; i < end; i += 2) {
            const v = (row[i] | (row[i + 1] << 8)) + (row[i - st] | (row[i - st + 1] << 8));
            row[i] = v;
            row[i + 1] = v >> 8;
          }
        else
          for (let i = st; i < end; i += 2) {
            const v = ((row[i] << 8) | row[i + 1]) + ((row[i - st] << 8) | row[i - st + 1]);
            row[i] = v >> 8;
            row[i + 1] = v;
          }
      } else if (bps === 32) {
        const dv = new DataView(row.buffer, row.byteOffset, row.byteLength), st = stride * 4;
        for (let i = st, end = nSamples * 4; i < end; i += 4) dv.setUint32(i, (dv.getUint32(i, le) + dv.getUint32(i - st, le)) >>> 0, le);
      }
      return le;
    }
    // predictor 3: byte-wise differencing, then the bytes of each value are stored as separate planes, MSB first
    const B = bps >> 3, cc = nSamples * B;
    for (let i = stride; i < cc; i++) row[i] = row[i] + row[i - stride];
    tmp.set(row.subarray(0, cc));
    for (let c = 0; c < nSamples; c++) for (let b = 0; b < B; b++) row[c * B + b] = tmp[b * nSamples + c];
    return false;
  }

  /* --------------------------------------------------------------------------------------- colour converters */
  // Each writes pixels x = x0, x0+f, … < x1 of a row buffer `b` (S samples per pixel) to RGBA bytes O[d], d += sx.
  const byte = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0);
  function alphaOf(b, i, P) {
    const a = b[i + P.ai] * P.k;
    return a > 0 ? (a < 1 ? a : 1) : 0;
  }
  const CONVERT = {
    gray(b, S, x0, x1, f, O, d, sx, P) {
      const k = P.k, inv = P.inv, ai = P.ai, assoc = P.assoc;
      for (let x = x0; x < x1; x += f, d += sx) {
        const i = x * S;
        let v = b[i] * k, a = 1;
        if (ai >= 0) {
          a = alphaOf(b, i, P);
          if (assoc && a > 0) v /= a;
        }
        if (inv) v = 1 - v;
        O[d] = O[d + 1] = O[d + 2] = byte(v);
        O[d + 3] = byte(a);
      }
    },
    rgb(b, S, x0, x1, f, O, d, sx, P) {
      const k = P.k, ai = P.ai, assoc = P.assoc;
      if (ai < 0) {
        for (let x = x0; x < x1; x += f, d += sx) {
          const i = x * S;
          O[d] = byte(b[i] * k);
          O[d + 1] = byte(b[i + 1] * k);
          O[d + 2] = byte(b[i + 2] * k);
          O[d + 3] = 255;
        }
        return;
      }
      for (let x = x0; x < x1; x += f, d += sx) {
        const i = x * S, a = alphaOf(b, i, P);
        const m = assoc && a > 0 ? k / a : k;
        O[d] = byte(b[i] * m);
        O[d + 1] = byte(b[i + 1] * m);
        O[d + 2] = byte(b[i + 2] * m);
        O[d + 3] = byte(a);
      }
    },
    palette(b, S, x0, x1, f, O, d, sx, P) {
      const map = P.map, n = map.length / 3, ai = P.ai;
      for (let x = x0; x < x1; x += f, d += sx) {
        const i = x * S, idx = b[i];
        if (idx >= 0 && idx < n) {
          O[d] = map[idx * 3];
          O[d + 1] = map[idx * 3 + 1];
          O[d + 2] = map[idx * 3 + 2];
        }
        O[d + 3] = ai >= 0 ? byte(alphaOf(b, i, P)) : 255;
      }
    },
    cmyk(b, S, x0, x1, f, O, d, sx, P) {
      const k = P.k, ai = P.ai, assoc = P.assoc;
      for (let x = x0; x < x1; x += f, d += sx) {
        const i = x * S;
        let a = 1, m = k;
        if (ai >= 0) {
          a = alphaOf(b, i, P);
          if (assoc && a > 0) m = k / a;
        }
        const K = 1 - b[i + 3] * m;
        O[d] = byte((1 - b[i] * m) * K);
        O[d + 1] = byte((1 - b[i + 1] * m) * K);
        O[d + 2] = byte((1 - b[i + 2] * m) * K);
        O[d + 3] = byte(a);
      }
    },
    lab(b, S, x0, x1, f, O, d, sx, P) {
      const ai = P.ai, lk = P.labL, ab = P.labAB, off = P.labOff, half = P.labHalf, one = P.nColor === 1;
      for (let x = x0; x < x1; x += f, d += sx) {
        const i = x * S;
        const L = b[i] * lk;
        let A = one ? 0 : b[i + 1], B = one ? 0 : b[i + 2];
        if (half) {
          // CIELab: a*/b* are two's-complement signed
          if (A >= half) A -= 2 * half;
          if (B >= half) B -= 2 * half;
        }
        A = (A - off) * ab;
        B = (B - off) * ab;
        // CIELab (D65) → XYZ → linear sRGB → sRGB
        const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
        const xr = fx * fx * fx > 0.008856 ? fx * fx * fx : (116 * fx - 16) / 903.3;
        const yr = L > 7.9996 ? fy * fy * fy : L / 903.3;
        const zr = fz * fz * fz > 0.008856 ? fz * fz * fz : (116 * fz - 16) / 903.3;
        const X = xr * 0.950456, Y = yr, Z = zr * 1.088754;
        O[d] = byte(srgb(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z));
        O[d + 1] = byte(srgb(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z));
        O[d + 2] = byte(srgb(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z));
        O[d + 3] = ai >= 0 ? byte(alphaOf(b, i, P)) : 255;
      }
    },
  };
  const srgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

  /** Fast path: 8/16-bit unsigned gray or RGB (+ unassociated alpha), chunky, straight from bytes to RGBA. */
  let LUT16 = null;
  function makeFastRow(bps, model, spp, ai, inv) {
    if (bps === 16 && !LUT16) {
      LUT16 = new Uint8Array(65536);
      for (let v = 0; v < 65536; v++) LUT16[v] = byte(v / 65535);
    }
    const L = LUT16, rgb = model === 'rgb';
    if (bps === 8)
      return (s, o, x0, x1, f, O, d, sx) => {
        const st = spp * f;
        for (let x = x0, p = o + x0 * spp; x < x1; x += f, d += sx, p += st) {
          if (rgb) {
            O[d] = s[p];
            O[d + 1] = s[p + 1];
            O[d + 2] = s[p + 2];
          } else O[d] = O[d + 1] = O[d + 2] = inv ? 255 - s[p] : s[p];
          O[d + 3] = ai >= 0 ? s[p + ai] : 255;
        }
      };
    return (s, o, x0, x1, f, O, d, sx, le) => {
      const st = spp * 2 * f, hi = le ? 1 : 0, lo = 1 - hi;
      for (let x = x0, p = o + x0 * spp * 2; x < x1; x += f, d += sx, p += st) {
        if (rgb) {
          O[d] = L[(s[p + hi] << 8) | s[p + lo]];
          O[d + 1] = L[(s[p + 2 + hi] << 8) | s[p + 2 + lo]];
          O[d + 2] = L[(s[p + 4 + hi] << 8) | s[p + 4 + lo]];
        } else {
          const v = L[(s[p + hi] << 8) | s[p + lo]];
          O[d] = O[d + 1] = O[d + 2] = inv ? 255 - v : v;
        }
        O[d + 3] = ai >= 0 ? L[(s[p + ai * 2 + hi] << 8) | s[p + ai * 2 + lo]] : 255;
      }
    };
  }

  /** Uncompressed YCbCr (any subsampling) → chunky 8-bit RGB, like libtiff's TIFFReadRGBA (chroma replicated). */
  function ycbcrToRgb(src, tw, rows, sh, sv, coef, ref) {
    const out = new Uint8Array(tw * rows * 3);
    const bx = Math.ceil(tw / sh), by = Math.ceil(rows / sv), bsz = sh * sv;
    const lr = coef[0], lg = coef[1], lb = coef[2];
    const yk = 255 / (ref[1] - ref[0] || 1), cbk = 127 / (ref[3] - ref[2] || 1), crk = 127 / (ref[5] - ref[4] || 1);
    const clamp = (v) => (v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0);
    let p = 0;
    for (let j = 0; j < by; j++)
      for (let i = 0; i < bx; i++, p += bsz + 2) {
        if (p + bsz + 2 > src.length) return out.subarray(0, Math.min(rows, j * sv) * tw * 3); // short data: rows without it stay transparent
        const Cb = (src[p + bsz] - ref[2]) * cbk, Cr = (src[p + bsz + 1] - ref[4]) * crk;
        for (let v = 0; v < sv; v++) {
          const y = j * sv + v;
          if (y >= rows) break;
          for (let h = 0; h < sh; h++) {
            const x = i * sh + h;
            if (x >= tw) break;
            const Y = (src[p + v * sh + h] - ref[0]) * yk;
            const R = Y + Cr * (2 - 2 * lr), B = Y + Cb * (2 - 2 * lb), G = (Y - lb * B - lr * R) / lg;
            const o = (y * tw + x) * 3;
            out[o] = clamp(R);
            out[o + 1] = clamp(G);
            out[o + 2] = clamp(B);
          }
        }
      }
    return out;
  }

  /* --------------------------------------------------------------------------------------- ICC colour profiles */
  // Browsers colour-manage JPEG / PNG uploads, so an Adobe RGB or ProPhoto TIFF (Lightroom, Photoshop, scanners) must be
  // converted to sRGB too or it looks dull next to the same photo saved as JPEG. Matrix/TRC RGB and gray profiles are
  // handled (relative colorimetric, like browsers); LUT-based profiles (CMYK etc.) and sRGB itself are left alone.
  const SRGB_D50 = [0.4360747, 0.3850649, 0.1430804, 0.2225045, 0.7168786, 0.0606169, 0.0139322, 0.0971045, 0.7141733]; // rows X, Y, Z
  const XYZ_TO_SRGB = [3.1338561, -1.6168667, -0.4906146, -0.9787684, 1.9161415, 0.033454, 0.0719453, -0.2289914, 1.4052427]; // D50 PCS
  const srgbDecode = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  function parseIcc(b) {
    if (!b || b.length < 132) return null;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const sig = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
    if (sig(36) !== 'acsp' || sig(20) !== 'XYZ ') return null;
    const space = sig(16), n = dv.getUint32(128);
    if ((space !== 'RGB ' && space !== 'GRAY') || n > 200 || 132 + n * 12 > b.length) return null;
    const tags = {};
    for (let i = 0; i < n; i++) {
      const e = 132 + i * 12, off = dv.getUint32(e + 4), size = dv.getUint32(e + 8);
      if (off + size <= b.length && size >= 12) tags[sig(e)] = { off, size };
    }
    const s15 = (o) => dv.getInt32(o) / 65536;
    const xyz = (t) => (tags[t] && sig(tags[t].off) === 'XYZ ' && tags[t].size >= 20 ? [s15(tags[t].off + 8), s15(tags[t].off + 12), s15(tags[t].off + 16)] : null);
    const trc = (t) => {
      const e = tags[t];
      if (!e) return null;
      const o = e.off, type = sig(o);
      if (type === 'curv') {
        const cnt = dv.getUint32(o + 8);
        if (12 + cnt * 2 > e.size) return null;
        if (cnt === 0) return (x) => x;
        if (cnt === 1) {
          const g = dv.getUint16(o + 12) / 256;
          return (x) => Math.pow(x, g);
        }
        const tab = new Float64Array(cnt);
        for (let i = 0; i < cnt; i++) tab[i] = dv.getUint16(o + 12 + i * 2) / 65535;
        return (x) => {
          const p = x * (cnt - 1), i = Math.min(cnt - 2, Math.floor(p));
          return tab[i] + (tab[i + 1] - tab[i]) * (p - i);
        };
      }
      if (type === 'para') {
        const ft = dv.getUint16(o + 8), np = [1, 3, 4, 5, 7][ft];
        if (np === undefined || 12 + np * 4 > e.size) return null;
        const [g, a, bb, c, d, ee, f] = Array.from({ length: 7 }, (_, i) => (i < np ? s15(o + 12 + i * 4) : 0));
        const pw = (v) => (v > 0 ? Math.pow(v, g) : 0);
        if (ft === 0) return (x) => pw(x);
        if (ft === 1) return (x) => (x >= -bb / a ? pw(a * x + bb) : 0);
        if (ft === 2) return (x) => (x >= -bb / a ? pw(a * x + bb) + c : c);
        if (ft === 3) return (x) => (x >= d ? pw(a * x + bb) : c * x);
        return (x) => (x >= d ? pw(a * x + bb) + ee : c * x + f);
      }
      return null; // other curve types (LUT-based profiles): leave the image alone
    };
    let desc = '';
    const dt = tags.desc;
    if (dt && sig(dt.off) === 'desc') {
      const cnt = Math.min(dv.getUint32(dt.off + 8), dt.size - 12, 64);
      for (let i = 0; i < cnt && b[dt.off + 12 + i]; i++) desc += String.fromCharCode(b[dt.off + 12 + i]);
    } else if (dt && sig(dt.off) === 'mluc' && dv.getUint32(dt.off + 8) > 0) {
      const len = dv.getUint32(dt.off + 20), at = dt.off + dv.getUint32(dt.off + 24);
      for (let i = 0; i + 1 < Math.min(len, 128) && at + i + 1 < b.length; i += 2) desc += String.fromCharCode(dv.getUint16(at + i));
    }
    const near = (f) => {
      // does this curve match the sRGB curve (to within ~half an 8-bit level)?
      for (let v = 8; v < 256; v += 16) if (Math.abs(f(v / 255) - srgbDecode(v / 255)) * 255 > 0.5) return false;
      return true;
    };
    if (space === 'GRAY') {
      const k = trc('kTRC');
      if (!k || near(k)) return null;
      return { kind: 'gray', trc: [k], desc: desc.trim() };
    }
    const r = xyz('rXYZ'), g = xyz('gXYZ'), bl = xyz('bXYZ'), tr = trc('rTRC'), tg = trc('gTRC'), tb = trc('bTRC');
    if (!r || !g || !bl || !tr || !tg || !tb) return null;
    const M = [r[0], g[0], bl[0], r[1], g[1], bl[1], r[2], g[2], bl[2]];
    if (M.every((v, i) => Math.abs(v - SRGB_D50[i]) < 0.003) && near(tr) && near(tg) && near(tb)) return null; // already sRGB
    const T = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[i * 3 + j] = XYZ_TO_SRGB[i * 3] * M[j] + XYZ_TO_SRGB[i * 3 + 1] * M[3 + j] + XYZ_TO_SRGB[i * 3 + 2] * M[6 + j];
    return { kind: 'rgb', trc: [tr, tg, tb], m: T, desc: desc.trim() };
  }
  /** Convert the decoded RGBA (8-bit, profile space) to sRGB in place. */
  async function applyIcc(icc, O) {
    const N = 16384, enc = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const v = i / (N - 1);
      enc[i] = (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5;
    }
    const lin = icc.trc.map((f) => Float32Array.from({ length: 256 }, (_, v) => f(v / 255)));
    const q = (v) => enc[v <= 0 ? 0 : v >= 1 ? N - 1 : (v * (N - 1) + 0.5) | 0];
    const n = O.length;
    let last = now();
    if (icc.kind === 'gray') {
      const L = Uint8Array.from(lin[0], (v) => q(v));
      for (let d = 0; d < n; d += 4) O[d] = O[d + 1] = O[d + 2] = L[O[d]];
      return;
    }
    const [L0, L1, L2] = lin, m = icc.m;
    for (let d = 0; d < n; d += 4) {
      const r = L0[O[d]], g = L1[O[d + 1]], b = L2[O[d + 2]];
      O[d] = q(m[0] * r + m[1] * g + m[2] * b);
      O[d + 1] = q(m[3] * r + m[4] * g + m[5] * b);
      O[d + 2] = q(m[6] * r + m[7] * g + m[8] * b);
      if ((d & 0xfffff) === 0 && now() - last > YIELD_MS) {
        await yieldTask();
        last = now();
      }
    }
  }

  /* --------------------------------------------------------------------------------------------- page decoder */
  async function decodePage(R, ifd, opts) {
    const vals = (tag) => tagValues(R, ifd, tag);
    const NAMES = { 256: 'image width', 257: 'image height', 258: 'bit depth', 277: 'samples per pixel', 278: 'rows per strip', 322: 'tile width', 323: 'tile height' };
    const num = (tag, def) => {
      const v = vals(tag);
      const x = v && v.length ? v[0] : def;
      // every tag read here is a whole number; a fraction / infinity means a damaged directory (e.g. a changed type)
      if (!Number.isInteger(x)) corrupt(`bad ${NAMES[tag] || 'tag ' + tag} value (${x})`);
      return x;
    };
    const W = num(T.ImageWidth, 0), H = num(T.ImageLength, 0);
    if (!(W > 0 && H > 0)) corrupt('missing image size');
    if (W > 1e6 || H > 1e6) unsupported(`image is too large (${W} × ${H})`);
    const maxIn = opts.maxInputPixels > 0 ? opts.maxInputPixels : MAX_INPUT_PIXELS;
    if (W * H > maxIn) unsupported(`image is too large: ${W} × ${H} is ${Math.round((W * H) / 1e6)} megapixels, the limit is ${Math.round(maxIn / 1e6)}`);
    const spp = Math.max(1, num(T.SamplesPerPixel, 1));
    const bpsA = vals(T.BitsPerSample) || [1];
    const bps = bpsA[0];
    if (!Number.isInteger(bps)) corrupt(`bad bit depth value (${bps})`);
    for (let i = 1; i < Math.min(spp, bpsA.length); i++) if (bpsA[i] !== bps) unsupported(`samples have different bit depths (${Array.from(bpsA).join(', ')})`);
    const compression = num(T.Compression, 1);
    let sf = (vals(T.SampleFormat) || [1])[0];
    if (sf === 4 || sf === 0) sf = 1;
    const predictor = num(T.Predictor, 1);
    let orientation = num(T.Orientation, 1);
    if (!(orientation >= 1 && orientation <= 8)) orientation = 1;
    const fillOrder = num(T.FillOrder, 1);
    const isFax = compression === 2 || compression === 3 || compression === 4 || compression === 32771;
    let photometric = num(T.Photometric, -1);
    if (photometric < 0) photometric = isFax ? 0 : ifd.tags.has(T.ColorMap) ? 3 : spp >= 3 ? 2 : 1;
    let planar = spp > 1 ? num(T.PlanarConfig, 1) : 1;
    if (planar !== 2) planar = 1;
    const cname = COMPRESSION[compression] || 'unknown';
    const pname = PHOTOMETRIC[photometric] || 'unknown';

    /* ---- compression */
    const SUPPORTED = [1, 2, 3, 4, 5, 6, 7, 8, 32771, 32773, 32946];
    if (!SUPPORTED.includes(compression)) unsupported(`compression ${compression} (${cname})`);
    let ojpeg = null;
    if (compression === 6) {
      const o = num(T.JPEGIFOffset, 0), l = num(T.JPEGIFByteCount, 0);
      if (o > 0 && o + 2 < R.n && R.u8[o] === 0xff && R.u8[o + 1] === 0xd8) ojpeg = R.u8.subarray(o, l > 0 ? Math.min(R.n, o + l) : R.n);
      else unsupported('compression 6 (old-style JPEG)');
    }
    const isJpeg = compression === 7 || compression === 6;

    /* ---- sample format / depth */
    if (sf === 3) {
      if (bps !== 16 && bps !== 32 && bps !== 64) unsupported(`${bps}-bit floating point samples`);
    } else if (sf === 1 || sf === 2) {
      if (!(bps >= 1 && bps <= 32)) unsupported(`${bps}-bit samples`);
    } else unsupported(`sample format ${sf}${sf >= 5 ? ' (complex numbers)' : ''}`);
    if (isFax && (bps !== 1 || spp !== 1)) corrupt('CCITT fax compression needs 1-bit, 1-sample images');
    if (isJpeg && bps !== 8 && !(bps === 12 && compression === 7)) unsupported(`${bps}-bit JPEG`);

    /* ---- colour model */
    let model, nColor;
    switch (photometric) {
      case 0: case 1:
        model = 'gray';
        nColor = 1;
        break;
      case 2:
        model = spp >= 3 ? 'rgb' : 'gray';
        nColor = spp >= 3 ? 3 : 1;
        break;
      case 3:
        model = 'palette';
        nColor = 1;
        if (sf === 3 || bps > 16) unsupported(`${bps}-bit palette image`);
        if (!ifd.tags.has(T.ColorMap)) corrupt('palette image without a ColorMap');
        break;
      case 5: {
        const inkSet = num(T.InkSet, 1), inks = num(T.NumberOfInks, 4);
        if (inkSet !== 1 && inks !== 4) unsupported(`separated image with ${inks} inks (only CMYK is supported)`);
        if (spp < 4) unsupported(`separated (CMYK) image with ${spp} sample(s)`);
        model = 'cmyk';
        nColor = 4;
        break;
      }
      case 6:
        if (spp < 3) corrupt('YCbCr image with fewer than 3 samples');
        model = 'ycbcr';
        nColor = 3;
        break;
      case 8: case 9:
        if (bps !== 8 && bps !== 16) unsupported(`${bps}-bit CIELab`);
        model = 'lab';
        nColor = spp >= 3 ? 3 : 1;
        break;
      default:
        unsupported(`photometric ${photometric} (${pname})`);
    }
    // alpha: first extra sample flagged associated (1) or unassociated (2); none flagged + extra present → unassociated
    let ai = -1, assoc = false;
    if (spp > nColor && model !== 'ycbcr') {
      const extra = vals(T.ExtraSamples);
      if (!extra) ai = nColor;
      else
        for (let i = 0; i < extra.length && nColor + i < spp; i++)
          if (extra[i] === 1 || extra[i] === 2) {
            ai = nColor + i;
            assoc = extra[i] === 1;
            break;
          }
    }

    /* ---- layout */
    const tiled = ifd.tags.has(T.TileWidth) && ifd.tags.has(T.TileOffsets);
    let tw, th, offs, cnts;
    if (tiled) {
      tw = num(T.TileWidth, 0);
      th = num(T.TileLength, tw);
      offs = vals(T.TileOffsets);
      cnts = vals(T.TileByteCounts);
      if (!(tw > 0 && th > 0)) corrupt('bad tile size');
    } else {
      tw = W;
      th = num(T.RowsPerStrip, H);
      if (!(th > 0) || th > H) th = H;
      offs = vals(T.StripOffsets);
      cnts = vals(T.StripByteCounts);
    }
    if (ojpeg) {
      tw = W;
      th = H;
    }
    if (!offs && !ojpeg) corrupt('no image data (missing strip/tile offsets)');
    const tilesX = Math.ceil(W / tw), tilesY = Math.ceil(H / th), perPlane = tilesX * tilesY;
    const sppc = planar === 2 ? 1 : spp; // samples per pixel inside one strip/tile
    const rowBytes = Math.ceil((tw * sppc * bps) / 8);

    // which planes we need (planar): colour planes + alpha plane
    const needed = [];
    for (let s = 0; s < nColor; s++) needed.push(s);
    if (ai >= 0) needed.push(ai);
    const planeList = planar === 2 ? needed : [0];
    if (!ojpeg && offs.length < perPlane * (planar === 2 ? Math.max(...planeList) + 1 : 1)) corrupt(`expected ${perPlane * (planar === 2 ? spp : 1)} strips/tiles, found ${offs.length}`);

    // Does the file really hold that much image? A damaged header can claim 100000 × 100000 pixels: reject that up
    // front, from the bytes the strips/tiles actually have in the file, before anything is allocated.
    if (tiled && (tw > Math.max(W, 16) * 2 + 1024 || th > Math.max(H, 16) * 2 + 1024)) corrupt(`${tw} × ${th} tiles do not fit a ${W} × ${H} image`);
    let avail = 0;
    if (ojpeg) avail = ojpeg.length;
    else
      for (let i = 0; i < offs.length && avail < R.n; i++) {
        const off = offs[i];
        if (off > 0 && off < R.n) avail += Math.min(cnts && i < cnts.length && cnts[i] > 0 ? cnts[i] : R.n, R.n - off);
      }
    avail = Math.min(avail, R.n);
    if (!avail) corrupt('the image data is missing (strip/tile offsets point past the end of the file — truncated download?)');
    const claimed = (W * H * spp * bps) / 8;
    if (isFax ? H > avail * 8 + 8 : claimed > avail * RATIO[compression] + (1 << 20)) // fax: every row takes ≥ 1 bit
      corrupt(`the header describes ${W} × ${H} pixels (${kb(claimed)} of samples), far more than the ${kb(avail)} of image data in this file can hold (damaged or truncated file?)`);

    // YCbCr: subsampling / conversion parameters (uncompressed or LZW etc.; JPEG handles its own)
    let ycc = null;
    if (model === 'ycbcr' && !isJpeg) {
      if (bps !== 8) unsupported(`${bps}-bit YCbCr`);
      const ss = vals(T.YCbCrSubSampling) || [2, 2];
      const sh = ss[0] || 2, sv = ss[1] || 2;
      if (planar === 2 && (sh !== 1 || sv !== 1)) unsupported('planar subsampled YCbCr');
      if (planar === 2) unsupported('planar YCbCr');
      if (![1, 2, 4].includes(sh) || ![1, 2, 4].includes(sv)) corrupt('bad YCbCr subsampling');
      const coef = vals(T.YCbCrCoefficients) || [0.299, 0.587, 0.114];
      const ref = vals(T.ReferenceBlackWhite) || [0, 255, 128, 255, 128, 255];
      ycc = { sh, sv, coef, ref };
    }
    // JPEG: decoded by the browser (8-bit gray / RGB / YCbCr / Adobe CMYK), or by jpegDecodeJS for what browsers get
    // wrong: chunky CMYK without an Adobe marker (plain ink values), extra (alpha) channels, 12-bit data.
    let jpegTables = null, jpegTransform = -1, jsJpeg = false;
    if (isJpeg) {
      if (model === 'palette' || model === 'lab') unsupported(`JPEG-compressed ${pname} image`);
      if (planar === 2 && model === 'ycbcr') unsupported('planar JPEG YCbCr');
      if (model === 'ycbcr' && spp !== 3) unsupported(`JPEG YCbCr with ${spp} samples per pixel`);
      jpegTables = tagBytes(R, ifd, T.JPEGTables);
      if (model === 'ycbcr') jpegTransform = 1;
      else if (model === 'rgb' && planar === 1) jpegTransform = 0;
      if (!ojpeg && opts.jsJpeg) jsJpeg = true; // test switch: force the JS decoder
      else if (!ojpeg) {
        const comps = planar === 2 ? 1 : spp, browserComps = planar === 2 || model === 'gray' ? 1 : model === 'cmyk' ? 4 : 3;
        if (bps !== 8 || comps !== browserComps) jsJpeg = true;
        else if (model === 'cmyk' && planar === 1) {
          const first = chunkSrc(0);
          jsJpeg = !((jpegTables && jpegInfo(jpegTables).adobe) || (first && jpegInfo(first).adobe));
        }
      }
    }

    /* ---- the colour model the converter sees, after JPEG / YCbCr expansion */
    let vModel = model === 'ycbcr' ? 'rgb' : model, vSpp = spp, vPlanar = planar, vAi = ai;
    if (isJpeg && planar === 1 && jsJpeg) vSpp = model === 'ycbcr' ? 3 : spp; // raw components (CMYK stays ink values)
    else if (isJpeg && planar === 1) {
      vSpp = model === 'gray' || model === 'palette' ? 1 : 3;
      if (model === 'cmyk') vModel = 'rgb'; // browser converts (Adobe CMYK only)
      vAi = -1;
    }
    if (ycc) {
      vSpp = 3;
      vAi = -1;
    }
    const vBps = isJpeg || ycc ? 8 : bps;
    const vSf = isJpeg || ycc ? 1 : sf;

    /* ---- output geometry: optional box-filter reduction (gigantic images, or opts.maxSide), then orientation */
    const maxPixels = opts.maxPixels > 0 ? opts.maxPixels : 64e6;
    let f = W * H > maxPixels ? Math.ceil(Math.sqrt((W * H) / maxPixels)) : 1;
    if (opts.maxSide > 0 && Math.max(W, H) > opts.maxSide) f = Math.max(f, Math.ceil(Math.max(W, H) / opts.maxSide));
    const SW = Math.ceil(W / f), SH = Math.ceil(H / f);
    const swap = orientation >= 5;
    const OW = swap ? SH : SW, OH = swap ? SW : SH;
    let base, sx, sy; // destination pixel index = base + xs*sx + ys*sy
    switch (orientation) {
      case 2: base = SW - 1; sx = -1; sy = OW; break;
      case 3: base = (SH - 1) * OW + SW - 1; sx = -1; sy = -OW; break;
      case 4: base = (SH - 1) * OW; sx = 1; sy = -OW; break;
      case 5: base = 0; sx = OW; sy = 1; break;
      case 6: base = SH - 1; sx = OW; sy = -1; break;
      case 7: base = (SW - 1) * OW + SH - 1; sx = -OW; sy = -1; break;
      case 8: base = (SW - 1) * OW; sx = -OW; sy = 1; break;
      default: base = 0; sx = 1; sy = OW;
    }
    let O;
    try {
      O = new Uint8ClampedArray(OW * OH * 4);
    } catch (e) {
      unsupported(`image is too large for this browser's memory (${W} × ${H})`);
    }

    /* ---- converter parameters */
    const P = { k: 1, ai: vAi, assoc, inv: photometric === 0, nColor };
    if (vSf === 3) P.k = 1;
    else if (vSf === 2) P.k = 1 / (Math.pow(2, vBps - 1) - 1);
    else P.k = 1 / (Math.pow(2, vBps) - 1);
    if (model === 'palette') {
      const cm = vals(T.ColorMap), n = 1 << bps;
      if (cm.length < 3 * n) corrupt('ColorMap too short');
      let wide = false;
      for (let i = 0; i < 3 * n; i++) if (cm[i] > 255) wide = true;
      const map = new Uint8Array(3 * n);
      for (let i = 0; i < n; i++)
        for (let c = 0; c < 3; c++) {
          const v = cm[c * n + i];
          map[i * 3 + c] = wide ? Math.round(v / 257) : v;
        }
      P.map = map;
    }
    if (model === 'lab') {
      const icc = photometric === 9;
      P.labL = 100 / (bps === 8 ? 255 : 65535);
      P.labAB = bps === 8 ? 1 : 1 / 256;
      P.labOff = icc ? (bps === 8 ? 128 : 32768) : 0;
      P.labHalf = icc ? 0 : bps === 8 ? 128 : 32768;
    }
    const conv = CONVERT[vModel];
    const reader = makeSampleReader(vBps, model === 'lab' ? 1 : vSf, R.le);
    const readerBE = vSf === 3 ? makeSampleReader(vBps, vSf, false) : reader;
    // signed / float pre-pass so converters see 0..1 (after × k) values
    const signedColour = vSf === 2 && model !== 'lab' && vModel !== 'palette';
    let tone = null; // float tone curve, set after the stats pass

    /* ---- chunk access */
    const fileFillRev = fillOrder === 2 && !isJpeg;
    function chunkSrc(idx) {
      if (ojpeg) return ojpeg;
      const off = offs[idx];
      if (!(off > 0) || off >= R.n) return null;
      let cnt = cnts && idx < cnts.length && cnts[idx] > 0 ? cnts[idx] : R.n - off;
      if (off + cnt > R.n) cnt = R.n - off;
      return R.u8.subarray(off, off + cnt);
    }
    const t4 = num(T.T4Options, 0);
    // A damaged strip/tile (bad Deflate / JPEG data …) is left transparent like a missing one, as libtiff-based viewers
    // do, instead of failing the whole image; only when not a single row could be decoded does the decode reject.
    let attempted = 0, damaged = 0, missing = 0, firstDamage = null, aborted = false;
    async function decodeChunk(idx, rows) {
      if (aborted) return null; // the decode already failed: don't keep prefetched strips busy
      attempted++;
      try {
        const r = await decodeChunkRaw(idx, rows);
        if (!r) missing++;
        return r;
      } catch (e) {
        if (!(e instanceof TiffError) || !/^Corrupt/.test(e.message)) throw e;
        damaged++;
        firstDamage = firstDamage || e;
        return null;
      }
    }
    async function decodeChunkRaw(idx, rows) {
      let src = chunkSrc(idx);
      if (!src) return null;
      if (fileFillRev) src = reverseBits(src);
      if (isJpeg && jsJpeg) {
        const r = await jpegDecodeJS(joinJpeg(jpegTables, src), model === 'ycbcr', tw, th);
        const k = planar === 2 ? 1 : vSpp, nc = r.nc, w = r.w, px = r.data;
        if (nc < k) corrupt(`a JPEG strip/tile has ${nc} components, expected ${k}`);
        const inv = model === 'cmyk' && r.adobe >= 0 ? 255 : 0; // Adobe CMYK is stored inverted
        if (w === tw && nc === k && !inv) return { data: px, rowBytes: tw * k, pred: 1 }; // already in strip/tile layout
        const mw = Math.min(w, tw), mh = Math.min(r.h, rows);
        const out = new Uint8Array(tw * mh * k); // rows the JPEG doesn't cover stay transparent
        for (let y = 0; y < mh; y++)
          for (let x = 0, s = y * w * nc, o = y * tw * k; x < mw; x++, s += nc, o += k) for (let c = 0; c < k; c++) out[o + c] = inv && c < 4 ? inv - px[s + c] : px[s + c];
        return { data: out, rowBytes: tw * k, pred: 1 };
      }
      if (isJpeg) {
        const j = ojpeg ? Object.assign(jpegInfo(ojpeg), { blob: new Blob([dropExif(ojpeg, 0)], { type: 'image/jpeg' }) }) : buildJpeg(jpegTables, src, jpegTransform);
        if (model === 'cmyk' && planar === 1 && !j.adobe) unsupported('JPEG-compressed CMYK without an Adobe marker in some strips');
        // a damaged / hostile frame header must not make the browser decode a gigantic image from a few bytes
        if (j.w > tw + 16 || j.h > th + 16) corrupt(`a JPEG strip/tile is ${j.w} × ${j.h}, larger than the ${tw} × ${th} it should be`);
        if (j.w * j.h * 3 > src.length * RATIO[7] + (1 << 22)) corrupt(`a JPEG strip/tile claims ${j.w} × ${j.h} pixels, far more than its ${kb(src.length)} of data can hold`);
        const k = planar === 2 ? 1 : vSpp;
        let out = null;
        await browserDecode(j.blob, (px, w, y0, n, h) => {
          if (!out) out = new Uint8Array(tw * Math.min(rows, h) * k); // rows the JPEG doesn't cover stay transparent
          const mw = Math.min(w, tw), y1 = Math.min(y0 + n, rows);
          for (let y = y0; y < y1; y++)
            for (let x = 0, s = (y - y0) * w * 4, o = y * tw * k; x < mw; x++, s += 4, o += k) {
              out[o] = px[s];
              if (k === 3) {
                out[o + 1] = px[s + 1];
                out[o + 2] = px[s + 2];
              }
            }
        });
        return out && { data: out, rowBytes: tw * k, pred: 1 };
      }
      let expected = rowBytes * rows;
      if (ycc) expected = Math.ceil(tw / ycc.sh) * Math.ceil(rows / ycc.sv) * (ycc.sh * ycc.sv + 2);
      // Never allocate from header values alone: a strip/tile can't decompress to more than RATIO × its bytes, and a
      // fax row takes at least one bit. Whatever the data doesn't cover is left transparent.
      let faxRows = rows;
      if (isFax) faxRows = Math.min(rows, src.length * 8 + 1);
      else if (compression !== 1) expected = Math.min(expected, src.length * RATIO[compression] + 4096);
      if ((isFax ? rowBytes * faxRows : compression === 1 ? 0 : expected) > MAX_CHUNK_BYTES)
        unsupported(`one strip/tile holds ${kb(isFax ? rowBytes * faxRows : expected)} of pixel data, too much to decode in a browser tab`);
      let data;
      if (useWorkers) {
        const r = await offThread(compression === 5 ? 'lzw' : 'deflate', src, expected, workerPred);
        if (ycc) return { data: ycbcrToRgb(r.data, tw, rows, ycc.sh, ycc.sv, ycc.coef, ycc.ref), rowBytes: tw * 3, pred: 1 };
        return { data: r.data, rowBytes, pred: r.predDone ? 1 : predictor };
      }
      switch (compression) {
        case 1:
          data = src; // short (truncated) data: the rows it doesn't cover stay transparent
          break;
        case 5:
          data = await lzwMain(src, expected);
          break;
        case 8: case 32946:
          data = await inflate(src, expected);
          break;
        case 32773:
          data = await unpackBits(src, expected);
          break;
        default: // CCITT
          data = await ccittDecode(src, tw, faxRows, compression, t4);
      }
      if (ycc) return { data: ycbcrToRgb(data, tw, rows, ycc.sh, ycc.sv, ycc.coef, ycc.ref), rowBytes: tw * 3, pred: 1 };
      return { data, rowBytes, pred: predictor };
    }
    if (predictor !== 1 && !isJpeg && !ycc) {
      if (predictor === 2 && ![8, 16, 32].includes(bps)) unsupported(`predictor 2 with ${bps}-bit samples`);
      if (predictor === 3 && sf !== 3) unsupported('floating-point predictor on integer samples');
      if (predictor !== 2 && predictor !== 3) unsupported(`predictor ${predictor}`);
    }

    /* ---- the strip/tile loop (run twice for float images: stats, then pixels) */
    let dataBytes = 0;
    if (cnts) for (let i = 0; i < cnts.length; i++) dataBytes += cnts[i];
    const wOpt = opts.workers;
    const useWorkers = (compression === 5 || compression === 8 || compression === 32946) && wOpt !== false && (dataBytes > (4 << 20) || wOpt === 'force') && !!workerPool();
    // predictor 2 is undone in the worker too (whole strip/tile rows)
    const workerPred = useWorkers && predictor === 2 && !ycc && [8, 16, 32].includes(bps) ? { pred: 2, rowBytes, nSamples: tw * sppc, stride: sppc, bps, le: R.le } : null;
    const asyncCodec = isJpeg || compression === 8 || compression === 32946;
    const WINDOW = useWorkers ? pool.workers.length * 3 : asyncCodec ? 8 : 1;
    // direct bytes → RGBA for the common 8/16-bit gray/RGB(A) cases (no float row buffer)
    const fast = vPlanar === 1 && vSf === 1 && !tone && (vBps === 8 || vBps === 16) && (vModel === 'rgb' || vModel === 'gray') && !(vAi >= 0 && assoc) ? makeFastRow(vBps, vModel, vSpp, vAi, P.inv) : null;
    const buf = new Float32Array(tw * vSpp + 8);
    const scratch = new Uint8Array(rowBytes + 16), tmp = new Uint8Array(rowBytes + 16);
    // Reduction (f > 1, gigantic images): rows are converted at full resolution into rowRGBA and box-filtered
    // (alpha-weighted) into a small ring of output rows — one tile band at most — so thin lines in huge scans survive.
    const reduce = f > 1;
    const rowRGBA = reduce ? new Uint8ClampedArray(tw * 4) : null;
    const accRows = reduce ? (tilesX === 1 ? 2 : Math.ceil(th / f) + 2) : 0;
    const acc = reduce ? new Float64Array(SW * accRows * 4) : null; // Float32 would round sums once f > 16
    let flushed = 0;
    function accumulate(x0, cw, y) {
      const a0 = (((y / f) | 0) % accRows) * SW * 4;
      for (let x = 0; x < cw; x++) {
        const s = x * 4, a = rowRGBA[s + 3];
        if (!a) continue;
        const k = a0 + (((x0 + x) / f) | 0) * 4;
        acc[k] += rowRGBA[s] * a;
        acc[k + 1] += rowRGBA[s + 1] * a;
        acc[k + 2] += rowRGBA[s + 2] * a;
        acc[k + 3] += a;
      }
    }
    function flushTo(ysEnd) {
      for (let ys = flushed; ys < ysEnd && ys < SH; ys++) {
        const a0 = (ys % accRows) * SW * 4, rows = Math.min(H, ys * f + f) - ys * f;
        for (let xs = 0; xs < SW; xs++) {
          const k = a0 + xs * 4, A = acc[k + 3];
          if (A > 0) {
            const d = (base + xs * sx + ys * sy) * 4;
            O[d] = (acc[k] / A + 0.5) | 0;
            O[d + 1] = (acc[k + 1] / A + 0.5) | 0;
            O[d + 2] = (acc[k + 2] / A + 0.5) | 0;
            O[d + 3] = (A / (rows * (Math.min(W, xs * f + f) - xs * f)) + 0.5) | 0;
            acc[k] = acc[k + 1] = acc[k + 2] = acc[k + 3] = 0;
          }
        }
      }
      if (ysEnd > flushed) flushed = ysEnd;
    }
    let last = now(), rowsDrawn = 0;
    /** Decode every strip/tile in order (prefetching WINDOW ahead) and hand each row to onRow / fastRow. */
    async function eachRow(onRow, fastRow, pixels) {
      const pending = new Map();
      const start = (ci) => {
        const ty = (ci / tilesX) | 0;
        const rows = tiled ? th : Math.min(th, H - ty * th);
        const p = Promise.all(planeList.map((pl) => decodeChunk(pl * perPlane + ci, rows)));
        p.catch(() => {});
        pending.set(ci, p);
      };
      for (let ci = 0; ci < Math.min(WINDOW, perPlane); ci++) start(ci);
      for (let ci = 0; ci < perPlane; ci++) {
        const chunks = await pending.get(ci);
        pending.delete(ci);
        if (ci + WINDOW < perPlane) start(ci + WINDOW);
        const tx = ci % tilesX, ty = (ci / tilesX) | 0;
        const x0 = tx * tw, y0 = ty * th;
        const cw = Math.min(tw, W - x0), ch = Math.min(th, H - y0);
        const gap = chunks.some((c) => !c); // missing strip/tile: leave transparent
        for (let r = 0; r < ch && !gap; r++) {
          const y = y0 + r;
          // short / damaged data: the rows it doesn't cover (in every plane) are left transparent
          let have = true;
          for (const c of chunks) if ((r + 1) * c.rowBytes > c.data.length) have = false;
          if (!have) break;
          let tgt = O, d = 0, step = 4;
          if (reduce) tgt = rowRGBA;
          else {
            d = (base + x0 * sx + y * sy) * 4;
            step = sx * 4;
          }
          if (fastRow) {
            const c = chunks[0];
            let row = c.data, off = r * c.rowBytes, le = R.le;
            if (c.pred !== 1) {
              scratch.set(row.subarray(off, off + c.rowBytes));
              le = undoPredictor(scratch, cw * sppc, sppc, bps, R.le, c.pred, tmp);
              row = scratch;
              off = 0;
            }
            fastRow(row, off, 0, cw, 1, tgt, d, step, le);
          } else {
            for (let pi = 0; pi < chunks.length; pi++) {
              const c = chunks[pi];
              let row = c.data, off = r * c.rowBytes, le = R.le;
              if (c.pred !== 1) {
                scratch.set(row.subarray(off, off + c.rowBytes));
                le = undoPredictor(scratch, c.pred === 3 ? tw * sppc : cw * sppc, sppc, bps, R.le, c.pred, tmp);
                row = scratch;
                off = 0;
              }
              const rd = le ? reader : readerBE;
              if (vPlanar === 2) rd(row, off, cw, buf, planeList[pi], vSpp);
              else rd(row, off, cw * vSpp, buf, 0, 1);
            }
            onRow(buf, cw, tgt, d, step);
          }
          if (pixels) rowsDrawn++;
          if (reduce && pixels) {
            accumulate(x0, cw, y);
            if (tilesX === 1 && ((y + 1) % f === 0 || y === H - 1)) flushTo(((y / f) | 0) + 1);
          }
          if ((r & 15) === 15 && now() - last > YIELD_MS) {
            await yieldTask();
            last = now();
          }
        }
        // end of a strip / tile band: every output row above the next band is complete
        if (reduce && pixels && tx === tilesX - 1) flushTo(y0 + ch >= H ? SH : Math.floor((y0 + ch) / f));
        if (now() - last > YIELD_MS) {
          await yieldTask();
          last = now();
        }
      }
    }
    const colourSlots = [];
    for (let s = 0; s < (vModel === 'gray' || vModel === 'palette' ? 1 : vModel === 'cmyk' ? 4 : 3); s++) colourSlots.push(s);

    try {
      if (vSf === 3) {
        // stats pass: is this 0..1 data or HDR?
        let max = 0;
        await eachRow((b, cw) => {
          for (let x = 0; x < cw; x++)
            for (const s of colourSlots) {
              const v = b[x * vSpp + s];
              if (v > max && v !== Infinity) max = v;
            }
        }, null, false);
        // 0..1 data (with a little filter overshoot) is shown as-is; real HDR is tone-mapped (extended Reinhard + gamma)
        if (max <= 1.1) tone = (v) => (v > 0 ? (v < 1 ? v : 1) : 0);
        else {
          const M2 = max * max, g = 1 / 2.2;
          tone = (v) => (v > 0 ? (v === Infinity ? 1 : Math.pow(Math.min(1, (v * (1 + v / M2)) / (1 + v)), g)) : 0);
        }
        P.toneMax = max;
        attempted = damaged = missing = 0; // count for the pixel pass only
        firstDamage = null;
      }
      await eachRow((b, cw, tgt, d, step) => {
        if (tone || signedColour) {
          for (let x = 0; x < cw; x++) {
            const i = x * vSpp;
            for (const s of colourSlots) {
              const v = b[i + s];
              b[i + s] = tone ? tone(v) : v < 0 ? 0 : v;
            }
            if (vAi >= 0 && signedColour && b[i + vAi] < 0) b[i + vAi] = 0;
          }
        }
        conv(b, vSpp, 0, cw, 1, tgt, d, step, P);
      }, fast, true);
    } catch (e) {
      aborted = true; // strips still being prefetched stop instead of decoding for nothing
      throw e;
    }
    if (reduce) flushTo(SH);
    if (!rowsDrawn) {
      if (firstDamage) throw firstDamage;
      corrupt(missing ? 'the image data is missing (strip/tile offsets point past the end of the file — truncated download?)' : 'no image data could be decoded');
    }
    // embedded ICC profile → sRGB (RGB / gray matrix-TRC profiles; float data is tone-mapped instead)
    let icc = null;
    if (opts.icc !== false && sf !== 3 && ifd.tags.has(T.ICCProfile)) {
      try {
        icc = parseIcc(tagBytes(R, ifd, T.ICCProfile));
      } catch (e) {
        icc = null; // a damaged profile is ignored, like browsers do
      }
      const fits = icc && (icc.kind === 'gray' ? model === 'gray' : model === 'rgb' || model === 'ycbcr' || model === 'palette');
      if (fits) await applyIcc(icc, O);
      else icc = null;
    }

    return {
      width: OW,
      height: OH,
      data: O,
      info: {
        width: W,
        height: H,
        compression: cname,
        photometric: pname,
        bitsPerSample: bps,
        sampleFormat: sf === 3 ? 'float' : sf === 2 ? 'int' : 'uint',
        samplesPerPixel: spp,
        planar: planar === 2,
        tiled,
        predictor,
        orientation,
        alpha: ai < 0 ? 'none' : assoc ? 'associated' : 'unassociated',
        littleEndian: R.le,
        bigTiff: R.big,
        reduced: f,
        hdrMax: P.toneMax,
        software: tagString(R, ifd, T.Software),
        iccConverted: icc ? icc.desc || icc.kind + ' profile' : '',
        damaged: damaged || missing ? `${damaged + missing} of ${attempted} strips/tiles ${!missing ? 'damaged' : !damaged ? 'missing' : 'damaged or missing'}` : '',
      },
    };
  }

  /* -------------------------------------------------------------------------------------------------- API */
  async function decode(input, opts) {
    opts = opts || {};
    const t0 = now();
    try {
      if (input && typeof input.arrayBuffer === 'function' && !(input instanceof ArrayBuffer)) input = await input.arrayBuffer();
      const u8 = toU8(input);
      if (!u8) fail('TIFF decode needs an ArrayBuffer');
      if (!isTiff(u8)) fail('Not a TIFF file');
      const R = makeReader(u8);
      const ifds = readChain(R);
      const page = choosePage(R, ifds, opts.page);
      const res = await decodePage(R, ifds[page], opts);
      res.pages = ifds.length;
      res.info.page = page;
      res.info.pages = ifds.length;
      res.info.ms = Math.round(now() - t0);
      return res;
    } catch (e) {
      if (e instanceof TiffError) throw new Error(e.message);
      if (e instanceof RangeError) throw new Error('Could not decode TIFF: the image is too large for available memory');
      throw new Error('Could not decode TIFF: ' + (e && e.message ? e.message : String(e)));
    } finally {
      releaseScratch();
    }
  }

  PG.tiff = { isTiff, decode };
})();
