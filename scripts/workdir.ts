import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function existsSync(path: string) { try { lstatSync(path); return true; } catch (error: any) { if (error.code === 'ENOENT') return false; throw error; } }
function safe(path: unknown): asserts path is string { check(typeof path === 'string' && path.length > 0 && !isAbsolute(path) && !path.includes('\\') && !path.includes(':') && path.split('/').every(p => p && p !== '.' && p !== '..'), 'Invalid relative backup path'); }
function inside(root: string, path: string) { const rel = relative(root, path); check(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'Path escapes selected root'); }
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
function inventory(root: string) {
  const files: { path: string; sha256: string }[] = [], directories: string[] = [];
  function scan(dir: string) {
    for (const name of readdirSync(dir).sort()) {
      const path = resolve(dir, name), rel = relative(root, path).split(sep).join('/'); safe(rel);
      const stat = lstatSync(path); check(!stat.isSymbolicLink(), 'Backup refuses symbolic links');
      if (stat.isDirectory()) { directories.push(rel); scan(path); }
      else { check(stat.isFile(), 'Backup supports regular files only'); files.push({ path: rel, sha256: hash(path) }); }
    }
  }
  scan(root); return { directories, files };
}
function baseWorkdir(base: string) {
  const root = realpathSync(base);
  const gitRoot = realpathSync(execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
  check(gitRoot === root, 'Base must be a Git checkout root');
  const workdir = realpathSync(resolve(root, 'workdir')); inside(root, workdir);
  return { root, workdir };
}
function below(root: string, path: string) {
  safe(path); let cursor = root;
  for (const part of path.split('/')) { cursor = resolve(cursor, part); if (existsSync(cursor)) check(!lstatSync(cursor).isSymbolicLink(), 'Path traverses symbolic link'); }
  inside(root, cursor); return cursor;
}
function temporaryDestination(parent: string, name: string) {
  const destination = resolve(parent, name); check(!existsSync(destination), 'Destination already exists; nothing overwritten');
  const staging = resolve(parent, `.${name}-${process.pid}-${Date.now()}.partial`); mkdirSync(staging); return { destination, staging };
}
export function exportWorkdir(base: string, selection: string, target: string, name: string) {
  check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name), 'Invalid export name');
  const { root, workdir } = baseWorkdir(base);
  const source = below(workdir, selection); check(lstatSync(source).isDirectory(), 'Selection must be a directory');
  const targetRoot = realpathSync(target), exportsPath = below(targetRoot, 'e2e/tmp/exports');
  mkdirSync(exportsPath, { recursive: true });
  const metadata = { schema_version: 1, base_revision: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), selection, ...inventory(source) };
  const { destination, staging } = temporaryDestination(exportsPath, name);
  try {
    mkdirSync(resolve(staging, 'data'));
    for (const dir of metadata.directories) mkdirSync(resolve(staging, 'data', dir), { recursive: true });
    for (const f of metadata.files) { copyFileSync(resolve(source, f.path), resolve(staging, 'data', f.path)); check(hash(resolve(staging, 'data', f.path)) === f.sha256, 'Source changed while exporting'); }
    writeFileSync(resolve(staging, 'backup.json'), JSON.stringify(metadata, null, 2) + '\n');
    check(!existsSync(destination), 'Destination appeared during export'); renameSync(staging, destination); return destination;
  } catch (error) { rmSync(staging, { recursive: true, force: true }); throw error; }
}
export function restoreWorkdir(base: string, selection: string, target: string, name: string) {
  check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name), 'Invalid export name');
  const { workdir } = baseWorkdir(base);
  const bundle = below(realpathSync(target), `e2e/tmp/exports/${name}`);
  check(!lstatSync(resolve(bundle, 'backup.json')).isSymbolicLink(), 'Backup metadata is a symlink');
  const data = JSON.parse(readFileSync(resolve(bundle, 'backup.json'), 'utf8'));
  check(data && Object.keys(data).sort().join(',') === 'base_revision,directories,files,schema_version,selection' && data.schema_version === 1 && typeof data.base_revision === 'string' && /^[a-f0-9]{40}$/.test(data.base_revision), 'Invalid backup metadata/version');
  safe(data.selection); check(Array.isArray(data.files) && Array.isArray(data.directories), 'Invalid backup inventory');
  for (const f of data.files) { check(f && Object.keys(f).sort().join(',') === 'path,sha256' && typeof f.sha256 === 'string' && /^[a-f0-9]{64}$/.test(f.sha256), 'Invalid backup file metadata'); safe(f.path); }
  for (const dir of data.directories) safe(dir);
  const source = below(bundle, 'data'); const actual = inventory(source);
  check(JSON.stringify(actual) === JSON.stringify({ directories: data.directories, files: data.files }), 'Backup inventory/hash mismatch');
  const destination = below(workdir, selection); check(!existsSync(destination), 'Destination already exists; nothing overwritten');
  mkdirSync(dirname(destination), { recursive: true });
  const prepared = temporaryDestination(dirname(destination), selection.split('/').at(-1)!);
  try {
    for (const dir of data.directories) mkdirSync(resolve(prepared.staging, dir), { recursive: true });
    for (const f of data.files) { copyFileSync(resolve(source, f.path), resolve(prepared.staging, f.path)); check(hash(resolve(prepared.staging, f.path)) === f.sha256, 'Backup changed during restore'); }
    check(!existsSync(destination), 'Destination appeared during restore'); renameSync(prepared.staging, destination);
    return { destination, backed_up_base_revision: data.base_revision, compatibility: 'not assessed; run the owning manifest validator before use' };
  } catch (error) { rmSync(prepared.staging, { recursive: true, force: true }); throw error; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = process.argv.slice(2);
    check(a.length === 9 && ['export', 'restore'].includes(a[0]) && a[1] === '--base' && a[3] === '--selection' && a[5] === '--target' && a[7] === '--name', 'Usage: export|restore --base <manifest-checkout> --selection <workdir-relative-dir> --target <target-root> --name <backup-id>');
    console.log(JSON.stringify((a[0] === 'export' ? exportWorkdir : restoreWorkdir)(a[2], a[4], a[6], a[8]), null, 2));
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
