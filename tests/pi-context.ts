// Inspect the installed native SDK; never prompt a model or execute a skill.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const packageRoot = process.argv[2];
assert.ok(packageRoot, 'Usage: npm run test:pi-context -- <installed Pi package directory>');
const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
assert.equal(pkg.name, '@earendil-works/pi-coding-agent');
const sdk = await import(pathToFileURL(resolve(packageRoot, 'dist/index.js')).href);
const { DefaultResourceLoader, SettingsManager, SessionManager, AuthStorage, ModelRegistry, createAgentSession } = sdk;
const scratch = resolve('e2e/tmp'); mkdirSync(scratch, { recursive: true });
const root = mkdtempSync(resolve(scratch, 'pi-context-'));
const cwd = resolve(root, 'repository/apps/selected');
const agentDir = resolve(root, 'agent');
const selected = resolve(root, 'selected-skill');
for (const dir of [cwd, agentDir, selected, resolve(cwd, '.pi')]) mkdirSync(dir, { recursive: true });
execFileSync('git', ['init', '-q', resolve(root, 'repository')]);
const entry = resolve(cwd, 'AGENTS.md');
writeFileSync(entry, 'SELECTED_TARGET_INSTRUCTIONS: inspect only the assigned target.\n');
writeFileSync(resolve(root, 'repository/AGENTS.md'), 'UNSELECTED_PARENT_INSTRUCTIONS\n');
writeFileSync(resolve(agentDir, 'AGENTS.md'), 'UNSELECTED_GLOBAL_INSTRUCTIONS\n');
writeFileSync(resolve(agentDir, 'SYSTEM.md'), 'UNSELECTED_SYSTEM_PROMPT\n');
writeFileSync(resolve(agentDir, 'APPEND_SYSTEM.md'), 'UNSELECTED_APPEND_PROMPT\n');
writeFileSync(resolve(selected, 'SKILL.md'), '---\nname: selected-context-probe\ndescription: Selected metadata for the context probe.\n---\nSELECTED_BODY_NOT_AUTOLOADED\n');
for (const dir of [resolve(agentDir, 'skills/other'), resolve(cwd, '.pi/skills/other')]) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'SKILL.md'), '---\nname: unselected-context-probe\ndescription: UNSELECTED_SKILL_METADATA\n---\nUNSELECTED_SKILL_BODY\n');
}
const settingsManager = SettingsManager.inMemory();
const common = { cwd, agentDir, settingsManager, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, additionalSkillPaths: [selected] };
// Negative control: noContextFiles alone does not suppress SYSTEM/APPEND_SYSTEM.
const discovery = new DefaultResourceLoader(common);
await discovery.reload();
assert.match(discovery.getSystemPrompt(), /UNSELECTED_SYSTEM_PROMPT/);
assert.match(discovery.getAppendSystemPrompt().join('\n'), /UNSELECTED_APPEND_PROMPT/);
const loader = new DefaultResourceLoader({ ...common, systemPrompt: '', appendSystemPrompt: [entry] });
await loader.reload();
assert.deepEqual(loader.getSkills().skills.map((s: any) => s.name), ['selected-context-probe']);
assert.deepEqual(loader.getAgentsFiles().agentsFiles, []);
assert.equal(loader.getExtensions().extensions.length, 0);
assert.equal(loader.getPrompts().prompts.length, 0);
const authStorage = AuthStorage.inMemory();
const modelRegistry = ModelRegistry.inMemory(authStorage);
const { session } = await createAgentSession({ cwd, agentDir, settingsManager, resourceLoader: loader, authStorage, modelRegistry, model: modelRegistry.getAll()[0], sessionManager: SessionManager.inMemory(cwd), tools: ['read'] });
try {
  const prompt = session.systemPrompt;
  assert.match(prompt, /SELECTED_TARGET_INSTRUCTIONS/);
  assert.match(prompt, /selected-context-probe/);
  assert.match(prompt, /Selected metadata for the context probe/);
  assert.ok(!prompt.includes('SELECTED_BODY_NOT_AUTOLOADED'), 'Skill body must remain deferred');
  assert.ok(!prompt.includes('UNSELECTED_'), 'Unselected instructions/skills must be absent');
  assert.deepEqual(session.getActiveToolNames(), ['read']);
  assert.equal(session.messages.length, 0);
  const proof = { version: pkg.version, kind: 'native-sdk-prepared-context', cwd, skill_metadata: ['selected-context-probe'], instruction_files: [entry], full_skill_body_loaded: false, tools: session.getActiveToolNames(), model_calls: 0, negative_control: 'noContextFiles alone still loads SYSTEM.md and APPEND_SYSTEM.md', prompt_sha256: createHash('sha256').update(prompt).digest('hex'), limitations: ['SDK construction, not CLI prompt equivalence or model execution.', 'Explicit fixture settings and agent directory; no claim about user configuration.', 'Read capability is not a filesystem sandbox.'] };
  writeFileSync(resolve(root, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ root, ...proof }, null, 2));
} finally { session.dispose(); }
