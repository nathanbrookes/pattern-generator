/* QR Code encoder (ISO/IEC 18004), written from scratch for the 2D Barcodes pattern.
 * Byte mode (UTF-8), error correction L/M/Q/H, versions 1–40, Reed–Solomon over GF(256),
 * format + version info, all 8 masks with penalty-based selection. No dependencies.
 *
 *   PG.qr.encode(text, ecc = 'M') → { size, version, ecc, mask, modules }
 *     modules: boolean[size][size], row-major (modules[y][x]), y = 0 is the TOP row, true = dark.
 *   Throws if the text does not fit in a version-40 symbol at the requested level. */
(function (root) {
  'use strict';
  const PG = (root.PG = root.PG || {});

  const LEVELS = { L: 0, M: 1, Q: 2, H: 3 };
  const FORMAT_BITS = [1, 0, 3, 2]; // 2-bit ECC indicator for L, M, Q, H

  // Per version (index 1..40): ECC codewords per block, and number of blocks.
  // prettier-ignore
  const ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  ];
  // prettier-ignore
  const NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  ];

  /* ---- capacity */
  // Modules available for data + ECC (everything that is not a function pattern / format / version info).
  function numRawDataModules(ver) {
    let n = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      n -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) n -= 36;
    }
    return n;
  }
  const numDataCodewords = (ver, ecl) => Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];

  function alignmentPositions(ver) {
    if (ver === 1) return [];
    const size = ver * 4 + 17;
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    const out = [6];
    for (let pos = size - 7; out.length < numAlign; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  /* ---- text → bytes */
  function utf8Bytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
        const d = str.charCodeAt(i + 1);
        if (d >= 0xdc00 && d < 0xe000) {
          c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
          i++;
        }
      }
      if (c >= 0xd800 && c < 0xe000) c = 0xfffd; // lone surrogate
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  /* ---- Reed–Solomon over GF(256), primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D) */
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  // Generator polynomial of the given degree, coefficients from highest to lowest power (leading 1 omitted).
  function rsDivisor(degree) {
    const r = new Array(degree).fill(0);
    r[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < r.length; j++) {
        r[j] = gfMul(r[j], root);
        if (j + 1 < r.length) r[j] ^= r[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, divisor) {
    const r = new Array(divisor.length).fill(0);
    for (const b of data) {
      const factor = b ^ r.shift();
      r.push(0);
      for (let i = 0; i < r.length; i++) r[i] ^= gfMul(divisor[i], factor);
    }
    return r;
  }

  // Split data codewords into blocks, append each block's ECC, interleave.
  function addEccAndInterleave(data, ver, ecl) {
    const numBlocks = NUM_BLOCKS[ecl][ver];
    const eccLen = ECC_PER_BLOCK[ecl][ver];
    const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    const numShort = numBlocks - (rawCodewords % numBlocks);
    const shortLen = Math.floor(rawCodewords / numBlocks);
    const divisor = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, divisor);
      if (i < numShort) dat.push(0); // placeholder so all blocks have equal length
      blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++) {
      for (let j = 0; j < blocks.length; j++) {
        if (i !== shortLen - eccLen || j >= numShort) out.push(blocks[j][i]);
      }
    }
    return out;
  }

  /* ---- masks & penalty */
  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const FINDER_A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const FINDER_B = FINDER_A.slice().reverse();

  function penalty(m, n) {
    let score = 0;
    const at = (horiz, i, j) => (j < 0 || j >= n ? false : horiz ? m[i][j] : m[j][i]);
    for (let pass = 0; pass < 2; pass++) {
      const horiz = pass === 0;
      for (let i = 0; i < n; i++) {
        // N1: runs of ≥5 same-colour modules
        let runColor = at(horiz, i, 0);
        let run = 0;
        for (let j = 0; j < n; j++) {
          const c = at(horiz, i, j);
          if (c === runColor) run++;
          else {
            if (run >= 5) score += run - 2;
            runColor = c;
            run = 1;
          }
        }
        if (run >= 5) score += run - 2;
        // N3: 1:1:3:1:1 finder-like pattern with 4 light modules on one side (outside the symbol counts as light)
        for (let j = -10; j < n; j++) {
          let a = true;
          let b = true;
          for (let k = 0; k < 11 && (a || b); k++) {
            const c = at(horiz, i, j + k) ? 1 : 0;
            if (c !== FINDER_A[k]) a = false;
            if (c !== FINDER_B[k]) b = false;
          }
          if (a) score += 40;
          if (b) score += 40;
        }
      }
    }
    // N2: 2×2 blocks of one colour
    let dark = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (m[y][x]) dark++;
        if (x < n - 1 && y < n - 1) {
          const c = m[y][x];
          if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
        }
      }
    }
    // N4: dark/light balance
    const total = n * n;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }

  /* ---- symbol construction */
  function encode(text, ecc) {
    const lvl = String(ecc == null ? 'M' : ecc).toUpperCase();
    const ecl = LEVELS[lvl];
    if (ecl === undefined) throw new Error(`Unknown QR error-correction level "${ecc}" (use L, M, Q or H)`);
    const bytes = utf8Bytes(String(text == null ? '' : text));

    // Smallest version that fits: mode (4 bits) + count (8 or 16 bits) + data.
    let ver = 1;
    for (; ver <= 40; ver++) {
      if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= numDataCodewords(ver, ecl) * 8) break;
    }
    if (ver > 40) {
      const max = numDataCodewords(40, ecl) - 3;
      throw new Error(`QR text too long: ${bytes.length} bytes (max ${max} at ECC ${lvl})`);
    }

    // Bit stream: byte mode, count, data, terminator, byte padding, pad codewords.
    const capBits = numDataCodewords(ver, ecl) * 8;
    const bits = [];
    const put = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    put(0b0100, 4);
    put(bytes.length, ver < 10 ? 8 : 16);
    for (const b of bytes) put(b, 8);
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
    const dataCodewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
      dataCodewords.push(v);
    }
    const codewords = addEccAndInterleave(dataCodewords, ver, ecl);

    const size = ver * 4 + 17;
    const mod = [];
    const fn = [];
    for (let y = 0; y < size; y++) {
      mod.push(new Array(size).fill(false));
      fn.push(new Array(size).fill(false));
    }
    const setF = (x, y, dark) => {
      mod[y][x] = dark;
      fn[y][x] = true;
    };

    // Timing patterns (finders/alignment drawn over them).
    for (let i = 0; i < size; i++) {
      setF(6, i, i % 2 === 0);
      setF(i, 6, i % 2 === 0);
    }
    // Finder patterns + separators.
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          setF(x, y, d !== 2 && d !== 4);
        }
      }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);
    // Alignment patterns (all grid combinations except the three finder corners).
    const al = alignmentPositions(ver);
    const na = al.length;
    for (let i = 0; i < na; i++) {
      for (let j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) setF(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
    // Format info (15 bits, BCH(15,5) + mask 0x5412), both copies + the always-dark module.
    const drawFormat = (mask) => {
      const data = (FORMAT_BITS[ecl] << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((data << 10) | rem) ^ 0x5412;
      const bit = (i) => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
      setF(8, 7, bit(6));
      setF(8, 8, bit(7));
      setF(7, 8, bit(8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
      setF(8, size - 8, true);
    };
    drawFormat(0); // reserve the area; redrawn with the real mask below
    // Version info (18 bits, BCH(18,6)) for versions ≥ 7.
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const b = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const dark = ((b >>> i) & 1) !== 0;
        const a = size - 11 + (i % 3);
        const c = Math.floor(i / 3);
        setF(a, c, dark);
        setF(c, a, dark);
      }
    }

    // Codewords in the zig-zag order (2-module columns, right to left, skipping the vertical timing column).
    let bi = 0;
    const totalBits = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const upward = ((right + 1) & 2) === 0;
      for (let v = 0; v < size; v++) {
        const y = upward ? size - 1 - v : v;
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          if (fn[y][x]) continue;
          if (bi < totalBits) mod[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
          bi++; // remainder bits stay light
        }
      }
    }

    // Choose the mask with the lowest penalty.
    const applyMask = (k) => {
      const f = MASKS[k];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && f(x, y)) mod[y][x] = !mod[y][x];
    };
    let best = 0;
    let bestScore = Infinity;
    for (let k = 0; k < 8; k++) {
      applyMask(k);
      drawFormat(k);
      const s = penalty(mod, size);
      if (s < bestScore) {
        bestScore = s;
        best = k;
      }
      applyMask(k); // undo (XOR)
    }
    applyMask(best);
    drawFormat(best);

    return { size, version: ver, ecc: lvl, mask: best, modules: mod };
  }

  PG.qr = { encode, capacity: (ver, ecc) => numDataCodewords(ver, LEVELS[String(ecc).toUpperCase()]) - (ver < 10 ? 2 : 3) };
})(typeof window !== 'undefined' ? window : globalThis);
