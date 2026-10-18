import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectGraph } from '../scripts/graph.ts';

function fixture(run: (root: string) => void) {
  mkdirSync('e2e/tmp', { recursive: true });
  const root = mkdtempSync(resolve('e2e/tmp/graph-'));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
test('installation and graph presence are independent, presence does not prove freshness', () => fixture(root => {
  const missing = resolve(root, 'missing-tool');
  assert.equal(inspectGraph(root, null, missing).graph.status, 'not-located');
  assert.equal(inspectGraph(root, 'graph.json', missing).graph.status, 'missing');
  writeFileSync(resolve(root, 'graph.json'), '{}');
  const result = inspectGraph(root, 'graph.json', missing);
  assert.equal(result.installation.status, 'executable-missing');
  assert.equal(result.graph.status, 'present');
  assert.equal(result.freshness.status, 'unknown');
  const tool = resolve(root, 'local-tool');
  writeFileSync(tool, '#!/bin/sh\nexit 1\n'); chmodSync(tool, 0o755);
  const available = inspectGraph(root, 'graph.json', tool);
  assert.equal(available.installation.status, 'executable-found');
  assert.equal(available.installation.runtime, 'not-tested');
}));
test('graph bytes determine identity, malformed data and path escapes are rejected', () => fixture(root => {
  const file = resolve(root, 'graph.json'); writeFileSync(file, '{}');
  const before = inspectGraph(root, 'graph.json').graph;
  writeFileSync(file, '{"nodes":[]}');
  assert.notDeepEqual(inspectGraph(root, 'graph.json').graph, before);
  assert.throws(() => inspectGraph(root, '../graph.json'), /relative/);
  symlinkSync('/etc/hosts', resolve(root, 'outside.json'));
  assert.throws(() => inspectGraph(root, 'outside.json'), /escapes/);
  assert.throws(() => inspectGraph(root, '.'), /file/);
  writeFileSync(file, 'invalid'); assert.throws(() => inspectGraph(root, 'graph.json'), /JSON/);
}));
