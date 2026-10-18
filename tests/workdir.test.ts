import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, statSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { exportWorkdir, restoreWorkdir } from '../scripts/workdir.ts';
const scratch = resolve('e2e/tmp'); mkdirSync(scratch, { recursive: true });
function fixture(action: (x: any) => void) {
  const root = mkdtempSync(resolve(scratch, 'backup-')), base = resolve(root, 'base'), target = resolve(root, 'app');
  mkdirSync(resolve(base, 'workdir/project/web/empty'), { recursive: true }); mkdirSync(target);
  writeFileSync(resolve(base, '.gitignore'), '/workdir/\n');
  const git = (...args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], { cwd: base, encoding: 'utf8' }).trim();
  git('init', '-b', 'dev'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'base');
  writeFileSync(resolve(base, 'workdir/project/web/manifest.json'), '{"local":"retain bytes"}\n');
  const backup = () => exportWorkdir(base, 'project/web', target, 'before-update');
  const restore = () => restoreWorkdir(base, 'project/restored', target, 'before-update');
  try { action({ root, base, target, backup, restore, git }); } finally { rmSync(root, { recursive: true, force: true }); }
}
test('export/restore preserves bytes and empty directories without activating adaptation', () => fixture(({ base, backup, restore }) => {
  backup(); const result = restore();
  assert.equal(readFileSync(resolve(result.destination, 'manifest.json'), 'utf8'), readFileSync(resolve(base, 'workdir/project/web/manifest.json'), 'utf8'));
  assert.ok(statSync(resolve(result.destination, 'empty')).isDirectory());
  assert.match(result.compatibility, /not assessed/);
  assert.throws(restore, /already exists/); assert.throws(backup, /already exists/);
}));
test('corrupt bytes and extra files fail before restore', () => fixture(({ backup, restore }) => {
  const bundle = backup(); const file = resolve(bundle, 'data/manifest.json'), original = readFileSync(file);
  writeFileSync(file, 'tampered'); assert.throws(restore, /hash mismatch/);
  writeFileSync(file, original); writeFileSync(resolve(bundle, 'data/extra.json'), '{}'); assert.throws(restore, /hash mismatch/);
}));
test('metadata traversal and incompatible versions cannot write outside workdir', () => fixture(({ backup, restore }) => {
  const bundle = backup(), path = resolve(bundle, 'backup.json'); const data = JSON.parse(readFileSync(path, 'utf8'));
  data.files[0].path = '../escape'; writeFileSync(path, JSON.stringify(data)); assert.throws(restore, /Invalid relative/);
  data.schema_version = 2; writeFileSync(path, JSON.stringify(data)); assert.throws(restore, /metadata\/version/);
}));
test('source and destination symlinks are refused including dangling links', () => fixture(({ base, target, backup, restore }) => {
  symlinkSync(resolve(target, 'missing'), resolve(base, 'workdir/project/web/link')); assert.throws(backup, /symbolic links/);
  rmSync(resolve(base, 'workdir/project/web/link')); backup();
  symlinkSync(resolve(target, 'missing'), resolve(base, 'workdir/project/restored')); assert.throws(restore, /symbolic link/);
}));
test('workdir survives base update and backup records its original revision', () => fixture(({ base, git, backup, restore }) => {
  const original = git('rev-parse', 'HEAD'); backup(); writeFileSync(resolve(base, 'new.txt'), 'new base'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'update');
  const result = restore(); assert.equal(result.backed_up_base_revision, original); assert.notEqual(original, git('rev-parse', 'HEAD'));
  assert.match(readFileSync(resolve(base, 'workdir/project/web/manifest.json'), 'utf8'), /retain bytes/);
}));
test('export path cannot escape target tmp through symlink', () => fixture(({ root, target, backup }) => {
  mkdirSync(resolve(target, 'e2e')); symlinkSync(root, resolve(target, 'e2e/tmp')); assert.throws(backup, /symbolic link/);
}));
