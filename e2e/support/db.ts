import { Client } from 'pg';
import { e2eEnv } from './env';

export async function setDrawInterval(code: string, ms: number): Promise<void> {
  if (!e2eEnv.databaseUrl) throw new Error('E2E_DATABASE_URL é obrigatório para encurtar o sorteio');
  const client = new Client({ connectionString: e2eEnv.databaseUrl });
  await client.connect();
  try {
    const { rowCount } = await client.query('UPDATE "Room" SET "drawIntervalMs" = $1 WHERE code = $2', [ms, code]);
    if (rowCount !== 1) throw new Error(`Sala ${code} não encontrada no banco de teste`);
  } finally {
    await client.end();
  }
}
