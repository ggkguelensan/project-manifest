import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Test transport only: observe native session_start, then exit without a model turn. */
export function observePiCli(cwd: string, args: string[], agentDir: string, output: string) {
  mkdirSync(output, {recursive: true});
  const extension = resolve(output, 'observe.ts'), file = resolve(output, 'observation.json');
  writeFileSync(extension, `import { writeFileSync } from 'node:fs';
export default function(pi) {
  pi.on('session_start', async (_event, ctx) => {
    writeFileSync(process.env.MANIFEST_PI_PROOF, JSON.stringify({ prompt: ctx.getSystemPrompt(), tools: pi.getActiveTools(), cwd: ctx.cwd }));
    ctx.shutdown();
  });
}
`);
  execFileSync('pi', [...args, '--extension', extension], {cwd, input: '', encoding:'utf8', stdio:['pipe','pipe','pipe'], timeout:30000, env:{...process.env, PI_CODING_AGENT_DIR:agentDir, MANIFEST_PI_PROOF:file}});
  return JSON.parse(readFileSync(file,'utf8'));
}
