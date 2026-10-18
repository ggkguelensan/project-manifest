import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readProject, planTask } from '../scripts/project.ts';

mkdirSync('e2e/tmp', {recursive: true});
function fixture(run: (root: string, data: any, save: () => ReturnType<typeof readProject>, git: (...args: string[]) => string) => void) {
  const root = mkdtempSync(resolve('e2e/tmp/project-'));
  const repo = resolve(root, 'repositories/frontend');
  mkdirSync(repo, {recursive: true});
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  git('init', '-b', 'dev'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'commit.gpgsign', 'false'); git('config', 'core.hooksPath', '/dev/null');
  mkdirSync(resolve(repo, 'apps/web'), {recursive: true}); writeFileSync(resolve(repo, 'apps/web/app.txt'), 'fixture');
  git('add', '.'); git('commit', '-m', 'fixture');
  git('worktree', 'add', '-b', 'task/example', resolve(root, 'worktrees/task'));
  mkdirSync(resolve(root, 'reference'), {recursive: true});
  const data = {schema_version: 1, project_id: 'fixture', repositories: [{id: 'frontend', path: 'repositories/frontend', references: ['reference'], development: 'dev', release: {kind: 'semver'}}], targets: [{id: 'web', repository_id: 'frontend', path: 'apps/web', manifests: []}], tools: {worktrunk: {enabled: false, required_for_tasks: false, config: null}, graphify: {enabled: false, procedure: null}}, manifests: []};
  const save = () => {writeFileSync(resolve(root, 'project.json'), JSON.stringify(data)); return readProject(resolve(root, 'project.json'), root);};
  try {run(root, data, save, git);} finally {rmSync(root, {recursive: true, force: true});}
}
const task = {target: 'web', worktree: 'worktrees/task', purpose: 'development' as const};
test('select registered task worktree and nested target from current source', () => fixture((root, data, save) => {
  const plan = planTask(save(), root, task);
  assert.equal(plan.target_root, resolve(root, 'worktrees/task/apps/web'));
  assert.equal(plan.branch, 'task/example'); assert.equal(plan.local_changes, false);
  assert.equal(plan.graphify.installation.status, 'not-inspected');
  writeFileSync(resolve(plan.target_root, 'app.txt'), 'modified');
  assert.equal(planTask(save(), root, task).local_changes, true);
}));
test('reject main clone and reference role even for registered worktree', () => fixture((root, data, save) => {
  assert.throws(() => planTask(save(), root, {...task, worktree: 'repositories/frontend'}), /main working clone/);
  data.repositories[0].references.push('worktrees/task');
  assert.throws(() => planTask(save(), root, task), /Protected reference/);
}));
test('reject symlink escape, unknown fields, duplicate and missing repository IDs', () => fixture((root, data, save) => {
  data.unknown = true; assert.throws(save, /schema/); delete data.unknown;
  data.repositories.push(structuredClone(data.repositories[0])); assert.throws(save, /Duplicate/); data.repositories.pop();
  data.targets[0].repository_id = 'absent'; assert.throws(save, /Unknown repository/); data.targets[0].repository_id = 'frontend';
  symlinkSync('/tmp', resolve(root, 'outside')); data.repositories[0].references = ['outside']; assert.throws(save, /escapes/);
}));
test('release family requires concrete existing branch and valid value', () => fixture((root, data, save, git) => {
  assert.throws(() => planTask(save(), root, {...task, purpose: 'release'}), /concrete release/);
  assert.throws(() => planTask(save(), root, {...task, purpose: 'release', release: 'release-latest'}), /semver/);
  git('branch', 'release-1.2.3');
  assert.equal(planTask(save(), root, {...task, purpose: 'release', release: 'release-1.2.3'}).base_ref, 'release-1.2.3');
  data.repositories[0].release = {kind: 'date'};
  assert.throws(() => planTask(save(), root, {...task, purpose: 'release', release: 'release-2026-02-30'}), /valid release/);
}));
test('target must exist in chosen branch, not only in main clone', () => fixture((root, data, save) => {
  rmSync(resolve(root, 'worktrees/task/apps/web'), {recursive: true});
  assert.throws(() => planTask(save(), root, task));
}));
test('release-family branches cannot serve as task branches for any purpose', () => fixture((root, data, save, git) => {
  git('branch', 'release-1.0.0');
  git('branch', '-m', 'task/example', 'release-2.0.0');
  assert.throws(() => planTask(save(), root, task), /Task branch must differ/);
  assert.throws(() => planTask(save(), root, {...task, purpose:'release', release:'release-1.0.0'}), /Task branch must differ/);
  data.repositories[0].release = {kind:'date'};
  git('branch', '-m', 'release-2.0.0', 'release-2026-10-18');
  assert.throws(() => planTask(save(), root, task), /Task branch must differ/);
  git('branch', '-m', 'release-2026-10-18', 'task/release-2026-10-18-fix');
  assert.equal(planTask(save(), root, task).branch, 'task/release-2026-10-18-fix');
}));
test('foreign clone with same content is not a registered worktree', () => fixture((root, data, save) => {
  execFileSync('git', ['clone', resolve(root, 'repositories/frontend'), resolve(root, 'foreign')], {stdio: 'pipe'});
  assert.throws(() => planTask(save(), root, {...task, worktree: 'foreign'}), /another repository/);
}));
test('graphify enabled needs project procedure, required wt cannot be disabled', () => fixture((root, data, save) => {
  data.tools.graphify.enabled = true; assert.throws(save, /procedure/);
  writeFileSync(resolve(root, 'graph-procedure.md'), 'Inspect current worktree sources before querying graph.');
  data.tools.graphify.procedure = 'graph-procedure.md';
  const selected = planTask(save(), root, task);
  assert.equal(selected.graphify.graph.status, 'not-located');
  assert.equal(selected.graphify.freshness.status, 'unknown');
  data.tools.graphify.enabled = false; data.tools.worktrunk.required_for_tasks = true; assert.throws(save, /Worktrunk/);
}));
test('manifest must match its pinned commit and have no local changes', () => fixture((root, data, save, git) => {
  data.manifests = [{id: 'e2e', path: 'repositories/frontend', revision: 'a'.repeat(40)}];
  assert.throws(save, /revision mismatch/);
  data.manifests[0].revision = git('rev-parse', 'HEAD'); assert.ok(save());
  writeFileSync(resolve(root, 'repositories/frontend/apps/web/app.txt'), 'modified'); assert.throws(save, /local changes/);
}));

