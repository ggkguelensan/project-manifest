import { accessSync, constants, readFileSync, realpathSync, statSync } from 'node:fs';
import { delimiter, isAbsolute, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

function executablePath(command: string) {
  const candidates = isAbsolute(command) ? [command] : (process.env.PATH ?? '').split(delimiter).filter(Boolean).map(directory => resolve(directory, command));
  for (const candidate of candidates) {
    try { if (statSync(candidate).isFile()) { accessSync(candidate, constants.X_OK); return realpathSync(candidate); } } catch { /* Continue PATH search. */ }
  }
  return null;
}

/** Read-only observation. Neither installation nor graph generation is performed. */
export function inspectGraph(root: string, graph: string | null, command = 'graphify') {
  root = realpathSync(root);
  if (!isAbsolute(command) && !/^[a-zA-Z0-9_-]+$/.test(command)) throw new Error('Command must be a PATH name or absolute executable path');
  const executable = executablePath(command);
  const installation = { status: executable ? 'executable-found' : 'executable-missing', executable, runtime: 'not-tested' };
  const freshness = { status: 'unknown', reason: 'Existence, mtime and hash do not establish source coverage or revision. Follow the selected project procedure before relying on the graph.' };
  if (graph === null) return { installation, graph: { status: 'not-located' }, freshness };
  if (isAbsolute(graph) || graph.includes('\\') || graph.includes(':') || graph.split('/').includes('..')) throw new Error('Graph path must be relative to selected root');
  let path: string;
  try { path = realpathSync(resolve(root, graph)); }
  catch (error: any) {
    if (error.code === 'ENOENT') return { installation, graph: { status: 'missing', path: graph }, freshness };
    throw error;
  }
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Graph escapes selected root');
  if (!statSync(path).isFile()) throw new Error('Graph must be a file');
  const bytes = readFileSync(path);
  try { JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Graph is not valid JSON'); }
  return { installation, graph: { status: 'present', path, sha256: createHash('sha256').update(bytes).digest('hex'), format: 'JSON syntax checked; provider semantics not validated' }, freshness };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [root, graph, command, ...extra] = process.argv.slice(2);
    if (!root || !graph || extra.length) throw new Error('Usage: <selected-root> <relative-graph-path> [command-name-or-absolute-path]');
    console.log(JSON.stringify(inspectGraph(root, graph, command), null, 2));
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
