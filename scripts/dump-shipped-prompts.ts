/** Write each shipped v8 specialist prompt to a file so the A/B harness can run
 *  exactly what production sends, rather than a hand-copied approximation. */
import { mkdir, writeFile } from 'node:fs/promises';
import { assessmentPipelineV8Prompts } from '../src/lib/writing-assessment-pipeline-v2';

async function main() {
  const outDir = process.argv[2] || 'tmp/ab/shipped';
  await mkdir(outDir, { recursive: true });
  for (const [name, prompt] of Object.entries(assessmentPipelineV8Prompts)) {
    await writeFile(`${outDir}/${name}.txt`, prompt, 'utf8');
    console.log(`${name.padEnd(18)} ${String(prompt.length).padStart(6)} chars`);
  }
}

main();
