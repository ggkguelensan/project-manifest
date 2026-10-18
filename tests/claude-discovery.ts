import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
mkdirSync('e2e/tmp', { recursive: true });
const root = mkdtempSync(resolve('e2e/tmp/claude-discovery-'));
const repo = resolve(root, 'repository'); mkdirSync(repo);
execFileSync('git', ['init', '-q', repo]);
for (const name of ['selected', 'sibling']) {
  const skill = resolve(repo, `apps/${name}/.claude/skills/probe-${name}`);
  mkdirSync(skill, { recursive: true });
  writeFileSync(resolve(skill, 'SKILL.md'), `---\nname: probe-${name}\ndescription: Discovery fixture ${name}.\n---\nDo not execute: native discovery probe only.\n`);
}
const config = resolve(root, 'config'); mkdirSync(config);
const args = ['--print', '--verbose', '--input-format', 'stream-json', '--output-format', 'stream-json', '--no-session-persistence', '--settings', '{"disableAllHooks":true}', '--setting-sources', 'project', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--tools', ''];
async function inspect(name: string) {
const cwd = resolve(repo, `apps/${name}`);
const child = spawn('claude', args, { cwd, env: { ...process.env, CLAUDE_CONFIG_DIR: config }, stdio: ['pipe', 'pipe', 'pipe'] });
child.stderr.resume();
const lines = createInterface({ input: child.stdout });
try {
  const result: any = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('Claude initialization timeout')), 30000);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Claude exited before initialization: ${code}`)); });
    lines.on('line', line => {
      let data; try { data = JSON.parse(line); } catch { return; }
      if (data.type !== 'control_response' || data.response?.request_id !== 'discovery') return;
      clearTimeout(timer); done(data.response);
    });
    // Only native initialization; never send a user message or prompt.
    child.stdin.write(JSON.stringify({ type: 'control_request', request_id: 'discovery', request: { subtype: 'initialize', hooks: null } }) + '\n');
  });
  assert.equal(result.subtype, 'success');
  const commands = result.response.commands;
  const custom = commands.filter((c: any) => !c.builtin).map((c: any) => c.name);
  assert.deepEqual(custom, [`probe-${name}`], 'Custom command discovery must equal this target selection');
  return { cwd, custom_commands: custom, builtin_commands: commands.filter((c: any) => c.builtin).map((c: any) => c.name) };
} finally { child.kill('SIGTERM'); lines.close(); }

}
const checked = [await inspect('selected'), await inspect('sibling')];
const proof = { version: execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim(), arguments: args, config_directory: config, checked, model_calls: 0, limitations: ['Native initialize command inventory only; full model-facing prompt and tool activation not inspected.', 'Isolated fixture config directory and project settings; built-in commands remain visible.', 'No CLAUDE.md loading, skill body execution, managed-policy override or provider request claimed.'] };
writeFileSync(resolve(root, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ root, version: proof.version, checked: checked.map(({cwd, custom_commands, builtin_commands}) => ({ cwd, custom_commands, builtin_count: builtin_commands.length })), model_calls: 0 }, null, 2));
