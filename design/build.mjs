// Builds design/nova.html + design/client.html: one self-contained page (calm-ui tokens + components + calm.js + only the icons it uses).
// node design/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(dir, f), 'utf8');

const src = read('src/client.src.html');
const sprite = read('calm/icons.svg');
const used = [...new Set(src.match(/\bi-[a-z0-9-]+(?=['"#)\s])/g) || [])];
const symbols = used.map(id => {
  const m = sprite.match(new RegExp(`<symbol id="${id}"[\\s\\S]*?</symbol>`));
  if (!m) { console.warn('missing icon', id); return ''; }
  return m[0];
}).join('\n');

const out = src
  .replace('/*@css*/', () => read('calm/tokens.css') + '\n' + read('calm/components.css'))
  .replace('<!--@sprite-->', () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${symbols}</svg>`)
  .replace('/*@calm*/', () => read('calm/calm.js').replaceAll('</script>', '<\\/script>'))   // a comment in calm.js would close the inline tag
  .replace('/*@qr*/', () => read('calm/qrcode.js').replaceAll('</script>', '<\/script>'))
  // every assets/<file> reference becomes a data: URI, so the page stays one self-contained file
  .replace(/assets\/([\w\/.-]+\.(png|webp|jpg|svg|woff2))/g, (_, f, ext) => `data:${ext === 'woff2' ? 'font/woff2' : 'image/' + (ext === 'svg' ? 'svg+xml' : ext === 'jpg' ? 'jpeg' : ext)};base64,` + readFileSync(join(dir, 'assets', f)).toString('base64'));

// nova.html: the Artifact page (the host adds doctype/head/body); client.html: the same page as a full document for local use
writeFileSync(join(dir, 'nova.html'), out);
writeFileSync(join(dir, 'client.html'), `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
${out}
</body>
</html>
`);
console.log(`nova.html + client.html · ${used.length} icons · ${(out.length / 1024).toFixed(0)} KB`);
