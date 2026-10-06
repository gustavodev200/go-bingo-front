// RNF-3D-01: Home, criar e ranking não podem baixar three.js (só a sala carrega o palco 3D).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const NEXT = '.next';
const PAGES = ['index', 'criar', 'ranking'];
const MARKER = 'WebGLRenderer';

function htmlFor(page) {
  const file = join(NEXT, 'server', 'app', `${page}.html`);
  if (!existsSync(file)) throw new Error(`Página estática não encontrada: ${file}. Rode "npm run build" antes.`);
  return readFileSync(file, 'utf8');
}

/** Todo chunk citado no HTML (tags <script> e referências do payload RSC embutido). */
function chunksIn(html) {
  return [...new Set([...html.matchAll(/\/_next\/(static\/chunks\/[^"'\\\s]+?\.js)/g)].map((m) => join(NEXT, m[1])))];
}

let failed = false;
for (const page of PAGES) {
  const chunks = chunksIn(htmlFor(page));
  if (chunks.length === 0) throw new Error(`Nenhum chunk encontrado em ${page}.html — o formato do build mudou; ajuste o verificador.`);
  const route = page === 'index' ? '/' : `/${page}`;
  for (const chunk of chunks) {
    if (readFileSync(chunk, 'utf8').includes(MARKER)) {
      console.error(`✖ ${route} carrega three.js via ${chunk}`);
      failed = true;
    }
  }
  console.log(`✔ ${route}: ${chunks.length} chunks verificados`);
}

// Sanidade: o three.js precisa existir em algum chunk, senão a verificação acima não prova nada.
const dir = join(NEXT, 'static', 'chunks');
const withThree = readdirSync(dir, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.js') && readFileSync(join(dir, f), 'utf8').includes(MARKER));
if (withThree.length === 0) {
  console.error(`✖ Nenhum chunk contém "${MARKER}" — o marcador mudou; ajuste o verificador.`);
  failed = true;
} else {
  console.log(`✔ three.js isolado em ${withThree.length} chunk(s) da sala`);
}

if (failed) process.exit(1);
