import { inspectGraph } from './graph.ts';
import Ajv2020 from 'ajv/dist/2020.js';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

type Repository = { id: string; path: string; references: string[]; development: string; release: { kind: 'fixed'; name: string } | { kind: 'date' | 'semver' } };
type Project = { schema_version: 1; project_id: string; repositories: Repository[]; targets: {id: string; repository_id: string; path: string; manifests: string[]}[]; tools: { worktrunk: {enabled: boolean; required_for_tasks: boolean; config: string | null}; graphify: {enabled: boolean; procedure: string | null} }; manifests: {id: string; path: string; revision: string}[] };
const schema = JSON.parse(readFileSync(new URL('../schemas/project.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv2020({allErrors: true, strict: true}).compile(schema);
function requireThat(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function unique(values: string[], label: string) { requireThat(new Set(values).size === values.length, `Duplicate ${label}`); }
function within(root: string, path: string) { const rel = relative(root, path); return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel); }
export function localPath(root: string, path: string) {
  requireThat(!isAbsolute(path) && !path.includes('\\') && !path.includes(':') && !path.split('/').includes('..'), `Invalid relative path: ${path}`);
  const result = realpathSync(resolve(root, path));
  requireThat(within(realpathSync(root), result), `Path escapes selected root: ${path}`);
  return result;
}
function git(root: string, ...args: string[]) { return execFileSync('git', ['--no-optional-locks', '-C', root, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim(); }
function gitRoot(root: string) { return realpathSync(git(root, 'rev-parse', '--show-toplevel')); }
function commonGit(root: string) { return realpathSync(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir')); }
export function readProject(file: string, projectRoot: string): Project {
  const project: Project = JSON.parse(readFileSync(file, 'utf8'));
  requireThat(validate(project), `Project schema: ${JSON.stringify(validate.errors)}`);
  unique(project.repositories.map(r => r.id), 'repository ID');
  unique(project.targets.map(t => t.id), 'target ID');
  unique(project.manifests.map(m => m.id), 'manifest ID');
  const repositoryPaths = project.repositories.map(repo => {
    const path = localPath(projectRoot, repo.path);
    requireThat(gitRoot(path) === path, `Repository path must be its Git root: ${repo.id}`);
    git(path, 'check-ref-format', '--branch', repo.development);
    if (repo.release.kind === 'fixed') git(path, 'check-ref-format', '--branch', repo.release.name);
    return path;
  });
  unique(repositoryPaths, 'physical repository path');
  const references = project.repositories.flatMap(repo => repo.references.map(p => localPath(projectRoot, p)));
  for (const path of repositoryPaths) requireThat(!references.some(ref => within(ref, path)), 'Working clone is inside a protected reference');
  for (const target of project.targets) {
    const repository = project.repositories.find(repo => repo.id === target.repository_id);
    requireThat(repository, `Unknown repository: ${target.repository_id}`);
    const repoRoot = localPath(projectRoot, repository.path);
    const targetPath = localPath(repoRoot, target.path);
    requireThat(statSync(targetPath).isDirectory() && gitRoot(targetPath) === repoRoot, `Target crosses repository boundary: ${target.id}`);
    for (const id of target.manifests) requireThat(project.manifests.some(m => m.id === id), `Unknown manifest: ${id}`);
  }
  for (const manifest of project.manifests) {
    const path = localPath(projectRoot, manifest.path);
    requireThat(gitRoot(path) === path && git(path, 'rev-parse', 'HEAD') === manifest.revision, `Manifest revision mismatch: ${manifest.id}`);
    requireThat(git(path, 'status', '--porcelain', '--untracked-files=normal') === '', `Manifest has local changes: ${manifest.id}`);
  }
  const wt = project.tools.worktrunk;
  requireThat(!wt.required_for_tasks || wt.enabled, 'Required Worktrunk must be enabled');
  if (wt.config) requireThat(statSync(localPath(projectRoot, wt.config)).isFile(), 'Worktrunk config must be a file');
  if (project.tools.graphify.enabled) requireThat(project.tools.graphify.procedure, 'Graphify requires a project procedure');
  if (project.tools.graphify.procedure) requireThat(statSync(localPath(projectRoot, project.tools.graphify.procedure)).isFile(), 'Graphify procedure must be a file');
  return project;
}

export function planTask(project: Project, projectRoot: string, options: { target: string; worktree: string; purpose: 'development' | 'release'; release?: string }) {
  const target = project.targets.find(t => t.id === options.target);
  requireThat(target, `Unknown target: ${options.target}`);
  const repo = project.repositories.find(r => r.id === target.repository_id)!;
  const root = localPath(projectRoot, repo.path);
  const worktree = localPath(projectRoot, options.worktree);
  for (const repository of project.repositories) for (const ref of repository.references) requireThat(!within(localPath(projectRoot, ref), worktree), 'Protected reference checkout cannot be used for task work');
  requireThat(worktree !== root, 'Select a task worktree, not the main working clone');
  requireThat(gitRoot(worktree) === worktree && commonGit(worktree) === commonGit(root), 'Worktree belongs to another repository');
  const registered = git(root, 'worktree', 'list', '--porcelain').split('\n').filter(l => l.startsWith('worktree ')).map(l => l.slice(9));
  requireThat(registered.some(p => existsSync(p) && realpathSync(p) === worktree), 'Worktree is not registered');
  const targetRoot = localPath(worktree, target.path);
  requireThat(gitRoot(targetRoot) === worktree && statSync(targetRoot).isDirectory(), 'Target is unavailable in selected worktree');
  const branch = git(worktree, 'branch', '--show-current');
  requireThat(branch, 'Task worktree must have a branch');
  let base = repo.development;
  if (options.purpose === 'release') {
    if (repo.release.kind === 'fixed') base = repo.release.name;
    else {
      requireThat(options.release, 'Select a concrete release branch; a family is not an active release');
      base = options.release;
      if (repo.release.kind === 'semver') requireThat(/^release-(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(base), 'Expected release-<semver> (three numeric components)');
      else {
        const value = base.replace(/^release-/, '');
        requireThat(/^release-\d{4}-\d{2}-\d{2}$/.test(base) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Expected valid release-YYYY-MM-DD');
      }
    }
  }
  requireThat(branch !== repo.development && !(repo.release.kind === 'fixed' && branch === repo.release.name) && branch !== base, 'Task branch must differ from development/release branch');
  const baseCommit = git(root, 'rev-parse', '--verify', `refs/heads/${base}^{commit}`);
  const wt = project.tools.worktrunk;
  let wtVersion: string | null = null;
  if (wt.enabled) {
    try { wtVersion = execFileSync('wt', ['--version'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim(); }
    catch { requireThat(!wt.required_for_tasks, 'Required wt is unavailable'); }
  }
  return {
    schema_version: 1, project_id: project.project_id, repository_id: repo.id, target_id: target.id,
    worktree, target_root: targetRoot, branch, revision: git(worktree, 'rev-parse', 'HEAD'),
    local_changes: git(worktree, 'status', '--porcelain') !== '', base_ref: base, base_commit: baseCommit,
    base_observation: 'local branch only; no fetch performed; not proof of original branch creation',
    worktrunk: {version: wtVersion, config: wt.config ? localPath(projectRoot, wt.config) : null},
    manifests: target.manifests.map(id => project.manifests.find(m => m.id === id)),
    graphify: project.tools.graphify.enabled
      ? {enabled: true, procedure: project.tools.graphify.procedure, ...inspectGraph(worktree, null)}
      : {enabled: false, installation: {status: 'not-inspected'}, graph: {status: 'not-inspected'}, freshness: {status: 'not-inspected'}},
    context: 'Selection only: native skill discovery and global tools must be checked before a new harness session',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const allowed = new Set(['--project', '--root', '--target', '--worktree', '--purpose', '--release']);
    requireThat(args.length % 2 === 0, 'Arguments require values');
    const values: Record<string, string> = {};
    for (let i = 0; i < args.length; i += 2) { requireThat(allowed.has(args[i]) && !values[args[i]], `Unknown or duplicate option: ${args[i]}`); values[args[i]] = args[i + 1]; }
    requireThat(values['--project'] && values['--root'], 'Usage: --project <json> --root <project root> [--target <id> --worktree <relative path> --purpose development|release --release <branch>]');
    const project = readProject(values['--project'], values['--root']);
    if (values['--target']) {
      requireThat(values['--worktree'] && ['development', 'release'].includes(values['--purpose']), 'Target requires worktree and explicit purpose');
      console.log(JSON.stringify(planTask(project, values['--root'], {target: values['--target'], worktree: values['--worktree'], purpose: values['--purpose'] as 'development' | 'release', release: values['--release']}), null, 2));
    } else {
      requireThat(!values['--worktree'] && !values['--purpose'] && !values['--release'], 'Task options require target');
      console.log(JSON.stringify({valid: true, project_id: project.project_id}));
    }
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
