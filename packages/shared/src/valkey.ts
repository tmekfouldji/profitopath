import { Redis } from 'ioredis';

export function createValkeyClient(
  url: string,
  onError: (error: Error) => void = () => undefined,
): Redis {
  const client = new Redis(url, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  client.on('error', onError);
  return client;
}

export async function checkValkey(client: Redis): Promise<void> {
  if (client.status === 'wait') {
    await client.connect();
  }
  const response = await client.ping();
  if (response !== 'PONG') {
    throw new Error(`Unexpected Valkey response: ${response}`);
  }
}
