/* Islamic Stars — classic star patterns built with Hankin's "polygons in contact" method.
 * A small JS solver lays a patch of a base tiling (4.8.8, 6.6.6, 4.6.12, or girih decagons + bowties), sends two
 * rays from every edge midpoint at the contact angle (plain stars, {n/s} chords or rosettes), then finds the strands,
 * their crossings (2-coloured so over/under alternates) and the faces they enclose. The part inside the mirror
 * group's fundamental domain (p4m / p6m triangle, pmm rectangle) is baked into a small data texture.
 * The shader folds each point into that domain, so a pixel only tests a handful of lines; the fold's mirror parity
 * flips over/under, which reproduces the alternating weave everywhere. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ vector helpers (JS side)
  const D2R = Math.PI / 180;
  const R3 = 1 / Math.sqrt(3);
  const dir = (a) => [Math.cos(a), Math.sin(a)];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, s) => [a[0] * s, a[1] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const crs = (a, b) => a[0] * b[1] - a[1] * b[0];
  const len = (a) => Math.hypot(a[0], a[1]);
  const nrm = (a) => mul(a, 1 / (len(a) || 1));

  function isect(p, d, q, e) {
    const den = crs(d, e);
    if (Math.abs(den) < 1e-12) return null;
    return add(p, mul(d, crs(sub(q, p), e) / den));
  }

  // ------------------------------------------------------------------ lattices + base tilings
  // F = fundamental domain of the mirror group (p4m triangle, p6m triangle, pmm rectangle);
  // copies = how many mirrored copies of F meet at each corner; order = which corner wins when a face holds several.
  const SQ = { kind: 0, a1: [1, 0], a2: [0, 1], F: [[0, 0], [0.5, 0], [0.5, 0.5]], copies: [8, 4, 8], order: [0, 2, 1] };
  const HX = { kind: 1, a1: [1, 0], a2: [0.5, Math.sqrt(3) / 2], F: [[0, 0], [0.5, 0], [0.5, 0.5 * R3]], copies: [12, 4, 6], order: [0, 2, 1] };
  // Girih: regular decagons (neighbours 1 apart) on a rhombic lattice, bowties in the gaps. Mirrors every GA in x, GB in y.
  const GE = Math.tan(Math.PI / 10); // decagon edge length for inradius 0.5
  const GA = Math.cos(Math.PI / 5), GB = Math.sin(Math.PI / 5);
  const RC = { kind: 2, a1: [2 * GA, 0], a2: [GA, GB], F: [[0, 0], [GA, 0], [GA, GB], [0, GB]], copies: [4, 4, 4, 4], order: [0, 2, 1, 3], K: 4 };

  // Girih bowtie (centred at the origin, pinched top and bottom) decorated at 54°: a strand runs straight across each
  // lobe between edge midpoints, and the rays aimed at the pinch points meet on the long axis → two kites.
  function bowtieSegs(theta) {
    const R = GE / (2 * Math.sin(Math.PI / 10));
    const pinch = GB - R, sx = R * Math.cos(Math.PI / 10) - GA, sy = R * Math.sin(Math.PI / 10);
    const v = [[sx, -sy], [0, -pinch], [-sx, -sy], [-sx, sy], [0, pinch], [sx, sy]]; // CCW
    const m = v.map((p, i) => mul(add(p, v[(i + 1) % 6]), 0.5));
    const t4 = nrm(sub(v[5], v[4])), in4 = [-t4[1], t4[0]];
    const XL = isect(m[4], add(mul(t4, -Math.cos(theta)), mul(in4, Math.sin(theta))), [0, 0], [1, 0]);
    const XR = [-XL[0], 0];
    return [[m[5], m[4]], [m[5], m[0]], [m[4], XL], [m[0], XL], [m[2], m[3]], [m[2], m[1]], [m[3], XR], [m[1], XR]];
  }

  // polygon: centre c, n sides, inradius r, phi0 = angle of the first edge normal (degrees)
  const TILINGS = {
    t488: {
      L: SQ,
      cell(o, push) {
        push(o, 8, 0.5, 0);
        push(add(o, [0.5, 0.5]), 4, Math.SQRT1_2 - 0.5, 45);
      },
    },
    t63: { L: HX, cell(o, push) { push(o, 6, 0.5, 0); } },
    t4612: {
      L: HX,
      cell(o, push) {
        const s = 0.5 / (0.5 / Math.tan(Math.PI / 12) + 0.5); // common edge length
        push(o, 12, 0.5 - s / 2, 0);
        for (let k = 0; k < 6; k++) push(add(o, mul(dir((30 + 60 * k) * D2R), R3)), 6, (s * Math.sqrt(3)) / 2, 30);
        for (let k = 0; k < 6; k++) push(add(o, mul(dir(60 * k * D2R), 0.5)), 4, s / 2, 60 * k);
      },
    },
    t10: {
      L: RC,
      cell(o, push) {
        push(o, 10, 0.5, 0);
        push(add(o, [GA, 0]), 0, 0, 0, bowtieSegs);
      },
    },
  };

  // Modes: base tiling + contact angle at sharpness 0 / 0.5 / 1. chord {n: s}: n-gons get straight {n/s} star
  // chords; rosette {n: true}: n-gons get a star ringed by petals (falls back to a plain star where impossible).
  // unit [size, strap]: per-style scale so Tile size / Strap width read the same in every style (4.6.12 has edges
  // half as long as 4.8.8, so its lattice is drawn larger and its straps thinner — otherwise switching Style clutters).
  const MODES = {
    eight: { tiling: 't488', theta: [42, 67.5, 80] },
    six: { tiling: 't63', theta: [36, 60, 78] },
    twelve: { tiling: 't4612', theta: [45, 66, 74], rosette: { 12: true }, unit: [1.5, 0.5] },
    girih: { tiling: 't10', theta: [54, 54, 54] }, // classic girih angle: strands cross every edge at 54°
    zellige: { tiling: 't488', theta: [67.5, 67.5, 67.5], chord: { 8: 3 } },
  };

  function contactAngle(m, sharp) {
    const t = m.theta;
    return sharp < 0.5 ? t[0] + (t[1] - t[0]) * sharp * 2 : t[1] + (t[2] - t[1]) * (sharp - 0.5) * 2;
  }

  // ------------------------------------------------------------------ solver
  function solve(modeId, sharp) {
    const mode = MODES[modeId] || MODES.eight;
    const T = TILINGS[mode.tiling];
    const L = T.L;
    const F = L.F;
    const Fc = mul(F.reduce((a, b) => add(a, b), [0, 0]), 1 / F.length);
    const theta = contactAngle(mode, sharp) * D2R;

    // 1. patch of polygons around F
    const polys = [];
    const seen = new Set();
    const K = L.K || 3;
    for (let i = -K; i <= K; i++)
      for (let j = -K; j <= K; j++) {
        const o = add(mul(L.a1, i), mul(L.a2, j));
        T.cell(o, (c, n, r, phi0, custom) => {
          if (len(sub(c, Fc)) > 1.7) return;
          const key = Math.round(c[0] * 1e4) + ',' + Math.round(c[1] * 1e4);
          if (seen.has(key)) return;
          seen.add(key);
          polys.push({ c, n, r, phi0, custom });
        });
      }

    // 2. Hankin rays (or straight {n/s} chords) → segments
    const segs = [];
    const ct = Math.cos(theta), st = Math.sin(theta);
    for (const P of polys) {
      if (P.custom) {
        for (const [a, b] of P.custom(theta)) segs.push([add(P.c, a), add(P.c, b)]);
        continue;
      }
      const n = P.n, M = [], Tg = [], IN = [];
      for (let k = 0; k < n; k++) {
        const phi = (P.phi0 + (360 * k) / n) * D2R;
        M.push(add(P.c, mul(dir(phi), P.r)));
        Tg.push(dir(phi + Math.PI / 2));
        IN.push(mul(dir(phi), -1));
      }
      const s = mode.chord && mode.chord[n];
      const ccw = (k) => add(mul(Tg[k], ct), mul(IN[k], st)); // ray from M_k towards the vertex after it
      const cw = (k) => add(mul(Tg[k], -ct), mul(IN[k], st)); // ray from M_k towards the vertex before it
      let rosette = mode.rosette && mode.rosette[n];
      if (rosette) {
        // only a rosette when the next-but-one meeting point lies beyond the first crossing (else plain Hankin)
        const P0 = isect(M[0], ccw(0), M[1], cw(1)), Q = isect(M[0], ccw(0), M[2], cw(2));
        rosette = P0 && Q && dot(sub(Q, M[0]), ccw(0)) > dot(sub(P0, M[0]), ccw(0)) + 1e-4 && len(sub(Q, P.c)) < P.r;
      }
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n, k2 = (k + 2) % n;
        if (s) {
          segs.push([M[k], M[(k + s) % n]]);
        } else if (rosette) {
          // rays run through their first crossing and stop where they meet the next-but-one ray:
          // an inner star ringed by petals (Lee / Kaplan rosette)
          const Q1 = isect(M[k], ccw(k), M[k2], cw(k2)); // on the axis through M_{k+1}
          const Q0 = isect(M[(k + n - 1) % n], ccw((k + n - 1) % n), M[k1], cw(k1)); // on the axis through M_k
          if (Q1 && Q0) segs.push([M[k], Q1], [M[k1], Q0]);
        } else {
          const X = isect(M[k], ccw(k), M[k1], cw(k1));
          if (X) segs.push([M[k], X], [M[k1], X]);
        }
      }
    }

    // 3. planar graph: vertices = endpoints + intersections
    const verts = [];
    const vmap = new Map();
    const vid = (p) => {
      const kx = Math.round(p[0] * 1e7), ky = Math.round(p[1] * 1e7);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const h = vmap.get(kx + dx + ',' + (ky + dy));
          if (h !== undefined) return h;
        }
      verts.push({ p, adj: [] });
      vmap.set(kx + ',' + ky, verts.length - 1);
      return verts.length - 1;
    };
    const onSeg = segs.map((s) => [{ t: 0, v: vid(s[0]) }, { t: 1, v: vid(s[1]) }]);
    for (let i = 0; i < segs.length; i++) {
      const [a, b] = segs[i];
      const d = sub(b, a);
      for (let j = i + 1; j < segs.length; j++) {
        const [c, e] = segs[j];
        if (Math.max(a[0], b[0]) < Math.min(c[0], e[0]) - 1e-9 || Math.max(c[0], e[0]) < Math.min(a[0], b[0]) - 1e-9) continue;
        if (Math.max(a[1], b[1]) < Math.min(c[1], e[1]) - 1e-9 || Math.max(c[1], e[1]) < Math.min(a[1], b[1]) - 1e-9) continue;
        const f = sub(e, c);
        const den = crs(d, f);
        if (Math.abs(den) < 1e-12) continue;
        const t = crs(sub(c, a), f) / den, u = crs(sub(c, a), d) / den;
        if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) continue;
        const v = vid(add(a, mul(d, t)));
        onSeg[i].push({ t, v });
        onSeg[j].push({ t: u, v });
      }
    }
    const edgeSet = new Set();
    for (const list of onSeg) {
      list.sort((x, y) => x.t - y.t);
      for (let k = 0; k + 1 < list.length; k++) {
        const v0 = list[k].v, v1 = list[k + 1].v;
        if (v0 === v1) continue;
        const key = v0 < v1 ? v0 + '_' + v1 : v1 + '_' + v0;
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        const dd = nrm(sub(verts[v1].p, verts[v0].p));
        verts[v0].adj.push({ to: v1, d: dd });
        verts[v1].adj.push({ to: v0, d: mul(dd, -1) });
      }
    }
    // vertex kinds: crossing (two straight lines), pass (straight, degree 2), bend, end
    for (const V of verts) {
      const a = V.adj;
      V.kind = 'end';
      if (a.length === 2) V.kind = dot(a[0].d, a[1].d) < -0.9999 ? 'pass' : 'bend';
      else if (a.length === 4) {
        V.kind = 'cross';
        V.line = [0, -1, -1, -1];
        for (let k = 1; k < 4; k++) if (dot(a[0].d, a[k].d) < -0.9999) V.line[k] = 0;
        let l = 1;
        for (let k = 1; k < 4; k++) if (V.line[k] < 0) V.line[k] = l;
        if (V.line.filter((x) => x === 0).length !== 2) V.kind = 'junk';
      } else if (a.length > 2) V.kind = 'junk';
    }
    const straight = (V, d) => V.adj.find((e) => dot(e.d, d) > 0.9999);

    // 4. runs = maximal straight paths (through crossings / passes), ending at bends
    const runOf = new Map();
    const runs = [];
    const ekey = (u, v) => u + '>' + v;
    for (let v0 = 0; v0 < verts.length; v0++) {
      for (const e0 of verts[v0].adj) {
        if (runOf.has(ekey(v0, e0.to))) continue;
        // walk backwards to the start of this straight run
        let start = v0, d = e0.d;
        for (let guard = 0; guard < 1000; guard++) {
          const V = verts[start];
          if (V.kind !== 'cross' && V.kind !== 'pass') break;
          const back = straight(V, mul(d, -1));
          if (!back) break;
          start = back.to;
        }
        const path = [start];
        let cur = start;
        for (let guard = 0; guard < 1000; guard++) {
          const e = straight(verts[cur], d);
          if (!e) break;
          path.push(e.to);
          cur = e.to;
          const V = verts[cur];
          if (V.kind !== 'cross' && V.kind !== 'pass') break;
        }
        const id = runs.length;
        runs.push({ path, a: verts[path[0]].p, b: verts[path[path.length - 1]].p });
        for (let k = 0; k + 1 < path.length; k++) {
          runOf.set(ekey(path[k], path[k + 1]), id);
          runOf.set(ekey(path[k + 1], path[k]), id);
        }
      }
    }

    // 5. alternate over/under: 2-colour (crossing, line) nodes. Same crossing → differ; next crossing along a strand → differ.
    const crossIdx = new Map();
    verts.forEach((V, i) => { if (V.kind === 'cross') crossIdx.set(i, crossIdx.size); });
    const nNodes = crossIdx.size * 2;
    const nbr = Array.from({ length: nNodes }, () => []);
    const link = (a, b) => { nbr[a].push(b); nbr[b].push(a); };
    for (const [vi, ci] of crossIdx) {
      link(ci * 2, ci * 2 + 1);
      const V = verts[vi];
      V.adj.forEach((e, k) => {
        let prev = vi, cur = e.to;
        for (let guard = 0; guard < 1000; guard++) {
          const W = verts[cur];
          if (W.kind === 'cross') {
            const kk = W.adj.findIndex((x) => x.to === prev);
            link(ci * 2 + V.line[k], crossIdx.get(cur) * 2 + W.line[kk]);
            break;
          }
          if (W.kind !== 'pass' && W.kind !== 'bend') break;
          const nx = W.adj.find((x) => x.to !== prev);
          prev = cur;
          cur = nx.to;
        }
      });
    }
    const color = new Int8Array(nNodes).fill(-1);
    let conflicts = 0;
    for (let s = 0; s < nNodes; s++) {
      if (color[s] >= 0) continue;
      color[s] = 0;
      const queue = [s];
      while (queue.length) {
        const x = queue.pop();
        for (const y of nbr[x]) {
          if (color[y] < 0) { color[y] = 1 - color[x]; queue.push(y); }
          else if (color[y] === color[x]) conflicts++;
        }
      }
    }

    // 6. fundamental triangle F: clip runs → face lines (+ half-plane cuts at bends inside F)
    const Fn = F.map((a, i) => {
      const b = F[(i + 1) % F.length];
      const t = nrm(sub(b, a));
      return { n: [t[1], -t[0]], c: dot([t[1], -t[0]], a), a, b }; // outward normal, inside: dot(n,p) <= c
    });
    const distToF = (p) => {
      let inside = true;
      for (const e of Fn) if (dot(e.n, p) - e.c > 0) inside = false;
      if (inside) return 0;
      let best = 1e9;
      for (const e of Fn) {
        const ab = sub(e.b, e.a);
        const h = Math.max(0, Math.min(1, dot(sub(p, e.a), ab) / dot(ab, ab)));
        best = Math.min(best, len(sub(p, add(e.a, mul(ab, h)))));
      }
      return best;
    };
    const onMirror = (p) => Fn.some((e) => Math.abs(dot(e.n, p) - e.c) < 1e-7);
    function clipLen(a, b) {
      let t0 = 0, t1 = 1;
      const d = sub(b, a);
      for (const e of Fn) {
        const num = e.c - dot(e.n, a), den = dot(e.n, d);
        if (Math.abs(den) < 1e-12) { if (num < 0) return 0; continue; }
        const t = num / den;
        if (den > 0) t1 = Math.min(t1, t); else t0 = Math.max(t0, t);
      }
      return Math.max(0, t1 - t0) * len(d);
    }
    function lineOf(run) {
      const d = nrm(sub(run.b, run.a));
      const n = [-d[1], d[0]];
      const cuts = [];
      for (const end of [0, 1]) {
        const vi = end === 0 ? run.path[0] : run.path[run.path.length - 1];
        const V = verts[vi];
        if (V.kind !== 'bend' || distToF(V.p) > 1e-9 || onMirror(V.p)) continue;
        const u = end === 0 ? d : mul(d, -1);
        const other = V.adj.find((e) => dot(e.d, u) < 0.9999);
        const b = nrm(add(u, other.d));
        const m = nrm(sub(u, mul(b, dot(u, b))));
        cuts.push([m[0], m[1], dot(m, V.p)]);
      }
      while (cuts.length < 2) cuts.push([0, 0, -1]);
      return { n, c: dot(n, run.a), cuts, run };
    }
    const lines = [];
    const lineIdx = new Map();
    runs.forEach((r, i) => {
      if (clipLen(r.a, r.b) > 1e-6) { lineIdx.set(i, lines.length); lines.push(lineOf(r)); }
    });
    const nFace = lines.length;
    if (nFace > 12) throw new Error('too many lines in the fundamental domain: ' + nFace);

    // crossings near F (their partner lines may lie outside F → appended as extra lines)
    const crossings = [];
    const runLine = (ri) => {
      if (!lineIdx.has(ri)) { lineIdx.set(ri, lines.length); lines.push(lineOf(runs[ri])); }
      return lineIdx.get(ri);
    };
    const runEvents = (ri) => runs[ri].path.filter((v, k, arr) => verts[v].kind === 'cross' || k === 0 || k === arr.length - 1);
    const cand = [];
    for (const [vi, ci] of crossIdx) {
      const d = distToF(verts[vi].p);
      if (d <= 0.2) cand.push({ vi, ci, d });
    }
    cand.sort((x, y) => x.d - y.d);
    for (const { vi, ci, d } of cand) {
      const V = verts[vi];
      const k0 = V.line.indexOf(0), k1 = V.line.indexOf(1);
      const r0 = runOf.get(ekey(vi, V.adj[k0].to)), r1 = runOf.get(ekey(vi, V.adj[k1].to));
      const extra = (lineIdx.has(r0) ? 0 : 1) + (lineIdx.has(r1) ? 0 : 1);
      if (crossings.length >= 40 || lines.length + extra > 50) break;
      const reach = (ri) => {
        let best = 1e9;
        for (const w of runEvents(ri)) if (w !== vi) best = Math.min(best, len(sub(verts[w].p, V.p)));
        return Math.min(0.9 * best, 1.9);
      };
      const over0 = color[ci * 2] === 1; // line 0 over (for mirror parity +1)
      const A = over0 ? r0 : r1, B = over0 ? r1 : r0;
      crossings.push({ p: V.p, a: runLine(A), b: runLine(B), ra: reach(A), rb: reach(B), d });
    }

    // 7. faces: arrangement of the face lines inside F (convex cells keyed by sign bits), merged where no strand separates them
    const area = (poly) => {
      let s = 0;
      for (let i = 0; i < poly.length; i++) s += crs(poly[i], poly[(i + 1) % poly.length]);
      return s / 2;
    };
    const centroid = (poly) => {
      let cx = 0, cy = 0, a = 0;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], w = crs(p, q);
        a += w; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w;
      }
      return [cx / (3 * a), cy / (3 * a)];
    };
    function split(poly, n, c) {
      const neg = [], pos = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const sp = dot(n, p) - c, sq = dot(n, q) - c;
        if (sp <= 0) neg.push(p);
        if (sp >= 0) pos.push(p);
        if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
          const x = add(p, mul(sub(q, p), sp / (sp - sq)));
          neg.push(x); pos.push(x);
        }
      }
      return [neg, pos];
    }
    let cells = [{ poly: F.map((p) => p.slice()), bits: 0 }];
    for (let i = 0; i < nFace; i++) {
      const out = [];
      for (const cell of cells) {
        const [ng, ps] = split(cell.poly, lines[i].n, lines[i].c);
        if (ng.length > 2 && area(ng) > 1e-11) out.push({ poly: ng, bits: cell.bits });
        if (ps.length > 2 && area(ps) > 1e-11) out.push({ poly: ps, bits: cell.bits | (1 << i) });
      }
      cells = out;
    }
    const parent = cells.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const walls = [];
    const valid = (ln, p) => ln.cuts.every((k) => k[0] * p[0] + k[1] * p[1] >= k[2] - 1e-7);
    function facet(ca, cb, ln) {
      const t = [-ln.n[1], ln.n[0]];
      const on = (poly) => poly.filter((p) => Math.abs(dot(ln.n, p) - ln.c) < 1e-9).map((p) => dot(t, p));
      const a = on(ca.poly), b = on(cb.poly);
      if (a.length < 2 || b.length < 2) return null;
      const lo = Math.max(Math.min(...a), Math.min(...b)), hi = Math.min(Math.max(...a), Math.max(...b));
      if (hi - lo < 1e-9) return null;
      const mid = add(mul(ln.n, ln.c), mul(t, (lo + hi) / 2));
      return { mid, length: hi - lo };
    }
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) {
        const x = cells[i].bits ^ cells[j].bits;
        if (!x || x & (x - 1)) continue;
        const k = 31 - Math.clz32(x);
        const f = facet(cells[i], cells[j], lines[k]);
        if (!f) continue;
        if (valid(lines[k], f.mid)) walls.push({ i, j, length: f.length });
        else parent[find(i)] = find(j);
      }
    const faceOf = new Map();
    const faces = [];
    cells.forEach((cell, i) => {
      const r = find(i);
      if (!faceOf.has(r)) { faceOf.set(r, faces.length); faces.push({ cells: [] }); }
      cell.face = faceOf.get(r);
      faces[cell.face].cells.push(cell);
    });
    // face centre (a point every mirrored copy agrees on) → per-tile random colours; real area → shape type
    for (const fc of faces) {
      let A = 0, cx = 0, cy = 0;
      for (const cell of fc.cells) {
        const a = area(cell.poly), c = centroid(cell.poly);
        A += a; cx += c[0] * a; cy += c[1] * a;
      }
      fc.area = A;
      let center = [cx / A, cy / A], copies = 1;
      const touch = Fn.map((e) => {
        const t = nrm(sub(e.b, e.a));
        let tot = 0;
        for (const cell of fc.cells) {
          const on = cell.poly.filter((p) => Math.abs(dot(e.n, p) - e.c) < 1e-9).map((p) => dot(t, p));
          if (on.length >= 2) tot += Math.max(...on) - Math.min(...on);
        }
        return tot > 1e-7;
      });
      let corner = -1;
      for (const ci of L.order) {
        const cp = F[ci];
        if (lines.slice(0, nFace).some((ln) => Math.abs(dot(ln.n, cp) - ln.c) < 1e-7)) continue;
        if (fc.cells.some((cell) => cell.poly.some((p) => len(sub(p, cp)) < 1e-9))) { corner = ci; break; }
      }
      if (corner >= 0) { center = F[corner].slice(); copies = L.copies[corner]; }
      else {
        const ei = touch.indexOf(true);
        if (ei >= 0) {
          const e = Fn[ei];
          center = sub(center, mul(e.n, dot(e.n, center) - e.c));
          copies = 2;
        }
      }
      fc.center = center;
      fc.real = A * copies;
    }
    const typeAreas = [];
    for (const fc of faces) {
      let t = typeAreas.findIndex((a) => Math.abs(a - fc.real) < 1e-4 * Math.max(a, fc.real));
      if (t < 0) { typeAreas.push(fc.real); t = typeAreas.length - 1; }
      fc.type0 = t;
    }
    const order = typeAreas.map((a, i) => i).sort((x, y) => typeAreas[y] - typeAreas[x]);
    const rank = [];
    order.forEach((t, r) => { rank[t] = r; });
    for (const fc of faces) fc.type = rank[fc.type0];
    // two-tone (checkerboard) parity of the faces
    const fadj = faces.map(() => []);
    let wallLen = 0;
    for (const w of walls) {
      const a = cells[w.i].face, b = cells[w.j].face;
      wallLen += w.length;
      if (a !== b) { fadj[a].push(b); fadj[b].push(a); }
    }
    faces.forEach((f) => { f.parity = -1; });
    for (let s = 0; s < faces.length; s++) {
      if (faces[s].parity >= 0) continue;
      faces[s].parity = 0;
      const q = [s];
      while (q.length) {
        const x = q.pop();
        for (const y of fadj[x]) if (faces[y].parity < 0) { faces[y].parity = 1 - faces[x].parity; q.push(y); }
      }
    }
    const Ftot = area(F);
    const typeFrac = typeAreas.map(() => 0);
    let oddFrac = 0;
    for (const fc of faces) {
      typeFrac[fc.type] += fc.area / Ftot;
      if (fc.parity) oddFrac += fc.area / Ftot;
    }
    const table = new Uint8Array(1 << nFace).fill(255);
    for (const cell of cells) table[cell.bits] = cell.face;

    // real-space weave (for checking the shader's mirror-parity rule)
    const weave = [];
    for (const [vi, ci] of crossIdx) {
      const V = verts[vi];
      const k = V.line.indexOf(color[ci * 2] === 1 ? 0 : 1);
      weave.push({ p: V.p, over: V.adj[k].d });
    }
    return { kind: L.kind, rect: [GA, GB], lines, nFace, crossings, faces, table, nTypes: typeAreas.length, typeFrac, oddFrac, density: wallLen / Ftot, conflicts, weave };
  }

  // ------------------------------------------------------------------ texture packing (two 16-bit values per texel, range ±2)
  const W = 256; // texels per row (keep in sync with is_faceAt)
  function bake(values) {
    const g = solve(values.mode, values.sharp);
    const tableRows = Math.max(1, Math.ceil(g.table.length / (W * 4)));
    const H = 5 + tableRows;
    const data = new Uint8Array(W * H * 4);
    const put = (row, x, a, b) => {
      const o = (row * W + x) * 4;
      const e = (v) => Math.max(0, Math.min(65535, Math.round(((v + 2) / 4) * 65535)));
      const ea = e(a), eb = e(b);
      data[o] = ea >> 8; data[o + 1] = ea & 255; data[o + 2] = eb >> 8; data[o + 3] = eb & 255;
    };
    const I = (n) => n / 32; // small integers
    put(0, 0, I(g.nFace), I(g.lines.length));
    put(0, 1, I(g.crossings.length), I(g.faces.length));
    put(0, 2, I(g.kind), I(g.nTypes));
    put(0, 3, Math.min(g.density / 4, 1.99), g.oddFrac);
    put(0, 4, g.rect[0], g.rect[1]);
    const unit = (MODES[values.mode] || MODES.eight).unit || [1, 1];
    put(0, 5, unit[0], unit[1]);
    g.typeFrac.slice(0, 32).forEach((f, i) => put(4, i, f, 0));
    g.lines.forEach((ln, i) => {
      const [c0, c1] = ln.cuts;
      put(1, i * 5, ln.n[0], ln.n[1]);
      put(1, i * 5 + 1, ln.c, c0[0]);
      put(1, i * 5 + 2, c0[1], c0[2]);
      put(1, i * 5 + 3, c1[0], c1[1]);
      put(1, i * 5 + 4, c1[2], 0);
    });
    g.crossings.forEach((x, i) => {
      put(2, i * 3, x.p[0], x.p[1]);
      put(2, i * 3 + 1, I(x.a), I(x.b));
      put(2, i * 3 + 2, x.ra, x.rb);
    });
    g.faces.slice(0, 64).forEach((f, i) => {
      put(3, i * 2, f.center[0], f.center[1]);
      put(3, i * 2 + 1, I(f.type), f.parity);
    });
    for (let e = 0; e < g.table.length; e++) data[(5 * W) * 4 + e] = g.table[e];
    return { width: W, height: H, data };
  }
  PG.islamicSolve = solve; // exposed for debugging in the console

  const hasStraps = (v) => v.strap > 0;
  const fillIs = (...m) => (v) => m.includes(v.fill);

  PG.registerPattern({
    id: 'islamic',
    name: 'Islamic Stars',
    category: 'Geometric',
    description: 'Classic Islamic and Moroccan star patterns: 8-, 6- and 12-fold stars, girih strapwork with over-under weaving, zellige mosaics.',
    params: [
      { type: 'heading', label: 'Pattern' },
      {
        id: 'mode',
        label: 'Style',
        type: 'select',
        options: [
          ['eight', '8-fold star & cross'],
          ['six', '6-fold hexagrams'],
          ['twelve', '12-fold rosettes'],
          ['girih', 'Girih strapwork'],
          ['zellige', 'Zellige mosaic'],
        ],
        default: 'eight',
      },
      { id: 'size', label: 'Tile size', min: 0.05, max: 4, default: 0.65, step: 0.001, scale: 'log', random: [0.45, 1.2] },
      {
        id: 'sharp', label: 'Star sharpness', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.25, 0.8],
        showIf: (v) => v.mode === 'eight' || v.mode === 'six' || v.mode === 'twelve',
        help: 'Hankin contact angle: how steeply the strands leave each edge. 0.5 = the classic star',
      },
      { id: 'angle', label: 'Rotation', min: -180, max: 180, default: 0, step: 1, unit: '°', random: false },

      { type: 'heading', label: 'Straps' },
      { id: 'strap', label: 'Strap width', min: 0, max: 0.14, default: 0.045, step: 0.001, random: [0.02, 0.08], help: '0 = plain lines (grout / line art)' },
      { id: 'outline', label: 'Outline / grout', min: 0, max: 0.03, default: 0.008, step: 0.0005, random: [0.003, 0.012] },
      { id: 'interlace', label: 'Interlace', type: 'bool', default: true, random: 0.6, help: 'Strands weave alternately over and under each other' },
      { id: 'shadow', label: 'Weave shadow', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.2, 0.8], showIf: (v) => v.interlace },
      { id: 'bevel', label: 'Strap relief', min: 0, max: 1, default: 0.35, step: 0.01, random: [0, 0.7], showIf: hasStraps },

      { type: 'heading', label: 'Color' },
      {
        id: 'fill',
        label: 'Fill',
        type: 'select',
        options: [
          ['solid', 'Plain ground'],
          ['twotone', 'Two-tone'],
          ['shape', 'Palette by shape'],
          ['random', 'Palette, random tiles'],
          ['gradient', 'Gradient sweep'],
        ],
        default: 'shape',
        random: ['shape', 'shape', 'random', 'random', 'twotone', 'solid', 'gradient'],
      },
      { id: 'palette', label: 'Palette', type: 'palette', default: ['#1c4f8f', '#1e6f5c', '#d8a23a', '#b4472e', '#0f2a4f'], showIf: fillIs('shape', 'random') },
      { id: 'gradient', label: 'Gradient', type: 'gradient', default: 'Ocean', showIf: fillIs('gradient') },
      { id: 'bgColor', label: 'Ground', type: 'color', default: '#14284a', random: 'dark', showIf: fillIs('solid', 'twotone') },
      { id: 'altColor', label: 'Second ground', type: 'color', default: '#2f6f8f', random: 'mid', showIf: fillIs('twotone') },
      { id: 'strapColor', label: 'Strap', type: 'color', default: '#f4ecd8', random: 'light', showIf: hasStraps },
      { id: 'lineColor', label: 'Outline / grout', type: 'color', default: '#1b1a1f', random: 'dark' },
      { id: 'variation', label: 'Tile variation', min: 0, max: 1, default: 0.15, step: 0.01, random: [0, 0.4], help: 'Random shade per tile, like hand-glazed zellige' },
      { id: 'glaze', label: 'Glaze', min: 0, max: 1, default: 0.3, step: 0.01, random: [0, 0.6], help: 'Soft shading towards the edges of every tile' },
      { id: 'shimmer', label: 'Shimmer', min: 0, max: 1, default: 0.4, step: 0.01, random: [0, 0.7], help: 'A glint of light sweeping across (when Animate is on)' },
    ],
    presets: [
      { name: 'Moroccan Star', thumb: true, values: {} },
      {
        name: 'Zellige Tiles',
        values: {
          mode: 'zellige', size: 0.9, strap: 0, outline: 0.009, interlace: false, fill: 'shape',
          palette: ['#f5f1e6', '#1d5fa8', '#1f7a4f', '#d9a441', '#0f2f5c', '#f5f1e6'], lineColor: '#ece6d8', variation: 0.25, glaze: 0.45,
        },
      },
      {
        name: 'Gold Strapwork',
        values: {
          mode: 'girih', size: 1.1, strap: 0.038, outline: 0.006, interlace: true, shadow: 0.6, bevel: 0.6, fill: 'twotone',
          bgColor: '#0e1a3a', altColor: '#15244b', strapColor: '#d9ad4c', lineColor: '#2a1a05', variation: 0.1, glaze: 0.35,
        },
      },
      {
        name: 'Alhambra',
        values: {
          mode: 'eight', size: 0.6, sharp: 0.5, strap: 0.036, outline: 0.007, interlace: true, shadow: 0.45, bevel: 0.25, fill: 'random',
          palette: ['#1f5d4a', '#c9822e', '#23262e', '#2d5c8a', '#f1e9d6', '#8a2d22'], strapColor: '#f5efe0', lineColor: '#1d1b19', variation: 0.15, glaze: 0.3,
        },
      },
      {
        name: 'Hexagram',
        values: {
          mode: 'six', size: 0.55, sharp: 0.5, strap: 0.05, outline: 0.008, interlace: true, shadow: 0.5, bevel: 0.3, fill: 'twotone',
          bgColor: '#7a1f2b', altColor: '#e8c37a', strapColor: '#f7f0e1', lineColor: '#2a0f12', variation: 0.05, glaze: 0.2,
        },
      },
      {
        name: 'Twelve Rosettes',
        values: {
          mode: 'twelve', size: 0.667, sharp: 0.62, strap: 0.044, outline: 0.006, interlace: true, shadow: 0.4, bevel: 0.3, fill: 'shape',
          palette: ['#0b4f6c', '#2e6e65', '#e0a458', '#c8553d', '#3d2c3e'], strapColor: '#fbf6ea', lineColor: '#1a1414', variation: 0.08, glaze: 0.25,
        },
      },
      {
        name: 'Persian Girih',
        values: {
          mode: 'girih', size: 0.85, strap: 0.04, outline: 0.007, interlace: true, shadow: 0.45, bevel: 0.3, fill: 'shape',
          palette: ['#1e3f8a', '#2b9c9a', '#e9b949', '#b5452f'], strapColor: '#f4efe3', lineColor: '#1b1b22', variation: 0.12, glaze: 0.35,
        },
      },
      {
        name: 'Monochrome Lines',
        values: {
          mode: 'eight', size: 0.6, strap: 0.03, outline: 0.0045, interlace: true, shadow: 0, bevel: 0, fill: 'solid',
          bgColor: '#f6f3ec', strapColor: '#f6f3ec', lineColor: '#141414', variation: 0, glaze: 0,
        },
      },
    ],
    textures: [{ id: 'geo', deps: ['mode', 'sharp'], filter: 'nearest', wrap: 'clamp', build: bake }],
    glsl: /* glsl */ `
// ---- baked geometry (see bake()): two 16-bit values per texel, range ±2
vec2 is_val(int x, int row) {
  vec4 t = floor(texelFetch(u_geo, ivec2(x, int(u_geo_size.y) - 1 - row), 0) * 255.0 + 0.5);
  return vec2(t.r * 256.0 + t.g, t.b * 256.0 + t.a) / 65535.0 * 4.0 - 2.0;
}
int is_int(float v) { return int(floor(v * 32.0 + 0.5)); }
int is_faceAt(int bits) {
  int x = bits >> 2;
  vec4 t = texelFetch(u_geo, ivec2(x % 256, int(u_geo_size.y) - 1 - (5 + x / 256)), 0);
  int c = bits & 3;
  float b = c == 0 ? t.r : c == 1 ? t.g : c == 2 ? t.b : t.a;
  return int(floor(b * 255.0 + 0.5));
}
vec3 is_line(int i) { vec2 a = is_val(i * 5, 1), b = is_val(i * 5 + 1, 1); return vec3(a, b.x); }

// ---- fold into the fundamental domain of p4m (square), p6m (hex) or pmm (girih rectangle rs).
// Keeps what's needed to unfold: real = is_cell + is_unfoldDir(folded); is_par = mirror parity (flips over/under).
vec2 is_cell; float is_par; vec2 is_sgn; bool is_swap = false; float is_k; bool is_mir;
vec2 is_fold(vec2 q, int kind, vec2 rs) {
  if (kind == 2) {
    vec2 ix = floor(q / rs), odd = mod(ix, 2.0), l = q - ix * rs;
    is_sgn = 1.0 - 2.0 * odd;
    is_cell = (ix + odd) * rs;
    is_par = is_sgn.x * is_sgn.y;
    return mix(l, rs - l, odd);
  }
  if (kind == 0) {
    is_cell = floor(q + 0.5);
    vec2 l = q - is_cell;
    is_sgn = vec2(l.x < 0.0 ? -1.0 : 1.0, l.y < 0.0 ? -1.0 : 1.0);
    vec2 a = abs(l);
    is_swap = a.y > a.x;
    is_par = is_sgn.x * is_sgn.y * (is_swap ? -1.0 : 1.0);
    return is_swap ? a.yx : a;
  }
  vec4 h = pg_hexGrid(q);
  is_cell = q - h.xy;
  is_k = floor(atan(h.y, h.x + 1e-9) / (PG_PI / 3.0));   // +1e-9: atan(0, 0) is undefined
  vec2 r = pg_rot(-is_k * PG_PI / 3.0) * h.xy;
  is_mir = r.y > r.x * 0.57735027;
  if (is_mir) r = vec2(0.5 * r.x + 0.8660254 * r.y, 0.8660254 * r.x - 0.5 * r.y);
  is_par = is_mir ? -1.0 : 1.0;
  return r;
}
// linear part of the unfold (directions); add is_cell for points
vec2 is_unfoldDir(vec2 v, int kind) {
  if (kind != 1) return (is_swap ? v.yx : v) * is_sgn;
  if (is_mir) v = vec2(0.5 * v.x + 0.8660254 * v.y, 0.8660254 * v.x - 0.5 * v.y);
  return pg_rot(is_k * PG_PI / 3.0) * v;
}

vec3 is_palAvg() {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 16; i++) { if (i >= u_palette_count) break; s += u_palette[i]; }
  return s / float(max(u_palette_count, 1));
}

// Fill colour of face f. inst = random per tile instance, along = gradient position.
vec3 is_faceColor(int type, float parity, float inst, float along) {
  vec3 c;
  if (u_fill == FILL_SOLID) c = u_bgColor;
  else if (u_fill == FILL_TWOTONE) c = parity > 0.5 ? u_altColor : u_bgColor;
  else if (u_fill == FILL_SHAPE) c = u_palette[pg_wrapi(type, u_palette_count)];
  else if (u_fill == FILL_RANDOM) c = u_palette[pg_wrapi(int(floor(inst * float(u_palette_count))), u_palette_count)];
  else c = pg_grad(u_gradient, 1.0 - abs(fract(along) * 2.0 - 1.0));
  return c;
}

vec3 is_strapShade(vec3 base, float s, float w, vec2 nReal) {
  if (w <= 0.0) return base;
  float t = clamp(s / w, -1.0, 1.0);
  vec2 L = normalize(vec2(-0.6, 0.8));
  float lit = dot(nReal * sign(s), L) * pow(abs(t), 0.7);
  return base * (1.0 + u_bevel * (0.42 * lit - 0.18 * t * t));
}

vec4 pattern(vec2 p) {
  vec2 h0 = is_val(0, 0), h1 = is_val(1, 0), h2 = is_val(2, 0), h3 = is_val(3, 0), unit = is_val(5, 0);
  float S = u_size * unit.x;                // lattice → pattern units (per-style scale, see MODES.unit)
  vec2 q = pg_rot(-radians(u_angle)) * p / S;
  int nf = is_int(h0.x), nx = is_int(h1.x), kind = is_int(h2.x), ntypes = is_int(h2.y);
  vec2 f = is_fold(q, kind, is_val(4, 0));

  float w = 0.5 * u_strap * unit.y, o = u_outline;
  float gap = o * 1.6 * (1.0 - smoothstep(0.0, 2.0 * o + 1e-5, w));   // line art: open a gap where a strand dives under

  // ---- union of all strands (mitred at bends via the half-plane cuts)
  float dmin = 1e3, smin = 1.0; vec2 nmin = vec2(0.0, 1.0); int kmin = 0;
  int bits = 0;
  for (int i = 0; i < 12; i++) {
    if (i >= nf) break;
    vec2 a = is_val(i * 5, 1), b = is_val(i * 5 + 1, 1), c = is_val(i * 5 + 2, 1), d = is_val(i * 5 + 3, 1), e = is_val(i * 5 + 4, 1);
    float s = dot(a, f) - b.x;
    if (s > 0.0) bits |= 1 << i;
    bool ok = dot(vec2(b.y, c.x), f) >= c.y - 1e-4 && dot(d, f) >= e.x - 1e-4;
    float dd = ok ? abs(s) : 1e3;
    if (dd < dmin) { dmin = dd; smin = s; nmin = a; kmin = i; }
  }

  // ---- face (tile) colour, with the neighbouring face across the nearest strand for an anti-aliased boundary
  int fid = is_faceAt(bits);
  int fid2 = is_faceAt(bits ^ (1 << kmin));
  if (fid > 63) fid = fid2 > 63 ? 0 : fid2;
  if (fid2 > 63) fid2 = fid;
  vec3 tile[2];
  float inst0 = 0.0;
  for (int k = 0; k < 2; k++) {
    int id = k == 0 ? fid : fid2;
    vec2 cc = is_val(id * 2, 3), tp = is_val(id * 2 + 1, 3);
    vec2 cReal = is_cell + is_unfoldDir(cc, kind);
    vec2 key = floor(cReal * 32.0 + 0.5);
    vec3 hh = pg_hash32(key);
    if (k == 0) inst0 = hh.y;
    float along = dot(cReal, vec2(0.8, 0.6)) / 7.0;
    vec3 c = is_faceColor(is_int(tp.x), tp.y, hh.x, along);
    c *= 1.0 + u_variation * (hh.z - 0.5) * 0.55;
    tile[k] = c;
  }
  vec3 col = mix(tile[1], tile[0], pg_fill(-dmin * S));
  // glaze: tiles darken a little towards their edges and catch a soft highlight
  float edge = dmin - w - o;
  col *= 1.0 - u_glaze * 0.26 * exp(-max(edge, 0.0) / 0.035);
  col += u_glaze * 0.07 * smoothstep(0.02, 0.09, edge) * (0.6 + 0.4 * inst0);
  vec3 ground = col;

  // ---- strands
  vec2 nReal = is_unfoldDir(nmin, kind);
  nReal = pg_rot(radians(u_angle)) * nReal;
  col = mix(col, u_lineColor, pg_line(dmin * S, (w + o) * S));
  col = mix(col, is_strapShade(u_strapColor, smin, w, nReal), pg_line(dmin * S, w * S));

  // ---- over-under: at each nearby crossing redraw the upper strand across the lower one
  if (u_interlace > 0.5) {
    float reach = 4.0 * (w + o + gap) + 0.12;
    for (int j = 0; j < 40; j++) {
      if (j >= nx) break;
      vec2 X = is_val(j * 3, 2);
      if (length(f - X) > reach) continue;
      vec2 ab = is_val(j * 3 + 1, 2), rr = is_val(j * 3 + 2, 2);
      bool aOver = is_par > 0.0;
      vec3 lo = is_line(is_int(aOver ? ab.x : ab.y));
      vec3 lu = is_line(is_int(aOver ? ab.y : ab.x));
      float rmax = aOver ? rr.x : rr.y;
      float so = dot(lo.xy, f) - lo.z, su = dot(lu.xy, f) - lu.z;
      float along = abs(dot(f - X, vec2(-lo.y, lo.x)));
      float m = pg_fill((abs(su) - w - o - gap) * S) * (1.0 - smoothstep(0.75 * rmax, rmax, along));
      if (m <= 0.0) continue;
      float under = pg_fill((abs(su) - w - o) * S);
      float sh = u_shadow * exp(-max(abs(so) - w - o, 0.0) / (0.7 * w + 0.012)) * under;
      vec3 pc = col * (1.0 - 0.75 * sh);
      if (gap > 0.0) pc = mix(pc, ground, pg_fill((abs(so) - w - o - gap) * S));
      vec2 nr = pg_rot(radians(u_angle)) * is_unfoldDir(lo.xy, kind);
      pc = mix(pc, u_lineColor, pg_line(so * S, (w + o) * S));
      pc = mix(pc, is_strapShade(u_strapColor, so, w, nr), pg_line(so * S, w * S));
      col = mix(col, pc, m);
    }
  }

  // ---- shimmer: a glint sweeping across (Animate). Everything repeats every 6 s (= the default video length) and
  // the glint eases out to nothing at t ≡ 0 (mod 6), so stills (t = 0) stay clean AND straight / boomerang loops that
  // start at t = 0 close without a pop (a hard "u_time > 0" gate would drop the glint on frame 0 only).
  float tl = mod(u_time, 6.0);
  float env = smoothstep(0.0, 1.0, tl) * (1.0 - smoothstep(5.0, 6.0, tl));
  if (u_shimmer > 0.0 && env > 0.0) {
    float ph = fract(dot(q, vec2(0.7071, 0.7071)) / 6.0 - u_time / 6.0);
    float g = exp(-pow((ph - 0.5) * 9.0, 2.0));
    float onStrap = pg_line(dmin * S, w * S);
    col += u_shimmer * env * g * (0.28 * onStrap + 0.08) * vec3(1.0, 0.95, 0.85);
  }

  // ---- far away (tiles only a few pixels big): settle on the average colour instead of moiré
  float fade = smoothstep(0.12, 0.4, pg_px * pg_ss / S);
  if (fade > 0.0) {
    vec3 avg;
    if (u_fill == FILL_SOLID) avg = u_bgColor;
    else if (u_fill == FILL_TWOTONE) avg = mix(u_bgColor, u_altColor, h3.y);
    else if (u_fill == FILL_SHAPE) {
      avg = vec3(0.0);
      for (int t = 0; t < 32; t++) { if (t >= ntypes) break; avg += is_val(t, 4).x * u_palette[pg_wrapi(t, u_palette_count)]; }
    } else if (u_fill == FILL_RANDOM) avg = is_palAvg();
    else avg = (pg_grad(u_gradient, 0.1) + pg_grad(u_gradient, 0.3) + pg_grad(u_gradient, 0.5) + pg_grad(u_gradient, 0.7) + pg_grad(u_gradient, 0.9)) * 0.2;
    float dens = h3.x * 4.0;
    float lineFrac = clamp(dens * 2.0 * (w + o), 0.0, 1.0);
    vec3 lineAvg = mix(u_strapColor, u_lineColor, o / max(w + o, 1e-5));
    col = mix(col, mix(avg, lineAvg, lineFrac), fade);
  }
  return vec4(col, 1.0);
}
`,
  });
})();
