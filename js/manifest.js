/* Pattern files, loaded in this order (also the order in the picker).
 * To add a pattern: create js/patterns/<name>.js that calls PG.registerPattern({...}) and list it here.
 * See docs/PATTERNS.md. */
PG.patternFiles = [
  'js/patterns/tile.js',
  'js/patterns/moire.js',
  'js/patterns/camo.js',
  'js/lib/qrcode.js',
  'js/patterns/barcode.js',
  'js/patterns/checker.js',
  'js/patterns/collage.js',
  'js/patterns/islamic.js',
  'js/patterns/deco.js',
  'js/patterns/bauhaus.js',
  'js/patterns/polygons.js',
  'js/patterns/retro-a.js',
  'js/patterns/retro-b.js',
  'js/patterns/retro-c.js',
  'js/patterns/retro.js',
  'js/patterns/arch-a.js',
  'js/patterns/arch-b.js',
  'js/patterns/arch-c.js',
  'js/patterns/architecture.js',
  'js/patterns/halftone.js',
  'js/patterns/truchet.js',
  'js/patterns/voronoi.js',
  'js/patterns/contour.js',
  'js/patterns/textile.js',
  'js/patterns/aura.js',
  'js/patterns/marble.js',
  'js/patterns/guilloche.js',
  'js/patterns/opart.js',
  'js/patterns/static.js',
  'js/patterns/glitch.js',
  'js/patterns/testcard.js',
  'js/patterns/screens.js',
];

PG.loadScripts(PG.patternFiles).then(() => PG.app.boot());
