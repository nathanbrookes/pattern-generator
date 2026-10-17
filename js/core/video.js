/* Pattern Generator — video encoder: WebCodecs VideoEncoder + tiny built-in MP4 (H.264) and WebM (VP9/VP8) muxers.
 *
 *   PG.video.supported() → Promise<{ mp4, webm }>
 *   PG.video.encode({ width, height, fps, frames, renderFrame, format, bitrate, onProgress, signal }) → Promise<Blob>
 *
 * Every frame gets the same exact duration (MP4: timescale = fps×1000, 1000 ticks per frame; WebM: DefaultDuration +
 * Info/Duration), so players report duration = frames / fps and a seamless loop has no extra frame at the seam.
 * MP4 is written 'faststart' (moov before mdat) and switches to co64 + a 64-bit mdat header past 4 GB.
 * The encoded file is held in memory (as Blob parts) until it is returned. PG.video.last describes the last encode.
 */
(function () {
  'use strict';
  const PG = (window.PG = window.PG || {});
  const video = (PG.video = {});

  const KEY_SECONDS = 2; // keyframe interval
  const QUEUE_BYTES = 256e6; // cap on raw frames waiting inside the encoder

  /* ================================================================ bytes */
  const ascii = (s) => new TextEncoder().encode(s);
  function concat(parts) {
    const flat = parts.flat(Infinity);
    let n = 0;
    for (const p of flat) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of flat) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
  const zeros = (n) => new Uint8Array(n);
  const u8 = (n) => Uint8Array.of(n & 255);
  const u16 = (n) => Uint8Array.of((n >>> 8) & 255, n & 255);
  function u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0);
    return b;
  }
  function u64(n) {
    const b = new Uint8Array(8);
    const dv = new DataView(b.buffer);
    dv.setUint32(0, Math.floor(n / 4294967296));
    dv.setUint32(4, n % 4294967296);
    return b;
  }
  /** Run-length encode [a, a, b] → [[2, a], [1, b]]. */
  function runs(values) {
    const out = [];
    for (const v of values) {
      const last = out[out.length - 1];
      if (last && last[1] === v) last[0]++;
      else out.push([1, v]);
    }
    return out;
  }
  function copyBytes(src) {
    if (!src) return null;
    const v = src instanceof ArrayBuffer ? new Uint8Array(src) : new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
    return v.slice();
  }

  /* Colour descriptions (ISO/IEC 23091-2 code points) from a WebCodecs VideoColorSpace. */
  const PRIMARIES = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9, smpte432: 12 };
  const TRANSFER = { bt709: 1, smpte170m: 6, linear: 8, 'iec61966-2-1': 13, pq: 16, hlg: 18 };
  const MATRIX = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 };
  function colorCodes(cs) {
    if (!cs) return null;
    const p = PRIMARIES[cs.primaries], t = TRANSFER[cs.transfer], m = MATRIX[cs.matrix];
    if (p == null || t == null || m == null) return null;
    return { primaries: p, transfer: t, matrix: m, fullRange: !!cs.fullRange };
  }

  /* ============================================================ MP4 muxer */
  const box = (type, ...parts) => {
    const body = concat(parts);
    return concat([u32(body.length + 8), ascii(type), body]);
  };
  const fullBox = (type, version, flags, ...parts) => box(type, u8(version), u8(flags >> 16), u8(flags >> 8), u8(flags), ...parts);
  const MATRIX_UNITY = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32);

  /**
   * t = { width, height, fps, frames, samples: [{ data, key, idx }] (decode order), description (avcC), colorSpace }
   * → Blob 'video/mp4'. t.force64 (tests only) writes the > 4 GB layout (co64 + 64-bit mdat size) for a small file.
   */
  function muxMP4(t) {
    const S = t.samples;
    const n = S.length;
    if (!n) throw new Error('no encoded frames to write');
    if (!t.description || !t.description.length) throw new Error('the H.264 encoder did not provide its avcC configuration');
    const timescale = Math.max(1, Math.round(t.fps * 1000));
    const TICKS = 1000; // per frame

    // Decode times are the sorted presentation times. A reordering encoder (B-frames) gets a non-negative ctts
    // (every frame is decoded before it is shown) plus an edit list that skips the `shift`-frame reorder delay,
    // so presentation still starts at 0 in every player (QuickTime/AVFoundation keep pts < dts otherwise).
    const pres = S.map((s) => s.idx);
    const sorted = pres.slice().sort((a, b) => a - b);
    const reordered = pres.some((p, k) => p !== sorted[k]);
    const shift = reordered ? pres.reduce((m, p, k) => Math.max(m, sorted[k] - p), 0) : 0;
    const cttsRuns = reordered ? runs(pres.map((p, k) => (p - sorted[k] + shift) * TICKS)) : null;
    const deltas = sorted.map((p, k) => ((k + 1 < n ? sorted[k + 1] : Math.max(t.frames, p + 1)) - p) * TICKS);
    const duration = deltas.reduce((a, b) => a + b, 0);
    const keys = [];
    S.forEach((s, k) => s.key && keys.push(k + 1));

    // Chunks of ~1 s; samples sit back-to-back in mdat in decode order.
    const perChunk = Math.max(1, Math.round(t.fps));
    const relOffsets = [];
    let pos = 0;
    S.forEach((s, k) => {
      if (k % perChunk === 0) relOffsets.push(pos);
      pos += s.data.length;
    });
    const payload = pos;
    const nChunks = relOffsets.length;
    const stscRuns = [[1, perChunk]];
    const lastCount = n - (nChunks - 1) * perChunk;
    if (nChunks === 1) stscRuns[0][1] = lastCount;
    else if (lastCount !== perChunk) stscRuns.push([nChunks, lastCount]);

    const now = Math.floor(Date.now() / 1000) + 2082844800; // seconds since 1904
    const v = duration > 0xffffffff || now > 0xffffffff ? 1 : 0;
    const times = v ? [u64(now), u64(now)] : [u32(now), u32(now)];
    const dur = v ? u64(duration) : u32(duration);
    const W = t.width, H = t.height;
    const colr = colorCodes(t.colorSpace);

    const buildMoov = (offsets, co64) =>
      box(
        'moov',
        fullBox('mvhd', v, 0, times, u32(timescale), dur, u32(0x00010000), u16(0x0100), zeros(10), MATRIX_UNITY, zeros(24), u32(2)),
        box(
          'trak',
          fullBox('tkhd', v, 3, times, u32(1), u32(0), dur, zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX_UNITY, u32(W * 65536), u32(H * 65536)),
          // edit list only when frames are reordered: present media [shift, shift + duration) at movie time 0
          reordered ? box('edts', fullBox('elst', v, 0, u32(1), dur, v ? u64(shift * TICKS) : u32(shift * TICKS), u16(1), u16(0))) : [],
          box(
            'mdia',
            fullBox('mdhd', v, 0, times, u32(timescale), dur, u16(0x55c4) /* 'und' */, u16(0)),
            fullBox('hdlr', 0, 0, u32(0), ascii('vide'), zeros(12), ascii('VideoHandler'), u8(0)),
            box(
              'minf',
              fullBox('vmhd', 0, 1, zeros(8)),
              box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))),
              box(
                'stbl',
                fullBox(
                  'stsd', 0, 0, u32(1),
                  box(
                    'avc1',
                    zeros(6), u16(1), // reserved, data_reference_index
                    zeros(16), u16(W), u16(H),
                    u32(0x00480000), u32(0x00480000), u32(0), u16(1), // 72 dpi, reserved, frame_count
                    zeros(32), u16(0x18), u16(0xffff), // compressorname, depth, pre_defined
                    box('avcC', t.description),
                    colr ? box('colr', ascii('nclx'), u16(colr.primaries), u16(colr.transfer), u16(colr.matrix), u8(colr.fullRange ? 0x80 : 0)) : [],
                    box('pasp', u32(1), u32(1))
                  )
                ),
                fullBox('stts', 0, 0, u32(runs(deltas).length), runs(deltas).map(([c, d]) => [u32(c), u32(d)])),
                reordered ? fullBox('ctts', 0, 0, u32(cttsRuns.length), cttsRuns.map(([c, o]) => [u32(c), u32(o)])) : [],
                fullBox('stss', 0, 0, u32(keys.length), keys.map(u32)),
                fullBox('stsc', 0, 0, u32(stscRuns.length), stscRuns.map(([first, count]) => [u32(first), u32(count), u32(1)])),
                fullBox('stsz', 0, 0, u32(0), u32(n), S.map((s) => u32(s.data.length))),
                co64 ? fullBox('co64', 0, 0, u32(nChunks), offsets.map(u64)) : fullBox('stco', 0, 0, u32(nChunks), offsets.map(u32))
              )
            )
          )
        )
      );

    const ftyp = box('ftyp', ascii('isom'), u32(512), ascii('isom'), ascii('iso2'), ascii('avc1'), ascii('mp41'));
    const bigMdat = !!t.force64 || payload + 8 > 0xffffffff;
    const mdatHeader = bigMdat ? concat([u32(1), ascii('mdat'), u64(payload + 16)]) : concat([u32(payload + 8), ascii('mdat')]);
    // moov's size depends only on stco-vs-co64, so measure with placeholder offsets, then write the real ones.
    let co64 = !!t.force64;
    let base = ftyp.length + buildMoov(relOffsets, co64).length + mdatHeader.length;
    if (!co64 && base + relOffsets[nChunks - 1] > 0xffffffff) {
      co64 = true;
      base = ftyp.length + buildMoov(relOffsets, co64).length + mdatHeader.length;
    }
    const moov = buildMoov(relOffsets.map((r) => base + r), co64);
    return new Blob([ftyp, moov, mdatHeader, ...S.map((s) => s.data)], { type: 'video/mp4' });
  }

  /* =========================================================== WebM muxer */
  function ebmlId(id) {
    const b = [];
    for (let v = id; v > 0; v = Math.floor(v / 256)) b.unshift(v & 255);
    return Uint8Array.from(b);
  }
  /** EBML variable-length size; minimal length unless len is given. */
  function vint(n, len) {
    if (!len) {
      len = 1;
      while (n >= Math.pow(2, 7 * len) - 1) len++;
    }
    const b = new Uint8Array(len);
    for (let i = len - 1, v = n; i >= 0; i--, v = Math.floor(v / 256)) b[i] = v % 256;
    b[0] |= 1 << (8 - len);
    return b;
  }
  function eUint(n, len) {
    if (!len) {
      len = 1;
      while (n >= Math.pow(2, 8 * len)) len++;
    }
    const b = new Uint8Array(len);
    for (let i = len - 1, v = n; i >= 0; i--, v = Math.floor(v / 256)) b[i] = v % 256;
    return b;
  }
  function eFloat(f) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, f);
    return b;
  }
  const el = (id, ...payload) => {
    const body = concat(payload);
    return concat([ebmlId(id), vint(body.length), body]);
  };

  /**
   * t = { width, height, fps, frames, samples: [{ data, key, idx }], codecId ('V_VP9' | 'V_VP8'), colorSpace }
   * → Blob 'video/webm'. TimecodeScale is 1 ms; a new Cluster starts at every keyframe (≤ 30 s apart).
   */
  function muxWebM(t) {
    const S = t.samples;
    if (!S.length) throw new Error('no encoded frames to write');
    const msPerFrame = 1000 / t.fps;
    const timeOf = (idx) => Math.round(idx * msPerFrame);

    const clusters = [];
    let cur = null;
    for (const s of S) {
      const tc = timeOf(s.idx);
      if (!cur || s.key || tc - cur.tc > 30000) clusters.push((cur = { tc, key: s.key, parts: [], size: 0 }));
      const rel = tc - cur.tc;
      const head = concat([ebmlId(0xa3), vint(4 + s.data.length), Uint8Array.of(0x81, (rel >> 8) & 255, rel & 255, s.key ? 0x80 : 0)]);
      cur.parts.push(head, s.data);
      cur.size += head.length + s.data.length;
    }
    const clusterParts = [];
    const clusterPos = [];
    let clusterBytes = 0;
    for (const c of clusters) {
      const tcEl = el(0xe7, eUint(c.tc));
      const header = concat([ebmlId(0x1f43b675), vint(tcEl.length + c.size)]);
      clusterPos.push(clusterBytes);
      clusterParts.push(header, tcEl, ...c.parts);
      clusterBytes += header.length + tcEl.length + c.size;
    }

    const app = ascii('pattern-generator');
    const info = el(0x1549a966, el(0x2ad7b1, eUint(1e6)), el(0x4489, eFloat((t.frames * 1000) / t.fps)), el(0x4d80, app), el(0x5741, app));
    const colr = colorCodes(t.colorSpace);
    const tracks = el(
      0x1654ae6b,
      el(
        0xae,
        el(0xd7, eUint(1)), // TrackNumber
        el(0x73c5, eUint(1)), // TrackUID
        el(0x83, eUint(1)), // TrackType: video
        el(0x9c, eUint(0)), // FlagLacing
        el(0x86, ascii(t.codecId)),
        el(0x23e383, eUint(Math.round(1e9 / t.fps))), // DefaultDuration (ns)
        el(
          0xe0,
          el(0xb0, eUint(t.width)),
          el(0xba, eUint(t.height)),
          colr
            ? el(0x55b0, el(0x55b1, eUint(colr.matrix)), el(0x55b9, eUint(colr.fullRange ? 2 : 1)), el(0x55ba, eUint(colr.transfer)), el(0x55bb, eUint(colr.primaries)))
            : []
        )
      )
    );
    const seekHead = (pos) =>
      el(0x114d9b74, ...[[0x1549a966, pos.info], [0x1654ae6b, pos.tracks], [0x1c53bb6b, pos.cues]].map(([id, p]) => el(0x4dbb, el(0x53ab, ebmlId(id)), el(0x53ac, eUint(p, 8)))));
    const seekLen = seekHead({ info: 0, tracks: 0, cues: 0 }).length;
    const first = seekLen + info.length + tracks.length; // first cluster, relative to the Segment payload
    const pos = { info: seekLen, tracks: seekLen + info.length, cues: first + clusterBytes };
    const cues = el(
      0x1c53bb6b,
      clusters.map((c, k) => (c.key ? el(0xbb, el(0xb3, eUint(c.tc)), el(0xb7, el(0xf7, eUint(1)), el(0xf1, eUint(first + clusterPos[k])))) : []))
    );
    const ebml = el(0x1a45dfa3, el(0x4286, eUint(1)), el(0x42f7, eUint(1)), el(0x42f2, eUint(4)), el(0x42f3, eUint(8)), el(0x4282, ascii('webm')), el(0x4287, eUint(4)), el(0x4285, eUint(2)));
    const segSize = pos.cues + cues.length;
    const segment = concat([ebmlId(0x18538067), vint(segSize, 8)]);
    return new Blob([ebml, segment, seekHead(pos), info, tracks, ...clusterParts, cues], { type: 'video/webm' });
  }

  /* ======================================================= codec choice */
  // H.264 levels: [level_idc, MaxMBPS, MaxFS (macroblocks), MaxBR (kbit/s, Main; High profile allows ×1.25)]
  const AVC_LEVELS = [
    [10, 1485, 99, 64], [11, 3000, 396, 192], [12, 6000, 396, 384], [13, 11880, 396, 768],
    [20, 11880, 396, 2000], [21, 19800, 792, 4000], [22, 20250, 1620, 4000],
    [30, 40500, 1620, 10000], [31, 108000, 3600, 14000], [32, 216000, 5120, 20000],
    [40, 245760, 8192, 20000], [41, 245760, 8192, 50000], [42, 522240, 8704, 50000],
    [50, 589824, 22080, 135000], [51, 983040, 36864, 240000], [52, 2073600, 36864, 240000],
    [60, 4177920, 139264, 240000], [61, 8355840, 139264, 480000], [62, 16711680, 139264, 800000],
  ];
  // VP9 levels: [level, max luma picture size, max luma sample rate]
  const VP9_LEVELS = [
    [10, 36864, 829440], [11, 73728, 2764800], [20, 122880, 4608000], [21, 245760, 9216000],
    [30, 552960, 20736000], [31, 983040, 36864000], [40, 2228224, 83558400], [41, 2228224, 160432128],
    [50, 8912896, 311951360], [51, 8912896, 588251136], [52, 8912896, 1176502272],
    [60, 35651584, 1176502272], [61, 35651584, 2353004544], [62, 35651584, 4706009088],
  ];
  const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');

  /** Codec candidates for a container, best first: [{ codec, codecId }]. */
  function candidates(container, w, h, fps, bitrate) {
    if (container === 'mp4') {
      const mbw = Math.ceil(w / 16), mbh = Math.ceil(h / 16), fs = mbw * mbh;
      const levels = AVC_LEVELS.filter(([, mbps, maxFs, br]) => {
        const side = Math.sqrt(maxFs * 8);
        return fs <= maxFs && mbw <= side && mbh <= side && fs * fps <= mbps && bitrate <= br * 1250;
      }).slice(0, 4);
      const out = [];
      for (const profile of ['6400', '4D00', '4200']) for (const [lv] of levels) out.push({ codec: `avc1.${profile}${hex2(lv)}`, codecId: 'avc1' });
      return out;
    }
    const lv = VP9_LEVELS.find(([, size, rate]) => w * h <= size && w * h * fps <= rate);
    return [{ codec: `vp09.00.${lv ? lv[0] : 62}.08`, codecId: 'V_VP9' }, { codec: 'vp8', codecId: 'V_VP8' }];
  }

  function makeConfig(c, w, h, fps, bitrate, hw) {
    const cfg = { codec: c.codec, width: w, height: h, framerate: fps, bitrate, bitrateMode: 'variable', latencyMode: 'quality', hardwareAcceleration: hw };
    if (c.codecId === 'avc1') cfg.avc = { format: 'avc' };
    return cfg;
  }

  /** First supported encoder config for the container, or null. */
  async function pick(container, w, h, fps, bitrate, hw) {
    for (const c of candidates(container, w, h, fps, bitrate)) {
      const config = makeConfig(c, w, h, fps, bitrate, hw);
      try {
        const r = await VideoEncoder.isConfigSupported(config);
        if (r && r.supported) return { container, codecId: c.codecId, config };
      } catch (e) {
        /* malformed for this browser — try the next one */
      }
    }
    return null;
  }

  const hasWebCodecs = () => typeof VideoEncoder === 'function' && typeof VideoFrame === 'function';

  let supportPromise = null;
  video.supported = function () {
    if (!supportPromise) {
      supportPromise = (async () => {
        if (!hasWebCodecs()) return { mp4: false, webm: false };
        const [mp4, webm] = await Promise.all([pick('mp4', 1280, 720, 30, 5e6, 'no-preference'), pick('webm', 1280, 720, 30, 5e6, 'no-preference')]);
        return { mp4: !!mp4, webm: !!webm };
      })().catch(() => ({ mp4: false, webm: false }));
    }
    return supportPromise;
  };

  /* ============================================================== encode */
  function abortError() {
    return new DOMException('Video encoding was cancelled', 'AbortError');
  }
  function encoderError(e) {
    const err = new Error('Video encoder error: ' + ((e && (e.message || e.name)) || String(e)));
    err.encoderFailure = true;
    err.cause = e;
    return err;
  }
  /** Yield to the event loop (MessageChannel isn't throttled in background tabs like setTimeout). */
  const yieldTask = () =>
    new Promise((r) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        r();
      };
      ch.port2.postMessage(0);
    });

  /** Wrap renderFrame's result in a VideoFrame of exactly W×H (cropping the right/bottom edge if larger). */
  function toVideoFrame(src, W, H, timestamp, duration, i) {
    if (typeof VideoFrame === 'function' && src instanceof VideoFrame) {
      try {
        return new VideoFrame(src, { timestamp, duration, visibleRect: { x: 0, y: 0, width: W, height: H } });
      } finally {
        src.close();
      }
    }
    const isCanvas =
      (typeof HTMLCanvasElement === 'function' && src instanceof HTMLCanvasElement) ||
      (typeof OffscreenCanvas === 'function' && src instanceof OffscreenCanvas) ||
      (typeof ImageBitmap === 'function' && src instanceof ImageBitmap);
    const sw = src ? src.width | 0 : 0, sh = src ? src.height | 0 : 0;
    if (sw < W || sh < H) throw new Error(`renderFrame(${i}) returned a ${sw}×${sh} image; ${W}×${H} is needed`);
    if (isCanvas) return new VideoFrame(src, { timestamp, duration, visibleRect: { x: 0, y: 0, width: W, height: H } });
    const data = src.data;
    if (!data || data.length < sw * sh * 4) throw new Error(`renderFrame(${i}) must return ImageData or { data (RGBA), width, height }`);
    let buf = data;
    if (sw !== W) {
      buf = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++) buf.set(data.subarray(y * sw * 4, y * sw * 4 + W * 4), y * W * 4);
    } else if (data.length !== W * H * 4) {
      buf = data.subarray(0, W * H * 4);
    }
    return new VideoFrame(buf, { format: 'RGBA', codedWidth: W, codedHeight: H, timestamp, duration });
  }

  async function runEncoder(o, choice, report) {
    const { W, H, fps, frames, renderFrame, signal } = o;
    const samples = [];
    const tsIndex = new Map();
    let decoderConfig = null;
    let failure = null;
    let waiter = null;
    const poke = () => {
      if (waiter) {
        const w = waiter;
        waiter = null;
        w();
      }
    };
    const wait = (ms) =>
      new Promise((r) => {
        const id = setTimeout(() => {
          waiter = null;
          r();
        }, ms);
        waiter = () => {
          clearTimeout(id);
          r();
        };
      });
    const check = () => {
      if (signal && signal.aborted) throw abortError();
      if (failure) throw failure;
    };

    const encoder = new VideoEncoder({
      output(chunk, meta) {
        try {
          if (meta && meta.decoderConfig && !decoderConfig) {
            decoderConfig = { description: copyBytes(meta.decoderConfig.description), colorSpace: meta.decoderConfig.colorSpace || null };
          }
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          const idx = tsIndex.has(chunk.timestamp) ? tsIndex.get(chunk.timestamp) : Math.round((chunk.timestamp * fps) / 1e6);
          samples.push({ data, key: chunk.type === 'key', idx });
          report(samples.length);
        } catch (e) {
          failure = failure || e;
        }
        poke();
      },
      error(e) {
        failure = failure || encoderError(e);
        poke();
      },
    });
    if ('ondequeue' in encoder) encoder.ondequeue = poke;
    if (signal) signal.addEventListener('abort', poke);
    try {
      try {
        encoder.configure(choice.config);
      } catch (e) {
        throw encoderError(e);
      }
      const gop = Math.max(1, Math.round(fps * KEY_SECONDS));
      const maxQueue = Math.max(2, Math.min(16, Math.floor(QUEUE_BYTES / (W * H * 4))));
      let lastYield = performance.now();
      for (let i = 0; i < frames; i++) {
        check();
        let src;
        try {
          src = await renderFrame(i);
        } catch (e) {
          if (e && e.name === 'AbortError') throw e;
          throw new Error(`renderFrame(${i}) failed: ${(e && e.message) || e}`);
        }
        check();
        const timestamp = Math.round((i * 1e6) / fps);
        const duration = Math.round(((i + 1) * 1e6) / fps) - timestamp;
        tsIndex.set(timestamp, i);
        const frame = toVideoFrame(src, W, H, timestamp, duration, i);
        try {
          encoder.encode(frame, { keyFrame: i % gop === 0 });
        } catch (e) {
          throw failure || encoderError(e);
        } finally {
          frame.close();
        }
        report(-1, i + 1);
        while (encoder.encodeQueueSize > maxQueue) {
          await wait(50);
          check();
        }
        if (performance.now() - lastYield > 40) {
          await yieldTask(); // let progress paint and encoder outputs arrive
          lastYield = performance.now();
        }
      }
      check();
      let done = false;
      let flushErr = null;
      encoder.flush().then(
        () => (done = true),
        (e) => {
          flushErr = e;
          done = true;
        }
      ).then(poke);
      while (!done) {
        await wait(100);
        check();
      }
      check();
      if (flushErr) throw encoderError(flushErr);
      encoder.close();
      if (!samples.length) throw encoderError('the encoder produced no frames');
      return { samples, decoderConfig };
    } finally {
      if (signal) signal.removeEventListener('abort', poke);
      if (encoder.state !== 'closed') {
        try {
          encoder.close();
        } catch (e) {
          /* already closed */
        }
      }
    }
  }

  /**
   * Encode `frames` frames from renderFrame(i) into an MP4 (H.264) or WebM (VP9) Blob.
   * Odd sizes are rounded down to even (right column / bottom row cropped). See the header for options.
   */
  video.encode = async function (opts) {
    const o = opts || {};
    const W = Math.floor(+o.width / 2) * 2;
    const H = Math.floor(+o.height / 2) * 2;
    const fps = +o.fps;
    const frames = Math.floor(+o.frames);
    if (!(W >= 2 && H >= 2)) throw new TypeError(`PG.video.encode: width/height must be ≥ 2 (got ${o.width}×${o.height})`);
    if (!(fps > 0 && fps <= 1000)) throw new TypeError(`PG.video.encode: bad fps ${o.fps}`);
    if (!(frames >= 1)) throw new TypeError(`PG.video.encode: frames must be ≥ 1 (got ${o.frames})`);
    if (typeof o.renderFrame !== 'function') throw new TypeError('PG.video.encode: renderFrame must be a function');
    const signal = o.signal || null;
    if (signal && signal.aborted) throw abortError();
    if (!hasWebCodecs()) throw new Error('This browser has no WebCodecs video encoder — use a recent Chrome, Edge or Safari');
    const format = o.format === 'mp4' || o.format === 'webm' ? o.format : 'auto';
    const bitrate = Math.round(o.bitrate > 0 ? Math.max(1e5, +o.bitrate) : Math.min(60e6, Math.max(4e6, 0.2 * W * H * fps)));

    let lastP = -1;
    const progress = (f) => {
      if (typeof o.onProgress !== 'function' || (f < 1 && f - lastP < 0.002)) return;
      lastP = f;
      try {
        o.onProgress(f);
      } catch (e) {
        /* UI errors must not break the encode */
      }
    };
    progress(0);

    // H.264 first (unless webm is forced), retrying in software if a hardware encoder dies; VP9/VP8 as the fallback.
    const attempts = [];
    if (format !== 'webm') attempts.push(['mp4', 'no-preference'], ['mp4', 'prefer-software']);
    if (format !== 'mp4') attempts.push(['webm', 'no-preference']);
    let lastErr = null;
    for (const [container, hw] of attempts) {
      const choice = await pick(container, W, H, fps, bitrate, hw);
      if (signal && signal.aborted) throw abortError();
      if (!choice) continue;
      let submitted = 0, written = 0;
      const report = (out, sub) => {
        if (out >= 0) written = out;
        if (sub != null) submitted = sub;
        progress(((submitted + written) / (2 * frames)) * 0.99);
      };
      const t0 = performance.now();
      try {
        const { samples, decoderConfig } = await runEncoder({ W, H, fps, frames, renderFrame: o.renderFrame, signal }, choice, report);
        const dc = decoderConfig || {};
        const meta = { width: W, height: H, fps, frames, samples, colorSpace: dc.colorSpace };
        const blob =
          container === 'mp4' ? muxMP4(Object.assign(meta, { description: dc.description })) : muxWebM(Object.assign(meta, { codecId: choice.codecId }));
        video.last = {
          container,
          codec: choice.config.codec,
          hardwareAcceleration: hw,
          width: W,
          height: H,
          fps,
          frames,
          encodedFrames: samples.length,
          keyFrames: samples.filter((s) => s.key).length,
          bitrate,
          bytes: blob.size,
          colorSpace: dc.colorSpace ? Object.assign({}, typeof dc.colorSpace.toJSON === 'function' ? dc.colorSpace.toJSON() : dc.colorSpace) : null,
          ms: Math.round(performance.now() - t0),
        };
        progress(1);
        return blob;
      } catch (e) {
        if ((signal && signal.aborted) || !e || !e.encoderFailure) throw signal && signal.aborted ? abortError() : e;
        lastErr = e;
        console.warn(`PG.video: ${choice.config.codec} (${hw}) failed — ${e.message}`);
      }
    }
    if (lastErr) throw lastErr;
    const what = format === 'auto' ? 'MP4 or WebM' : format.toUpperCase();
    throw new Error(`This browser can't encode ${what} video at ${W}×${H}, ${fps} fps`);
  };

  // exposed for tests
  video._mux = { mp4: muxMP4, webm: muxWebM };
  video._candidates = candidates;
})();
