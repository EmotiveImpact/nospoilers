import { scan } from '../scanner/index.ts';
import {writeFile} from 'node:fs/promises';

// Only the isolated parser receives the artifact path. No database, signing or OAuth credentials.
async function main() {
try {
  const target=process.argv[2];
  if(!target)throw new Error('Missing artifact.');
  const report=await scan(target,{timeoutMs:90_000});
  const serialized=JSON.stringify(report);
  const output=process.argv[3];
  if(output)await writeFile(output,serialized,{mode:0o600});
  else process.stdout.write(serialized);
} catch {
  process.stderr.write('Artifact processing failed.');
  process.exitCode=1;
}
}
void main();
