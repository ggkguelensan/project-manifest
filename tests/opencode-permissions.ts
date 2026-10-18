import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('e2e/tmp', {recursive:true});
const root = mkdtempSync(resolve('e2e/tmp/opencode-permissions-'));
execFileSync('git', ['init', '-q', root]);
for (const name of ['selected', 'denied']) {
  const path = resolve(root, `.agents/skills/probe-${name}`); mkdirSync(path, {recursive:true});
  writeFileSync(resolve(path,'SKILL.md'), `---\nname: probe-${name}\ndescription: Local ${name} permission fixture.\n---\nBODY_${name}\n`);
}
const config = (skill: Record<string,string>) => writeFileSync(resolve(root,'opencode.json'), JSON.stringify({permission:{skill}},null,2));
const invoke = (name: string) => {
  const args = ['--pure','debug','agent','build','--tool','skill','--params',JSON.stringify({name:`probe-${name}`})];
  const result = spawnSync('opencode',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  assert.ifError(result.error);
  return {arguments:args,status:result.status,stdout:result.stdout,stderr:result.stderr};
};
// Positive control: denied fixture exists and is loadable before its permission changes.
config({'*':'deny','probe-selected':'allow','probe-denied':'allow'});
const baseline=invoke('denied'); assert.equal(baseline.status,0);
assert.match(JSON.parse(baseline.stdout).result.output,/BODY_denied/);
config({'*':'deny','probe-selected':'allow'});
const selected=invoke('selected'); assert.equal(selected.status,0);
const loaded=JSON.parse(selected.stdout); assert.equal(loaded.result.metadata.name,'probe-selected');
assert.match(loaded.result.output,/BODY_selected/);
const denied=invoke('denied'); assert.notEqual(denied.status,0);
assert.match(denied.stderr,/rule which prevents you from using this specific tool call/);
assert.ok(!denied.stdout.includes('BODY_denied'));
const proof={version:execFileSync('opencode',['--version'],{encoding:'utf8'}).trim(),root,agent:'build',config:'opencode.json',checks:['fixture load succeeds when allowed','selected skill body loads after default deny','known unselected skill load rejected by permission'],observations:{baseline,selected,denied},model_calls:0,limitations:['Native debug tool invocation, not a model-facing metadata or full prompt inspection.','External plugins disabled with --pure; other inherited resources are not proven absent.','Loading SKILL.md does not execute its procedure or prove filesystem isolation.']};
writeFileSync(resolve(root,'proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({root,version:proof.version,checks:proof.checks,model_calls:0},null,2));
