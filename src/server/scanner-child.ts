import { scan } from '../scanner/index.ts';

// Only the isolated parser receives the artifact path. No database, signing or OAuth credentials.
async function main() {
try {
  const target=process.argv[2];
  if(!target)throw new Error('Missing artifact.');
  const report=await scan(target,{timeoutMs:90_000});
  process.stdout.write(JSON.stringify(report));
} catch {
  process.stderr.write('Artifact processing failed.');
  process.exitCode=1;
}
}
void main();
