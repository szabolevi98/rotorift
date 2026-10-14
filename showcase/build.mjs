import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import { loadCatalog } from '../server/catalog.js';
import { buildMapSurfaces } from '../scripts/build-map-surfaces.mjs';

buildMapSurfaces();
const catalog = await loadCatalog();

// A klasszikus scriptbe csomagolt könyvtárakkal a kész HTML file:// alatt is fut.
// Nem kell npm install, hálózat, modulbetöltés vagy külön webszerver.
const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(root, name), 'utf8');
const three = read('vendor/three.module.js').replace(/export \{([^}]+)\};?\s*$/, (_, names) => `const THREE = {${names}};`);
if (/\bexport \{/.test(three)) throw new Error('Three.js export átalakítás sikertelen.');
function addon(file, name, extra = '') {
  const source = read(file)
    .replace(/import\s*\{([^}]+)\}\s*from\s*['"]three['"];?/g, 'const {$1} = THREE;')
    .replace(/import\s*\{\s*decompress\s*\}\s*from\s*['"][^'"]+['"];?/g, 'const { decompress } = DemoTextureUtils;')
    .replace(/export function /g, 'function ')
    .replace(/export\s*\{[^}]+\};?/g, '');
  return `const ${name} = (() => {\n${source}\n${extra || `return ${name};`}\n})();`;
}
const script = [
  three,
  addon('vendor/OrbitControls.js', 'OrbitControls'),
  addon('vendor/TextureUtils.js', 'DemoTextureUtils', 'return { decompress };'),
  addon('vendor/GLTFExporter.js', 'GLTFExporter'),
  read('../shared/visual/drone-rendering.js').replace(/^export /gm, ''),
  read('../shared/visual/battery-labels.js').replace(/^export /gm, ''),
  read('../shared/visual/drone-colors.js').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''),
  read('drone.js'),
  read('whoop65.js'),
  read('whoop75.js'),
  read('cinewhoop3.js'),
  read('catalog.js'),
  read('../shared/visual/rotor-motion.js').replace(/^export /gm, ''),
  `const ROTOR_THRUST_EXPONENTS = ${JSON.stringify(Object.fromEntries(catalog.drones.map(c=>[c.id,c.motor.thrustExponent])))};`,
  read('viewer.js'),
].join('\n');
const html = read('template.html')
  .replace('/* DEMO_STYLE */', () => read('style.css'))
  .replace('/* DEMO_SCRIPT */', () => script.replace(/<\/script/gi, '<\\/script'));
writeFileSync(join(root, 'index.html'), html);
const studyScript=[three,addon('vendor/OrbitControls.js','OrbitControls'),
  read('../shared/visual/drone-rendering.js').replace(/^export /gm,''),
  read('../shared/visual/battery-labels.js').replace(/^export /gm,''),
  read('../shared/visual/drone-colors.js').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,''),
  read('whoop65.js'),read('whoop75.js'),read('canopy-studies.js')].join('\n');
writeFileSync(join(root,'canopy-lab.html'),read('canopy-lab.template.html').replace('/* CANOPY_LAB_SCRIPT */',()=>studyScript.replace(/<\/script/gi,'<\\/script')));
// The showcase stays English; use the game's dictionary as the name source.
const english = JSON.parse(read('../web/lang/en.json'));
const maps = catalog.maps.map(map => ({ ...map, name: english['map.' + map.id] ?? map.name }));
await build({
  stdin: { contents: `import { startMapViewer } from './map-viewer.js'; startMapViewer(${JSON.stringify({maps})}).catch(error => { document.querySelector('#loading').textContent = 'Cannot load the map: ' + error.message; console.error(error); });`, resolveDir: root, sourcefile: 'map-entry.js' },
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true,
  outfile: join(root,'map-viewer.bundle.js'),
  plugins: [{ name: 'project-absolute-imports', setup(api) {
    api.onResolve({filter:/^\/(shared|web)\//}, args => ({path:join(root,'..',args.path.slice(1))}));
  }}],
});
// Shader template strings retain vendor indentation after bundling. Whitespace
// at line ends and mixed leading indentation are insignificant to GLSL.
const mapBundle = join(root,'map-viewer.bundle.js');
writeFileSync(mapBundle, readFileSync(mapBundle,'utf8').replace(/[ \t]+$/gm,'').replace(/^ +(\t+)/gm,'$1'));
console.log(`Showcase built: drones, maps and race editor (${Math.round(Buffer.byteLength(html) / 1024)} KiB drone HTML).`);
