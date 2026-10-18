import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import './project.ts';
const ignored = new Set(['.git', 'node_modules', 'workdir', 'tmp']);
function walk(directory: string) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) {walk(file); continue;}
    if (file.endsWith('.json')) JSON.parse(readFileSync(file, 'utf8'));
    if (!file.endsWith('.md')) continue;
    const body = readFileSync(file, 'utf8');
    for (const link of body.matchAll(/\]\(([^)]+)\)/g)) {
      const path = link[1].split('#')[0];
      if (!path || /^[a-z]+:/.test(path)) continue;
      const target = resolve(dirname(file), path);
      if (!existsSync(target) || !statSync(target).isFile()) throw new Error(`Broken link in ${file}: ${path}`);
    }
  }
}
walk(resolve('.'));
console.log('Local links, JSON syntax and project schema compilation passed.');