test('target introduced only in task worktree does not depend on main checkout layout', () => fixture((root, data, save) => {
  const created = resolve(root, 'worktrees/task/apps/new-app');
  mkdirSync(created, {recursive: true}); writeFileSync(resolve(created, 'app.txt'), 'new application');
  data.targets.push({id: 'new-app', repository_id: 'frontend', path: 'apps/new-app', manifests: []});
  // Another registered target may also be absent from this branch.
  data.targets.push({id: 'future', repository_id: 'frontend', path: 'apps/future', manifests: []});
  const project = save();
  assert.equal(planTask(project, root, {...task, target: 'new-app'}).target_root, created);
  assert.equal(planTask(project, root, task).target_id, 'web');
  assert.throws(() => planTask(project, root, {...task, target: 'future'}), /ENOENT/);
}));
test('deferred target resolution still rejects traversal, symlink escape and nested repositories', () => fixture((root, data, save) => {
  for (const path of ['../reference', '/tmp', 'apps/../web', 'apps\\web']) {
    data.targets[0].path = path; assert.throws(save, /relative path|schema/);
  }
  data.targets[0].path = 'apps/escape';
  symlinkSync(resolve(root, 'reference'), resolve(root, 'worktrees/task/apps/escape'));
  assert.throws(() => planTask(save(), root, task), /escapes/);
  const nested = resolve(root, 'worktrees/task/apps/nested'); mkdirSync(nested);
  execFileSync('git', ['init', '-q', nested], {stdio: 'pipe'});
  data.targets[0].path = 'apps/nested';
  assert.throws(() => planTask(save(), root, task), /unavailable in selected worktree/);
}));
