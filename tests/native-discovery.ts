import { inspectPi } from './helpers/pi-discovery.ts';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync, openSync, closeSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
const scratch = resolve('e2e/tmp'); mkdirSync(scratch, { recursive: true });
const root = mkdtempSync(resolve(scratch, 'native-discovery-'));
const repo = resolve(root, 'repository'); mkdirSync(repo);
execFileSync('git', ['init', '-q', repo]);
const targets = ['mobile', 'design'].map(name => {
  const skill = resolve(root, `sources/${name}`), target = resolve(repo, `apps/${name}`);
  mkdirSync(skill, { recursive: true }); mkdirSync(resolve(target, '.agents/skills'), { recursive: true });
  writeFileSync(resolve(skill, 'SKILL.md'), `---\nname: pm-probe-${name}\ndescription: Local discovery fixture for ${name}; no model execution required.\n---\nFixture content.\n`);
  symlinkSync(skill, resolve(target, `.agents/skills/pm-probe-${name}`));
  return target;
});
const child = spawn('codex', ['app-server', '--stdio'], { cwd: repo, stdio: ['pipe', 'pipe', 'pipe'] });
child.stderr.resume();
const waiting = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  let message; try { message = JSON.parse(line); } catch { return; }
  const request = waiting.get(message.id); if (!request) return;
  clearTimeout(request.timer); waiting.delete(message.id);
  if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
});
child.on('exit', code => { for (const req of waiting.values()) { clearTimeout(req.timer); req.reject(new Error(`app-server exited ${code}`)); } waiting.clear(); });
let id = 0;
function rpc(method: string, params: unknown) {
  return new Promise<any>((done, reject) => {
    const key = ++id; const timer = setTimeout(() => { waiting.delete(key); reject(new Error(`Timeout: ${method}`)); }, 30000);
    waiting.set(key, { resolve: done, reject, timer }); child.stdin.write(JSON.stringify({ id: key, method, params }) + '\n');
  });
}
try {
  const initialized = await rpc('initialize', { clientInfo: { name: 'manifest-discovery-check', version: '0.1.0' }, capabilities: { experimentalApi: true } });
  child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const result = await rpc('skills/list', { cwds: targets, forceReload: true });
  const checked = result.data.map((entry: any, index: number) => {
    assert.deepEqual(entry.errors, []);
    const visible = entry.skills.filter((s: any) => s.enabled !== false).map((s: any) => s.name);
    assert.ok(visible.includes(`pm-probe-${index === 0 ? 'mobile' : 'design'}`));
    assert.ok(!visible.includes(`pm-probe-${index === 0 ? 'design' : 'mobile'}`));
    return { cwd: entry.cwd, enabled: visible, scope: 'Native discovery; no model turn, full instruction loading or tool activation tested.' };
  });
  assert.equal(checked.length, 2);
  const output = { version: execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim(), initialized, checked };
  writeFileSync(resolve(root, 'codex-discovery.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ root, version: output.version, checks: checked.map((x: any) => ({ cwd: x.cwd, probe_skills: x.enabled.filter((n: string) => n.startsWith('pm-probe-')), inherited_count: x.enabled.filter((n: string) => !n.startsWith('pm-probe-')).length })) }, null, 2));
} finally { child.kill('SIGTERM'); lines.close(); }

const openCode = targets.map((cwd, index) => {
  const output = resolve(root, `opencode-${index}.json`);
  const fd = openSync(output, 'w');
  try { execFileSync('opencode', ['--pure', 'debug', 'skill'], { cwd, stdio: ['ignore', fd, 'pipe'], timeout: 30000 }); } finally { closeSync(fd); }
  const skills = JSON.parse(readFileSync(output, 'utf8'));
  const names = skills.map((s: any) => s.name);
  assert.ok(names.includes(`pm-probe-${index === 0 ? 'mobile' : 'design'}`));
  assert.ok(!names.includes(`pm-probe-${index === 0 ? 'design' : 'mobile'}`));
  return { cwd, discovered: names, limitation: 'Discovery only; debug skill does not prove model-facing permission filtering.' };
});
writeFileSync(resolve(root, 'opencode-discovery.json'), JSON.stringify({ version: execFileSync('opencode', ['--version'], { encoding: 'utf8' }).trim(), checked: openCode }, null, 2));
const piResult = await inspectPi(targets[0], [{ name: 'pm-probe-mobile', path: resolve(root, 'sources/mobile') }]);
writeFileSync(resolve(root, 'pi-discovery.json'), JSON.stringify(piResult, null, 2));
console.log(JSON.stringify({ root, opencode: 'sibling exclusion verified; inherited skills remain', pi: piResult.skills, model_calls: 0 }));
