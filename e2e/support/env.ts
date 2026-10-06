export const e2eEnv = {
  baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
  /** Postgres do back de teste; só os testes de jogo completo precisam (encurtar o sorteio). */
  databaseUrl: process.env.E2E_DATABASE_URL,
};
