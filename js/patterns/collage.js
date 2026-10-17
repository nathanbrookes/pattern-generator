/* Line Collage — an abstract collage of layers made of fine parallel lines: straight strips, see-through bundles
 * and nested picture frames (concentric rectangles, L and U corners with 45° mitres), stacked with soft drop shadows.
 * Elements live on a jittered grid (several per cell, each with a random height). Every sample gathers the elements of
 * the 3×3 neighbouring cells, sorts them by height and composites them front-to-back; each element darkens everything
 * beneath it with an offset, blurred copy of itself (higher layers throw longer, softer shadows). */
(function () {
  const THREAD = ['#cbb99c', '#b4a184', '#9a8870', '#4b4135', '#17130f', '#c9a032'];
  const col = (v) => v.layout !== 'tunnels';   // collage-only controls
  const tun = (v) => v.layout === 'tunnels';   // tunnel-grid-only controls
  const hasFrames = (v) => col(v) && v.frameMix > 0;

  /* Tunnel cords are shaded from a lookup table instead of in the shader (the collage shares the shader program and
   * slows down when it grows). A cord bed — parallel touching cords of radius 1 on a slope — seen from the front only
   * shows the part of each cord its neighbour doesn't hide; its shading depends on the position f across the slot,
   * the picture-plane spacing s of the cords (2 = lying flat, → 0 = a vertical wall), whether the next cord sits
   * lower (tunnel) or higher (pyramid), the light's component across the cords (la) and Relief. The light is 60°
   * above the picture plane (|L.xy| = 0.5). Rows: (pyramid × NL + la) × NS + s; columns: f.
   * R = light / 2, G = occlusion (how far it sinks into the ground colour), B/A = the same averaged over the slot. */
  const LUT = { NF: 96, NS: 32, NL: 17 };
  const LZ = Math.sqrt(3) / 2;
  const smooth = (e0, e1, x) => {
    const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return t * t * (3 - 2 * t);
  };
  function cordShade(f, s, hz, la, relief, out) {
    const x = (hz >= 0 ? 1 - s : -1) + s * f;                                   // cross position on the cord
    const ed = hz > 0 ? s * f : hz < 0 ? s * (1 - f) : 9;                        // distance from the hidden edge
    const py = Math.sqrt(Math.max(1 - x * x, 0));
    let na = (1 - relief) * 0.5 * hz + relief * x;                               // normal (across, towards viewer)
    let nz = (1 - relief) * 0.5 * s + relief * py;
    const nl = Math.hypot(na, nz) || 1;
    na /= nl;
    nz /= nl;
    const ll = Math.hypot(la, LZ), lx = la / ll, lz = LZ / ll;                   // light in the cross-section
    let dmin = 9, cmin = 9;
    for (let k = -1; k <= 1; k += 2) {                                           // the two neighbouring cords
      const cx = k * s - x, cz = -k * hz - py;
      const t = cx * lx + cz * lz;
      if (t > 0) dmin = Math.min(dmin, Math.hypot(cx - lx * t, cz - lz * t));   // ... their shadows
      cmin = Math.min(cmin, Math.hypot(cx, cz));                                 // ... and the crevices
    }
    const sh = relief * smooth(1.15, 0.75, dmin);
    let ao = smooth(0, 0.8, cmin - 1);
    ao = Math.min(ao, 1 + (smooth(0, 0.55, ed) - 1) * (1 - 0.5 * s));          // the slot behind the cord in front
    ao = 1 + (ao - 1) * relief;
    const hv = Math.hypot(0.5, LZ + 1);
    let sp = Math.max((na * la + nz * (LZ + 1)) / hv, 0);
    sp *= sp; sp *= sp; sp *= sp; sp *= sp;
    const dl = (Math.max(na * la + nz * LZ, 0) / LZ) * (1 - sh);                // direct light that reaches it
    out[0] = 0.42 * ao + (0.58 * dl + 0.45 * relief * sp * (1 - sh));
    out[1] = 1 + (ao - 1) * 0.6 * (1 - 0.7 * Math.min(dl, 1));                // lit crevices don't sink as deep
  }
  function buildCordLut(v) {
    if (v.layout !== 'tunnels') return { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) };
    const { NF, NS, NL } = LUT;
    const H = 2 * NL * NS;
    const data = new Uint8Array(NF * H * 4);
    const o = [0, 0], lit = new Float32Array(NF), ao = new Float32Array(NF);
    const b = (x) => Math.max(0, Math.min(255, Math.round(x * 255)));
    for (let pyr = 0; pyr < 2; pyr++)
      for (let li = 0; li < NL; li++)
        for (let si = 0; si < NS; si++) {
          const s = Math.max((2 * si) / (NS - 1), 0.01);
          const hz = (pyr ? -1 : 1) * Math.sqrt(Math.max(4 - s * s, 0));
          const la = -0.5 + li / (NL - 1);
          let m0 = 0, m1 = 0;
          for (let fi = 0; fi < NF; fi++) {
            cordShade(fi / (NF - 1), s, hz, la, v.relief, o);
            lit[fi] = o[0];
            ao[fi] = o[1];
            const w = fi === 0 || fi === NF - 1 ? 0.5 : 1;                          // trapezoid rule
            m0 += w * o[0] * o[1];
            m1 += w * o[1];
          }
          m0 /= NF - 1;
          m1 /= NF - 1;
          // cords lying flat are the raised dividers: softer, flatter bundles (40% of the way to their mean tone;
          // the tone is linear in ao and lit * ao, so mixing those mixes the tone)
          const soft = si === NS - 1 ? 0.4 : 0;
          const row = ((pyr * NL + li) * NS + si) * NF * 4;
          for (let fi = 0; fi < NF; fi++) {
            const i = row + fi * 4;
            const a = ao[fi] + (m1 - ao[fi]) * soft;
            data[i] = b((lit[fi] * ao[fi] + (m0 - lit[fi] * ao[fi]) * soft) / a / 2);
            data[i + 1] = b(a);
            data[i + 2] = b(m0 / 2);
            data[i + 3] = b(m1);
          }
        }
    return { width: NF, height: H, data };
  }

  PG.registerPattern({
    id: 'collage',
    name: 'Line Collage',
    category: 'Geometric',
    description: 'Overlapping strips, bundles and nested frames of fine parallel lines, stacked with soft shadows like a thread collage — or a grid of recessed tunnels wound from cord.',
    params: [
      { type: 'heading', label: 'Layout' },
      { id: 'layout', label: 'Layout', type: 'select', options: [['collage', 'Collage'], ['tunnels', 'Tunnel grid']], default: 'collage', random: false, help: 'Collage = stacked strips and frames. Tunnel grid = square cells, each a recessed tunnel of concentric cord rings' },
      { id: 'scale', label: 'Element size', min: 0.15, max: 3, default: 0.6, step: 0.001, scale: 'log', random: [0.4, 1], showIf: col, help: 'Size of the grid that places the elements; strips grow up to two cells long' },
      { id: 'density', label: 'Layers', min: 0.5, max: 4, default: 3, step: 0.01, random: [1.8, 3.4], showIf: col, help: 'Elements per grid cell: more = deeper, busier stacks' },
      { id: 'frameMix', label: 'Frames', min: 0, max: 1, default: 0.5, step: 0.01, random: [0.15, 0.65], showIf: col, help: 'Share of nested frames versus straight strips' },
      { id: 'corners', label: 'Open corners', min: 0, max: 1, default: 0.6, step: 0.01, random: [0.2, 0.8], showIf: hasFrames, help: 'Share of frames drawn as L and U shapes instead of closed rectangles' },
      { id: 'orient', label: 'Horizontal bias', min: 0, max: 1, default: 0.55, step: 0.01, random: [0.3, 0.75], showIf: col, help: 'Share of strips that run horizontally (also turns the base layer)' },
      { id: 'baseLines', label: 'Lined base layer', type: 'bool', default: true, random: 0.6, showIf: col, help: 'Fill the bottom of the stack with lines instead of the plain background' },
      { id: 'cell', label: 'Cell size', min: 0.1, max: 3, default: 0.5, step: 0.001, scale: 'log', random: [0.3, 0.9], showIf: tun, help: 'Height of one tunnel cell, divider included' },
      { id: 'cellAspect', label: 'Cell aspect', min: 0.4, max: 2.5, default: 1, step: 0.01, scale: 'log', random: [0.8, 1.3], showIf: tun, help: 'Cell width ÷ height' },
      { id: 'divider', label: 'Divider width', min: 0, max: 0.4, default: 0.08, step: 0.005, random: [0.03, 0.14], showIf: tun, help: 'Raised cord frame between the cells, as a share of the cell height' },
      { id: 'divCords', label: 'Divider cords', type: 'int', min: 1, max: 8, default: 1, random: [1, 4], showIf: (v) => tun(v) && v.divider > 0, help: 'Cords laid side by side in each divider' },
      { id: 'hole', label: 'Hole size', min: 0, max: 0.8, default: 0.12, step: 0.005, random: [0.05, 0.25], showIf: tun, help: 'Size of the dark square at the end of each tunnel (the flat top of a pyramid)' },
      { id: 'holeX', label: 'Hole offset X', min: -0.8, max: 0.8, default: 0, step: 0.01, random: [-0.3, 0.3], showIf: tun, help: 'Moves every vanishing point sideways, like looking at the grid from one side' },
      { id: 'holeY', label: 'Hole offset Y', min: -0.8, max: 0.8, default: -0.15, step: 0.01, random: [-0.4, 0.2], showIf: tun, help: 'Moves every vanishing point up or down, like looking at the grid from above or below' },
      { id: 'jitter', label: 'Hole jitter', min: 0, max: 1, default: 0.3, step: 0.01, random: [0.1, 0.5], showIf: tun, help: 'Per-cell wander of the vanishing point (drifts smoothly across the grid) and of the hole size' },
      { id: 'pyramids', label: 'Raised pyramids', min: 0, max: 1, default: 0, step: 0.01, random: [0, 0.3], showIf: tun, help: 'Share of cells turned inside out: stepped pyramids rising towards you instead of tunnels' },

      { type: 'heading', label: 'Lines' },
      { id: 'pitch', label: 'Line spacing', min: 0.004, max: 0.08, default: 0.013, step: 0.0005, scale: 'log', random: [0.009, 0.026], showIf: col },
      { id: 'variety', label: 'Line variety', min: 0, max: 1, default: 0.6, step: 0.01, random: [0.3, 0.9], showIf: col, help: 'How much line weight and spacing vary between and within elements' },
      { id: 'open', label: 'See-through', min: 0, max: 1, default: 0.45, step: 0.01, random: [0.2, 0.75], showIf: col, help: 'Share of elements with open gaps between their lines; the rest are packed solid' },
      { id: 'rings', label: 'Rings', type: 'int', min: 2, max: 40, default: 11, random: [6, 18], showIf: tun, help: 'Cord rings wound from the rim of each tunnel to its hole' },
      { id: 'persp', label: 'Perspective', min: 0, max: 1, default: 0.15, step: 0.01, random: [0, 0.6], showIf: tun, help: 'Rings crowd together towards the hole, like a deep tunnel seen in perspective' },
      { id: 'cordGap', label: 'Cord gaps', min: 0, max: 0.8, default: 0, step: 0.01, random: [0, 0.3], showIf: tun, help: 'Space between neighbouring cords, where the background shows through' },
      { id: 'wobble', label: 'Hand-made wobble', min: 0, max: 1, default: 0.3, step: 0.01, random: [0, 0.6], showIf: tun, help: 'Slightly wavy, uneven rings' },
      { id: 'fibre', label: 'Fibre texture', min: 0, max: 1, default: 0.45, step: 0.01, random: [0.15, 0.8], help: 'Streaky thread / straw grain along the lines (tunnels: twisted cord strands)' },

      { type: 'heading', label: 'Color' },
      { id: 'palette', label: 'Line colors', type: 'palette', min: 1, max: 10, default: THREAD, help: 'Collage: the first color is the most common; with 3+ colors the last one is the accent. Tunnels: the cord colors (see Cord coloring)' },
      { id: 'tColors', label: 'Cord coloring', type: 'select', options: [['mono', 'First color only'], ['cells', 'One per cell'], ['rings', 'Ring bands']], default: 'mono', random: ['mono', 'mono', 'cells', 'rings'], showIf: tun, help: 'How the tunnels use the palette' },
      { id: 'accent', label: 'Accent amount', min: 0, max: 0.5, default: 0.04, step: 0.005, random: [0, 0.14], showIf: col, help: 'Share of lines in the last palette color' },
      { id: 'darkLines', label: 'Dark elements', min: 0, max: 1, default: 0.42, step: 0.01, random: [0.2, 0.7], showIf: col, help: 'Share of elements made mostly from the later palette colors (and more dark lines in the rest)' },
      { id: 'ground', label: 'Background', type: 'color', default: '#18130f', random: 'dark', help: 'Shows behind everything and in the gaps between packed lines (tunnels: the deep shadow between cords and in the holes)' },

      { type: 'heading', label: 'Depth' },
      { id: 'shadow', label: 'Shadow strength', min: 0, max: 1, default: 0.62, step: 0.01, random: [0.45, 0.85], showIf: col },
      { id: 'shadowSize', label: 'Shadow size', min: 0, max: 1, default: 0.4, step: 0.01, random: [0.2, 0.6], showIf: col, help: 'Offset and softness; higher layers throw longer, softer shadows' },
      { id: 'shadowAngle', label: 'Shadow direction', min: -180, max: 180, default: -60, step: 1, unit: '°', random: [-150, -30], showIf: col },
      { id: 'lightAngle', label: 'Light direction', min: -180, max: 180, default: 65, step: 1, unit: '°', random: [20, 160], showIf: tun, help: 'Where the light comes from (90° = from above)' },
      { id: 'faces', label: 'Face contrast', min: 0, max: 1, default: 0.75, step: 0.01, random: [0.3, 0.8], showIf: tun, help: 'Steeper tunnel walls: bigger difference between the lit and shaded faces' },
      { id: 'depthShade', label: 'Depth shading', min: 0, max: 1, default: 0.7, step: 0.01, random: [0.4, 0.9], showIf: tun, help: 'Tunnels darken towards the hole (pyramids towards their base)' },
      { id: 'holeDark', label: 'Hole darkness', min: 0, max: 1, default: 1, step: 0.01, random: [0.6, 1], showIf: tun, help: '1 = a black opening; 0 = a flat back panel, like a coffer' },
      { id: 'relief', label: 'Relief', min: 0, max: 1, default: 0.65, step: 0.01, random: [0.25, 0.8], help: 'Rounded lines, lit frame walls and darker frame depths (tunnels: rounded cords and deep gaps between them)' },

      { type: 'heading', label: 'Animation' },
      { id: 'speed', label: 'Parallax sway', min: 0, max: 2, default: 0.4, step: 0.01, random: [0.2, 0.8], help: 'With Animate on, the layers drift by different amounts (tunnels: the vanishing points sway), like a camera moving past them' },
    ],
    presets: [
      { name: 'Thread Collage', thumb: true, values: {}, seed: 2 },
      {
        name: 'Ink & Paper',
        values: {
          palette: ['#1b1a19', '#3a3936', '#6d6a64', '#b9332b'], accent: 0.04, darkLines: 0.15, ground: '#f3efe6',
          baseLines: false, open: 0.7, pitch: 0.013, variety: 0.55, frameMix: 0.45, density: 2.2, fibre: 0.25,
          shadow: 0.35, shadowSize: 0.35, relief: 0.25,
        },
        seed: 11,
      },
      {
        name: 'Bauhaus Strips',
        values: {
          palette: ['#f1ebdc', '#d62828', '#1d4fd8', '#111111', '#f7c600'], accent: 0.12, darkLines: 0.55, ground: '#f1ebdc',
          baseLines: false, frameMix: 0.12, corners: 0.6, scale: 0.75, density: 2.2, pitch: 0.03, variety: 0.25, open: 0.25,
          fibre: 0.1, shadow: 0.55, shadowSize: 0.5, relief: 0.3,
        },
        seed: 1,
      },
      {
        name: 'Neon Wire',
        values: {
          palette: ['#05d9e8', '#ff2a6d', '#d1f7ff', '#7b2dff', '#f9f871'], accent: 0.1, darkLines: 0.6, ground: '#07040f',
          baseLines: false, open: 0.9, pitch: 0.02, variety: 0.7, frameMix: 0.5, corners: 0.6, density: 2.4, fibre: 0,
          shadow: 0.85, shadowSize: 0.55, relief: 0.6,
        },
        seed: 23,
      },
      {
        name: 'Blueprint',
        values: {
          palette: ['#e8f1ff', '#a9c8f2', '#5d8fd6', '#2d5fa8', '#ffffff'], accent: 0.05, darkLines: 0.3, ground: '#0d2b5e',
          baseLines: false, open: 0.75, pitch: 0.014, variety: 0.4, frameMix: 0.65, corners: 0.45, density: 2.4, fibre: 0,
          shadow: 0.6, shadowSize: 0.35, relief: 0.15,
        },
        seed: 8,
      },
      {
        name: 'Sunset Tape',
        values: {
          palette: ['#f6d6a8', '#f4a259', '#e76f51', '#9b2c4f', '#3d1d3f', '#ffd166'], accent: 0.08, darkLines: 0.45, ground: '#2a1528',
          pitch: 0.024, variety: 0.5, open: 0.35, frameMix: 0.3, scale: 0.7, density: 2.8, fibre: 0.35,
          shadow: 0.7, shadowSize: 0.5, shadowAngle: -110, relief: 0.45,
        },
        seed: 14,
      },
      {
        name: 'Monochrome Frames',
        values: {
          palette: ['#e8e8e6', '#bdbdbb', '#7c7c7a', '#2f2f2e', '#0e0e0e'], accent: 0, darkLines: 0.4, ground: '#0b0b0b',
          frameMix: 0.88, corners: 0.3, scale: 0.7, density: 2.3, pitch: 0.013, variety: 0.45, open: 0.3, fibre: 0.2,
          shadow: 0.8, shadowSize: 0.45, relief: 0.7,
        },
        seed: 3,
      },
      {
        name: 'Cord Tunnels',
        values: {
          layout: 'tunnels', palette: ['#545040'], tColors: 'mono', ground: '#0c0a07',
          cell: 0.92, cellAspect: 1, divider: 0.085, divCords: 1, hole: 0.07, holeX: 0, holeY: -0.36, jitter: 0.3, holeDark: 0.85,
          rings: 14, persp: 0.1, wobble: 0.4, fibre: 0.15, lightAngle: 65, faces: 0.9, depthShade: 0.75, relief: 0.75,
        },
        transform: { panX: 0.519, panY: -0.061 },
        seed: 47,
      },
      {
        name: 'Sandstone Tunnels',
        values: {
          layout: 'tunnels', palette: ['#d9b68b', '#c99f70', '#e4cba5', '#b8895a'], tColors: 'cells', ground: '#2a190d',
          cell: 0.62, divider: 0.07, divCords: 2, hole: 0.14, holeY: -0.1, jitter: 0.3, holeDark: 0.9, pyramids: 0.2,
          rings: 14, persp: 0.3, wobble: 0.35, fibre: 0.4, lightAngle: 125, faces: 0.7, depthShade: 0.75, relief: 0.6,
        },
        seed: 4,
      },
      {
        name: 'Gold Ziggurats',
        values: {
          layout: 'tunnels', palette: ['#e0b04a'], tColors: 'mono', ground: '#050403', pyramids: 1, cordGap: 0.3,
          cell: 0.5, divider: 0.05, divCords: 1, hole: 0.18, holeX: 0, holeY: 0, jitter: 0.08,
          rings: 8, persp: 0, wobble: 0, fibre: 0, lightAngle: 120, faces: 0.9, depthShade: 0.8, relief: 0.85,
        },
        seed: 1,
      },
      {
        name: 'Concrete Coffers',
        values: {
          layout: 'tunnels', palette: ['#a7a49d'], tColors: 'mono', ground: '#262523',
          cell: 0.7, divider: 0.16, divCords: 1, hole: 0.42, holeX: 0, holeY: 0, jitter: 0, holeDark: 0.15,
          rings: 4, persp: 0, wobble: 0, fibre: 0.3, lightAngle: 110, faces: 0.55, depthShade: 0.45, relief: 0.2,
        },
        seed: 1,
      },
      {
        name: 'Neon Tunnels',
        values: {
          layout: 'tunnels', palette: ['#05d9e8', '#ff2a6d', '#f9f871', '#7b2dff'], tColors: 'rings', ground: '#030208',
          cell: 0.55, divider: 0.05, divCords: 1, hole: 0.1, holeY: -0.1, jitter: 0.35, holeDark: 1, cordGap: 0.45,
          rings: 13, persp: 0.35, wobble: 0, fibre: 0, lightAngle: 100, faces: 0.8, depthShade: 0.9, relief: 0.8,
        },
        seed: 9,
      },
    ],
    textures: [{ id: 'tnLut', deps: ['layout', 'relief'], filter: 'linear', wrap: 'clamp', build: buildCordLut }],
    glsl: /* glsl */ `
#define CL_MAX 8

// Extra avalanche so every bit field of a hash is usable (integer-valued float keys leave PCG's low bits weak).
uvec3 cl_mix(uvec3 h) {
  h ^= h >> 16u; h *= 0x7feb352du;
  h ^= h >> 15u; h *= 0x846ca68bu;
  return h ^ (h >> 16u);
}
// Nine uniform randoms in [0,1) (10 bits each) from one seeded hash.
void cl_rand9(vec2 key, out vec3 a, out vec3 b, out vec3 c) {
  uvec3 h = cl_mix(pg_hashBits(key));
  a = vec3(h & 1023u) * (1.0 / 1024.0);
  b = vec3((h >> 10u) & 1023u) * (1.0 / 1024.0);
  c = vec3((h >> 20u) & 1023u) * (1.0 / 1024.0);
}
// Six uniform randoms (16 bits each) from three integer-valued floats.
void cl_rand3(vec3 v, out vec3 a, out vec3 b) {
  uvec3 h = cl_mix(pg_pcg3d(floatBitsToUint(v) ^ uvec3(0u, 0u, uint(u_seed) * 747796405u + 2891336453u)));
  a = vec3(h & 0xffffu) * (1.0 / 65536.0);
  b = vec3(h >> 16u) * (1.0 / 65536.0);
}

// Line recipe of one element.
struct ClRec {
  float key;    // hash key (integer valued)
  float pitch;  // slot width in pattern units (one line per slot)
  float fill;   // line width / slot
  float open;   // 1 = the gaps between lines are see-through
  float e;      // color exponent: large = mostly the first palette color
  float dark;   // 1 = the palette order is reversed (an element built mostly from the later, darker colors)
  float tint;   // brightness multiplier
  float skip;   // chance that a slot has no line
  float group;  // neighbouring lines share a color in runs of this many
  float accent; // chance that a line takes the accent (last) color
  float band;   // frames: band width / half-size (1 = nested all the way to the centre)
  float sides;  // frames: side bits (1 top, 2 right, 4 bottom, 8 left)
};

// Bit field [shift, shift + n) of w as a uniform random in [0,1).
float cl_bits(uint w, int shift, int n) { return float((w >> uint(shift)) & ((1u << uint(n)) - 1u)) / float(1 << n); }

ClRec cl_recipe(vec2 id, bool frame) {
  uvec3 h = cl_mix(pg_hashBits(id + vec2(0.0, 80000.0)));
  ClRec r;
  r.key = float(h.x >> 9u);
  r.pitch = u_pitch * exp2((cl_bits(h.x, 0, 8) - 0.5) * 2.6 * u_variety);
  r.open = cl_bits(h.x, 8, 8) < u_open * (frame ? 0.5 : 1.25) ? 1.0 : 0.0;   // frames are mostly packed, strips more often loose
  r.e = exp2(mix(2.4, 1.1, u_darkLines) + (cl_bits(h.x, 16, 8) - 0.5) * 1.6);
  r.dark = cl_bits(h.y, 26, 6) < 0.3 * u_darkLines ? 1.0 : 0.0;
  if (r.dark > 0.5 && cl_bits(h.z, 28, 4) < 0.75) r.open = 1.0;           // dark elements are mostly loose sticks
  r.pitch *= 1.0 + 0.35 * r.open;                                         // loose bundles: chunkier sticks
  float fl = cl_bits(h.x, 24, 8);
  r.fill = r.open > 0.5 ? mix(0.35, 0.75, fl) : mix(0.8, 1.0, fl * (2.0 - fl));
  r.tint = 0.9 + 0.18 * cl_bits(h.y, 0, 6);
  r.skip = r.open > 0.5 ? 0.25 * cl_bits(h.y, 6, 6) : 0.0;
  r.band = cl_bits(h.y, 12, 6) < 0.45 ? 1.0 : mix(0.3, 0.85, cl_bits(h.y, 18, 8));
  float g = cl_bits(h.z, 16, 6), ac = cl_bits(h.z, 22, 6);
  r.group = 1.0 + floor(g * g * 6.0);
  r.accent = u_accent * 2.5 * ac * ac;
  int bits = 15;
  if (cl_bits(h.z, 0, 8) < u_corners) {
    int rot = int((h.z >> 8u) & 3u);
    int base = cl_bits(h.z, 10, 6) < 0.6 ? 3 : 7;   // L corner (top + right) or U (three sides), then rotated
    bits = ((base << rot) | (base >> (4 - rot))) & 15;
    r.band = min(r.band, mix(0.3, 0.75, cl_bits(h.y, 18, 8)));   // open shapes: arms, not triangles
  }
  r.sides = float(bits);
  return r;
}

// Average color of an element (what its lines blend into when they shrink below a pixel).
vec3 cl_mean(ClRec r) {
  int n = u_palette_count;
  int m = n >= 3 ? n - 1 : n;
  vec3 s = vec3(0.0);
  float prev = 0.0;
  for (int k = 0; k < 16; k++) {
    if (k >= m) break;
    float cdf = pow(float(k + 1) / float(m), 1.0 / r.e);
    s += (cdf - prev) * u_palette[r.dark > 0.5 ? m - 1 - k : k];
    prev = cdf;
  }
  return n >= 3 ? mix(s, u_palette[n - 1], r.accent) : s;
}

// Slot geometry shared by the lines and their shadows: x = line centre in the slot, y = line width (slot units).
vec2 cl_slot(vec3 h0, ClRec r) {
  float w = r.fill * mix(1.0, r.open > 0.5 ? 0.4 + 0.6 * h0.x : 0.7 + 0.3 * h0.x, u_variety);   // packed: no wide black gaps
  return vec2(0.5 + (h0.y - 0.5) * (1.0 - w), w);
}

// Parallel lines across coordinate u (pattern units), along coordinate a. lsgn = how much the +u side faces the light.
// Open elements return (line color, coverage); packed ones return (lines over the gap color, 1).
vec4 cl_lines(float u, float a, ClRec r, float lsgn) {
  float s = u / r.pitch;
  float i = floor(s), f = s - i;
  vec3 h0, h1, c0, c1;
  cl_rand3(vec3(i, r.key, 1.0), h0, h1);                       // per line: geometry, tone, fibres
  cl_rand3(vec3(floor(i / r.group), r.key, 2.0), c0, c1);      // per run of lines: color
  vec2 sl = cl_slot(h0, r);
  float t = clamp((f - sl.x) / (0.5 * sl.y), -1.0, 1.0);
  float cov = pg_fill((abs(f - sl.x) - 0.5 * sl.y) * r.pitch) * step(r.skip, h0.z);

  int n = u_palette_count;
  int m = n >= 3 ? n - 1 : n;
  int ci = min(int(pow(c0.y, r.e) * float(m)), m - 1);
  vec3 col = (n >= 3 && c1.x < r.accent) ? u_palette[n - 1] : u_palette[r.dark > 0.5 ? m - 1 - ci : ci];   // accents come in runs too
  col *= r.tint * (0.92 + 0.16 * h1.z);

  float px = pg_px / r.pitch;                                   // one sample, in slots
  float rel = u_relief * (1.0 - smoothstep(0.12, 0.4, px / sl.y));
  col *= 1.0 - rel * (0.5 * t * t * t * t + 0.12 * t * t - 0.2 * t * lsgn);    // rounded, lit from one side
  if (u_fibre > 0.0) {
    // fibres: four thin streaks per line, each broken into staggered dashes of random tone; slow drift along the line
    float ax = a / r.pitch;
    float j = floor(f * 4.0);
    float fx = ax / 1.8 + fract(h1.x * (j + 1.0) * 7.31) * 4.0;
    vec3 fa, fb;
    cl_rand3(vec3(floor(fx), i * 4.0 + j, r.key), fa, fb);
    float fz = 1.0 - smoothstep(0.3, 0.8, px * 4.0);
    float fib = mix(fa.x, fa.y, fract(fx)) - 0.5 + 0.6 * (fb.x - 0.5) * step(0.8, fb.y);
    float mot = sin(ax * (0.02 + 0.05 * h1.z) + h0.z * PG_TAU);
    col *= 1.0 + u_fibre * (0.42 * fib * fz + 0.1 * mot);
  }
  // far away / zoomed out: settle on the element's average instead of aliasing
  float fade = smoothstep(0.3, 0.8, px);
  if (fade > 0.0) {
    vec3 mc = cl_mean(r) * r.tint * (1.0 - 0.17 * u_relief);
    float mcov = r.fill * mix(1.0, r.open > 0.5 ? 0.7 : 0.85, u_variety) * (1.0 - r.skip);
    col = mix(col, mc, fade);
    cov = mix(cov, mcov, fade);
  }
  return r.open > 0.5 ? vec4(col, cov) : vec4(mix(u_ground, col, cov), 1.0);
}

// Which frame sides are drawn at q (hsel = 1 on the top/bottom sides, 0 on the left/right ones).
float cl_sides(vec2 q, float sides, float hsel) {
  int sb = int(sides);
  float fH = float((sb >> (q.y > 0.0 ? 0 : 2)) & 1);
  float fV = float((sb >> (q.x > 0.0 ? 1 : 3)) & 1);
  return mix(fV, fH, hsel);
}

// Color + coverage of an element at q (relative to its centre, pattern units). type 0 = horizontal strip,
// 1 = vertical strip, 2 = frame.
vec4 cl_element(vec2 q, vec2 hs, float type, ClRec r, vec2 L) {
  if (type < 1.5) {
    float cov = pg_fill(pg_sdBox(q, hs));
    if (cov <= 0.0) return vec4(0.0);
    vec4 c = type < 0.5 ? cl_lines(q.y + hs.y, q.x, r, L.y) : cl_lines(q.x + hs.x, q.y, r, L.x);
    return vec4(c.rgb, c.a * cov);
  }
  // frame: u = inset from the outer edge, so the lines are concentric rectangles with mitred corners
  float dx = hs.x - abs(q.x), dy = hs.y - abs(q.y);
  float d = min(dx, dy);
  float hsel = pg_fill((dy - dx) * 0.7071);
  float T = r.band * min(hs.x, hs.y);
  float cov = pg_fill(-d) * pg_fill(d - T) * cl_sides(q, r.sides, hsel);
  if (cov <= 0.0) return vec4(0.0);
  // walls of a recess: each side faces inwards; lit sides brighter, deeper rings darker
  float lH = -sign(q.y) * L.y, lV = -sign(q.x) * L.x;
  bool horiz = dy < dx;
  vec4 c = cl_lines(d, horiz ? q.x : q.y, r, horiz ? lH : lV);
  float lit = 1.0 + 0.4 * u_relief * mix(lV, lH, hsel);
  float deep = 1.0 - 0.8 * u_relief * smoothstep(0.0, 1.0, d / max(min(hs.x, hs.y), 1e-5));
  return vec4(c.rgb * lit * deep, c.a * cov);
}

// Soft silhouette of an element (for its shadow), blurred by b.
float cl_mask(vec2 q, vec2 hs, float type, ClRec r, float b) {
  float m, u;
  if (type < 1.5) {
    m = clamp(0.5 - pg_sdBox(q, hs) / b, 0.0, 1.0);
    u = type < 0.5 ? q.y + hs.y : q.x + hs.x;
  } else {
    float dx = hs.x - abs(q.x), dy = hs.y - abs(q.y);
    float d = min(dx, dy);
    float hsel = clamp(0.5 + (dx - dy) * 0.7071 / b, 0.0, 1.0);
    float T = r.band * min(hs.x, hs.y);
    m = clamp(0.5 + d / b, 0.0, 1.0) * clamp(0.5 - (d - T) / b, 0.0, 1.0) * cl_sides(q, r.sides, hsel);
    u = d;
  }
  if (r.open > 0.5 && m > 0.0) {
    // separate lines throw separate shadows through the gaps
    float s = u / r.pitch, i = floor(s), f = s - i;
    vec3 h0, h1;
    cl_rand3(vec3(i, r.key, 1.0), h0, h1);
    vec2 sl = cl_slot(h0, r);
    float bl = max(min(b, 0.3 * r.pitch), pg_px);                 // keep line shadows distinct
    float lm = clamp(0.5 - (abs(f - sl.x) - 0.5 * sl.y) * r.pitch / bl, 0.0, 1.0) * step(r.skip, h0.z);
    float mean = r.fill * mix(1.0, 0.7, u_variety) * (1.0 - r.skip);
    m *= mix(lm, mean, smoothstep(0.3, 0.8, pg_px / r.pitch));
  }
  return m;
}

// Bottom of the stack: endless lines broken into long runs.
vec3 cl_base(vec2 p, vec2 L) {
  if (u_baseLines < 0.5) return u_ground;
  bool hz = u_orient >= 0.5;
  float u = hz ? p.y : p.x, a = hz ? p.x : p.y;
  float band = floor(u / (u_pitch * 9.0));                // panels nine lines high, cut into long runs
  vec3 h0, h1;
  cl_rand3(vec3(band, 3.0, 3.0), h0, h1);
  float seg = floor(a / (u_scale * mix(0.8, 3.5, h0.x)) + h0.y);
  ClRec r = cl_recipe(vec2(seg, band - 300000.0), false);
  r.pitch = u_pitch;
  r.open = 0.0;
  r.skip = 0.0;
  r.accent *= 0.3;
  r.fill = mix(0.55, 0.92, h1.x);
  return cl_lines(u, a, r, hz ? L.y : L.x).rgb * 0.86;
}

// Candidate k of grid cell c. False if it doesn't exist; otherwise its centre and half-size (cells), type
// (0 = horizontal strip, 1 = vertical strip, 2 = frame), height z and id.
bool cl_place(vec2 c, int k, vec2 sway, float hmax, out vec2 ctr, out vec2 hs, out float type, out float z, out vec2 id) {
  id = vec2(c.x * 4.0 + float(k), c.y);
  vec3 a, b, h;
  cl_rand9(id, a, b, h);
  z = a.z;
  if (a.y < u_frameMix) {
    type = 2.0;
    hs = vec2(mix(0.25, 0.95, b.z), mix(0.25, 0.95, h.x));
    z = 0.05 + 0.75 * z;                                  // frames tend to lie lower
  } else {
    float len = mix(0.35, 0.97, b.z), th = mix(0.03, 0.34, h.x * h.x);
    bool hz = h.y < u_orient;
    type = hz ? 0.0 : 1.0;
    hs = hz ? vec2(len, th) : vec2(th, len);
    z = 0.2 + 0.8 * z;
  }
  hs = min(hs, vec2(hmax));
  ctr = c + b.xy + sway * z;
  return a.x < u_density - float(k);
}

vec4 cl_collage(vec2 p) {
  float S = u_scale;
  float ang = radians(u_shadowAngle);
  vec2 sdir = vec2(cos(ang), sin(ang));       // direction the shadows fall
  vec2 L = -sdir;                             // towards the light
  float shOff = 0.05 * u_shadowSize;          // shadow offset of the highest layer (pattern units)
  float shBlur = 0.045 * u_shadowSize;
  float swayAmp = u_speed > 0.0 ? 0.05 * S : 0.0;
  float tt = u_time * u_speed;
  vec2 sway = swayAmp * vec2(sin(tt * 0.7), sin(tt * 0.53 + 1.3)) / S;     // cells, scaled by height below
  float reach = (shOff + shBlur + swayAmp) / S + 0.01;                    // cells
  float hmax = max(0.99 - reach, 0.15);

  // gather the candidates whose rectangle (plus shadow reach) contains p, as sorted keys: height * 64 + candidate
  float LK[CL_MAX];
  int n = 0;
  vec2 g = p / S, gc = floor(g);
  for (int ci = 0; ci < 36; ci++) {
    int k = ci & 3;
    if (float(k) >= u_density) continue;
    vec2 c = gc + vec2(float((ci >> 2) % 3 - 1), float(ci / 12 - 1));
    vec2 ctr, hs, id; float type, z;
    if (!cl_place(c, k, sway, hmax, ctr, hs, type, z, id)) continue;
    if (any(greaterThan(abs(g - ctr), hs + reach))) continue;
    float key = floor(z * 1024.0) * 64.0 + float(ci);
    if (n == CL_MAX) {                                        // full: drop the lowest
      if (key <= LK[0]) continue;
      for (int s = 0; s < CL_MAX - 1; s++) LK[s] = LK[s + 1];
      n--;
    }
    int j = n;
    for (int s = 0; s < CL_MAX; s++) {
      if (j == 0 || LK[j - 1] <= key) break;
      LK[j] = LK[j - 1];
      j--;
    }
    LK[j] = key;
    n++;
  }

  // composite front-to-back: each layer adds its lines, then shadows everything beneath it
  vec3 acc = vec3(0.0);
  float T = 1.0;
  for (int j = CL_MAX - 1; j >= 0; j--) {
    if (j >= n) continue;
    if (T < 0.003) break;
    int ci = int(mod(LK[j], 64.0));
    vec2 c = gc + vec2(float((ci >> 2) % 3 - 1), float(ci / 12 - 1));
    vec2 ctr, hs, id; float type, z;
    cl_place(c, ci & 3, sway, hmax, ctr, hs, type, z, id);
    vec2 q = (g - ctr) * S;
    hs *= S;
    ClRec r = cl_recipe(id, type > 1.5);
    vec4 e = cl_element(q, hs, type, r, L);
    float sh = 0.0;
    if (u_shadow > 0.0) {
      sh = cl_mask(q - sdir * shOff * (0.25 + 0.75 * z), hs, type, r, max(shBlur * (0.3 + 0.7 * z), pg_px));
    }
    acc += T * e.a * e.rgb;
    T *= (1.0 - e.a) * (1.0 - u_shadow * sh);
  }
  if (T > 0.003) acc += T * cl_base(p, L);
  return vec4(acc, 1.0);
}

// ================================================================ Tunnel grid
// Every cell is a recessed square tunnel (or a raised pyramid) wound from concentric rings of cord around an
// off-centre vanishing point, framed by raised cord dividers. A point's ring parameter t (0 = rim, 1 = hole) is the
// smallest of the four faces' parameters, so the faces meet on mitred seams running from the corners to the hole.
// Faces are numbered 0 right, 1 top, 2 left, 3 bottom.
// This code shares one shader program with the collage, and the collage slows down when the program grows, so it is
// kept compact: the cord shading comes from a lookup table (buildCordLut), and loops get a bound the compiler can't
// see through (TN_N) so they aren't unrolled into many inlined copies.
#define TN_N(n) ((n) + min(u_palette_count, 0))

vec3 tn_L = vec3(0.0, 0.0, 1.0);    // towards the light (set by tn_grid)
vec3 tn_Hv = vec3(0.0, 0.0, 1.0);   // half-way vector between the light and the viewer

// Ambient (dimmed by occlusion ao) + diffuse and a soft sheen (dimmed by shadow sh); 1 for a flat, open surface.
float tn_lit(vec3 n, float sh, float ao) {
  float sp = max(dot(n, tn_Hv), 0.0);
  sp *= sp; sp *= sp; sp *= sp; sp *= sp;                         // ^16
  return 0.42 * ao + (0.58 * max(dot(n, tn_L), 0.0) / tn_L.z + 0.45 * u_relief * sp) * (1.0 - sh);
}

// A bed of parallel, touching cords (radius 1) lying on a slope, seen from the front. a = picture-plane direction
// across the cords, s = picture-plane spacing of their centres, hz = how much lower the next cord (towards +a) sits
// (s² + hz² = 4: they touch), Nf = the slope's own normal (what Relief 0 flattens the cords to).
struct TnBed { vec2 a; float s; float hz; vec3 Nf; };

// Slope running a picture-plane distance span from the rim (height 0) to the hole (height -sgn * D).
TnBed tn_bed(vec2 a, float span, float D, float sgn) {
  float r = inversesqrt(span * span + D * D);
  return TnBed(a, 2.0 * span * r, 2.0 * sgn * D * r, vec3(a * (sgn * D * r), span * r));
}

// Light and occlusion of a cord bed at slot position f (0..1) from the lookup table (see buildCordLut); .zw = the same
// averaged over the whole slot.
vec4 tn_lut(TnBed b, float f) {
  const float NF = 96.0, NS = 32.0, NL = 17.0;
  float lf = (clamp(dot(tn_L.xy, b.a), -0.5, 0.5) + 0.5) * (NL - 1.0);
  float l0 = min(floor(lf), NL - 2.0);
  float row = ((b.hz < 0.0 ? NL : 0.0) + l0) * NS + clamp(0.5 * b.s, 0.0, 1.0) * (NS - 1.0) + 0.5;
  vec2 uv = vec2((clamp(f, 0.0, 1.0) * (NF - 1.0) + 0.5) / NF, 1.0 - row / u_tnLut_size.y);
  vec4 A = texture(u_tnLut, uv), B = texture(u_tnLut, uv - vec2(0.0, NS / u_tnLut_size.y));   // two light slices
  return mix(A, B, lf - l0) * vec4(2.0, 1.0, 2.0, 1.0);
}
vec3 tn_tone(vec2 la, vec3 col) { return mix(u_ground, col * la.x, la.y); }
vec3 tn_meanTone(vec2 m, vec3 col) { return mix(u_ground, u_ground * (1.0 - m.y) + col * m.x, 1.0 - u_cordGap); }

// One slot of a cord bed. f = position across the slot (0..1, towards +a), slotW = slot width (pattern units),
// along = coordinate along the cord, h = per-cord randoms, ncol = colour of the neighbouring cord on the nearer side.
// Anti-aliased where neighbouring cords meet; cords smaller than a pixel settle on their mean.
vec3 tn_slot(TnBed b, float f, float slotW, float along, vec3 col, vec3 ncol, vec3 mcol, vec3 h) {
  float px = pg_px / slotW;                                       // one sample, in slots
  float fade = smoothstep(0.3, 0.8, px);
  float g = u_cordGap;
  float fc = g > 0.0 ? clamp((f - 0.5 * g) / (1.0 - g), 0.0, 1.0) : f;   // position across the cord itself
  vec4 la = tn_lut(b, fc);
  vec3 o = vec3(0.0);
  if (fade < 1.0) {
    float x = fc * 2.0 - 1.0;
    vec3 cc = col * (0.9 + 0.2 * h.x);
    if (u_fibre > 0.0) {
      // three twisted strands across the cord, each with a slowly varying tone
      float a = along / slotW;
      float fz = 1.0 - smoothstep(0.12, 0.35, px);
      float st = sin(PG_TAU * (a * (0.35 + 0.2 * h.z) + 0.25 * x) + h.y * 40.0 + floor((x + 1.0) * 1.5) * 2.1);
      cc *= 1.0 + u_fibre * fz * 0.14 * st;
    }
    o = tn_tone(la.xy, cc);
    if (g > 0.0) {
      o = mix(u_ground, o, pg_fill((abs(f - 0.5) - 0.5 * (1.0 - g)) * slotW));   // the gap between cords
    } else {
      // the jump to the neighbouring cord at either end of the slot
      float wl = 1.0 - pg_fill(-f * slotW), wr = 1.0 - pg_fill((f - 1.0) * slotW);
      if (max(wl, wr) > 0.0) o = mix(o, tn_tone(tn_lut(b, wl > wr ? 1.0 : 0.0).xy, ncol), max(wl, wr));
    }
  }
  if (fade > 0.0) o = mix(o, tn_meanTone(la.zw, mcol), fade);
  return o;
}

// Depth shading: tunnels darken towards the hole (z = 1), pyramids towards their base (z = 0).
float tn_depth(float z, float sgn) {
  return sgn > 0.0 ? 1.0 - u_depthShade * 0.82 * pow(z, 1.3) : 1.0 - u_depthShade * 0.45 * (1.0 - z) * (1.0 - z);
}
// Picture-plane outward direction of face k.
vec2 tn_dir(int k) { return k == 0 ? vec2(1.0, 0.0) : k == 1 ? vec2(0.0, 1.0) : k == 2 ? vec2(-1.0, 0.0) : vec2(0.0, -1.0); }
const vec3 TN_UP = vec3(0.0, 0.0, 1.0);

vec4 tn_grid(vec2 p) {
  float az = radians(u_lightAngle);
  tn_L = vec3(0.5 * vec2(cos(az), sin(az)), 0.8660254);           // 60° above the picture plane
  tn_Hv = normalize(tn_L + TN_UP);
  vec2 C = u_cell * vec2(u_cellAspect, 1.0);                      // cell size
  vec2 id = floor(p / C);
  vec2 q = p - (id + 0.5) * C;                                    // position in the cell (pattern units)
  float dw = 0.5 * u_divider * u_cell;                            // divider half-width
  vec2 S = max(0.5 * C - dw, vec2(1e-5));                         // half-size of the tunnel's rim
  int np = u_palette_count;

  // per cell: tunnel or pyramid, hole size and vanishing point (smooth drift across the grid + a little per cell)
  vec3 ca, cb;
  cl_rand3(vec3(id, 7.0), ca, cb);
  float sgn = ca.x < u_pyramids ? -1.0 : 1.0;
  vec2 H = S * clamp(u_hole * (1.0 + 0.5 * u_jitter * (ca.y - 0.5)), 0.0, 0.95);
  vec2 drift = vec2(pg_vnoise(id * 0.45 + vec2(0.5, 3.5)), pg_vnoise(id.yx * 0.45 + vec2(19.5, 7.5))) * 2.0 - 1.0;
  vec2 vp = vec2(u_holeX, u_holeY) + u_jitter * (0.9 * drift + 0.25 * (cb.xy * 2.0 - 1.0));
  if (u_speed > 0.0) {
    float tt = u_time * u_speed;
    vp += sgn * 0.3 * vec2(sin(tt * 0.7), sin(tt * 0.53));       // a camera swaying in front of the grid
  }
  vec2 v = clamp(vp, -0.9, 0.9) * (S - H);                        // vanishing point (pattern units)
  float D = mix(0.12, 1.4, u_faces) * min(S.x, S.y);              // tunnel depth: steeper walls, more face contrast

  // cord colours (dividers are shared by two cells, so they always take the first colour)
  vec3 col0 = u_palette[0];
  if (u_tColors == TCOLORS_CELLS) col0 = u_palette[min(int(cb.z * float(np)), np - 1)];
  vec3 mcol = col0;
  if (u_tColors == TCOLORS_RINGS) {
    mcol = vec3(0.0);
    for (int k = 0; k < 16; k++) { if (k >= np) break; mcol += u_palette[k]; }
    mcol /= float(np);
  }

  // faces: ring parameter of each, nearest face k1 and the neighbouring face k2 across the closest seam
  vec4 span = vec4(S - H - v, S - H + v);
  vec4 tf = vec4(S - q, S + q) / span;
  int k1 = 0;
  float t1 = tf.x;
  if (tf.y < t1) { t1 = tf.y; k1 = 1; }
  if (tf.z < t1) { t1 = tf.z; k1 = 2; }
  if (tf.w < t1) { t1 = tf.w; k1 = 3; }
  int ka = (k1 + 1) & 3, kb = (k1 + 3) & 3;
  int k2 = tf[ka] < tf[kb] ? ka : kb;
  float s1 = span[k1], s2 = span[k2];
  float w2 = 1.0 - pg_fill(-(tf[k2] - t1) / sqrt(1.0 / (s1 * s1) + 1.0 / (s2 * s2)));   // AA across the mitre

  float N = u_rings;
  float t = t1;
  if (u_wobble > 0.0) t += u_wobble * 0.45 / N * (2.0 * pg_vnoise(q / (0.35 * u_cell) + id * 17.0) - 1.0);
  float kp = 3.0 * u_persp;
  float tc = clamp(t, 0.0, 1.0);
  float den = 1.0 + kp * (1.0 - tc);
  float z = tc / den;                                             // depth: rings equally spaced along the tunnel
  float rr = z * N, i = floor(min(rr, N - 0.5)), f = rr - i;
  float slotK = den * den / (N * (1.0 + kp));                     // slot width = span * slotK
  vec3 h0, h1;
  cl_rand3(vec3(i, id.x, id.y + 9000.0), h0, h1);
  float dep = tn_depth(z, sgn);
  vec3 ccol = (u_tColors == TCOLORS_RINGS ? u_palette[pg_wrapi(int(i), np)] : col0) * dep;

  // the hole: a dark opening (or a flat back panel); for pyramids the flat top
  vec3 back = col0 * tn_lit(TN_UP, 0.0, 1.0) * (0.9 + 0.2 * ca.z);
  if (sgn > 0.0) back = mix(back * tn_depth(1.0, sgn), u_ground, u_holeDark);
  float wallCov = pg_fill((t - 1.0) * s1);

  // layers, bottom up: 0 = wall, 1 = the neighbouring wall across a mitre seam, (then the hole),
  // 2 = horizontal shelf, 3 = vertical divider (runs over the shelves)
  vec3 o = back;
  for (int l = 0; l < TN_N(4); l++) {
    if (l == 2) o = mix(back, o, wallCov);
    TnBed b = TnBed(vec2(1.0, 0.0), 2.0, 0.0, TN_UP);              // flat (dividers)
    float w = 1.0, ff, sw, al;
    vec3 c = u_palette[0], mc = c, hh = h0, nc = c;
    if (l >= 2) {
      // raised divider cords: position across the divider centred on the nearest boundary line
      bool hz = l == 2;
      float side = step(0.0, hz ? q.y : q.x);
      float xb = (hz ? q.y : q.x) - (side - 0.5) * (hz ? C.y : C.x);
      w = u_divider > 0.0 ? pg_fill(abs(xb) - dw) : 0.0;
      if (w <= 0.0) continue;
      sw = 2.0 * dw / u_divCords;
      float du = (xb + dw) / sw, dj = clamp(floor(du), 0.0, u_divCords - 1.0);
      cl_rand3(vec3(dj, (hz ? id.y : id.x) + side, hz ? id.x + 5000.0 : 7000.0), hh, h1);
      b.a = hz ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
      ff = du - dj; al = hz ? p.x : p.y;
    } else {
      int k = l == 0 ? k1 : k2;
      if (l == 1) {
        w = w2;
        if (w <= 0.0) continue;
      }
      float sk = span[k];
      b = tn_bed(-tn_dir(k), sk, D, sgn);
      ff = f; sw = sk * slotK; al = (k & 1) == 0 ? q.y : q.x;
      c = ccol; mc = mcol * dep;
      nc = u_tColors == TCOLORS_RINGS ? u_palette[pg_wrapi(int(i) + (f < 0.5 ? -1 : 1), np)] * dep : c;   // neighbouring ring
    }
    vec3 sc = tn_slot(b, ff, sw, al, c, nc, mc, hh);
    o = l == 0 ? sc : mix(o, sc, w);
  }

  // whole cells only a few pixels big: settle on the cell's average (four walls, dividers, hole) instead of moiré
  float cf = smoothstep(0.05, 0.16, pg_px / u_cell);
  if (cf > 0.0) {
    vec3 acc = mcol * tn_lit(TN_UP, 0.0, 1.0);
    if (sgn > 0.0) acc = mix(acc * tn_depth(1.0, sgn), u_ground, u_holeDark);
    acc *= 4.0 * H.x * H.y;
    for (int k = 0; k < TN_N(5); k++) {
      int kk = min(k, 3);
      TnBed b = tn_bed(-tn_dir(kk), span[kk], D, sgn);
      if (k == 4) b = TnBed(vec2(1.0, 0.0), 2.0, 0.0, TN_UP);
      float area = k == 4 ? C.x * C.y - 4.0 * S.x * S.y : ((k & 1) == 0 ? S.y + H.y : S.x + H.x) * span[kk];
      acc += area * tn_meanTone(tn_lut(b, 0.5).zw, k == 4 ? u_palette[0] : mcol * tn_depth(0.45, sgn));
    }
    o = mix(o, acc / (C.x * C.y), cf);
  }
  return vec4(o, 1.0);
}

vec4 pattern(vec2 p) {
  if (u_layout == LAYOUT_TUNNELS) return tn_grid(p);
  return cl_collage(p);
}
`,
  });
})();
