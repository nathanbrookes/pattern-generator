/* Make Your Own — upload one tile image (or pick a sample) and it repeats into a pattern.
 * Layouts: grid, brick, half-drop, mirror, pinwheel (p4; a windmill around small squares for rectangular tiles),
 * random turns (any tile → Truchet; half turns + flips for rectangles), herringbone, basket weave, diamond, hex,
 * sticker bomb (overlapping random copies with z-order) and radial rings. Tiles keep the image's shape or take a
 * chosen one (square, 4:3 … 1:2, custom) that the image is cropped, fitted or stretched into. Every tile instance
 * can be rotated, jittered, flipped, recoloured and spun; the image is premultiplied + mipmapped so it stays clean
 * when zoomed out or tilted. Sample tiles are drawn procedurally with Canvas2D. */
(function () {
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ sample tiles (unit coordinates) */
  function unit(draw) {
    return (ctx, size) => {
      ctx.save();
      ctx.scale(size, size);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      draw(ctx);
      ctx.restore();
    };
  }
  const disc = (g, x, y, r, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };
  const poly = (g, pts, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
  };
  // pointed leaf along +x from the origin
  function leafPath(g, len, wid) {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.25, -wid * 1.15, len * 0.72, -wid * 0.95, len, 0);
    g.bezierCurveTo(len * 0.72, wid * 0.95, len * 0.25, wid * 1.15, 0, 0);
  }

  // Botanical sprig: a curved stem with alternating leaves and a berry cluster, on transparent.
  function drawSprig(g) {
    const P = [[0.2, 0.92], [0.26, 0.62], [0.58, 0.44], [0.8, 0.12]];
    const bez = (t, i) => (1 - t) ** 3 * P[0][i] + 3 * (1 - t) ** 2 * t * P[1][i] + 3 * (1 - t) * t * t * P[2][i] + t ** 3 * P[3][i];
    const dbez = (t, i) => 3 * (1 - t) ** 2 * (P[1][i] - P[0][i]) + 6 * (1 - t) * t * (P[2][i] - P[1][i]) + 3 * t * t * (P[3][i] - P[2][i]);
    const at = (t) => [bez(t, 0), bez(t, 1), Math.atan2(dbez(t, 1), dbez(t, 0))];
    const leaf = (t, side, len, dark, light) => {
      const [x, y, a] = at(t);
      g.save();
      g.translate(x, y);
      g.rotate(a + side * 0.95);
      const wid = len * 0.3;
      const grd = g.createLinearGradient(0, -wid, len, wid);
      grd.addColorStop(0, dark);
      grd.addColorStop(1, light);
      g.fillStyle = grd;
      leafPath(g, len, wid);
      g.fill();
      g.strokeStyle = 'rgba(232, 244, 214, 0.7)';
      g.lineWidth = 0.006;
      g.beginPath();
      g.moveTo(0.012, 0);
      g.quadraticCurveTo(len * 0.5, -wid * 0.08, len * 0.9, 0);
      for (let i = 1; i <= 3; i++) {
        const x0 = len * (0.12 + i * 0.18);
        g.moveTo(x0, 0);
        g.quadraticCurveTo(x0 + len * 0.06, -wid * 0.25, x0 + len * 0.13, -wid * 0.62);
        g.moveTo(x0, 0);
        g.quadraticCurveTo(x0 + len * 0.06, wid * 0.25, x0 + len * 0.13, wid * 0.62);
      }
      g.stroke();
      g.restore();
    };
    // berry twig, in the open space on the lower-right side of the stem
    const [bx, by] = at(0.33);
    g.strokeStyle = '#4d6b34';
    g.lineWidth = 0.009;
    const berries = [[0.2, 0.05], [0.15, 0.12], [0.25, 0.13], [0.21, 0.2]];
    for (const [dx, dy] of berries) {
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + dx * 0.6, by + dy * 0.2, bx + dx, by + dy);
      g.stroke();
    }
    for (const [dx, dy] of berries) {
      disc(g, bx + dx, by + dy, 0.034, '#c8393f');
      disc(g, bx + dx - 0.01, by + dy - 0.011, 0.01, 'rgba(255, 220, 210, 0.75)');
    }
    // stem
    g.strokeStyle = '#4d6b34';
    g.lineWidth = 0.016;
    g.beginPath();
    g.moveTo(P[0][0], P[0][1]);
    g.bezierCurveTo(P[1][0], P[1][1], P[2][0], P[2][1], P[3][0], P[3][1]);
    g.stroke();
    const greens = [['#24573a', '#5f9e52'], ['#2f6c3f', '#86bd66']];
    const L = [[0.1, -1, 0.27], [0.18, 1, 0.25], [0.32, -1, 0.28], [0.52, 1, 0.26], [0.6, -1, 0.23], [0.78, 1, 0.2], [0.84, -1, 0.17]];
    L.forEach(([t, s, len], i) => leaf(t, s, len, greens[i % 2][0], greens[i % 2][1]));
    leaf(1, 0, 0.15, greens[0][0], greens[0][1]);
  }

  // Quarter-circle Truchet tile: two banded arcs joining the edge midpoints, full dots at every corner.
  function drawTruchet(g) {
    g.fillStyle = '#183447';
    g.fillRect(0, 0, 1, 1);
    const band = (cx, cy, a0) => {
      const arc = (w, col) => {
        g.lineCap = 'butt';
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        g.arc(cx, cy, 0.5, a0, a0 + Math.PI / 2);
        g.stroke();
      };
      arc(0.32, '#0e2230');
      arc(0.28, '#f2c14e');
      arc(0.1, '#e4572e');
      arc(0.03, '#f7ede2');
    };
    band(0, 0, 0);
    band(1, 1, Math.PI);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      disc(g, x, y, 0.15, '#0e2230');
      disc(g, x, y, 0.12, '#7fc8c4');
    }
  }

  // Folk-art rosette: eight petals with inlays, leaves between, dotted centre.
  function drawRosette(g) {
    g.translate(0.5, 0.5);
    const petal = (r0, r1, w) => {
      g.beginPath();
      g.moveTo(r0, 0);
      g.bezierCurveTo(r0 + (r1 - r0) * 0.15, -w, r1 - (r1 - r0) * 0.1, -w * 0.95, r1, 0);
      g.bezierCurveTo(r1 - (r1 - r0) * 0.1, w * 0.95, r0 + (r1 - r0) * 0.15, w, r0, 0);
    };
    for (let i = 0; i < 8; i++) {
      g.save();
      g.rotate((i + 0.5) * (TAU / 8));
      g.translate(0.2, 0);
      g.fillStyle = '#2e6b45';
      leafPath(g, 0.27, 0.06);
      g.fill();
      g.strokeStyle = '#9fcf8a';
      g.lineWidth = 0.007;
      g.beginPath();
      g.moveTo(0.02, 0);
      g.lineTo(0.22, 0);
      g.stroke();
      g.restore();
    }
    for (let i = 0; i < 8; i++) {
      g.save();
      g.rotate(i * (TAU / 8));
      g.fillStyle = '#7a1f2b';
      petal(0.07, 0.43, 0.125);
      g.fill();
      g.fillStyle = '#d6404a';
      petal(0.08, 0.41, 0.108);
      g.fill();
      g.fillStyle = '#f7b2a4';
      petal(0.13, 0.33, 0.055);
      g.fill();
      disc(g, 0.37, 0, 0.016, '#fff4e0');
      g.restore();
    }
    disc(g, 0, 0, 0.15, '#7a1f2b');
    disc(g, 0, 0, 0.135, '#f2b134');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      disc(g, Math.cos(a) * 0.095, Math.sin(a) * 0.095, 0.014, '#7a1f2b');
    }
    disc(g, 0, 0, 0.05, '#2e6b45');
    disc(g, 0, 0, 0.022, '#fff4e0');
  }

  // Geometric triangle tile: asymmetric on purpose, so mirror / pinwheel / random layouts all differ.
  function drawTriangles(g) {
    g.fillStyle = '#f3e9d2';
    g.fillRect(0, 0, 1, 1);
    poly(g, [[0, 0], [1, 0], [0, 1]], '#1d3557');
    poly(g, [[0.5, 0], [1, 0], [0.5, 0.5]], '#457b9d');
    poly(g, [[0, 0], [0.5, 0], [0, 0.5]], '#e76f51');
    g.fillStyle = '#e9c46a';
    g.beginPath();
    g.moveTo(1, 1);
    g.arc(1, 1, 0.42, Math.PI, Math.PI * 1.5);
    g.closePath();
    g.fill();
    g.fillStyle = '#2a9d8f';
    g.beginPath();
    g.moveTo(1, 1);
    g.arc(1, 1, 0.21, Math.PI, Math.PI * 1.5);
    g.closePath();
    g.fill();
    disc(g, 0.2, 0.2, 0.055, '#f3e9d2');
  }

  // Encaustic cement tile: 4-fold symmetric, so it repeats seamlessly (circles form where corners meet).
  function drawEncaustic(g) {
    const navy = '#1f3a5f', terra = '#c4553a', cream = '#f0e7d3', mustard = '#d9a441';
    g.fillStyle = cream;
    g.fillRect(0, 0, 1, 1);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      disc(g, x, y, 0.3, navy);
      disc(g, x, y, 0.235, cream);
      disc(g, x, y, 0.17, terra);
      disc(g, x, y, 0.08, cream);
    }
    for (const [x, y] of [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]) poly(g, [[x - 0.09, y], [x, y - 0.09], [x + 0.09, y], [x, y + 0.09]], mustard);
    g.save();
    g.translate(0.5, 0.5);
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate(Math.PI / 4 + (i * Math.PI) / 2);
      g.translate(0.2, 0);
      g.fillStyle = mustard;
      leafPath(g, 0.2, 0.055);
      g.fill();
      g.restore();
    }
    for (const a of [0, Math.PI / 4]) {
      g.save();
      g.rotate(a);
      g.fillStyle = terra;
      g.fillRect(-0.17, -0.17, 0.34, 0.34);
      g.restore();
    }
    disc(g, 0, 0, 0.135, cream);
    disc(g, 0, 0, 0.1, navy);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      disc(g, Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.018, cream);
    }
    disc(g, 0, 0, 0.04, mustard);
    g.restore();
    g.strokeStyle = navy;
    g.lineWidth = 0.012;
    g.strokeRect(0.035, 0.035, 0.93, 0.93);
  }

  // Memphis confetti: squiggle, dotted grid, triangle, circle and zigzag with offset black shadows.
  function drawMemphis(g) {
    const sh = 0.014;
    const twice = (fn, col) => {
      g.save();
      g.translate(sh, sh);
      fn('#151515');
      g.restore();
      fn(col);
    };
    const squiggle = (col) => {
      g.strokeStyle = col;
      g.lineWidth = 0.055;
      g.beginPath();
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        const x = 0.1 + 0.58 * t + 0.05 * Math.sin(t * Math.PI * 5);
        const y = 0.66 - 0.5 * t + 0.05 * Math.sin(t * Math.PI * 5);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    };
    twice(squiggle, '#ff5c8a');
    twice((c) => disc(g, 0.73, 0.71, 0.12, c), '#2ec4f1');
    twice((c) => poly(g, [[0.66, 0.1], [0.9, 0.2], [0.7, 0.36]], c), '#ffd23f');
    g.strokeStyle = '#151515';
    g.lineWidth = 0.022;
    g.beginPath();
    for (let i = 0; i <= 6; i++) g[i ? 'lineTo' : 'moveTo'](0.1 + i * 0.055, 0.86 + (i % 2 ? -0.05 : 0.02));
    g.stroke();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) disc(g, 0.12 + x * 0.05, 0.12 + y * 0.05, 0.013, '#151515');
    twice((c) => {
      g.save();
      g.translate(0.46, 0.8);
      g.rotate(0.5);
      g.fillStyle = c;
      g.fillRect(-0.07, -0.022, 0.14, 0.044);
      g.restore();
    }, '#8e6cf0');
  }

  // Damask ornament: a mirrored scroll-and-bud motif with a gold gradient, on transparent.
  function drawDamask(g) {
    const gold = g.createLinearGradient(0, 0.05, 0, 0.95);
    gold.addColorStop(0, '#f6dd96');
    gold.addColorStop(0.55, '#d9ae52');
    gold.addColorStop(1, '#b8863a');
    g.fillStyle = gold;
    g.strokeStyle = gold;
    for (const sx of [1, -1]) {
      g.save();
      g.translate(0.5, 0);
      g.scale(sx, 1);
      g.lineWidth = 0.03;
      // big C-scroll
      g.beginPath();
      g.moveTo(0.02, 0.24);
      g.bezierCurveTo(0.2, 0.18, 0.4, 0.32, 0.34, 0.5);
      g.bezierCurveTo(0.3, 0.62, 0.15, 0.62, 0.15, 0.52);
      g.stroke();
      disc(g, 0.17, 0.5, 0.035, gold);
      // lower scroll
      g.beginPath();
      g.moveTo(0.02, 0.84);
      g.bezierCurveTo(0.16, 0.86, 0.32, 0.78, 0.3, 0.68);
      g.stroke();
      disc(g, 0.29, 0.665, 0.028, gold);
      // leaves off the scrolls
      g.save();
      g.translate(0.33, 0.33);
      g.rotate(-1.15);
      leafPath(g, 0.17, 0.045);
      g.fill();
      g.restore();
      g.save();
      g.translate(0.2, 0.83);
      g.rotate(0.35);
      leafPath(g, 0.16, 0.04);
      g.fill();
      g.restore();
      g.save();
      g.translate(0.08, 0.13);
      g.rotate(-0.55);
      leafPath(g, 0.13, 0.035);
      g.fill();
      g.restore();
      disc(g, 0.42, 0.18, 0.018, gold);
      disc(g, 0.44, 0.6, 0.02, gold);
      disc(g, 0.4, 0.92, 0.016, gold);
      g.restore();
    }
    // central bud with a cut-out inlay
    const bud = (top, bot, w) => {
      g.beginPath();
      g.moveTo(0.5, top);
      g.bezierCurveTo(0.5 + w, top + (bot - top) * 0.3, 0.5 + w, top + (bot - top) * 0.75, 0.5, bot);
      g.bezierCurveTo(0.5 - w, top + (bot - top) * 0.75, 0.5 - w, top + (bot - top) * 0.3, 0.5, top);
    };
    bud(0.2, 0.78, 0.14);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    bud(0.28, 0.72, 0.09);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    bud(0.36, 0.66, 0.05);
    g.fill();
    // fleur on top, stem below
    g.save();
    g.translate(0.5, 0.2);
    for (const a of [-0.75, 0, 0.75]) {
      g.save();
      g.rotate(-Math.PI / 2 + a);
      leafPath(g, a ? 0.11 : 0.15, 0.035);
      g.fill();
      g.restore();
    }
    g.restore();
    g.lineWidth = 0.024;
    g.beginPath();
    g.moveTo(0.5, 0.78);
    g.lineTo(0.5, 0.92);
    g.stroke();
    disc(g, 0.5, 0.94, 0.026, gold);
  }

  /* ---- rectangular samples: unit height, x ∈ [0, W] */
  function unitRect(draw) {
    return (ctx, w, h) => {
      ctx.save();
      ctx.scale(h, h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      draw(ctx, w / h);
      ctx.restore();
    };
  }
  // seeded, so a sample looks the same on every load
  function rng(seed) {
    let s = seed >>> 0;
    return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  }
  // light from the top left: a bevel of width e around a W×1 tile (four mitred bands, light → dark)
  function bevel(g, W, e, light, mid, dark) {
    const band = (pts, x0, y0, x1, y1, c0, c1) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, c0);
      gr.addColorStop(1, c1);
      poly(g, pts, gr);
    };
    band([[0, 0], [W, 0], [W - e, e], [e, e]], 0, 0, 0, e, light, mid);
    band([[0, 0], [e, e], [e, 1 - e], [0, 1]], 0, 0, e, 0, light, mid);
    band([[0, 1], [e, 1 - e], [W - e, 1 - e], [W, 1]], 0, 1, 0, 1 - e, dark, mid);
    band([[W, 0], [W, 1], [W - e, 1 - e], [W - e, e]], W, 0, W - e, 0, dark, mid);
  }

  // Oak plank (2:1): streaky grain that flows around a knot, with a fine bevel so planks read one by one.
  function drawPlank(g, W) {
    const R = rng(90210);
    const base = g.createLinearGradient(0, 0, 0, 1);
    base.addColorStop(0, '#c99a62');
    base.addColorStop(0.5, '#b8844c');
    base.addColorStop(1, '#c3915a');
    g.fillStyle = base;
    g.fillRect(0, 0, W, 1);
    for (let i = 0; i < 8; i++) {
      const y = R() * 1.1 - 0.1, hh = 0.04 + R() * 0.16;
      g.fillStyle = R() < 0.5 ? `rgba(122, 74, 34, ${0.07 + R() * 0.1})` : `rgba(226, 184, 128, ${0.08 + R() * 0.12})`;
      g.fillRect(0, y, W, hh);
    }
    const kx = W * 0.7, ky = 0.56;
    // grain lines part around the knot
    const bend = (x, y0) => {
      const dx = (x - kx) / 0.3, dy = (y0 - ky) / 0.24;
      return (y0 >= ky ? 1 : -1) * 0.12 * Math.exp(-dx * dx - dy * dy * 0.7);
    };
    for (let i = 0; i < 54; i++) {
      const y0 = R() * 1.16 - 0.08, amp = 0.004 + R() * 0.012, fr = 1.5 + R() * 3.5, ph = R() * TAU;
      g.strokeStyle = R() < 0.7 ? `rgba(98, 57, 26, ${0.16 + R() * 0.3})` : `rgba(240, 206, 152, ${0.2 + R() * 0.25})`;
      g.lineWidth = 0.003 + R() * 0.008;
      g.beginPath();
      for (let j = 0; j <= 160; j++) {
        const x = (j / 160) * W, y = y0 + amp * Math.sin(x * fr + ph) + bend(x, y0);
        j ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    for (let r = 0.075; r > 0.01; r -= 0.013) {
      g.strokeStyle = 'rgba(84, 46, 18, 0.55)';
      g.lineWidth = 0.007;
      g.beginPath();
      g.ellipse(kx, ky, r * 1.7, r, 0, 0, TAU);
      g.stroke();
    }
    g.fillStyle = '#5b3417';
    g.beginPath();
    g.ellipse(kx, ky, 0.026, 0.016, 0, 0, TAU);
    g.fill();
    bevel(g, W, 0.025, 'rgba(255, 236, 200, 0.55)', 'rgba(255, 236, 200, 0)', 'rgba(60, 32, 12, 0.6)');
  }

  // Glossy subway tile (2:1): white glaze, a soft pillowed bevel and a highlight sweeping across the face.
  function drawSubway(g, W) {
    g.fillStyle = '#ebe7de';
    g.fillRect(0, 0, W, 1);
    bevel(g, W, 0.085, '#ffffff', '#efebe3', '#b9b2a5');
    const face = g.createLinearGradient(0, 0.085, 0, 0.915);
    face.addColorStop(0, '#fdfcf8');
    face.addColorStop(1, '#efeae0');
    g.fillStyle = face;
    g.beginPath();
    g.roundRect(0.07, 0.07, W - 0.14, 0.86, 0.05);
    g.fill();
    // glaze pooling slightly darker along the inner edge
    g.strokeStyle = 'rgba(150, 140, 122, 0.18)';
    g.lineWidth = 0.012;
    g.stroke();
    g.save();
    g.clip();
    const gloss = g.createLinearGradient(W * 0.18, 0, W * 0.42, 1);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gloss.addColorStop(0.42, 'rgba(255, 255, 255, 0)');
    gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
    gloss.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, W, 1);
    const sheen = g.createRadialGradient(W * 0.3, 0.22, 0, W * 0.3, 0.22, 0.6);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, W, 1);
    g.restore();
  }

  if (PG.images) {
    PG.images.registerSample('sprig', 'Botanical sprig', unit(drawSprig));
    PG.images.registerSample('rosette', 'Folk rosette', unit(drawRosette));
    PG.images.registerSample('encaustic', 'Encaustic tile', unit(drawEncaustic));
    PG.images.registerSample('truchet', 'Truchet arcs', unit(drawTruchet));
    PG.images.registerSample('triangles', 'Geometric triangles', unit(drawTriangles));
    PG.images.registerSample('memphis', 'Memphis confetti', unit(drawMemphis));
    PG.images.registerSample('damask', 'Damask ornament', unit(drawDamask));
    PG.images.registerSample('plank', 'Oak plank (2:1)', unitRect(drawPlank), { w: 1024, h: 512 });
    PG.images.registerSample('subway', 'Subway tile (2:1)', unitRect(drawSubway), { w: 1024, h: 512 });
  }

  /* ------------------------------------------------------------------ texture: premultiplied RGBA */
  // Premultiplying before upload keeps filtering and mipmaps free of dark fringes around transparent pixels.
  // Also records how much of the image is transparent, so stickers (cut-out PNGs) can be laid out whole.
  const clearShare = new WeakMap(); // canvas → share of clearly transparent pixels
  function premultiplied(src) {
    const w = src.width, h = src.height;
    let px;
    try {
      px = src.getContext('2d').getImageData(0, 0, w, h).data;
    } catch (e) {
      clearShare.set(src, 0);
      return { canvas: src };
    }
    const out = new Uint8Array(px.length);
    let clear = 0;
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3];
      if (a < 128) clear++;
      if (a === 255) {
        out[i] = px[i];
        out[i + 1] = px[i + 1];
        out[i + 2] = px[i + 2];
      } else if (a) {
        const k = a / 255;
        out[i] = px[i] * k + 0.5;
        out[i + 1] = px[i + 1] * k + 0.5;
        out[i + 2] = px[i + 2] * k + 0.5;
      }
      out[i + 3] = a;
    }
    clearShare.set(src, clear / (w * h));
    return { width: w, height: h, data: out };
  }
  const tileCanvas = (v) => PG.images.get(v.tile) || PG.images.placeholder();

  const L = (...ids) => (v) => ids.includes(v.layout);
  // width ÷ height of the chosen tile shape (0 = the image's own)
  const shapeAspect = (v) => (v.tileShape === 'custom' ? +v.tileAspect : v.tileShape === 'image' ? 0 : +v.tileShape);
  const imageAspect = (id) => {
    const c = PG.images && PG.images.get(id);
    return c && c.width && c.height ? c.width / c.height : 0;
  };
  // pinwheel with rectangular tiles = windmill (no rows to slide)
  const windmill = (v) => v.layout === 'pinwheel' && shapeAspect(v) > 0 && Math.abs(Math.log(shapeAspect(v))) > 1e-3;
  const rowLayouts = (v) => L('grid', 'brick', 'halfdrop', 'mirror', 'pinwheel', 'random', 'scatter', 'radial')(v) && !windmill(v);
  // Fit matters when the tile's shape differs from the image's, or the layout cuts its own cell shape: pinwheel
  // (squares), diamond / hex cells, basket weave (n:1 planks), and with the image's shape random turns (squares)
  // and herringbone with a near-square image (2:1 planks)
  const fitShown = (v) => {
    if (L('pinwheel', 'diamond', 'hex', 'basketweave')(v)) return true;
    const ta = shapeAspect(v), ia = imageAspect(v.tile);
    if (!ta) return v.layout === 'random' || (v.layout === 'herringbone' && (!ia || Math.max(ia, 1 / ia) < 1.5));
    return !ia || Math.abs(Math.log(ta / ia)) > 0.01;
  };

  PG.registerPattern({
    id: 'tile',
    name: 'Make Your Own',
    category: 'Custom',
    description: 'Upload a tile (or pick a sample) and it repeats into a pattern: grid, brick, half-drop, mirror, pinwheel, Truchet shuffle, herringbone, basket weave, diamond, hex, sticker bomb or radial — square or rectangular tiles.',
    params: [
      { id: 'tile', label: 'Tile image', type: 'image', default: 'sample:sprig', random: false },
      { type: 'heading', label: 'Layout' },
      {
        id: 'layout',
        label: 'Layout',
        type: 'select',
        options: [
          ['grid', 'Grid'],
          ['brick', 'Brick'],
          ['halfdrop', 'Half-drop'],
          ['mirror', 'Mirror'],
          ['pinwheel', 'Pinwheel'],
          ['random', 'Random turns'],
          ['herringbone', 'Herringbone'],
          ['basketweave', 'Basket weave'],
          ['diamond', 'Diamond'],
          ['hex', 'Hex'],
          ['scatter', 'Sticker bomb'],
          ['radial', 'Radial'],
        ],
        default: 'grid',
        dropdown: true,
        help: 'Mirror always tiles seamlessly. Random turns rotates every tile by 90° steps (half turns and flips for rectangles) — any image becomes a Truchet pattern. Pinwheel with a rectangular tile shape becomes a windmill around small squares. Herringbone and Basket weave lay the tile as planks (2:1 to 4:1 shapes look best)',
      },
      { id: 'size', label: 'Tile size', min: 0.03, max: 3, default: 0.42, step: 0.001, scale: 'log', random: [0.18, 0.7] },
      {
        id: 'tileShape',
        label: 'Tile shape',
        type: 'select',
        options: [
          ['image', "Image's shape"],
          ['1', 'Square 1:1'],
          ['1.333', '4:3'],
          ['1.5', '3:2'],
          ['1.778', '16:9'],
          ['2', '2:1'],
          ['3', '3:1'],
          ['0.75', '3:4 portrait'],
          ['0.667', '2:3 portrait'],
          ['0.5', '1:2 portrait'],
          ['custom', 'Custom'],
        ],
        default: 'image',
        dropdown: true,
        random: ['image', 'image', 'image', '1', '2', '1.5', '0.667'],
        showIf: (v) => v.layout !== 'hex',
        help: "The rectangle each tile fills. Image's shape keeps the picture's proportions (Pinwheel and Random turns still use squares); any other shape crops, fits or stretches the image into it",
      },
      { id: 'tileAspect', label: 'Aspect (width ÷ height)', min: 0.2, max: 5, default: 1.5, step: 0.001, scale: 'log', random: [0.33, 3], showIf: (v) => v.tileShape === 'custom' && v.layout !== 'hex' },
      {
        id: 'tileFit',
        label: 'Fit',
        type: 'select',
        options: [['crop', 'Crop'], ['fit', 'Fit'], ['stretch', 'Stretch']],
        default: 'crop',
        random: ['crop', 'crop', 'fit'],
        showIf: fitShown,
        help: 'How the image fills a tile of another shape: Crop fills it and trims the overflow, Fit shows the whole image (the tile backing or background shows around it), Stretch distorts it to fill. Cut-out PNGs are never cropped',
      },
      { id: 'gap', label: 'Spacing', min: 0, max: 1.5, default: 0, step: 0.005, random: [0, 0.35], help: 'Gap between tiles — the background shows through' },
      { id: 'offset', label: 'Offset', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.25, 0.75], showIf: L('brick', 'halfdrop'), help: 'How far each row (brick) or column (half-drop) shifts' },
      { id: 'density', label: 'Stickers per cell', type: 'int', min: 1, max: 5, default: 2, random: [1, 4], showIf: L('scatter') },

      { type: 'heading', label: 'Tile transform' },
      { id: 'rotation', label: 'Rotation', min: -180, max: 180, default: 0, step: 1, unit: '°', random: false, help: 'Turns every tile. On Hex and Diamond, opaque images turn inside cells that stay in place' },
      { id: 'randRot', label: 'Random rotation', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.35], help: '1 = any angle' },
      { id: 'scaleJit', label: 'Size variation', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.45] },
      {
        id: 'flip',
        label: 'Flip',
        type: 'select',
        options: [['none', 'None'], ['x', 'Horizontal'], ['y', 'Vertical'], ['xy', 'Both'], ['random', 'Random']],
        default: 'none',
        random: ['none', 'none', 'random'],
      },
      { id: 'seamless', label: 'Seamless edges', min: 0, max: 1, default: 0, step: 0.01, random: false, showIf: L('grid', 'brick', 'halfdrop'), help: 'Cross-fades each tile into a half-offset copy of itself near its edges to hide seams of non-repeating images' },

      { type: 'heading', label: 'Color' },
      { id: 'bgColor', label: 'Background', type: 'color', default: '#f1e8d6', random: 'light', help: 'Shows through transparent PNGs and the gaps' },
      { id: 'tileFill', label: 'Tile backing', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'Fills each tile shape behind the image — turns transparent PNGs into solid tiles, with the background as grout' },
      { id: 'fillColor', label: 'Backing color', type: 'color', default: '#f6efe0', random: 'light', showIf: (v) => v.tileFill > 0 },
      { id: 'opacity', label: 'Tile opacity', min: 0, max: 1, default: 1, step: 0.01, random: [0.85, 1] },
      { id: 'shadow', label: 'Drop shadow', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.5], help: 'Soft shadow under each tile — makes overlapping stickers pop' },
      { id: 'shadowColor', label: 'Shadow color', type: 'color', default: '#1a1414', random: 'dark', showIf: (v) => v.shadow > 0 },
      { id: 'hueVar', label: 'Hue variation', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.3], help: 'Random hue shift per tile' },
      { id: 'briVar', label: 'Brightness variation', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.3] },
      { id: 'tintAmt', label: 'Recolor', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.6], help: 'Blend each tile toward a new colour (0 = original image)' },
      {
        id: 'tintMode',
        label: 'Recolor mode',
        type: 'select',
        options: [['colorize', 'Colorize'], ['multiply', 'Multiply'], ['solid', 'Solid silhouette'], ['palette', 'Palette per tile']],
        default: 'colorize',
        showIf: (v) => v.tintAmt > 0,
      },
      { id: 'tint', label: 'Tint', type: 'color', default: '#2a6f97', random: 'mid', showIf: (v) => v.tintAmt > 0 && v.tintMode !== 'palette' },
      { id: 'palette', label: 'Palette', type: 'palette', default: 'Pastel', showIf: (v) => v.tintAmt > 0 && v.tintMode === 'palette' },

      { type: 'heading', label: 'Animation' },
      { id: 'tileSpin', label: 'Tile spin', min: -2, max: 2, default: 0, step: 0.01, random: [-0.4, 0.4], help: 'Each tile turns about its centre while Animate is on (1 = a quarter turn per second)' },
      { id: 'rowSlide', label: 'Row slide', min: -2, max: 2, default: 0, step: 0.01, random: [0, 0.3], showIf: rowLayouts, help: 'Alternate rows (rings in Radial) slide in opposite directions, in tiles per second' },
    ],
    presets: [
      { name: 'Simple Grid', values: { tile: 'sample:encaustic', layout: 'grid', size: 0.5, gap: 0.025, bgColor: '#d9cfbd' } },
      { name: 'Brick Wall', values: { tile: 'sample:memphis', layout: 'brick', size: 0.5, gap: 0.04, shadow: 0.25, bgColor: '#ffe3d8' } },
      { name: 'Mirror Repeat', values: { tile: 'sample:triangles', layout: 'mirror', size: 0.3 } },
      { name: 'Truchet Shuffle', values: { tile: 'sample:truchet', layout: 'random', size: 0.24, bgColor: '#183447' }, seed: 7 },
      {
        name: 'Sticker Bomb',
        thumb: true,
        values: { tile: 'sample:rosette', layout: 'scatter', size: 0.4, gap: 0.1, density: 3, randRot: 1, scaleJit: 0.4, hueVar: 0.3, shadow: 0.4, bgColor: '#f5ecd8' },
        seed: 11,
      },
      { name: 'Hex Tiles', values: { tile: 'sample:rosette', layout: 'hex', size: 0.44, gap: 0.07, tileFill: 1, fillColor: '#f4ead6', bgColor: '#1f3b4d' } },
      { name: 'Pinwheel', values: { tile: 'sample:triangles', layout: 'pinwheel', size: 0.3 } },
      { name: 'Wallpaper Drop', values: { tile: 'sample:damask', layout: 'halfdrop', size: 0.5, bgColor: '#5a1d2b' } },
      // stretched (not cropped) to 3:1, so every plank keeps its bevel on all four edges
      { name: 'Herringbone Parquet', values: { tile: 'sample:plank', layout: 'herringbone', tileShape: '3', tileFit: 'stretch', size: 0.2, gap: 0.03, briVar: 0.22, bgColor: '#2b1d12' }, seed: 5 },
      { name: 'Basket Weave', values: { tile: 'sample:plank', layout: 'basketweave', size: 0.17, gap: 0.05, briVar: 0.28, bgColor: '#2f2116' }, seed: 3 },
      { name: 'Subway Tile', values: { tile: 'sample:subway', layout: 'brick', size: 0.2, gap: 0.035, briVar: 0.06, bgColor: '#8f8a82' } },
      {
        name: 'Windmill',
        // Stretch: the small centre squares get the whole tile (bevel all round) instead of a square crop of it
        values: { tile: 'sample:subway', layout: 'pinwheel', tileShape: '2', tileFit: 'stretch', size: 0.26, gap: 0.05, hueVar: 0.15, briVar: 0.15, tintAmt: 1, tintMode: 'multiply', tint: '#5aa0b8', bgColor: '#f2ede4' },
        seed: 4,
      },
    ],
    textures: [
      {
        id: 'tileTex',
        deps: ['tile'],
        wrap: 'clamp', // no bleeding across tile edges (mirror / pinwheel / turns meet edges that don't wrap)
        mipmap: true,
        build(v) {
          if (!PG.images) return { width: 1, height: 1, data: new Uint8Array([128, 128, 128, 255]) };
          return premultiplied(tileCanvas(v));
        },
      },
      {
        // 1×1: red = share of transparent pixels (> ~5% → treat the image as a sticker)
        id: 'tileInfo',
        deps: ['tile'],
        filter: 'nearest',
        wrap: 'clamp',
        build(v) {
          let t = 0;
          if (PG.images) {
            const src = tileCanvas(v);
            if (!clearShare.has(src)) premultiplied(src);
            t = clearShare.get(src) || 0;
          }
          return { width: 1, height: 1, data: new Uint8Array([Math.round(Math.min(1, t) * 255), 0, 0, 255]) };
        },
      },
    ],
    glsl: /* glsl */ `
// ---- per-frame state ---------------------------------------------------------------------------
vec2 T_dx, T_dy;       // d(p)/d(screen) for one supersample → texture LOD
vec2 T_clip;           // half-size of the visible rect (≤ half the image; smaller when cropped to a square)
vec2 T_ext;            // extra half-size of the rect clip (hides seams where tiles touch, fast path only)
int T_shape;           // 0 rect, 1 hex, 2 rhombus clip
vec2 T_shapeR;         // hex inradius (.x) | rhombus half-diagonals
float T_sMax;          // largest tile scale the neighbour search still covers
vec2 T_shOff;          // drop-shadow offset (pattern units)
float T_rB;            // bounding radius of one instance (incl. shadow) → cheap reject in the neighbour search
bool T_sticker;        // image is a cut-out (lots of transparency) and has no backing: never clip it to a cell shape
bool T_fit;            // the image is smaller than its tile (Fit): mask it to its own rectangle
bool T_halfTurns;      // Random turns with rectangular tiles: half turns + flips instead of quarter turns
ivec2 T_win;           // reach of the rectangular lattices' neighbour search, in cells (x, y)
vec2 T_seamWin;        // share of the image (uv) a cropped tile shows, centred → Seamless edges fade at the tile's edges
const float T_BIG = 1e4;

// up to 4 overlapping layers, sorted by z ascending (premultiplied colour)
vec4 K_col[4];
float K_z[4];
int K_n;

void K_add(vec4 c, float z) {
  if (c.a <= 0.0) return;
  if (K_n == 4) {
    if (z <= K_z[0]) return;
    K_col[0] = K_col[1]; K_z[0] = K_z[1];
    K_col[1] = K_col[2]; K_z[1] = K_z[2];
    K_col[2] = K_col[3]; K_z[2] = K_z[3];
    K_n = 3;
  }
  int i = K_n;
  for (int k = 3; k >= 1; k--) {
    if (k > K_n) continue;
    if (K_z[k - 1] > z) { K_col[k] = K_col[k - 1]; K_z[k] = K_z[k - 1]; i = k - 1; } else break;
  }
  K_col[i] = c; K_z[i] = z;
  K_n++;
}

struct Inst { vec2 c; float ang; float s; vec2 fl; vec3 h; float z; };

// ---- sampling & colour -------------------------------------------------------------------------
vec4 tileTex(vec2 uv, vec2 gx, vec2 gy) {
  vec4 c = textureGrad(u_tileTex, uv, gx, gy);
  // only where the control is shown (a value left over from another layout must not ghost the image)
  if (u_seamless > 0.0 && (u_layout == LAYOUT_GRID || u_layout == LAYOUT_BRICK || u_layout == LAYOUT_HALFDROP)) {
    // separable cross-fade with half-offset copies: every tile edge shows the image's centre lines → no seams
    if (T_seamWin.x < 1.0 || T_seamWin.y < 1.0) {
      // the tile shows only a crop of the image (a chosen tile shape): fade across the visible window's edges
      vec2 lo = 0.5 - 0.5 * T_seamWin, u = (uv - lo) / T_seamWin;
      vec2 e = 1.0 - smoothstep(vec2(0.0), vec2(u_seamless * 0.5), min(u, 1.0 - u));
      vec4 cx = textureGrad(u_tileTex, lo + fract(u + vec2(0.5, 0.0)) * T_seamWin, gx, gy);
      vec4 cy = textureGrad(u_tileTex, lo + fract(u + vec2(0.0, 0.5)) * T_seamWin, gx, gy);
      vec4 cxy = textureGrad(u_tileTex, lo + fract(u + 0.5) * T_seamWin, gx, gy);
      return mix(mix(c, cx, e.x), mix(cy, cxy, e.x), e.y);
    }
    vec2 e = 1.0 - smoothstep(vec2(0.0), vec2(u_seamless * 0.5), min(uv, 1.0 - uv));
    vec4 cx = textureGrad(u_tileTex, fract(uv + vec2(0.5, 0.0)), gx, gy);
    vec4 cy = textureGrad(u_tileTex, fract(uv + vec2(0.0, 0.5)), gx, gy);
    vec4 cxy = textureGrad(u_tileTex, fract(uv + 0.5), gx, gy);
    c = mix(mix(c, cx, e.x), mix(cy, cxy, e.x), e.y);
  }
  return c;
}

vec3 recolor(vec3 rgb, vec3 h) {
  if (u_hueVar > 0.0) {
    vec3 v = pg_rgb2hsv(rgb);
    v.x = fract(v.x + (h.x - 0.5) * u_hueVar);
    rgb = pg_hsv2rgb(v);
  }
  if (u_briVar > 0.0) rgb *= exp2((h.y - 0.5) * 2.0 * u_briVar);
  if (u_tintAmt > 0.0) {
    vec3 t = u_tintMode == TINTMODE_PALETTE ? u_palette[pg_wrapi(int(floor(h.z * 64.0)), u_palette_count)] : u_tint;
    vec3 r;
    if (u_tintMode == TINTMODE_MULTIPLY) r = rgb * t;
    else if (u_tintMode == TINTMODE_SOLID) r = t;
    else {
      // black → tint → white, with the tint sitting at its own luminance
      float Lp = pg_luma(clamp(rgb, 0.0, 1.0)), Lt = clamp(pg_luma(t), 0.05, 0.95);
      r = Lp < Lt ? t * (Lp / Lt) : mix(t, vec3(1.0), (Lp - Lt) / (1.0 - Lt));
    }
    rgb = mix(rgb, r, u_tintAmt);
  }
  return clamp(rgb, 0.0, 1.0);
}

// Coverage of the tile's clip at tile-local point l (rotated / flipped with the image) and cell-local point lc
// (only scaled: hex / rhombus cells stay put while the image turns inside them, so they always tessellate).
// Grown by half a sample so two tiles sharing an edge both cover it fully — no background seam between them.
float clipCov(vec2 l, vec2 lc, float s) {
  float d = pg_sdBox(l, T_clip + T_ext);
  if (T_shape == 1) d = max(d, pg_sdHex(lc.yx, T_shapeR.x));
  else if (T_shape == 2) d = max(d, (abs(lc.x) * T_shapeR.y + abs(lc.y) * T_shapeR.x - T_shapeR.x * T_shapeR.y) / length(T_shapeR));
  return pg_fill(d * s - 0.5 * pg_px);
}

// Coverage of the image's own rectangle (Fit: a smaller image inside its tile).
float imgCov(vec2 l, vec2 dims, float s) {
  return pg_fill(pg_sdBox(l, 0.5 * dims) * s);
}

// ---- tile shape ------------------------------------------------------------------------------------
// width ÷ height of the chosen tile shape
float tileAspect() {
  int s = u_tileShape;
  return s == TILESHAPE_CUSTOM ? u_tileAspect : s == TILESHAPE_1_333 ? 4.0 / 3.0 : s == TILESHAPE_1_5 ? 1.5
    : s == TILESHAPE_1_778 ? 16.0 / 9.0 : s == TILESHAPE_2 ? 2.0 : s == TILESHAPE_3 ? 3.0 : s == TILESHAPE_0_75 ? 0.75
    : s == TILESHAPE_0_667 ? 2.0 / 3.0 : s == TILESHAPE_0_5 ? 0.5 : 1.0;
}
// Size of an image (aspect asp) filling a tile box: cover (Crop), contain (Fit — cut-out stickers are never
// cropped, they fit too) or the box itself (Stretch).
vec2 fitImage(vec2 box, float asp) {
  if (u_tileFit == TILEFIT_STRETCH) return box;
  float h = u_tileFit == TILEFIT_CROP && !T_sticker ? max(box.y, box.x / asp) : min(box.y, box.x / asp);
  return h * vec2(asp, 1.0);
}
bool smaller(vec2 dims, vec2 box) { return any(lessThan(dims, box * 0.999)); }

// Premultiplied colour of one tile instance (plus its drop shadow) at p. dims = image size at scale 1.
vec4 stamp(vec2 p, Inst t, vec2 dims) {
  mat2 R = pg_rot(-t.ang);
  vec2 k = t.fl / (t.s * dims);
  vec2 gx = (R * T_dx) * k, gy = (R * T_dy) * k;
  vec4 col = vec4(0.0);
  vec2 l = (R * (p - t.c)) / t.s * t.fl;
  float cov = clipCov(l, (p - t.c) / t.s, t.s);
  if (cov > 0.0) {
    vec4 c = tileTex(l / dims + 0.5, gx, gy);
    if (T_fit) c *= imgCov(l, dims, t.s);
    float a = c.a * cov * u_opacity;
    if (a > 0.0) col = vec4(recolor(c.rgb / max(c.a, 1e-4), t.h) * a, a);
    if (u_tileFill > 0.0) {
      float fa = u_tileFill * cov * u_opacity;
      col += vec4(u_fillColor * fa, fa) * (1.0 - col.a);
    }
  }
  if (u_shadow > 0.0 && col.a < 0.999) {
    // offset copy of the alpha, read from a blurrier mip level for a soft edge
    vec2 ls = (R * (p - t.c - T_shOff)) / t.s * t.fl;
    float cs = clipCov(ls, (p - t.c - T_shOff) / t.s, t.s);
    if (cs > 0.0) {
      float b = max(1.0, 0.035 * u_size / max(length(T_dx), 1e-7));
      float ia = textureGrad(u_tileTex, ls / dims + 0.5, gx * b, gy * b).a;
      if (T_fit) ia *= imgCov(ls, dims, t.s);
      float sa = max(ia, u_tileFill) * cs * u_shadow * u_opacity;
      col += vec4(u_shadowColor * sa, sa) * (1.0 - col.a);
    }
  }
  return col;
}

// Per-instance randomness from an integer key; ang = layout angle, par = ±1 spin direction.
Inst makeInst(vec2 key, vec2 c, float ang, float par) {
  vec3 a = pg_hash32(key), b = pg_hash32(key + vec2(0.0, 65536.0)), e = pg_hash32(key + vec2(65536.0, 0.0));
  Inst t;
  t.c = c;
  t.ang = ang + radians(u_rotation) + u_randRot * (a.x - 0.5) * PG_TAU + u_tileSpin * u_time * par * (PG_PI * 0.5);
  t.s = min(exp2(u_scaleJit * (2.0 * a.y - 1.0)), T_sMax);
  t.fl = vec2(1.0);
  if (u_flip == FLIP_X || u_flip == FLIP_XY) t.fl.x = -1.0;
  if (u_flip == FLIP_Y || u_flip == FLIP_XY) t.fl.y = -1.0;
  if (u_flip == FLIP_RANDOM) t.fl = vec2(e.x < 0.5 ? -1.0 : 1.0, e.y < 0.5 ? -1.0 : 1.0);
  t.h = b;
  t.z = a.z;
  return t;
}

float parity(vec2 id) { return mod(id.x + id.y, 2.0) < 0.5 ? 1.0 : -1.0; }

// ---- layouts -----------------------------------------------------------------------------------
// Rectangular lattices: grid, brick, half-drop (transposed brick), mirror, pinwheel, random turns, scatter.
void rectLayout(vec2 p, vec2 dims, vec2 cell, bool search) {
  bool hd = u_layout == LAYOUT_HALFDROP;
  bool scatter = u_layout == LAYOUT_SCATTER;
  vec2 P = cell * (1.0 + u_gap);
  vec2 w = hd ? p.yx : p, Pw = hd ? P.yx : P;
  float sh0 = (u_layout == LAYOUT_BRICK || hd) ? u_offset : 0.0;
  float j0 = floor(w.y / Pw.y);
  ivec2 r = search ? (hd ? T_win.yx : T_win) : ivec2(0);
  int N = scatter ? int(u_density) : 1;
  for (int dy = -3; dy <= 3; dy++) {
    if (abs(dy) > r.y) continue;
    float j = j0 + float(dy);
    float sh = fract(sh0 * j) + u_rowSlide * u_time * (mod(j, 2.0) < 0.5 ? 1.0 : -1.0);
    float i0 = floor(w.x / Pw.x - sh);
    for (int dx = -3; dx <= 3; dx++) {
      if (abs(dx) > r.x) continue;
      vec2 idw = vec2(i0 + float(dx), j);
      vec2 id = hd ? idw.yx : idw;
      vec2 o = vec2((idw.x + sh) * Pw.x, j * Pw.y);
      for (int m = 0; m < 5; m++) {
        if (m >= N) break;
        vec2 key = vec2(id.x * 8.0 + float(m), id.y);
        // scatter: N evenly spread base points per cell (a rank-1 lattice: quincunx for 2) + jitter → even coverage,
        // no clumps or empty bands
        float gen = N >= 4 ? 2.0 : 1.0;
        vec2 f = scatter ? fract(0.25 + vec2(1.0, gen) * (float(m) / float(N)) + (pg_hash22(key + vec2(0.0, 131072.0)) - 0.5) * (0.55 / sqrt(float(N)))) : vec2(0.5);
        vec2 cw = o + f * Pw;
        vec2 cp = hd ? cw.yx : cw;
        if (search && dot(p - cp, p - cp) > T_rB * T_rB) continue;
        float ang = 0.0;
        vec2 fq = vec2(1.0);
        if (u_layout == LAYOUT_PINWHEEL) {
          // 2×2 block turning about its shared corner: quarter turns 2 1 / 3 0 (counter-clockwise)
          vec2 b = mod(id, 2.0);
          ang = (PG_PI * 0.5) * (b.x > 0.5 ? (b.y > 0.5 ? 0.0 : 3.0) : (b.y > 0.5 ? 1.0 : 2.0));
        } else if (u_layout == LAYOUT_RANDOM) {
          float q = floor(pg_hash12(key + vec2(0.0, 262144.0)) * 4.0);
          // a rectangle only maps onto its own cell by half turns and flips: none, flip x, flip y, both (= half turn)
          if (T_halfTurns) fq = vec2(mod(q, 2.0) < 0.5 ? 1.0 : -1.0, q < 1.5 ? 1.0 : -1.0);
          else ang = (PG_PI * 0.5) * q;
        }
        float par = scatter ? (pg_hash12(key + vec2(0.0, 393216.0)) < 0.5 ? 1.0 : -1.0) : parity(id);
        Inst t = makeInst(key, cp, ang, par);
        if (T_halfTurns) t.fl *= fq;
        if (u_layout == LAYOUT_MIRROR) t.fl *= vec2(mod(id.x, 2.0) < 0.5 ? 1.0 : -1.0, mod(id.y, 2.0) < 0.5 ? 1.0 : -1.0);
        K_add(stamp(p, t, dims), t.z);
      }
    }
  }
}

// Hex lattice (pointy-top): the image covers the hexagon and is clipped to it; the hexagon stays put while the
// image turns inside it (cut-out stickers stay whole and turn as a unit).
void hexLayout(vec2 p, vec2 dims, float S, bool search) {
  float P = S * (1.0 + u_gap);
  vec4 h = pg_hexGrid(p / P);
  T_shape = !T_sticker && (search || u_gap > 0.0) ? 1 : 0;
  T_shapeR = vec2(0.5 * S);
  if (T_sticker) T_clip = 0.5 * dims; else T_ext = vec2(T_BIG);
  for (int k = 0; k < 7; k++) {
    if (k > 0 && !search) break;
    vec2 o = k == 0 ? vec2(0.0) : k == 1 ? vec2(1.0, 0.0) : k == 2 ? vec2(-1.0, 0.0) : k == 3 ? vec2(0.5)
           : k == 4 ? vec2(-0.5, 0.5) : k == 5 ? vec2(0.5, -0.5) : vec2(-0.5);
    vec2 id = h.zw + o;                       // half-integer ids; centre = id * (1, √3)
    vec2 c = id * vec2(1.0, 1.7320508) * P;
    if (k > 0 && dot(p - c, p - c) > T_rB * T_rB) continue;
    Inst t = makeInst(id * 2.0, c, 0.0, parity(floor(id * 2.0)));
    K_add(stamp(p, t, dims), t.z);
  }
}

// Diamond lattice: upright tiles clipped to rhombi (diagonals D) on a centred lattice. img = drawn image size
// (D for opaque images, larger when they turn so the rhombus stays covered; the grid's tile size for stickers,
// which stay whole and sit on the 45° lattice without crowding).
void diamondLayout(vec2 p, vec2 D, vec2 img, bool search) {
  vec2 Pd = D * (1.0 + u_gap);
  vec2 q = p / Pd;
  vec2 A0 = floor(vec2(q.x + q.y, q.y - q.x));
  T_shape = !T_sticker && (search || u_gap > 0.0) ? 2 : 0;
  T_shapeR = 0.5 * D;
  if (T_sticker) T_clip = 0.5 * img; else T_ext = vec2(T_BIG);
  int r = search ? 1 : 0;
  for (int dy = -1; dy <= 1; dy++) {
    if (abs(dy) > r) continue;
    for (int dx = -1; dx <= 1; dx++) {
      if (abs(dx) > r) continue;
      vec2 A = A0 + vec2(float(dx), float(dy));
      vec2 c = vec2(A.x - A.y, A.x + A.y + 1.0) * 0.5 * Pd;
      if (search && dot(p - c, p - c) > T_rB * T_rB) continue;
      Inst t = makeInst(A, c, 0.0, parity(A));
      K_add(stamp(p, t, img), t.z);
    }
  }
}

// Herringbone: every plank (the tile, long side along the plank) butts its end against the side of the next, the
// zig-zag running along x with planks at ±45°. Worked out in an axis frame (the view turned by 45°) where planks are
// horizontal (H) or vertical (V): pitch A × B (plank + grout), lattice (B, B) and (A, -A);
// H(k,m) = [kB+mA, kB+mA+A] × [kB-mA, kB-mA+B] and V(k,m) = [kB+mA, kB+mA+B] × [(k+1)B-mA, (k+1)B-mA+A].
vec2 herrCentre(float k, float m, int v, float A, float B) {
  return v == 0 ? vec2(k * B + m * A + 0.5 * A, k * B - m * A + 0.5 * B)
                : vec2(k * B + m * A + 0.5 * B, (k + 1.0) * B - m * A + 0.5 * A);
}
void herringboneLayout(vec2 p, vec2 tD, float asp, bool search, float pad) {
  float a = max(tD.x, tD.y), b = min(tD.x, tD.y), g = u_gap * b;
  float A = a + g, B = b + g;
  vec2 dims = fitImage(tD, asp);
  T_fit = smaller(dims, tD);
  T_clip = 0.5 * tD;
  T_rB = length(T_clip) * min(exp2(u_scaleJit), T_sMax) + pad;
  if (!search && g == 0.0) T_ext = vec2(T_BIG);
  mat2 toView = pg_rot(-0.25 * PG_PI);
  vec2 q = pg_rot(0.25 * PG_PI) * p;
  // the tile's long side runs along each plank; V planks are H planks turned a quarter
  float angH = (tD.x >= tD.y ? 0.0 : -0.5 * PG_PI) - 0.25 * PG_PI;
  if (!search) {
    // the one plank under p
    float q2 = q.x - q.y;
    float m = floor((q2 + B) / (2.0 * A)), k = floor((q.y + m * A) / B);
    int v = 0;
    float X = q.x - k * B - m * A;
    if (X < 0.0 || X > A) {
      v = 1;
      m = ceil(q2 / (2.0 * A));
      k = floor((q.x - m * A) / B);
    }
    Inst t = makeInst(vec2(k * 2.0 + float(v), m), toView * herrCentre(k, m, v, A, B), angH + float(v) * 0.5 * PG_PI, parity(vec2(k, m)));
    K_add(stamp(p, t, dims), t.z);
    return;
  }
  // every plank whose centre is within T_rB. The H (or V) planks of one m lie on a diagonal line, B√2 apart:
  // skip lines farther than T_rB, and on the others visit just the run of planks within reach.
  float mc = floor((q.x - q.y) / (2.0 * A) + 0.5);
  float reach = T_rB / (B * 1.4142136);
  for (int dm = -1; dm <= 1; dm++) {
    float m = mc + float(dm);
    for (int v = 0; v < 2; v++) {
      vec2 d0 = q - herrCentre(0.0, m, v, A, B);
      if (abs(d0.x - d0.y) * 0.70710678 > T_rB) continue;
      float ks = (d0.x + d0.y) / (2.0 * B);          // nearest plank along the line (fractional)
      // at most 8 planks, centred on the nearest one (near a tilted horizon the reach can span more than 8)
      float kc = floor(ks + 0.5);
      float k0 = max(ceil(ks - reach), kc - 3.0), k1 = min(floor(ks + reach), kc + 4.0);
      for (int i = 0; i < 8; i++) {
        float k = k0 + float(i);
        if (k > k1) break;
        vec2 ca = herrCentre(k, m, v, A, B);
        if (dot(q - ca, q - ca) > T_rB * T_rB) continue;
        Inst t = makeInst(vec2(k * 2.0 + float(v), m), toView * ca, angH + float(v) * 0.5 * PG_PI, parity(vec2(k, m)));
        K_add(stamp(p, t, dims), t.z);
      }
    }
  }
}

// Basket weave: square blocks of n planks side by side (n = the tile's aspect rounded, at least 2), alternating
// horizontal and vertical like a checkerboard. The planks are n:1 rectangles, so the image fills them per Fit.
void basketLayout(vec2 p, vec2 tD, float asp, bool search, float pad) {
  float b = min(tD.x, tD.y);
  float n = clamp(floor(max(tD.x, tD.y) / b + 0.5), 2.0, 6.0);
  float g = u_gap * b, Bp = b + g, P = n * Bp;
  bool land = tD.x >= tD.y;
  vec2 pl = land ? vec2(P - g, b) : vec2(b, P - g);      // one plank, in the tile's own frame
  vec2 dims = fitImage(pl, asp);
  T_fit = smaller(dims, pl);
  T_clip = 0.5 * pl;
  T_rB = length(T_clip) * min(exp2(u_scaleJit), T_sMax) + pad;
  if (!search && g == 0.0) T_ext = vec2(T_BIG);
  float angH = land ? 0.0 : -0.5 * PG_PI;
  vec2 ij = floor(p / P);
  int r = search ? 1 : 0;
  for (int dy = -1; dy <= 1; dy++) {
    if (abs(dy) > r) continue;
    for (int dx = -1; dx <= 1; dx++) {
      if (abs(dx) > r) continue;
      vec2 id = ij + vec2(float(dx), float(dy));
      vec2 o = id * P;
      bool hor = mod(id.x + id.y, 2.0) < 0.5;
      if (search && pg_sdBox(p - o - 0.5 * P, vec2(0.5 * P)) > T_rB) continue;
      // planks across the block: just the one under p, or (search) those within reach
      float across = (hor ? p.y - o.y : p.x - o.x) / Bp;
      float s0 = search ? max(0.0, ceil(across - T_rB / Bp - 0.5)) : clamp(floor(across), 0.0, n - 1.0);
      float s1 = search ? min(n - 1.0, floor(across + T_rB / Bp - 0.5)) : s0;
      for (int s = 0; s < 6; s++) {
        float fs = s0 + float(s);
        if (fs > s1) break;
        vec2 c = o + (hor ? vec2(0.5 * P, (fs + 0.5) * Bp) : vec2((fs + 0.5) * Bp, 0.5 * P));
        if (search && dot(p - c, p - c) > T_rB * T_rB) continue;
        vec2 key = vec2(id.x * 8.0 + fs, id.y);
        Inst t = makeInst(key, c, angH + (hor ? 0.0 : 0.5 * PG_PI), parity(key));
        K_add(stamp(p, t, dims), t.z);
      }
    }
  }
}

// Windmill (pinwheel for rectangles): four tiles turn around each small square (side = long − short side). The
// squares sit on the lattice (B, A), (A, -B); each lattice point owns its square, the tile above it and the tile
// to its right. pitch A × B = tile + grout.
void windmillLayout(vec2 p, vec2 tD, float asp, bool search, float pad) {
  float a = max(tD.x, tD.y), b = min(tD.x, tD.y), g = u_gap * b;
  float A = a + g, B = b + g, h = 0.5 * (a - b);
  float angT = tD.x >= tD.y ? 0.0 : -0.5 * PG_PI;
  vec2 sq = vec2(max(a - b - g, 0.0));                    // the small square, as drawn
  vec2 dR = fitImage(tD, asp), dS = fitImage(sq, asp);
  bool fitR = smaller(dR, tD), fitS = smaller(dS, sq);
  float rB = max(0.5 * length(tD), 0.7072 * sq.x) * min(exp2(u_scaleJit), T_sMax) + pad;
  if (!search && g == 0.0) T_ext = vec2(T_BIG);
  float d = A * A + B * B;
  vec2 mn = floor(vec2(B * p.x + A * p.y, A * p.x - B * p.y) / d + 0.5);
  bool done = false;
  for (int dm = -1; dm <= 1; dm++) {
    for (int dn = -1; dn <= 1; dn++) {
      vec2 L = mn + vec2(float(dm), float(dn));
      vec2 qc = L.x * vec2(B, A) + L.y * vec2(A, -B);
      for (int e = 0; e < 3; e++) {
        if (done) break;
        if (e == 0 && sq.x <= 0.0) continue;
        vec2 c = e == 0 ? qc : e == 1 ? qc + vec2(0.5 * B, h + 0.5 * B) : qc + vec2(h + 0.5 * B, -0.5 * B);
        if (search) {
          if (dot(p - c, p - c) > rB * rB) continue;
        } else {
          // fast path: only the element whose slot holds p
          vec2 slot = e == 0 ? vec2(h) : e == 1 ? 0.5 * vec2(A, B) : 0.5 * vec2(B, A);
          if (any(greaterThan(abs(p - c), slot))) continue;
          done = true;
        }
        T_clip = e == 0 ? 0.5 * sq : 0.5 * tD;
        T_fit = e == 0 ? fitS : fitR;
        vec2 key = vec2(L.x * 4.0 + float(e), L.y);
        // odd lattice points add a half turn: every tile is the top of one square and the bottom of the next, so
        // with a checkerboard of half turns the four tiles round each square turn 90° step by step (a real windmill)
        float par = parity(L);
        float ang = e == 0 ? 0.0 : (e == 1 ? angT : angT - 0.5 * PG_PI) + (par < 0.0 ? PG_PI : 0.0);
        Inst t = makeInst(key, c, ang, par);
        K_add(stamp(p, t, e == 0 ? dS : dR), t.z);
      }
    }
  }
}

// Radial: a centre tile plus rings of tiles facing outward, each ring filled with a whole number of tiles.
// dims = the tile (spacing), img = the image drawn in it.
void radialLayout(vec2 p, vec2 dims, vec2 img, bool search) {
  vec2 P = dims * (1.0 + u_gap);            // .x along the ring, .y between rings
  float rr = length(p);
  float a = atan(p.y, p.x);
  float k0 = floor(rr / P.y + 0.5);
  int r = search ? 1 : 0;
  for (int dk = -1; dk <= 1; dk++) {
    if (abs(dk) > r) continue;
    float k = k0 + float(dk);
    if (k < 0.0) continue;
    float n = k < 0.5 ? 1.0 : max(1.0, floor(PG_TAU * k * P.y / P.x));
    float st = PG_TAU / n;
    float slide = u_rowSlide * u_time * (mod(k, 2.0) < 0.5 ? 1.0 : -1.0);
    float m0 = floor(a / st - slide);
    for (int dm = -1; dm <= 1; dm++) {
      if (abs(dm) > r) continue;
      if (dm != 0 && (n < 1.5 || (n < 2.5 && dm > 0))) continue;   // rings of 1–2 tiles: no duplicates
      float m = m0 + float(dm);
      float th = (m + 0.5 + slide) * st;
      vec2 key = vec2(mod(m, n), k);
      Inst t = makeInst(key, k * P.y * vec2(cos(th), sin(th)), k < 0.5 ? 0.0 : th - PG_PI * 0.5, parity(key));
      if (k > 0.5) t.s *= k * P.y * st / P.x;  // stretch so each ring closes up exactly
      K_add(stamp(p, t, img), t.z);
    }
  }
}

// The image's own shape, cropped where a layout cuts cells (the original layouts). Kept apart from shapedLayouts()
// so presets and saved designs from before tile shapes existed render exactly as they always did.
void classicLayouts(vec2 p) {
  float asp = u_tileTex_size.x / max(u_tileTex_size.y, 1.0);
  float S = u_size;
  vec2 rectD = S * vec2(sqrt(asp), 1.0 / sqrt(asp));            // keeps the image's area at S²
  T_sticker = u_tileFill <= 0.0 && texelFetch(u_tileInfo, ivec2(0), 0).r > 0.05;
  // square cells (pinwheel / random turns): opaque images are cropped to cover them, stickers fit inside
  vec2 sqD = (asp >= 1.0) != T_sticker ? S * vec2(asp, 1.0) : S * vec2(1.0, 1.0 / asp);
  bool scatter = u_layout == LAYOUT_SCATTER;
  bool hex = u_layout == LAYOUT_HEX, dia = u_layout == LAYOUT_DIAMOND, rad = u_layout == LAYOUT_RADIAL;
  bool sq = u_layout == LAYOUT_PINWHEEL || u_layout == LAYOUT_RANDOM;
  vec2 dims = sq ? sqD : rectD, cell = sq ? vec2(S) : rectD;     // rectangular layouts
  vec2 fp = hex || dia ? vec2(1.0) : rad ? rectD : min(dims, cell); // visible footprint of one tile
  // quarter turns keep a square footprint inside its cell, half turns any footprint
  float period = abs(fp.x - fp.y) < 1e-4 * S ? 90.0 : 180.0;
  bool turns = u_randRot > 0.0 || u_tileSpin != 0.0;
  bool tilted = turns || abs(mod(u_rotation, 180.0)) > 1e-3;     // image not upright (for covering a cell)
  // opaque images on hex / diamond lattices are cut to a fixed cell, so turning them never leaves it
  bool locked = !T_sticker && (hex || dia);
  // anything that can push a tile (or its shadow) past its own cell needs the neighbour search (and z-order);
  // so do stickers on hex / diamond / radial lattices, which are drawn whole instead of cut to their cell
  bool search = scatter || u_scaleJit > 0.0 || (!locked && (turns || abs(mod(u_rotation, period)) > 1e-3))
    || (u_shadow > 0.0 && (u_gap > 0.0 || T_sticker))
    || (T_sticker && (hex || dia || rad));

  float pad = (u_shadow > 0.0 ? length(T_shOff) : 0.0) + 2.0 * pg_px * pg_ss;
  if (hex) {
    // cover the hexagon (or, when the image turns, its circumcircle) with as little crop as possible
    vec2 hd = tilted && !T_sticker ? 1.1547005 * S * (asp >= 1.0 ? vec2(asp, 1.0) : vec2(1.0, 1.0 / asp))
                                   : max(S / asp, 1.1547005 * S) * vec2(asp, 1.0);
    T_sMax = T_sticker ? 1.5 : 2.0;
    T_rB = (T_sticker ? 0.5 * length(hd) : 0.5774 * S) * min(exp2(u_scaleJit), T_sMax) + pad;
    hexLayout(p, hd, S, search);
  } else if (dia) {
    vec2 D = rectD * 1.4142136;
    vec2 img = T_sticker ? rectD : tilted ? D * (max(D.x, D.y) / min(D.x, D.y)) : D;
    T_sMax = 1.4;
    T_rB = (T_sticker ? 0.5 * length(rectD) : 0.7072 * max(rectD.x, rectD.y)) * min(exp2(u_scaleJit), T_sMax) + pad;
    diamondLayout(p, D, img, search);
  } else if (rad) {
    T_sMax = 1.4;
    T_clip = 0.5 * rectD;
    if (!search && u_gap == 0.0) T_ext = vec2(T_BIG);
    radialLayout(p, rectD, rectD, search);
  } else {
    T_clip = 0.5 * fp;
    vec2 P = cell * (1.0 + u_gap);
    T_sMax = (scatter ? 1.0 : 1.5) * min(P.x, P.y) / length(T_clip);
    T_rB = length(T_clip) * min(exp2(u_scaleJit), T_sMax) + pad;
    // tiles that exactly fill their cell: drop the clip there so neighbours meet without a background seam
    if (!search) T_ext = T_BIG * step(P - 2.0 * T_clip, vec2(1e-5 * S));
    rectLayout(p, dims, cell, search);
  }
}

// Everything else: a chosen tile shape (or Fit / Stretch, Herringbone, Basket weave). The image's shape stays the tile
// unless a shape is picked; Pinwheel and Random turns then still use square cells, as they always did.
void shapedLayouts(vec2 p) {
  float asp = u_tileTex_size.x / max(u_tileTex_size.y, 1.0);
  float S = u_size;
  vec2 rectD = S * vec2(sqrt(asp), 1.0 / sqrt(asp));            // keeps the image's area at S²
  T_sticker = u_tileFill <= 0.0 && texelFetch(u_tileInfo, ivec2(0), 0).r > 0.05;
  // square cells (pinwheel / random turns): opaque images are cropped to cover them, stickers fit inside
  vec2 sqD = (asp >= 1.0) != T_sticker ? S * vec2(asp, 1.0) : S * vec2(1.0, 1.0 / asp);
  bool scatter = u_layout == LAYOUT_SCATTER;
  bool hex = u_layout == LAYOUT_HEX, dia = u_layout == LAYOUT_DIAMOND, rad = u_layout == LAYOUT_RADIAL;
  bool sq = u_layout == LAYOUT_PINWHEEL || u_layout == LAYOUT_RANDOM;
  bool herr = u_layout == LAYOUT_HERRINGBONE, bask = u_layout == LAYOUT_BASKETWEAVE;
  // A chosen tile shape replaces the image's rectangle (same area S²); the image is cropped / fitted / stretched
  // into it. Herringbone needs planks: a near-square image's own shape becomes 2:1.
  bool shaped = u_tileShape != TILESHAPE_IMAGE;
  if (shaped) {
    float ta = tileAspect();
    rectD = S * vec2(sqrt(ta), 1.0 / sqrt(ta));
  } else if (herr && max(asp, 1.0 / asp) < 1.5) {
    rectD = S * (asp >= 1.0 ? vec2(1.4142136, 0.70710678) : vec2(0.70710678, 1.4142136));
  }
  bool sqTile = abs(rectD.x - rectD.y) < 1e-3 * S;
  bool wind = u_layout == LAYOUT_PINWHEEL && shaped && !sqTile;    // rectangles: windmill around small squares
  T_halfTurns = u_layout == LAYOUT_RANDOM && shaped && !sqTile;    // rectangles: half turns and flips
  if (shaped) sq = sq && sqTile;
  bool planks = herr || bask || wind;
  vec2 dims = sq ? sqD : rectD, cell = sq ? vec2(S) : rectD;     // rectangular layouts
  if (shaped || (sq && u_tileFit != TILEFIT_CROP)) {
    dims = fitImage(cell, asp);
    T_fit = smaller(dims, cell);
  }
  // visible footprint of one tile (a fitted opaque image keeps its whole tile: the backing fills it)
  vec2 fp = hex || dia ? vec2(1.0) : rad || planks ? rectD : T_fit && !T_sticker ? cell : min(dims, cell);
  // quarter turns keep a square footprint inside its cell, half turns any footprint
  float period = abs(fp.x - fp.y) < 1e-4 * S ? 90.0 : 180.0;
  bool turns = u_randRot > 0.0 || u_tileSpin != 0.0;
  bool tilted = turns || abs(mod(u_rotation, 180.0)) > 1e-3;     // image not upright (for covering a cell)
  // opaque images on hex / diamond lattices are cut to a fixed cell, so turning them never leaves it
  bool locked = !T_sticker && (hex || dia);
  // anything that can push a tile (or its shadow) past its own cell needs the neighbour search (and z-order);
  // so do stickers on hex / diamond / radial lattices, which are drawn whole instead of cut to their cell
  // (a fitted image's shadow can fall on the neighbour's empty margin)
  bool masked = T_fit || (u_tileFit == TILEFIT_FIT && (hex || dia || planks));
  bool search = scatter || u_scaleJit > 0.0 || (!locked && (turns || abs(mod(u_rotation, period)) > 1e-3))
    || (u_shadow > 0.0 && (u_gap > 0.0 || T_sticker || masked))
    || (T_sticker && (hex || dia || rad));

  float pad = (u_shadow > 0.0 ? length(T_shOff) : 0.0) + 2.0 * pg_px * pg_ss;
  if (hex) {
    // cover the hexagon (or, when the image turns, its circumcircle) with as little crop as possible
    vec2 hd = tilted && !T_sticker ? 1.1547005 * S * (asp >= 1.0 ? vec2(asp, 1.0) : vec2(1.0, 1.0 / asp))
                                   : max(S / asp, 1.1547005 * S) * vec2(asp, 1.0);
    if (u_tileFit == TILEFIT_FIT) {
      // the whole image inside the hexagon (inside its incircle when it turns)
      float hy = tilted && !T_sticker ? 0.5 * S / sqrt(1.0 + asp * asp) : min(0.5773503 * S / (1.0 + 0.5773503 * asp), 0.5 * S / asp);
      hd = 2.0 * hy * vec2(asp, 1.0);
      T_fit = !T_sticker;
    } else if (u_tileFit == TILEFIT_STRETCH) {
      // the hexagon's bounding box (scaled up to cover its circumcircle when the image turns)
      hd = (tilted && !T_sticker ? 1.1547005 : 1.0) * S * vec2(1.0, 1.1547005);
    }
    T_sMax = T_sticker ? 1.5 : 2.0;
    T_rB = (T_sticker ? 0.5 * length(hd) : 0.5774 * S) * min(exp2(u_scaleJit), T_sMax) + pad;
    hexLayout(p, hd, S, search);
  } else if (dia) {
    vec2 D = rectD * 1.4142136;
    // stretch (and the image's own shape): the image is drawn at the cell's size
    vec2 img = T_sticker ? rectD : tilted ? D * (max(D.x, D.y) / min(D.x, D.y)) : D;
    if (u_tileFit == TILEFIT_FIT) {
      // the whole image inside the rhombus (inside its incircle when it turns)
      vec2 hD = 0.5 * D;
      float hy = tilted && !T_sticker ? hD.x * hD.y / length(hD) / sqrt(1.0 + asp * asp) : 1.0 / (asp / hD.x + 1.0 / hD.y);
      img = 2.0 * hy * vec2(asp, 1.0);
      T_fit = !T_sticker;
    } else if (shaped && u_tileFit == TILEFIT_CROP) {
      img = fitImage(T_sticker ? rectD : tilted ? vec2(max(D.x, D.y)) : D, asp);
    }
    T_sMax = 1.4;
    T_rB = (T_sticker ? 0.5 * length(rectD) : 0.7072 * max(rectD.x, rectD.y)) * min(exp2(u_scaleJit), T_sMax) + pad;
    diamondLayout(p, D, img, search);
  } else if (rad) {
    T_sMax = 1.4;
    T_clip = 0.5 * rectD;
    if (!search && u_gap == 0.0) T_ext = vec2(T_BIG);
    radialLayout(p, rectD, dims, search);
  } else if (planks) {
    T_sMax = 1.3;
    if (herr) herringboneLayout(p, rectD, asp, search, pad);
    else if (bask) basketLayout(p, rectD, asp, search, pad);
    else windmillLayout(p, rectD, asp, search, pad);
  } else {
    T_clip = 0.5 * fp;
    vec2 P = cell * (1.0 + u_gap);
    // search reach in cells: enough rows / columns that a turned long tile is never cut at full size (up to 3 each
    // way; 2 for sticker bomb, whose base points roam the whole cell)
    float Lc = length(T_clip), sOff = scatter ? 0.0 : 0.5;
    vec2 wn = clamp(ceil(Lc * max(1.0, exp2(u_scaleJit)) / P - sOff), vec2(1.0), vec2(scatter ? 2.0 : 3.0));
    T_win = ivec2(wn);
    vec2 cap = (wn + sOff) * P / Lc;
    T_sMax = min(cap.x, cap.y);
    T_rB = length(T_clip) * min(exp2(u_scaleJit), T_sMax) + pad;
    // tiles that exactly fill their cell: drop the clip there so neighbours meet without a background seam
    if (!search) T_ext = T_BIG * step(P - 2.0 * T_clip, vec2(1e-5 * S));
    T_seamWin = min(vec2(1.0), 2.0 * T_clip / dims);
    rectLayout(p, dims, cell, search);
  }
}

vec4 pattern(vec2 p) {
  // texture LOD from the per-sample footprint; clamped so symmetry folds / floor pixels can't pick a blurry mip
  T_dx = dFdx(p) / pg_ss;
  T_dy = dFdy(p) / pg_ss;
  float lim = 2.0 * pg_px;
  T_dx *= min(1.0, lim / max(length(T_dx), 1e-9));
  T_dy *= min(1.0, lim / max(length(T_dy), 1e-9));
  K_n = 0;
  T_shape = 0;
  T_shapeR = vec2(1.0);
  T_ext = vec2(0.0);
  T_clip = vec2(T_BIG);
  T_shOff = vec2(0.04, -0.055) * u_size;
  T_fit = false;
  T_halfTurns = false;
  T_win = ivec2(1);
  T_seamWin = vec2(1.0);

  if (u_tileShape == TILESHAPE_IMAGE && u_tileFit == TILEFIT_CROP && u_layout != LAYOUT_HERRINGBONE && u_layout != LAYOUT_BASKETWEAVE) classicLayouts(p);
  else shapedLayouts(p);

  vec3 col = u_bgColor;
  for (int i = 0; i < 4; i++) {
    if (i >= K_n) break;
    col = K_col[i].rgb + col * (1.0 - K_col[i].a);
  }
  return vec4(col, 1.0);
}
`,
  });
})();
