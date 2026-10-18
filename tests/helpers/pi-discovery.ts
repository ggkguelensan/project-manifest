import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { realpathSync } from 'node:fs';

/** Diagnostic native discovery only: never sends a prompt or runs a skill. */
export async function inspectPi(cwd: string, selected: { name: string; path: string }[]) {
  assert.ok(selected.length, 'Explicit skill selection required');
  assert.equal(new Set(selected.map(s => s.name)).size, selected.length, 'Duplicate skill names');
  const args = ['--offline', '--no-session', '--no-tools', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files', ...selected.flatMap(s => ['--skill', realpathSync(s.path)]), '--mode', 'rpc', '--approve'];
  const child = spawn('pi', args, { cwd: realpathSync(cwd), stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  const lines = createInterface({ input: child.stdout });
  try {
    const response: any = await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(new Error('Pi command discovery timeout')), 30000);
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('exit', code => { clearTimeout(timer); reject(new Error(`Pi exited ${code}`)); });
      lines.on('line', line => {
        let data; try { data = JSON.parse(line); } catch { return; }
        if (data.command !== 'get_commands' || data.id !== 'probe') return;
        clearTimeout(timer); done(data);
      });
      child.stdin.write(JSON.stringify({ type: 'get_commands', id: 'probe' }) + '\n');
    });
    assert.equal(response.success, true);
    const skills = response.data.commands.filter((c: any) => c.source === 'skill').map((c: any) => c.name).sort();
    assert.deepEqual(skills, selected.map(s => `skill:${s.name}`).sort(), 'Native discovery must equal explicit selection');
    return { version: execFileSync('pi', ['--version'], { encoding: 'utf8' }).trim(), cwd: realpathSync(cwd), arguments: args, skills, model_calls: 0, limitation: 'Registered commands only; full prompt, instruction loading and skill execution not tested. Context files disabled in this diagnostic.' };
  } finally { child.kill('SIGTERM'); lines.close(); }
}
