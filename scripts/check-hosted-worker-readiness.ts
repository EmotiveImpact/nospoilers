import {databaseMode,loadConfig} from '../src/server/config.ts';
import {assertHostedWorkerReady} from '../src/server/hosted-worker-readiness.ts';

const config=loadConfig();
try {
 await assertHostedWorkerReady(config);
 process.stdout.write(`${JSON.stringify({
  ok:true,
  role:config.processRole,
  database:databaseMode(config.databaseUrl),
  scanner:'worker-local-container',
  notification:process.env.NOSPOILERS_HOSTED_NOTIFICATION_PROVIDER,
 })}\n`);
} catch(error) {
 process.stderr.write(`${error instanceof Error?error.message:'Hosted worker readiness failed.'}\n`);
 process.exitCode=1;
}
