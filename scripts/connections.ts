import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localPath, planTask, readProject } from './project.ts';

export function validateConnections(file: string, root: string, options: Parameters<typeof planTask>[2], adaptations: Record<string, string>) {
  const project = readProject(file, root);
  const selection = planTask(project, root, options);
  const selected = selection.manifests.map(manifest => manifest!.id);
  if (Object.keys(adaptations).some(id => !selected.includes(id))) throw new Error('Adaptation provided for an unselected manifest');
  const domains: Record<string, unknown> = {};
  for (const manifest of selection.manifests) {
    if (!manifest || !adaptations[manifest.id]) throw new Error(`Missing selected adaptation: ${manifest?.id}`);
    const base = localPath(root, manifest.path), directory = localPath(root, adaptations[manifest.id]);
    const args = manifest.id === 'e2e'
      ? ['--adaptation', directory, '--base', base, '--target', selection.target_root, '--scope', '.']
      : [directory, base, selection.target_root, selection.repository_id, selection.target_id];
    // Execute only the explicitly registered, clean, pinned owner checkout.
    const data = JSON.parse(execFileSync(process.execPath, [resolve(base, 'scripts/adaptation.ts'), ...args], { cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
    const identity = manifest.id === 'e2e' ? data.manifest : data;
    if (identity?.repository_id !== selection.repository_id || identity?.target_id !== selection.target_id) throw new Error(`Adaptation identity mismatch: ${manifest.id}`);
    domains[manifest.id] = { base_revision: manifest.revision, directory, result: data };
  }
  return { selection, domains, limitation: 'Owner validation does not install skills, activate tools or prove cross-domain free-text compatibility.' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), values: Record<string,string> = {};
    const allowed = new Set(['--project','--root','--target','--worktree','--purpose','--release','--e2e','--design']);
    if (args.length % 2) throw new Error('Options require values');
    for(let i=0;i<args.length;i+=2) {
      if(!allowed.has(args[i]) || values[args[i]]) throw new Error(`Unknown or duplicate option: ${args[i]}`);
      values[args[i]]=args[i+1];
    }
    if (!values['--project'] || !values['--root'] || !values['--target'] || !values['--worktree'] || !['development','release'].includes(values['--purpose'])) throw new Error('Require --project --root --target --worktree --purpose; provide selected --e2e/--design adaptation paths relative to project root');
    const adaptations = Object.fromEntries(['e2e','design'].filter(id=>values[`--${id}`]).map(id=>[id,values[`--${id}`]]));
    console.log(JSON.stringify(validateConnections(values['--project'], values['--root'], {target:values['--target'],worktree:values['--worktree'],purpose:values['--purpose'] as 'development'|'release',release:values['--release']}, adaptations),null,2));
  } catch(error) { console.error(error instanceof Error ? error.message : error); process.exitCode=1; }
}
