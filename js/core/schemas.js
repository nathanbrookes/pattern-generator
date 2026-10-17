/* Pattern Generator — global Transform (perspective / warp / symmetry) and Post-FX (pixelate / colour) schemas.
 * Transform params become `u_tf_<id>` uniforms in the pattern pass; post params become `u_fx_<id>` in the post pass.
 * Select options become defines: TF_WARP_WAVES, FX_PXSHAPE_HEX, … */
(function () {
  'use strict';
  const PG = window.PG;

  const warpOn = (v) => v.warp !== 'none';
  const pixOn = (v) => !!v.pixelate;
  const glitchOn = (v) => v.glitch > 0;

  PG.transformSchema = [
    { type: 'heading', label: 'View' },
    { id: 'zoom', label: 'Zoom', min: 0.05, max: 20, default: 1, step: 0.01, scale: 'log' },
    { id: 'rotate', label: 'Rotate', min: -180, max: 180, default: 0, step: 1, unit: '°' },
    { id: 'panX', label: 'Pan X', min: -10, max: 10, default: 0, step: 0.01, soft: true },
    { id: 'panY', label: 'Pan Y', min: -10, max: 10, default: 0, step: 0.01, soft: true },

    { type: 'heading', label: 'Motion' },
    { id: 'spin', label: 'Spin', min: -180, max: 180, default: 0, step: 1, unit: '°/s', uniform: false, help: 'Rotation speed while Animate is on' },
    { id: 'drift', label: 'Drift', min: 0, max: 2, default: 0, step: 0.01, uniform: false, help: 'Pan speed while Animate is on' },
    { id: 'driftDir', label: 'Drift angle', min: -180, max: 180, default: 0, step: 1, unit: '°', uniform: false, showIf: (v) => v.drift > 0 },

    { type: 'heading', label: 'Perspective' },
    { id: 'tilt', label: 'Tilt', min: 0, max: 88, default: 0, step: 0.5, unit: '°', help: 'Lay the pattern down like a floor running to the horizon' },
    { id: 'tiltDir', label: 'Tilt direction', min: -180, max: 180, default: 0, step: 1, unit: '°' },
    { id: 'fov', label: 'Lens (FOV)', min: 5, max: 140, default: 60, step: 1, unit: '°', help: 'Wider lens = stronger perspective' },
    { id: 'fog', label: 'Horizon fade', min: 0, max: 1, default: 0, step: 0.01 },
    { id: 'fogColor', label: 'Horizon color', type: 'color', default: '#9a9a9a' },

    { type: 'heading', label: 'Warp' },
    {
      id: 'warp',
      label: 'Warp',
      type: 'select',
      options: [
        ['none', 'None'],
        ['waves', 'Waves'],
        ['noise', 'Noise'],
        ['swirl', 'Swirl'],
        ['ripple', 'Ripple'],
        ['twist', 'Twist'],
        ['bulge', 'Bulge'],
        ['zigzag', 'Zigzag'],
        ['polar', 'Polar'],
      ],
      default: 'none',
    },
    { id: 'warpAmt', label: 'Amount', min: 0, max: 2, default: 0.5, step: 0.01, showIf: warpOn },
    { id: 'warpFreq', label: 'Frequency', min: 0.1, max: 30, default: 4, step: 0.01, scale: 'log', showIf: warpOn },
    { id: 'warpSpeed', label: 'Speed', min: -3, max: 3, default: 0.5, step: 0.01, showIf: warpOn, help: 'Used when Animate is on' },

    { type: 'heading', label: 'Symmetry' },
    {
      id: 'symmetry',
      label: 'Symmetry',
      type: 'select',
      options: [
        ['none', 'None'],
        ['mirrorX', 'Mirror X'],
        ['mirrorY', 'Mirror Y'],
        ['quad', 'Quad'],
        ['kaleido', 'Kaleidoscope'],
      ],
      default: 'none',
    },
    { id: 'segments', label: 'Segments', type: 'int', min: 2, max: 32, default: 6, showIf: (v) => v.symmetry === 'kaleido' },

    { type: 'heading', label: 'Quality' },
    { id: 'snap', label: 'Floor pixels', min: 0, max: 0.5, default: 0, step: 0.001, help: 'Pixelate in pattern space, so pixels follow the perspective. 0 = off' },
    { id: 'ss', label: 'Supersampling', type: 'select', options: [['1', 'Off'], ['2', '2×'], ['3', '3×'], ['4', '4×']], default: '2', uniform: false, help: 'Off = raw aliasing (extra moiré!)' },
    { id: 'aa', label: 'Smooth edges', type: 'bool', default: true },
  ].map(PG.normalizeParam);

  PG.postSchema = [
    { type: 'heading', label: 'Pixelate' },
    { id: 'pixelate', label: 'Pixelate', type: 'bool', default: false },
    { id: 'pxSize', label: 'Pixel size', min: 2, max: 128, default: 12, step: 1, unit: 'px', showIf: pixOn },
    {
      id: 'pxShape',
      label: 'Shape',
      type: 'select',
      options: [
        ['square', 'Square'],
        ['round', 'Round'],
        ['rounded', 'Rounded'],
        ['diamond', 'Diamond'],
        ['hex', 'Hex'],
      ],
      default: 'square',
      showIf: pixOn,
    },
    { id: 'pxGap', label: 'Gap', min: 0, max: 0.9, default: 0, step: 0.01, showIf: pixOn },
    { id: 'pxGapColor', label: 'Gap color', type: 'color', default: '#0b0b0d', showIf: (v) => v.pixelate && (v.pxGap > 0 || v.pxShape === 'round' || v.pxShape === 'rounded' || v.pxShape === 'diamond') },
    { id: 'pxSample', label: 'Sampling', type: 'select', options: [['average', 'Average'], ['center', 'Center']], default: 'average', showIf: pixOn, help: 'Average = blend everything under the block. Center = one crisp sample (harder, more aliased)' },

    { type: 'heading', label: 'Color' },
    { id: 'hue', label: 'Hue shift', min: -180, max: 180, default: 0, step: 1, unit: '°' },
    { id: 'saturation', label: 'Saturation', min: 0, max: 3, default: 1, step: 0.01 },
    { id: 'contrast', label: 'Contrast', min: 0, max: 3, default: 1, step: 0.01 },
    { id: 'brightness', label: 'Brightness', min: -1, max: 1, default: 0, step: 0.01 },
    { id: 'invert', label: 'Invert', type: 'bool', default: false },
    { id: 'gradMap', label: 'Gradient map', type: 'bool', default: false, help: 'Recolor any pattern by brightness' },
    { id: 'gradMapGrad', label: 'Map gradient', type: 'gradient', default: 'Holo Film', showIf: (v) => v.gradMap },
    { id: 'gradMapMix', label: 'Map mix', min: 0, max: 1, default: 1, step: 0.01, showIf: (v) => v.gradMap },

    { type: 'heading', label: 'Quantize & dither' },
    { id: 'quantize', label: 'Quantize', type: 'select', options: [['off', 'Off'], ['posterize', 'Posterize'], ['palette', 'Palette']], default: 'off' },
    { id: 'levels', label: 'Levels', type: 'int', min: 2, max: 32, default: 4, showIf: (v) => v.quantize === 'posterize' },
    { id: 'qPalette', label: 'Palette', type: 'palette', default: 'Game Boy', showIf: (v) => v.quantize === 'palette' },
    {
      id: 'dither',
      label: 'Dither',
      type: 'select',
      options: [
        ['none', 'None'],
        ['bayer2', 'Bayer 2×2'],
        ['bayer4', 'Bayer 4×4'],
        ['bayer8', 'Bayer 8×8'],
        ['noise', 'Noise'],
      ],
      default: 'bayer4',
      showIf: (v) => v.quantize !== 'off',
    },
    { id: 'ditherAmt', label: 'Dither amount', min: 0, max: 1, default: 0.6, step: 0.01, showIf: (v) => v.quantize !== 'off' && v.dither !== 'none' },

    { type: 'heading', label: 'Effects' },
    { id: 'rgbSplit', label: 'RGB split', min: 0, max: 40, default: 0, step: 0.5, unit: 'px' },
    { id: 'rgbAngle', label: 'Split angle', min: -180, max: 180, default: 0, step: 1, unit: '°', showIf: (v) => v.rgbSplit > 0 },
    { id: 'scanlines', label: 'Scanlines', min: 0, max: 1, default: 0, step: 0.01 },
    { id: 'scanSize', label: 'Scanline size', min: 1, max: 24, default: 3, step: 0.5, unit: 'px', showIf: (v) => v.scanlines > 0 },
    { id: 'grain', label: 'Grain', min: 0, max: 1, default: 0, step: 0.01 },
    { id: 'vignette', label: 'Vignette', min: 0, max: 1, default: 0, step: 0.01 },

    // Glitch: displaces where the image is sampled (pixel blocks inherit it) + colour damage. See fx_glitch() in glsl.js;
    // the Glitch card's effects (smear … crush) are fx_glitchMove() / fx_glitchDamage() / fx_glitchCrush().
    // Every id here starts with 'glitch' (the app gives them their own panel); new effects default to 0 = off.
    { type: 'heading', label: 'Glitch' },
    { id: 'glitch', label: 'Amount', min: 0, max: 1, default: 0, step: 0.01, random: false, help: 'Digital / analogue signal damage on top of any pattern. 0 = off' },
    { id: 'glitchSlices', label: 'Slice tearing', min: 0, max: 1, default: 0.7, step: 0.01, random: [0.2, 1], showIf: glitchOn, help: 'Horizontal bands of the picture jump sideways' },
    { id: 'glitchBlocks', label: 'Block damage', min: 0, max: 1, default: 0.5, step: 0.01, random: [0, 0.9], showIf: glitchOn, help: 'Datamosh: macroblocks copied from elsewhere, smeared, flattened or colour-corrupted' },
    { id: 'glitchRGB', label: 'Channel split', min: 0, max: 1, default: 0.6, step: 0.01, random: [0, 1], showIf: glitchOn, help: 'Red and blue pulled apart in random bands' },
    { id: 'glitchNoise', label: 'VHS noise', min: 0, max: 1, default: 0.3, step: 0.01, random: [0, 0.8], showIf: glitchOn, help: 'Rolling tracking band, line jitter, head-switching noise and dropouts' },
    // The Glitch card's effects, run on the rendered picture (all default to 0 = off)
    { id: 'glitchSmear', label: 'Datamosh smear', min: 0, max: 1, default: 0, step: 0.01, random: [-0.5, 1], showIf: glitchOn, help: 'Lost keyframe: blobs of the picture melt along a motion field in macroblock steps (it flows while animating)' },
    { id: 'glitchSort', label: 'Pixel sort', min: 0, max: 1, default: 0, step: 0.01, random: [-0.6, 1], showIf: glitchOn, help: 'Bright runs of pixels are sorted by brightness into long streaks' },
    { id: 'glitchSortDir', label: 'Sort direction', type: 'select', options: [['vertical', 'Vertical'], ['horizontal', 'Horizontal']], default: 'vertical', random: ['vertical', 'vertical', 'horizontal'], showIf: (v) => v.glitch > 0 && v.glitchSort > 0 },
    { id: 'glitchSortThreshold', label: 'Sort threshold', min: 0, max: 1, default: 0.4, step: 0.01, random: [0.15, 0.65], showIf: (v) => v.glitch > 0 && v.glitchSort > 0, help: 'Runs of pixels brighter than this get sorted (lower = more and longer streaks)' },
    { id: 'glitchJpeg', label: 'Broken JPEG', min: 0, max: 1, default: 0, step: 0.01, random: [-0.5, 1], showIf: glitchOn, help: '8×8 blocking, flattened colour and ringing; bitstream errors shift and tint the rest of the picture, or turn it grey' },
    { id: 'glitchBleed', label: 'VHS bleed', min: 0, max: 1, default: 0, step: 0.01, random: [-0.6, 1], showIf: glitchOn, help: 'Worn tape: soft picture with edge halos, colour smeared to the right, wavy lines, chroma noise, lifted blacks' },
    { id: 'glitchInterlace', label: 'Interlace', min: 0, max: 1, default: 0, step: 0.01, random: [-0.7, 0.8], showIf: glitchOn, help: 'Combing: every other line pair is shifted sideways, like a badly deinterlaced field' },
    { id: 'glitchCrush', label: 'Bit crush', min: 0, max: 1, default: 0, step: 0.01, random: [-0.6, 0.8], showIf: glitchOn, help: 'Fewer colour levels with ordered dither, plus bands of bit-shifted colour' },
    { id: 'glitchBlock', label: 'Block size', min: 4, max: 96, default: 16, step: 1, unit: 'px', random: [8, 40], showIf: (v) => v.glitch > 0 && (v.glitchBlocks > 0 || v.glitchSmear > 0), help: 'Macroblock size for block damage and datamosh smear' },
    { id: 'glitchRate', label: 'Rate', min: 0, max: 30, default: 8, step: 0.5, unit: '/s', random: [2, 16], showIf: glitchOn, help: 'How often the glitch changes while Animate is on (0 = frozen)' },
  ].map(PG.normalizeParam);
})();
