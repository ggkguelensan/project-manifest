import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
mkdirSync('e2e/tmp', { recursive: true });
const root = mkdtempSync(resolve('e2e/tmp/codex-selection-'));
const cwd = resolve(root, 'repository'); mkdirSync(cwd);
execFileSync('git', ['init', '-q', cwd]);
for (const name of ['selected', 'unselected']) {
  const dir = resolve(cwd, `.agents/skills/selection-probe-${name}`); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'SKILL.md'), `---\nname: selection-probe-${name}\ndescription: Local fixture ${name}; no model invocation.\n---\nSelection diagnostic only.\n`);
}
async function inspect(overrides: string[] = []) {
  const child = spawn('codex', [...overrides, 'app-server', '--stdio'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  const lines = createInterface({ input: child.stdout });
  const waiting = new Map<number, {resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  let id = 0;
  const fail = (error: Error) => { for (const item of waiting.values()) { clearTimeout(item.timer); item.reject(error); } waiting.clear(); };
  child.on('error', fail); child.on('exit', code => fail(new Error(`Codex exited: ${code}`)));
  lines.on('line', line => {
    let data; try { data = JSON.parse(line); } catch { return; }
    const item = waiting.get(data.id); if (!item) return;
    clearTimeout(item.timer); waiting.delete(data.id);
    if (data.error) item.reject(new Error(JSON.stringify(data.error))); else item.resolve(data.result);
  });
  const rpc = (method: string, params: unknown) => new Promise<any>((done, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { waiting.delete(key); reject(new Error(`Codex timeout: ${method}`)); }, 30000);
    waiting.set(key, {resolve: done, reject, timer});
    child.stdin.write(JSON.stringify({id: key, method, params}) + '\n');
  });
  try {
    await rpc('initialize', {clientInfo: {name: 'manifest-selection-probe', version: '0.1.0'}, capabilities: {experimentalApi: true}});
    child.stdin.write(JSON.stringify({method: 'initialized'}) + '\n');
    const response = await rpc('skills/list', {cwds: [cwd], forceReload: true});
    assert.equal(response.data.length, 1); assert.deepEqual(response.data[0].errors, []);
    return response.data[0].skills;
  } finally { child.kill('SIGTERM'); lines.close(); }
}
const before = await inspect();
const selected = before.find((s: any) => s.name === 'selection-probe-selected');
assert.ok(selected && selected.enabled !== false);
assert.ok(before.some((s: any) => s.name === 'selection-probe-unselected' && s.enabled !== false));
const disabled = before.filter((s: any) => s.path !== selected.path);
// Native process-local overrides, not persistent config or a skill registry.
const config = `skills.config=[${disabled.map((s: any) => `{path=${JSON.stringify(s.path)},enabled=false}`).join(',')}]`;
const overrides = ['-c', config];
const after = await inspect(overrides);
const enabled = after.filter((s: any) => s.enabled !== false).map((s: any) => s.name);
assert.deepEqual(enabled, ['selection-probe-selected']);
assert.ok(after.some((s: any) => s.name === 'selection-probe-unselected' && s.enabled === false));
const proof = { version: execFileSync('codex', ['--version'], {encoding: 'utf8'}).trim(), cwd, arguments: overrides, before: before.map((s: any) => ({name:s.name,path:s.path,enabled:s.enabled})), after: after.map((s: any) => ({name:s.name,path:s.path,enabled:s.enabled})), model_calls: 0, limitations: ['Native skills/list enabled inventory only; disabled entries still returned diagnostically.', 'No prompt/body/tool/MCP/plugin activation inspection or model execution.', 'Snapshot of discovered paths: newly installed or changed skills require a new discovery and validation.', 'Process-local overrides only; mandatory policy is not bypassed.'] };
writeFileSync(resolve(root, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({root,version:proof.version,before_enabled:before.filter((s:any)=>s.enabled!==false).length,after_enabled:enabled,model_calls:0}, null, 2));
