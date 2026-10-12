import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
  read('../shared/visual/drone-colors.js').replace(/^export /gm, ''),
  read('drone.js'),
  read('whoop65.js'),
  read('cinewhoop3.js'),
  read('catalog.js'),
  read('viewer.js'),
].join('\n');
const html = read('template.html')
  .replace('/* DEMO_STYLE */', () => read('style.css'))
  .replace('/* DEMO_SCRIPT */', () => script.replace(/<\/script/gi, '<\\/script'));
writeFileSync(join(root, 'index.html'), html);
console.log(`Offline demo kész: ${join(root, 'index.html')} (${Math.round(Buffer.byteLength(html) / 1024)} KiB)`);
