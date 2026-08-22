import { checkDatabase } from '@profitopath/database';
import {
  checkValkey,
  createValkeyClient,
  parseRuntimeEnv,
  runReadinessChecks,
} from '@profitopath/shared';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const env = parseRuntimeEnv();
  const valkey = createValkeyClient(env.VALKEY_URL);
  const report = await runReadinessChecks({
    database: checkDatabase,
    valkey: () => checkValkey(valkey),
  });
  valkey.disconnect();

  return Response.json(report, { status: report.status === 'ok' ? 200 : 503 });
}
