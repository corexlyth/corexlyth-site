import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const dist = join(root, 'dist');
const essential = [
  'index.html',
  '404.html',
  'assets/css/main.css',
  'assets/js/main.js',
  'assets/img/corexlyth-apps.svg',
  'assets/img/corexlyth-code.svg',
  'assets/img/corexlyth-featured.svg',
  'assets/img/corexlyth-lab.svg',
];
let failures = 0;
function assert(ok, message) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`);
  if (!ok) failures++;
}
for (const file of essential) assert(existsSync(join(dist, file)), `Output contains ${file}`);
if (existsSync(join(dist, 'index.html'))) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const mustContain = [
    'KEŞİF', 'TÜM KAYITLAR', 'NEURAL INTERFACE',
    'cx-hud-frame', '/corexlyth-site/assets/css/main.css',
    '/corexlyth-site/assets/js/main.js', '<link rel="canonical"',
    'name="description"',
  ];
  for (const text of mustContain) assert(html.includes(text), `Homepage includes ${text}`);
  assert(!html.includes('src="./assets/'), 'No broken relative asset paths');
  assert(!html.includes('href="./assets/'), 'No broken relative stylesheet paths');
}
if (failures) {
  console.error(`CoreXLyth preview validation failed (${failures} checks).`);
  process.exitCode = 1;
} else {
  console.log('CoreXLyth Astro foundation verification passed.');
}
